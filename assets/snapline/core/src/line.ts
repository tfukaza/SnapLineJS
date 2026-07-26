import { ElementObject, BaseObject } from "@snap-engine/core";
import type {
  ConnectorAnchor,
  ConnectorCandidate,
  ConnectorComponent,
  ConnectorHit,
  ConnectorLinePhase,
  ConnectorPoint,
  ConnectorSurfaceStrategy,
} from "./connector";
import type { GeometryWriter } from "./geometry";

export interface LineGeometrySnapshot {
  readonly start: ConnectorAnchor;
  readonly end: ConnectorAnchor;
  readonly delta: Readonly<{ x: number; y: number }>;
}

export interface LineStateSnapshot {
  readonly phase: ConnectorLinePhase;
  readonly target: ConnectorComponent | null;
  readonly candidate: ConnectorComponent | null;
  readonly payload: unknown;
}

class LineComponent extends ElementObject {
  endWorldX: number;
  endWorldY: number;

  start: ConnectorComponent;
  target: ConnectorComponent | null;
  payload: unknown;
  startAnchor: ConnectorAnchor;
  endAnchor: ConnectorAnchor;
  phase: ConnectorLinePhase;
  candidate: ConnectorCandidate | null;

  #geometryWriter: GeometryWriter<LineGeometrySnapshot> | null = null;
  #stateCallbacks = new Set<(state: LineStateSnapshot) => void>();
  #sourceStrategy: ConnectorSurfaceStrategy | null = null;
  #sourceHit: ConnectorHit | null = null;
  #targetStrategy: ConnectorSurfaceStrategy | null = null;
  #targetHit: ConnectorHit | null = null;
  #previewPosition: ConnectorPoint | null = null;

  constructor(engine: any, parent: BaseObject) {
    super(engine, parent);

    this.endWorldX = 0;
    this.endWorldY = 0;

    this.start = parent as unknown as ConnectorComponent;
    this.target = null;
    this.payload = undefined;
    this.startAnchor = { x: 0, y: 0 };
    this.endAnchor = { x: 0, y: 0 };
    this.phase = "source-start";
    this.candidate = null;
    this.transformMode = "direct";
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
    this.candidate = candidate;
    this.#targetStrategy = strategy;
    this.#targetHit = candidate?.hit ?? null;
    if (previousConnector !== (candidate?.connector ?? null)) {
      this.#emitStateChange();
    }
  }

  setPhase(phase: ConnectorLinePhase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    this.#emitStateChange();
  }

  setPayload(payload: unknown): void {
    if (Object.is(this.payload, payload)) return;
    this.payload = payload;
    this.#emitStateChange();
  }

  setPreviewPosition(position: ConnectorPoint): void {
    this.#previewPosition = position;
    this.updateAnchors();
  }

  connectTarget(
    target: ConnectorComponent,
    candidate: ConnectorCandidate | null = this.candidate,
    strategy: ConnectorSurfaceStrategy | null = this.#targetStrategy,
  ): void {
    this.target = target;
    this.#targetStrategy = strategy;
    this.#targetHit = candidate?.hit ?? this.#targetHit;
    this.candidate = null;
    this.phase = "connected";
    this.updateAnchors();
    this.#emitStateChange();
  }

  clearTarget(): void {
    const changed =
      this.target !== null ||
      this.candidate !== null ||
      this.phase !== "preview-free";
    this.target = null;
    this.candidate = null;
    this.#targetStrategy = null;
    this.#targetHit = null;
    this.phase = "preview-free";
    if (changed) this.#emitStateChange();
  }

  setLineStartAtConnector(): void {
    const peer = this.target ?? this.candidate?.connector ?? null;
    const peerGeometry = peer?.geometry ?? null;
    const position =
      peerGeometry?.center ?? this.#previewPosition ?? this.endAnchor;
    const anchor = this.start.resolveAnchor({
      line: this,
      role: "source",
      phase: this.phase,
      peer,
      position,
      hit: this.#sourceHit,
      strategy: this.#sourceStrategy,
    });
    this.setLineStartAnchor(anchor);
  }

  setLineEndAtConnector(): void {
    const target = this.target ?? this.candidate?.connector ?? null;
    if (!target) return;
    const anchor = target.resolveAnchor({
      line: this,
      role: "target",
      phase: this.phase,
      peer: this.start,
      position: this.start.geometry.center,
      hit: this.#targetHit,
      strategy: this.#targetStrategy,
    });
    this.setLineEndAnchor(anchor);
  }

  setLineStart(startPositionX: number, startPositionY: number): void {
    this.setLineStartAnchor({ x: startPositionX, y: startPositionY });
  }

  setLineEnd(endWorldX: number, endWorldY: number): void {
    this.setLineEndAnchor({ x: endWorldX, y: endWorldY });
  }

  setLineStartAnchor(anchor: ConnectorAnchor): void {
    this.startAnchor = cloneAnchor(anchor);
    this.worldTransform = { x: anchor.x, y: anchor.y };
  }

  setLineEndAnchor(anchor: ConnectorAnchor): void {
    this.endAnchor = cloneAnchor(anchor);
    this.endWorldX = anchor.x;
    this.endWorldY = anchor.y;
  }

  setLinePosition(
    startWorldX: number,
    startWorldY: number,
    endWorldX: number,
    endWorldY: number,
  ): void {
    this.setLineStart(startWorldX, startWorldY);
    this.setLineEnd(endWorldX, endWorldY);
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

  moveLineToConnectorTransform(): void {
    this.updateAnchors();
  }

  writeTransform(): void {
    this.#geometryWriter?.(this.geometrySnapshot());
  }
}

function cloneAnchor(anchor: ConnectorAnchor): ConnectorAnchor {
  return {
    x: anchor.x,
    y: anchor.y,
    ...(anchor.normal
      ? { normal: { x: anchor.normal.x, y: anchor.normal.y } }
      : {}),
  };
}

export { LineComponent };
