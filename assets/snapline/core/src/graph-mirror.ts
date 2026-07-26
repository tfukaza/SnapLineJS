import type { ConnectorMirror } from "./connector";
import type { NodeMirror } from "./node";
import type { LineMirror } from "./line";
import type { GroupNodeMirror, GroupMembershipResolver } from "./group";
import type { LineChangeRequest } from "./line-reconciler";

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

// Structural reconciler contract so the registry (and the connector emit
// sites that reach it) never value-import the reconciler module — it imports
// the registry accessor, not the reverse.
export interface GraphReconcilerLike {
  /** Run one reconciliation pass against the latest canonical state. Invoked
   * by the mirror's coalescing, batch-aware scheduler. */
  reconcile?(): void;
  /** Forward a gesture's atomic proposal to the application. Present only on
   * the controlled bridge; its presence routes gesture drops. */
  dispatchLineChangeRequest?(request: LineChangeRequest): void;
}

/** A batch token from `beginBatch()`; `end()` is idempotent. */
export interface GraphBatch {
  end(): void;
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
  #reconciliationErrors: readonly ReconciliationError[] = [];

  // Engine-scoped controlled-lines reconciler, installed by
  // attachControlledGraph(); the connector emit sites and the scheduler
  // reach it through this slot.
  reconciler: GraphReconcilerLike | null = null;

  /** @internal True while a reconciler pass mutates topology on the
   * canonical document's behalf — those mutations bypass the authority gate
   * on imperative commands. */
  reconcilerActive = false;

  /** @internal One in-flight gesture request per engine (gestures are
   * serial); cleared by the next reconciliation pass. */
  pendingGestureRequest = false;

  #reconciliationQueued = false;
  #batchDepth = 0;
  #batchDirty = false;

  /**
   * Coalescing, batch-aware reconciliation trigger: registrations, canonical
   * snapshot changes, and dispatched requests all funnel here. One microtask
   * pass per burst; open batches defer the pass to the outermost `end()`.
   */
  scheduleReconciliation(): void {
    if (this.#batchDepth > 0) {
      this.#batchDirty = true;
      return;
    }
    if (this.#reconciliationQueued) return;
    this.#reconciliationQueued = true;
    queueMicrotask(() => {
      if (!this.#reconciliationQueued) return; // flushed synchronously
      this.#reconciliationQueued = false;
      this.reconciler?.reconcile?.();
    });
  }

  /** Run any pending (or batch-deferred) reconciliation synchronously. */
  flush(): void {
    this.#reconciliationQueued = false;
    this.#batchDirty = false;
    this.reconciler?.reconcile?.();
  }

  /**
   * Open a bulk boundary: no partial reconciliation runs until the outermost
   * `end()`, which schedules one final pass if anything went dirty. Batches
   * nest; `end()` is idempotent.
   */
  beginBatch(): GraphBatch {
    this.#batchDepth += 1;
    let closed = false;
    return {
      end: () => {
        if (closed) return;
        closed = true;
        this.#batchDepth -= 1;
        if (this.#batchDepth === 0 && this.#batchDirty) {
          this.#batchDirty = false;
          this.scheduleReconciliation();
        }
      },
    };
  }

  /** Scoped batch — exception-safe by construction. */
  async runBatch<T>(fn: () => T | Promise<T>): Promise<T> {
    const batch = this.beginBatch();
    try {
      return await fn();
    } finally {
      batch.end();
    }
  }

  // ---- Engine-scoped interaction state (formerly cross-engine arrays on
  // ---- global.data). Live containers mutated in place by their owners.

  /** Currently-selected nodes (multi-select drag moves all of them). */
  readonly selection: NodeMirror[] = [];
  /** Live groups on this engine, in registration order. The type-only group
   * import keeps node.ts (which reads this) free of any group value import. */
  readonly groups: GroupNodeMirror[] = [];
  /** The node mid-resize, so an unrelated pointerUp doesn't click-select. */
  resizingNode: NodeMirror | null = null;
  /** Direct parent group per node — settled geometric membership. */
  readonly parentGroups = new WeakMap<NodeMirror, GroupNodeMirror>();
  /** Optional membership resolver overriding the smallest-eligible default. */
  membershipResolver: GroupMembershipResolver | null = null;
  /** Re-entrancy guard for group membership reconciliation. */
  reconcilingMembership = false;

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
    this.scheduleReconciliation();
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
    this.scheduleReconciliation();
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
    return [...this.#duplicateErrors.values(), ...this.#reconciliationErrors];
  }

  /** @internal Reconciler-only: replace the derived per-pass error set.
   * Returns whether the contents changed (shallow, order-insensitive on the
   * code+id triple). */
  setReconciliationErrors(errors: readonly ReconciliationError[]): boolean {
    const key = (error: ReconciliationError) =>
      `${error.code}|${error.lineId ?? ""}|${error.connectorId ?? ""}|${error.nodeId ?? ""}`;
    const previous = this.#reconciliationErrors.map(key).sort();
    const next = errors.map(key).sort();
    this.#reconciliationErrors = [...errors];
    return (
      previous.length !== next.length ||
      previous.some((entry, index) => entry !== next[index])
    );
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
