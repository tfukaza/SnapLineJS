import { BaseObject, ElementObject } from "@snap-engine/core";
import type {
  pointerDownProp,
  pointerMoveProp,
  pointerUpProp,
} from "@snap-engine/core";
import { RectCollider, Collider } from "@snap-engine/core/collision";
import { NodeMirror, type SelectionMode } from "./node";
import { getGraphMirror } from "./snapline-globals";
import type { GeometryWriter } from "./geometry";

/** World-space rectangle delivered to the registered geometry writer. */
export interface SelectRect {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
}

export interface SelectStartEvent {
  select: RectSelectController;
  position: { x: number; y: number };
  originalEvent: PointerEvent;
}

export interface SelectChangeEvent {
  select: RectSelectController;
  selection: readonly NodeMirror[];
}

export interface SelectCallbacks {
  canStart?: (event: SelectStartEvent) => boolean;
  /** Consumer-defined selection policy; SnapLine owns no modifier keys. */
  resolveSelectionMode?: (event: SelectStartEvent) => SelectionMode;
  /**
   * Observes rubber-band rectangle changes. Adapters render live geometry
   * through `bindGeometryWriter`; this callback is for application behavior,
   * logging, and persistence rather than per-frame framework rendering.
   */
  onRectChange?: (rect: SelectRect) => void;
  onSelectionChange?: (event: SelectChangeEvent) => void;
}

export interface SelectConfig {
  callbacks?: SelectCallbacks;
}

class RectSelectController extends ElementObject {
  #state: "none" | "dragging";
  #mouseDownX: number;
  #mouseDownY: number;
  #selectHitBox: Collider;
  #callbacks: SelectCallbacks;
  #geometryWriter: GeometryWriter<SelectRect> | null = null;
  #rect: SelectRect = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    visible: false,
  };
  #selectionMode: SelectionMode = "replace";
  #baselineSelection = new Set<NodeMirror>();

  constructor(
    engine: any,
    parent: BaseObject | null,
    config: SelectConfig = {},
  ) {
    super(engine, parent);

    this.#state = "none";
    this.#mouseDownX = 0;
    this.#mouseDownY = 0;

    this.event.global.pointerDown = this.onGlobalCursorDown;
    this.event.global.pointerMove = this.onGlobalCursorMove;
    this.event.global.pointerUp = this.onGlobalCursorUp;

    this.#selectHitBox = new RectCollider(engine, this, 0, 0, 0, 0);
    this.#selectHitBox.localTransform = { x: 0, y: 0 };

    this.addCollider(this.#selectHitBox);

    // A fresh selection controller starts its engine from an empty selection.
    getGraphMirror(this.engine).selection.length = 0;

    this.#callbacks = config.callbacks ?? {};
  }

  get callbacks(): SelectCallbacks {
    return this.#callbacks;
  }

  get rect(): Readonly<SelectRect> {
    return this.#rect;
  }

  bindGeometryWriter(writer: GeometryWriter<SelectRect>): () => void {
    this.#geometryWriter = writer;
    writer({ ...this.#rect });
    return () => {
      if (this.#geometryWriter === writer) this.#geometryWriter = null;
    };
  }

  #fireRect(width: number, height: number, visible: boolean): void {
    this.#rect = {
      x: this.worldTransform.x,
      y: this.worldTransform.y,
      width,
      height,
      visible,
    };
    this.#callbacks.onRectChange?.({ ...this.#rect });
    this.schedule(
      () => this.#geometryWriter?.({ ...this.#rect }),
      {
        stage: "WRITE_2",
        queueId: `${this.id}-geometry`,
      },
    );
  }

  onGlobalCursorDown(prop: pointerDownProp): void {
    if (prop.event.button !== 0) {
      return;
    }
    const startEvent = {
      select: this,
      position: prop.position,
      originalEvent: prop.event,
    };
    if (this.#callbacks.canStart?.(startEvent) === false) return;
    this.#selectionMode =
      this.#callbacks.resolveSelectionMode?.(startEvent) ?? "replace";
    this.#baselineSelection = new Set(getGraphMirror(this.engine).selection);
    if (this.#selectionMode === "replace") {
      // setSelected(false) removes each node from the engine's selection.
      for (let node of [...getGraphMirror(this.engine).selection]) {
        node.setSelected(false);
      }
    }

    // worldTransform positions the selection collider (its transform parent);
    // the registered writer updates the visual box during WRITE_2.
    this.worldTransform = { x: prop.position.x, y: prop.position.y };
    this.#state = "dragging";
    this.#mouseDownX = prop.position.x;
    this.#mouseDownY = prop.position.y;
    this.#selectHitBox.width = 0;
    this.#selectHitBox.height = 0;
    this.#fireRect(0, 0, true);
    this.#callbacks.onSelectionChange?.({
      select: this,
      selection: [...getGraphMirror(this.engine).selection],
    });

    this.#selectHitBox.event.collider.onBeginContact = (
      _: Collider,
      otherObject: Collider,
    ) => {
      if (otherObject.parent instanceof NodeMirror) {
        let node = otherObject.parent as NodeMirror;
        node.setSelected(
          this.#selectionMode === "toggle"
            ? !this.#baselineSelection.has(node)
            : true,
        );
        this.#callbacks.onSelectionChange?.({
          select: this,
          selection: [...getGraphMirror(this.engine).selection],
        });
      }
    };
    this.#selectHitBox.event.collider.onEndContact = (
      _thisObject: Collider,
      otherObject: Collider,
    ) => {
      if (otherObject.parent instanceof NodeMirror) {
        let node = otherObject.parent as NodeMirror;
        node.setSelected(this.#baselineSelection.has(node));
        this.#callbacks.onSelectionChange?.({
          select: this,
          selection: [...getGraphMirror(this.engine).selection],
        });
      }
    };
  }

  onGlobalCursorMove(prop: pointerMoveProp): void {
    if (this.#state === "dragging") {
      let [boxOriginX, boxOriginY] = [
        Math.min(this.#mouseDownX, prop.position.x),
        Math.min(this.#mouseDownY, prop.position.y),
      ];
      let [boxWidth, boxHeight] = [
        Math.abs(prop.position.x - this.#mouseDownX),
        Math.abs(prop.position.y - this.#mouseDownY),
      ];
      this.worldTransform = { x: boxOriginX, y: boxOriginY };
      this.#selectHitBox.localTransform = { x: 0, y: 0 };
      this.#selectHitBox.width = boxWidth;
      this.#selectHitBox.height = boxHeight;
      this.#fireRect(boxWidth, boxHeight, true);
    }
  }

  onGlobalCursorUp(_prop: pointerUpProp): void {
    const wasDragging = this.#state === "dragging";
    this.#state = "none";

    this.#selectHitBox.event.collider.onBeginContact = null;
    this.#selectHitBox.event.collider.onEndContact = null;
    if (wasDragging) this.#fireRect(0, 0, false);
  }

}

export { RectSelectController };
