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

  #renderCallbacks: Set<(line: LineComponent) => void>;
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
    this.#renderCallbacks = new Set();

    this.transformMode = "direct";
  }

  onRender(callback: (line: LineComponent) => void): () => void {
    this.#renderCallbacks.add(callback);
    return () => {
      this.#renderCallbacks.delete(callback);
    };
  }

  requestRender(): void {
    for (const callback of this.#renderCallbacks) {
      callback(this);
    }
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
    this.candidate = candidate;
    this.#targetStrategy = strategy;
    this.#targetHit = candidate?.hit ?? null;
    this.requestRender();
  }

  setPhase(phase: ConnectorLinePhase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    this.requestRender();
  }

  setPayload(payload: unknown): void {
    this.payload = payload;
    this.requestRender();
  }

  setPreviewPosition(position: ConnectorPoint): void {
    this.#previewPosition = position;
    // Pointer and edge-pan updates are committed through the engine's write
    // phase by ConnectorComponent. Updating the model here but deferring the
    // render callback keeps the line and camera transform in the same frame;
    // rendering immediately leaves the preview one camera frame behind during
    // continuous edge-pan.
    this.updateAnchors(false);
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
  }

  clearTarget(): void {
    this.target = null;
    this.candidate = null;
    this.#targetStrategy = null;
    this.#targetHit = null;
    this.phase = "preview-free";
    this.requestRender();
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

  updateAnchors(requestRender = true): void {
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
      if (requestRender) this.requestRender();
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
    if (requestRender) this.requestRender();
  }

  moveLineToConnectorTransform(): void {
    this.updateAnchors();
  }

  writeTransform(): void {
    // A logical/headless line can exist before a framework mounts its SVG.
    if (this.element) super.writeTransform();
    this.requestRender();
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
