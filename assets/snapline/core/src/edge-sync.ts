import type {
  ConnectorComponent,
  ConnectorConnectionEvent,
  ConnectorDisconnectionEvent,
} from "./connector";
import type { LineComponent } from "./line";
import { getNodeManager } from "./snapline-globals";

export interface EdgeEndpoint {
  node: string;
  port: string;
}

export interface EdgeLike {
  from: EdgeEndpoint;
  to: EdgeEndpoint;
}

export interface EdgeConnectIntentEvent {
  from: EdgeEndpoint;
  to: EdgeEndpoint;
  source: ConnectorComponent;
  target: ConnectorComponent;
  line: LineComponent;
  origin: "gesture";
}

export interface EdgeDisconnectIntentEvent {
  from: EdgeEndpoint;
  to: EdgeEndpoint;
  source: ConnectorComponent;
  target: ConnectorComponent;
  line: LineComponent;
  reason: "gesture" | "replacement";
}

export interface EdgeSyncCallbacks {
  onEdgeConnect?: (event: EdgeConnectIntentEvent) => void;
  onEdgeDisconnect?: (event: EdgeDisconnectIntentEvent) => void;
}

type EdgeSyncEngine = { global: { data: any } | null };

export interface EdgeSyncConfig {
  engine: EdgeSyncEngine;
  // Maps a connector to its semantic endpoint, or null for connectors that
  // are not part of the consumer's edge document (their lines are left
  // untouched by sync and never produce intents).
  identity: (connector: ConnectorComponent) => EdgeEndpoint | null;
  // The consumer's current edge list — the single source of truth. Consulted
  // fresh on every sync; the controller never stores edges.
  getEdges: () => readonly EdgeLike[];
  callbacks?: EdgeSyncCallbacks;
}

// Control-character separator: consumer node/port ids are free to contain
// ':' or other printable punctuation.
const KEY_SEPARATOR = "";

function endpointKey(endpoint: EdgeEndpoint): string {
  return endpoint.node + KEY_SEPARATOR + endpoint.port;
}

function edgeKey(from: EdgeEndpoint, to: EdgeEndpoint): string {
  return endpointKey(from) + KEY_SEPARATOR + endpointKey(to);
}

// Controlled-edges controller: the consumer owns the edge document, SnapLine
// owns keeping rendered lines reconciled to it and translating gestures into
// semantic intents.
//
// Contract: gesture connects and gesture/replacement disconnects forward as
// intents; programmatic, hydration, and teardown changes never do. Intents
// fire synchronously inside the drop dispatch — a consumer that writes its
// document synchronously in the intent (and whose adapter reconciles in the
// same task) keeps the accept AND reject paths paint-atomic. `sync()` is
// idempotent, skips in-flight drag lines, and never forwards intents for its
// own mutations.
export class EdgeSyncController {
  #config: EdgeSyncConfig;
  #syncing = false;
  #syncQueued = false;
  #disposed = false;

  constructor(config: EdgeSyncConfig) {
    this.#config = config;
    const manager = getNodeManager(config.engine);
    if (manager.edgeSync && manager.edgeSync !== this) {
      console.warn(
        "SnapLine: replacing an existing EdgeSyncController for this engine.",
      );
    }
    manager.edgeSync = this;
  }

  get callbacks(): EdgeSyncCallbacks {
    return this.#config.callbacks ?? {};
  }

  dispose(): void {
    this.#disposed = true;
    const manager = getNodeManager(this.#config.engine);
    if (manager.edgeSync === this) manager.edgeSync = null;
  }

  // @internal Called by NodeManager when a connector registers after this
  // controller exists (a node mounted). Coalesced into one microtask so a
  // mounting batch reconciles once, before the frame paints.
  connectorRegistered(): void {
    if (this.#syncQueued) return;
    this.#syncQueued = true;
    queueMicrotask(() => {
      this.#syncQueued = false;
      if (!this.#disposed) this.sync();
    });
  }

  // Reconcile rendered lines to the consumer's edge list. Safe to call at any
  // time: in-flight drag lines (no target yet) and foreign lines (either
  // endpoint without identity) are left alone, and mutations made here never
  // forward as intents.
  sync(): void {
    if (this.#syncing) return;
    this.#syncing = true;
    try {
      const manager = getNodeManager(this.#config.engine);
      const identity = this.#config.identity;
      const connectors = manager.connectors;

      const identities = new Map<ConnectorComponent, EdgeEndpoint | null>();
      const byKey = new Map<string, ConnectorComponent>();
      for (const connector of connectors) {
        const endpoint = identity(connector);
        identities.set(connector, endpoint);
        if (endpoint) byKey.set(endpointKey(endpoint), connector);
      }

      const edges = this.#config.getEdges();
      const edgeKeys = new Set(
        edges.map((edge) => edgeKey(edge.from, edge.to)),
      );

      for (const connector of connectors) {
        const fromEndpoint = identities.get(connector);
        if (!fromEndpoint) continue;
        for (const line of [...connector.outgoingLines]) {
          if (line.isDeleteRequested) continue;
          const target = line.target;
          if (!target) continue; // in-flight drag line
          const toEndpoint = identities.get(target) ?? identity(target);
          if (!toEndpoint) continue; // foreign line — not ours to manage
          if (!edgeKeys.has(edgeKey(fromEndpoint, toEndpoint))) {
            const index = connector.outgoingLines.indexOf(line);
            if (index !== -1) connector.deleteLine(index, "programmatic");
          }
        }
      }

      for (const edge of edges) {
        const from = byKey.get(endpointKey(edge.from));
        const to = byKey.get(endpointKey(edge.to));
        if (!from || !to) continue; // endpoint not mounted yet; next sync
        const exists = from.outgoingLines.some(
          (line) => !line.isDeleteRequested && line.target === to,
        );
        if (exists) continue;
        // Document-driven restoration. A false return means a canConnect
        // predicate rejected the edge; the consumer owns document validity,
        // so leave the document alone.
        from.connectToConnector({ target: to, origin: "hydration" });
      }
    } finally {
      this.#syncing = false;
    }
  }

  // @internal Called from ConnectorComponent's emit sites.
  notifyConnect(event: ConnectorConnectionEvent): void {
    if (this.#syncing || event.origin !== "gesture") return;
    const endpoints = this.#endpoints(event.source, event.target);
    if (!endpoints) return;
    this.callbacks.onEdgeConnect?.({
      ...endpoints,
      line: event.line,
      origin: "gesture",
    });
  }

  // @internal Called from ConnectorComponent's emit sites.
  notifyDisconnect(event: ConnectorDisconnectionEvent): void {
    if (this.#syncing) {
      if (event.reason === "replacement") {
        console.warn(
          "SnapLine EdgeSync: sync evicted a live line via replacement — " +
            "the edge document exceeds a connector's incoming capacity.",
        );
      }
      return;
    }
    if (event.reason !== "gesture" && event.reason !== "replacement") return;
    const endpoints = this.#endpoints(event.source, event.target);
    if (!endpoints) return;
    this.callbacks.onEdgeDisconnect?.({
      ...endpoints,
      line: event.line,
      reason: event.reason,
    });
  }

  #endpoints(
    source: ConnectorComponent,
    target: ConnectorComponent,
  ): {
    from: EdgeEndpoint;
    to: EdgeEndpoint;
    source: ConnectorComponent;
    target: ConnectorComponent;
  } | null {
    // ConnectorPairEvent's source/target are already in wire direction.
    const from = this.#config.identity(source);
    const to = this.#config.identity(target);
    return from && to ? { from, to, source, target } : null;
  }
}
