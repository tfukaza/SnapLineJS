import { ElementObject, BaseObject } from "@snap-engine/core";
import type { Point } from "@snap-engine/core/geometry";
import type {
  ConnectorAnchor,
  ConnectorCandidate,
  ConnectorMirror,
  ConnectorHit,
  ConnectorSurfaceStrategy,
} from "./connector";
import type { GeometryInvalidationObserver, GeometryWriter } from "./types";
import { getGraphRegistry } from "./internal/shared-data";
import { mintDomainId } from "./internal/graph-registry";

/**
 * Explicit line lifetime. "staged" is a gesture that completed locally and
 * awaits the canonical owner's decision (controlled mode only); preview
 * phases are the same mirror, not a second entity.
 */
export type LineMirrorPhase =
  | "source-start"
  | "preview-free"
  | "preview-target"
  | "drop"
  | "staged"
  | "connected";

export interface LineGeometrySnapshot {
  readonly start: ConnectorAnchor;
  readonly end: ConnectorAnchor;
  readonly delta: Point;
}

export interface LineStateSnapshot {
  readonly phase: LineMirrorPhase;
  readonly target: ConnectorMirror | null;
  readonly candidate: ConnectorMirror | null;
  readonly payload: unknown;
}

class LineMirror extends ElementObject {
  /** Stable domain identity — minted at creation (or supplied by the
   * reconciler for canonical records). Never the engine-internal
   * `BaseObject.id`. */
  readonly lineId: string;

  #start: ConnectorMirror;
  #target: ConnectorMirror | null = null;
  #payload: unknown = undefined;
  #startAnchor: ConnectorAnchor = { x: 0, y: 0 };
  #endAnchor: ConnectorAnchor = { x: 0, y: 0 };
  #phase: LineMirrorPhase = "source-start";
  #candidate: ConnectorCandidate | null = null;
  #geometryWriter: GeometryWriter<LineGeometrySnapshot> | null = null;
  #geometryObservers = new Set<GeometryInvalidationObserver<LineMirror>>();
  #stateCallbacks = new Set<(state: LineStateSnapshot) => void>();
  #sourceStrategy: ConnectorSurfaceStrategy | null = null;
  #sourceHit: ConnectorHit | null = null;
  #targetStrategy: ConnectorSurfaceStrategy | null = null;
  #targetHit: ConnectorHit | null = null;
  #previewPosition: Point | null = null;

  constructor(engine: any, parent: BaseObject, config: { id?: string } = {}) {
    super(engine, parent);
    this.#start = parent as unknown as ConnectorMirror;
    this.transformMode = "direct";
    this.lineId = config.id ?? mintDomainId("line", this.global);
    getGraphRegistry(this.engine).registerLine(this);
  }

  // Read-only outside the mirror's own lifecycle operations.
  get start(): ConnectorMirror {
    return this.#start;
  }

  get target(): ConnectorMirror | null {
    return this.#target;
  }

  get payload(): unknown {
    return this.#payload;
  }

  get startAnchor(): ConnectorAnchor {
    return this.#startAnchor;
  }

  get endAnchor(): ConnectorAnchor {
    return this.#endAnchor;
  }

  get phase(): LineMirrorPhase {
    return this.#phase;
  }

  get candidate(): ConnectorCandidate | null {
    return this.#candidate;
  }

  /** @internal Reconnect pickup: drop the target reference without the
   * phase/notification side effects of clearTarget(). */
  detachTarget(): void {
    this.#target = null;
  }

  /** @internal Controlled gesture staging: attach the drop target visually
   * and await the canonical decision. No topology commitment — the line is
   * not in the target's incoming list and not in the settled index. */
  stageTarget(
    target: ConnectorMirror,
    candidate: ConnectorCandidate | null,
    strategy: ConnectorSurfaceStrategy | null,
  ): void {
    this.#target = target;
    this.#targetStrategy = strategy ?? this.#targetStrategy;
    this.#targetHit = candidate?.hit ?? this.#targetHit;
    this.#candidate = null;
    this.#phase = "staged";
    this.updateAnchors();
    this.#emitStateChange();
  }

  /** @internal Controlled gesture disconnect: already detached; hold the
   * staged phase until the canonical decision (a rejected removal re-glues
   * from the unchanged document). */
  stageForRemoval(): void {
    this.#phase = "staged";
    this.#emitStateChange();
  }

  override destroy(removeElement: boolean = true): void {
    getGraphRegistry(this.engine).unregisterLine(this);
    super.destroy(removeElement);
  }

  bindGeometryWriter(writer: GeometryWriter<LineGeometrySnapshot>): () => void {
    this.#geometryWriter = writer;
    writer(this.geometrySnapshot());
    return () => {
      if (this.#geometryWriter === writer) this.#geometryWriter = null;
    };
  }

  /**
   * Subscribe to "this line's geometry is about to change".
   *
   * Fires **synchronously, during input dispatch, before any frame task is
   * queued** — not at paint time. It deliberately hands over no geometry:
   * schedule your own task at whatever stage suits you and read
   * `geometrySnapshot()` there.
   *
   * ```ts
   * const stop = line.onGeometryInvalidated(() =>
   *   line.schedule(place, { stage: "WRITE_3", queueId: "label" }),
   * );
   * ```
   *
   * The line itself paints at `WRITE_2` (and resolves its anchors inside that
   * same task), so `WRITE_3` sees this frame's position while `WRITE_1` and
   * `READ_2` still see the previous frame's. Choosing that is the caller's
   * job, which is why no stage is implied here.
   *
   * Unlike {@link bindGeometryWriter} — the single owner that paints the line —
   * any number of observers may subscribe. There is no priming call: nothing
   * has been invalidated at subscribe time, so read `geometrySnapshot()`
   * directly for the initial position.
   *
   * @returns an unsubscribe function.
   */
  onGeometryInvalidated(
    observer: GeometryInvalidationObserver<LineMirror>,
  ): () => void {
    this.#geometryObservers.add(observer);
    return () => this.#geometryObservers.delete(observer);
  }

  onStateChange(callback: (state: LineStateSnapshot) => void): () => void {
    this.#stateCallbacks.add(callback);
    callback(this.stateSnapshot());
    return () => this.#stateCallbacks.delete(callback);
  }

  geometrySnapshot(): LineGeometrySnapshot {
    const start = cloneAnchor(this.startAnchor);
    const end = cloneAnchor(this.endAnchor);
    return {
      start,
      end,
      delta: { x: end.x - start.x, y: end.y - start.y },
    };
  }

  stateSnapshot(): LineStateSnapshot {
    return {
      phase: this.phase,
      target: this.target,
      candidate: this.candidate?.connector ?? null,
      payload: this.payload,
    };
  }

  #emitStateChange(): void {
    const state = this.stateSnapshot();
    for (const callback of this.#stateCallbacks) callback(state);
  }

  setSourceSurfaceContext(
    strategy: ConnectorSurfaceStrategy | null,
    hit: ConnectorHit | null,
  ): void {
    this.#sourceStrategy = strategy;
    this.#sourceHit = hit;
  }

  setCandidate(
    candidate: ConnectorCandidate | null,
    strategy: ConnectorSurfaceStrategy | null = null,
  ): void {
    const previousConnector = this.candidate?.connector ?? null;
    this.#candidate = candidate;
    this.#targetStrategy = strategy;
    this.#targetHit = candidate?.hit ?? null;
    if (previousConnector !== (candidate?.connector ?? null)) {
      this.#emitStateChange();
    }
  }

  setPhase(phase: LineMirrorPhase): void {
    if (this.#phase === phase) return;
    this.#phase = phase;
    this.#emitStateChange();
  }

  setPayload(payload: unknown): void {
    if (Object.is(this.#payload, payload)) return;
    this.#payload = payload;
    this.#emitStateChange();
  }

  setPreviewPosition(position: Point): void {
    this.#previewPosition = position;
    this.updateAnchors();
  }

  connectTarget(
    target: ConnectorMirror,
    candidate: ConnectorCandidate | null = this.candidate,
    strategy: ConnectorSurfaceStrategy | null = this.#targetStrategy,
  ): void {
    this.#target = target;
    this.#targetStrategy = strategy;
    this.#targetHit = candidate?.hit ?? this.#targetHit;
    this.#candidate = null;
    this.#phase = "connected";
    getGraphRegistry(this.engine).settleLine(this);
    this.updateAnchors();
    this.#emitStateChange();
  }

  clearTarget(): void {
    const changed =
      this.target !== null ||
      this.candidate !== null ||
      this.phase !== "preview-free";
    this.#target = null;
    this.#candidate = null;
    this.#targetStrategy = null;
    this.#targetHit = null;
    this.#phase = "preview-free";
    getGraphRegistry(this.engine).unsettleLine(this);
    if (changed) this.#emitStateChange();
  }

  setLineStartAnchor(anchor: ConnectorAnchor): void {
    this.#startAnchor = cloneAnchor(anchor);
    this.worldTransform = { x: anchor.x, y: anchor.y };
  }

  setLineEndAnchor(anchor: ConnectorAnchor): void {
    this.#endAnchor = cloneAnchor(anchor);
  }

  /**
   * The deferred re-glue: notify observers now, paint next WRITE_2.
   *
   * Coalesces on `(objectId, queueId)`, so many invalidations in one frame
   * collapse to a single write task.
   */
  invalidateGeometry(): void {
    this.#notifyGeometryInvalidated();
    this.schedule(
      () => {
        this.updateAnchors();
        this.writeTransform();
      },
      { stage: "WRITE_2", queueId: `${this.id}-transform` },
    );
  }

  /**
   * The synchronous re-glue, for callers already inside a WRITE stage
   * (settle, prop-driven node moves). Observers still fire first, so a
   * subscriber's own scheduled task is queued before the paint happens.
   */
  invalidateGeometryNow(): void {
    this.#notifyGeometryInvalidated();
    this.updateAnchors();
    this.writeTransform();
  }

  #notifyGeometryInvalidated(): void {
    for (const observer of this.#geometryObservers) {
      // A third-party observer must never be able to stop the line painting
      // or starve its peers.
      try {
        observer(this);
      } catch (error) {
        console.error("SnapLine: a line geometry observer threw.", error);
      }
    }
  }

  updateAnchors(): void {
    const target = this.target ?? this.candidate?.connector ?? null;
    if (!target) {
      const preview = this.#previewPosition ?? this.endAnchor;
      const startAnchor = this.start.resolveAnchor({
        line: this,
        role: "source",
        phase: this.phase,
        peer: null,
        position: preview,
        hit: this.#sourceHit,
        strategy: this.#sourceStrategy,
      });
      this.setLineStartAnchor(startAnchor);
      this.setLineEndAnchor(preview);
      return;
    }

    const sourceGeometry = this.start.geometry;
    const targetGeometry = target.geometry;
    const sourceAnchor = this.start.resolveAnchor({
      line: this,
      role: "source",
      phase: this.phase,
      peer: target,
      position: targetGeometry.center,
      hit: this.#sourceHit,
      strategy: this.#sourceStrategy,
    });
    const targetAnchor = target.resolveAnchor({
      line: this,
      role: "target",
      phase: this.phase,
      peer: this.start,
      position: sourceGeometry.center,
      hit: this.#targetHit,
      strategy: this.#targetStrategy,
    });
    this.setLineStartAnchor(sourceAnchor);
    this.setLineEndAnchor(targetAnchor);
  }

  writeTransform(): void {
    this.#geometryWriter?.(this.geometrySnapshot());
  }
}

export function cloneAnchor(anchor: ConnectorAnchor): ConnectorAnchor {
  return {
    x: anchor.x,
    y: anchor.y,
    ...(anchor.normal
      ? { normal: { x: anchor.normal.x, y: anchor.normal.y } }
      : {}),
  };
}

export { LineMirror };
