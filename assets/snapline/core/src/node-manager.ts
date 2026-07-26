import type {
  ConnectorComponent,
  ConnectorConnectionEvent,
  ConnectorDisconnectionEvent,
} from "./connector";
import type { NodeComponent } from "./node";

// Structural stand-in for EdgeSyncController so the manager (and the emit
// sites that reach it) never value-import edge-sync — edge-sync imports the
// manager accessor, not the reverse.
export interface EdgeSyncLike {
  notifyConnect(event: ConnectorConnectionEvent): void;
  notifyDisconnect(event: ConnectorDisconnectionEvent): void;
  /** A connector registered after the controller — reconcile so document
   * edges whose endpoints just mounted get their lines. */
  connectorRegistered?(): void;
}

// Engine-scoped registry of every live SnapLine node and connector.
//
// Created lazily by `getNodeManager(engine)` the first time any SnapLine
// component registers, so it exists exactly when SnapLine is in use — no
// adapter wiring required, vanilla consumers included. Components register in
// their constructors and unregister in `destroy()`.
//
// Beyond enumeration (which `query.ts` delegates to), the manager is the home
// for engine-scoped SnapLine facilities: the controlled-edges controller
// today (`edgeSync`), layout helpers that need to walk `nodes` tomorrow.
export class NodeManager {
  readonly engine: unknown;
  #nodes = new Set<NodeComponent>();
  #connectors = new Set<ConnectorComponent>();

  // Engine-scoped controlled-edges controller. Registered by
  // EdgeSyncController's constructor; the connector emit sites forward
  // connection events through it.
  edgeSync: EdgeSyncLike | null = null;

  constructor(engine: unknown) {
    this.engine = engine;
  }

  registerNode(node: NodeComponent): void {
    this.#nodes.add(node);
  }

  unregisterNode(node: NodeComponent): void {
    this.#nodes.delete(node);
  }

  registerConnector(connector: ConnectorComponent): void {
    this.#connectors.add(connector);
    this.edgeSync?.connectorRegistered?.();
  }

  unregisterConnector(connector: ConnectorComponent): void {
    this.#connectors.delete(connector);
  }

  // Live nodes in registration order. Returns a copy, never internal state.
  get nodes(): readonly NodeComponent[] {
    return [...this.#nodes];
  }

  // Live connectors in registration order. Returns a copy.
  get connectors(): readonly ConnectorComponent[] {
    return [...this.#connectors];
  }
}
