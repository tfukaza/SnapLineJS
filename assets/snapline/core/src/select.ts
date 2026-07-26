import { BaseObject, ElementObject } from "@snap-engine/core";
import type {
  pointerDownProp,
  pointerMoveProp,
  pointerUpProp,
} from "@snap-engine/core";
import { RectCollider, Collider } from "@snap-engine/core/collision";
import { NodeMirror, type SelectionMode } from "./node";
import { getSelectList, snapData } from "./snapline-globals";
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
  _state: "none" | "dragging";
  _mouseDownX: number;
  _mouseDownY: number;
  _selectHitBox: Collider;
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

    this._state = "none";
    this._mouseDownX = 0;
    this._mouseDownY = 0;

    this.event.global.pointerDown = this.onGlobalCursorDown;
    this.event.global.pointerMove = this.onGlobalCursorMove;
    this.event.global.pointerUp = this.onGlobalCursorUp;

    this._selectHitBox = new RectCollider(engine, this, 0, 0, 0, 0);
    this._selectHitBox.localTransform = { x: 0, y: 0 };
    this._selectHitBox.event.collider.onCollide = this.onCollideNode;

    this.addCollider(this._selectHitBox);

    snapData(this.global).select = [];

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
    this.#baselineSelection = new Set(getSelectList(this.global));
    if (this.#selectionMode === "replace") {
      for (let node of [...getSelectList(this.global)]) {
        node.setSelected(false);
      }
      snapData(this.global).select = [];
    }

    // worldTransform positions the selection collider (its transform parent);
    // the registered writer updates the visual box during WRITE_2.
    this.worldTransform = { x: prop.position.x, y: prop.position.y };
    this._state = "dragging";
    this._mouseDownX = prop.position.x;
    this._mouseDownY = prop.position.y;
    this._selectHitBox.width = 0;
    this._selectHitBox.height = 0;
    this.#fireRect(0, 0, true);
    this.#callbacks.onSelectionChange?.({
      select: this,
      selection: [...getSelectList(this.global)],
    });

    this._selectHitBox.event.collider.onBeginContact = (
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
          selection: [...getSelectList(this.global)],
        });
      }
    };
    this._selectHitBox.event.collider.onEndContact = (
      _thisObject: Collider,
      otherObject: Collider,
    ) => {
      if (otherObject.parent instanceof NodeMirror) {
        let node = otherObject.parent as NodeMirror;
        node.setSelected(this.#baselineSelection.has(node));
        this.#callbacks.onSelectionChange?.({
          select: this,
          selection: [...getSelectList(this.global)],
        });
      }
    };
  }

  onGlobalCursorMove(prop: pointerMoveProp): void {
    if (this._state === "dragging") {
      let [boxOriginX, boxOriginY] = [
        Math.min(this._mouseDownX, prop.position.x),
        Math.min(this._mouseDownY, prop.position.y),
      ];
      let [boxWidth, boxHeight] = [
        Math.abs(prop.position.x - this._mouseDownX),
        Math.abs(prop.position.y - this._mouseDownY),
      ];
      this.worldTransform = { x: boxOriginX, y: boxOriginY };
      this._selectHitBox.localTransform = { x: 0, y: 0 };
      this._selectHitBox.width = boxWidth;
      this._selectHitBox.height = boxHeight;
      this.#fireRect(boxWidth, boxHeight, true);
    }
  }

  onGlobalCursorUp(_prop: pointerUpProp): void {
    const wasDragging = this._state === "dragging";
    this._state = "none";

    this._selectHitBox.event.collider.onBeginContact = null;
    this._selectHitBox.event.collider.onEndContact = null;
    if (wasDragging) this.#fireRect(0, 0, false);
  }

  onCollideNode(_hitBox: Collider, _node: Collider): void {}
}

export { RectSelectController };
