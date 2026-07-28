import { ElementObject, BaseObject } from "@snap-engine/core";
import type {
  ConnectorAnchor,
  ConnectorCandidate,
  ConnectorMirror,
  ConnectorHit,
  ConnectorPoint,
  ConnectorSurfaceStrategy,
} from "./connector";
import type { GeometryWriter } from "./geometry";
import { getGraphMirror } from "./snapline-globals";
import { mintDomainId } from "./graph-mirror";

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
  readonly delta: Readonly<{ x: number; y: number }>;
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
  #stateCallbacks = new Set<(state: LineStateSnapshot) => void>();
  #sourceStrategy: ConnectorSurfaceStrategy | null = null;
  #sourceHit: ConnectorHit | null = null;
  #targetStrategy: ConnectorSurfaceStrategy | null = null;
  #targetHit: ConnectorHit | null = null;
  #previewPosition: ConnectorPoint | null = null;

  constructor(engine: any, parent: BaseObject, config: { id?: string } = {}) {
    super(engine, parent);
    this.#start = parent as unknown as ConnectorMirror;
    this.transformMode = "direct";
    this.lineId = config.id ?? mintDomainId("line", this.global);
    getGraphMirror(this.engine).registerLine(this);
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
    getGraphMirror(this.engine).unregisterLine(this);
    super.destroy(removeElement);
  }

  bindGeometryWriter(
    writer: GeometryWriter<LineGeometrySnapshot>,
  ): () => void {
    this.#geometryWriter = writer;
    writer(this.geometrySnapshot());
    return () => {
      if (this.#geometryWriter === writer) this.#geometryWriter = null;
    };
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

  setPreviewPosition(position: ConnectorPoint): void {
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
    getGraphMirror(this.engine).settleLine(this);
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
    getGraphMirror(this.engine).unsettleLine(this);
    if (changed) this.#emitStateChange();
  }

  setLineStartAnchor(anchor: ConnectorAnchor): void {
    this.#startAnchor = cloneAnchor(anchor);
    this.worldTransform = { x: anchor.x, y: anchor.y };
  }

  setLineEndAnchor(anchor: ConnectorAnchor): void {
    this.#endAnchor = cloneAnchor(anchor);
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
