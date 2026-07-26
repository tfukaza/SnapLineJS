import type {
  ConnectorMirror,
  ConnectorConnectionEvent,
  ConnectorDisconnectionEvent,
} from "./connector";
import type { NodeMirror } from "./node";
import type { LineMirror } from "./line";

/** Stable application-facing identity of a canonical node. */
export type NodeId = string;
/** Stable application-facing identity of a canonical connector (graph-global). */
export type ConnectorId = string;
/** Stable application-facing identity of a canonical line. */
export type LineId = string;

/**
 * Structured, non-throwing report of a graph state the mirror cannot
 * represent. Derived state: entries drop out when their cause resolves.
 */
export interface ReconciliationError {
  code:
    | "duplicate-id"
    | "missing-node"
    | "missing-connector"
    | "capacity-exceeded"
    | "connection-rejected"
    | "identity-changed"
    | "unrepresentable-line";
  lineId?: LineId;
  nodeId?: NodeId;
  connectorId?: ConnectorId;
  message: string;
  cause?: unknown;
}

// Structural stand-in for EdgeSyncController so the registry (and the emit
// sites that reach it) never value-import edge-sync — edge-sync imports the
// registry accessor, not the reverse. Replaced by the LineReconciler contract
// when the controlled line protocol lands.
export interface EdgeSyncLike {
  notifyConnect(event: ConnectorConnectionEvent): void;
  notifyDisconnect(event: ConnectorDisconnectionEvent): void;
  /** Connector membership changed — reconcile so document lines whose
   * endpoints just mounted (or unmounted) converge. */
  connectorRegistered?(): void;
}

/** Mint a domain ID for a mirror created without an application-supplied id. */
export function mintDomainId(
  kind: "node" | "connector" | "line",
  global: { createId(): string },
): string {
  return `${kind}-${global.createId()}`;
}

// Engine-scoped registry of every live SnapLine runtime mirror — the mirror
// of the whole graph (nodes, connectors, settled lines, previews).
//
// Created lazily by `getGraphMirror(engine)` the first time any SnapLine
// mirror registers, so it exists exactly when SnapLine is in use — no adapter
// wiring required, vanilla consumers included. Mirrors register in their
// constructors and unregister in `destroy()`.
//
// Domain-identity indexes follow a first-registration-wins policy: a
// duplicate ID is never silently allowed to steal the index entry; it stays
// unindexed and is reported through `diagnostics()` until the conflict
// resolves (either mirror unregisters).
export class GraphMirror {
  readonly engine: unknown;
  #nodes = new Set<NodeMirror>();
  #connectors = new Set<ConnectorMirror>();
  #nodesById = new Map<NodeId, NodeMirror>();
  #connectorsById = new Map<ConnectorId, ConnectorMirror>();
  #linesById = new Map<LineId, LineMirror>();
  #previewLines = new Set<LineMirror>();
  #duplicateErrors = new Map<object, ReconciliationError>();

  // Engine-scoped controlled-lines reconciler. Registered by
  // EdgeSyncController's constructor; the connector emit sites forward
  // connection events through it.
  edgeSync: EdgeSyncLike | null = null;

  constructor(engine: unknown) {
    this.engine = engine;
  }

  registerNode(node: NodeMirror): void {
    this.#nodes.add(node);
    this.#index(this.#nodesById, node.nodeId, node, { nodeId: node.nodeId });
  }

  unregisterNode(node: NodeMirror): void {
    this.#nodes.delete(node);
    this.#unindex(this.#nodesById, node.nodeId, node, this.#nodes, (n) => n.nodeId);
  }

  registerConnector(connector: ConnectorMirror): void {
    this.#connectors.add(connector);
    this.#index(this.#connectorsById, connector.connectorId, connector, {
      connectorId: connector.connectorId,
    });
    this.edgeSync?.connectorRegistered?.();
  }

  unregisterConnector(connector: ConnectorMirror): void {
    this.#connectors.delete(connector);
    this.#unindex(
      this.#connectorsById,
      connector.connectorId,
      connector,
      this.#connectors,
      (c) => c.connectorId,
    );
    // A departed endpoint can make canonical lines latent; let the reconciler
    // converge (idempotent — teardown already removed the mirror's lines).
    this.edgeSync?.connectorRegistered?.();
  }

  /** Every line starts life as a preview until it settles against a target. */
  registerLine(line: LineMirror): void {
    this.#previewLines.add(line);
  }

  /** A line gained a settled target: index it by its stable line ID. */
  settleLine(line: LineMirror): void {
    this.#previewLines.delete(line);
    this.#index(this.#linesById, line.lineId, line, { lineId: line.lineId });
  }

  /** A settled line lost its target (reconnect pickup): back to preview. */
  unsettleLine(line: LineMirror): void {
    if (this.#linesById.get(line.lineId) === line) {
      this.#linesById.delete(line.lineId);
    }
    this.#duplicateErrors.delete(line);
    this.#previewLines.add(line);
  }

  unregisterLine(line: LineMirror): void {
    this.#previewLines.delete(line);
    this.#duplicateErrors.delete(line);
    if (this.#linesById.get(line.lineId) !== line) return;
    this.#linesById.delete(line.lineId);
    // First-wins retry: promote a formerly duplicate settled line, if any.
    for (const [candidate, error] of this.#duplicateErrors) {
      if (error.code === "duplicate-id" && error.lineId === line.lineId) {
        this.#linesById.set(line.lineId, candidate as LineMirror);
        this.#duplicateErrors.delete(candidate);
        return;
      }
    }
  }

  // Live mirrors in registration order. Always copies, never internal state.
  get nodes(): readonly NodeMirror[] {
    return [...this.#nodes];
  }

  get connectors(): readonly ConnectorMirror[] {
    return [...this.#connectors];
  }

  /** Settled lines only; previews are listed separately. */
  get lines(): readonly LineMirror[] {
    return [...this.#linesById.values()];
  }

  get previewLines(): readonly LineMirror[] {
    return [...this.#previewLines];
  }

  node(id: NodeId): NodeMirror | null {
    return this.#nodesById.get(id) ?? null;
  }

  connector(id: ConnectorId): ConnectorMirror | null {
    return this.#connectorsById.get(id) ?? null;
  }

  line(id: LineId): LineMirror | null {
    return this.#linesById.get(id) ?? null;
  }

  diagnostics(): readonly ReconciliationError[] {
    return [...this.#duplicateErrors.values()];
  }

  #index<T extends object>(
    map: Map<string, T>,
    id: string,
    item: T,
    ref: Pick<ReconciliationError, "nodeId" | "connectorId" | "lineId">,
  ): void {
    const existing = map.get(id);
    if (existing === undefined) {
      map.set(id, item);
      return;
    }
    if (existing === item) return;
    this.#duplicateErrors.set(item, {
      code: "duplicate-id",
      ...ref,
      message: `SnapLine: duplicate id "${id}" — the first registration keeps the index entry; this mirror stays unindexed until the conflict resolves.`,
    });
  }

  #unindex<T extends object>(
    map: Map<string, T>,
    id: string,
    item: T,
    live: Set<T>,
    idOf: (item: T) => string,
  ): void {
    this.#duplicateErrors.delete(item);
    if (map.get(id) !== item) return;
    map.delete(id);
    // First-wins retry: if a formerly duplicate live mirror carries this id,
    // it takes over the index entry and its diagnostic clears.
    for (const candidate of live) {
      if (candidate !== item && idOf(candidate) === id) {
        map.set(id, candidate);
        this.#duplicateErrors.delete(candidate);
        return;
      }
    }
  }

}
