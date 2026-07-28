/**
 * Pure type declarations shared across SnapLine — identity, diagnostics, the
 * geometry-writer signature, and the controlled-graph contract the application
 * negotiates through.
 *
 * This module deliberately imports nothing. Everything here is part of the
 * public surface, so it stays at the top level while the machinery that
 * consumes it lives under `internal/`.
 */

/** Stable application-facing identity of a canonical node. */
export type NodeId = string;
/** Stable application-facing identity of a canonical connector (graph-global). */
export type ConnectorId = string;
/** Stable application-facing identity of a canonical line. */
export type LineId = string;

/**
 * Sink for high-frequency geometry: core hands over numbers, the consumer owns
 * the element. Used by lines, selection, and placement.
 */
export type GeometryWriter<T> = (geometry: Readonly<T>) => void;

/**
 * Notified the moment core determines an object's geometry will change this
 * frame — synchronously during input dispatch, before anything is queued.
 *
 * It carries no geometry on purpose. The subscriber schedules its own task at
 * the stage it wants (`schedule(cb, { stage, queueId })`) and reads the
 * object's `geometrySnapshot()` there, rather than having core pick a write
 * phase on its behalf.
 */
export type GeometryInvalidationObserver<T> = (source: T) => void;

/**
 * Structured, non-throwing report of a graph state the registry cannot
 * represent. Derived state: entries drop out when their cause resolves.
 */
export interface ReconciliationError {
  code: "duplicate-id" | "capacity-exceeded" | "connection-rejected";
  lineId?: LineId;
  nodeId?: NodeId;
  connectorId?: ConnectorId;
  message: string;
  cause?: unknown;
}

/** A batch token from `beginBatch()`; `end()` is idempotent. */
export interface GraphBatch {
  end(): void;
}

/** Canonical committed relationship, owned by the application. */
export interface LineRecord {
  id: LineId;
  fromConnectorId: ConnectorId;
  toConnectorId: ConnectorId;
  payload?: unknown;
}

/** The application-pushed canonical document. Node and connector existence
 * stays framework-mount-led; the snapshot carries the line records. */
export interface CanonicalGraphSnapshot {
  lines: readonly LineRecord[];
}

/** A gesture-created line proposed to the canonical owner. The `id` is
 * minted by SnapLine; adopting it settles the staged mirror in place. */
export interface ProposedLine {
  id: LineId;
  fromConnectorId: ConnectorId;
  toConnectorId: ConnectorId;
  payload?: unknown;
}

export interface LineEndpointUpdate {
  id: LineId;
  toConnectorId: ConnectorId;
}

/** One atomic proposal for the application to change canonical records. */
export interface LineChangeRequest {
  intent: "connect" | "disconnect" | "replace" | "reconnect";
  add: readonly ProposedLine[];
  remove: readonly LineId[];
  update: readonly LineEndpointUpdate[];
}

export interface ControlledGraphCallbacks {
  /**
   * One atomic proposal per gesture. **Return the line list that should now be
   * canonical** — the bridge hands it straight to the reconciler, so exactly
   * one decisive pass runs per request whether you accept, normalize, or
   * reject.
   *
   * ```ts
   * onLineChangeRequest: (r) => (lines = applyLineChange(lines, r))
   * ```
   *
   * To reject, return the list unchanged (`return lines`). The return type is
   * non-optional on purpose: "I reject" and "I forgot to return anything" used
   * to be the same code, and this makes the second one a type error.
   *
   * Must be synchronous — the staged preview line is resolved by the pass that
   * follows this call.
   */
  onLineChangeRequest(request: LineChangeRequest): readonly LineRecord[];
  onDiagnosticsChanged?(diagnostics: readonly ReconciliationError[]): void;
}

/** What `attachControlledGraph()` hands the adapter. */
export interface ControlledGraphHandle {
  setCanonicalGraph(snapshot: CanonicalGraphSnapshot): void;
  /** Run any pending reconciliation synchronously (vanilla/tests). */
  flush(): void;
  dispose(): void;
}
