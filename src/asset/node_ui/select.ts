import { GlobalManager } from "../../global";
import { BaseObject, DomElement, ElementObject } from "../../object";
import {
  cursorDownProp,
  cursorMoveProp,
  cursorState,
  cursorUpProp,
} from "../../input";
import { RectCollider, Collider } from "../../collision";
import { NodeComponent } from "./node";

class RectSelectComponent extends ElementObject {
  _state: "none" | "dragging";
  _mouseDownX: number;
  _mouseDownY: number;
  _selectHitBox: Collider;
  constructor(globals: GlobalManager, parent: BaseObject) {
    super(globals, parent);

    this._state = "none";
    this._mouseDownX = 0;
    this._mouseDownY = 0;

    this.event.global.onCursorDown = this.onGlobalCursorDown;
    this.event.global.onCursorMove = this.onGlobalCursorMove;
    this.event.global.onCursorUp = this.onGlobalCursorUp;

    this._selectHitBox = new RectCollider(globals, this, 0, 0, 0, 0);
    this._selectHitBox.localX = 0;
    this._selectHitBox.localY = 0;
    this._selectHitBox.event.collider.onCollide = this.onCollideNode;

    this.addCollider(this._selectHitBox);

    this.global.data.select = [];
  }

  addDom(dom: HTMLElement): DomElement {
    let domElement = super.addDom(dom);
    domElement.style = {
      width: "0px",
      height: "0px",
      transformOrigin: "top left",
      position: "absolute",
      left: "0px",
      top: "0px",
      pointerEvents: "none",
    };
    this.requestWrite();
    return domElement;
  }

  onGlobalCursorDown(prop: cursorDownProp): void {
    if (
      prop.button !== cursorState.mouseLeft ||
      (prop.element && prop.element.id !== "sl-background")
    ) {
      return;
    }
    for (let node of this.global.data.select) {
      node.setSelected(false);
    }

    this.global.data.select = [];
    this.worldPosition = [prop.worldX, prop.worldY];
    this._selectHitBox.recalculate();
    this._state = "dragging";
    this.dom.style = {
      display: "block",
      width: "0px",
      height: "0px",
    };
    this._mouseDownX = prop.worldX;
    this._mouseDownY = prop.worldY;

    this._selectHitBox.event.collider.onBeginContact = (
      _: Collider,
      otherObject: Collider,
    ) => {
      if (otherObject.parent.constructor.name === "NodeComponent") {
        let node = otherObject.parent as NodeComponent;
        node.setSelected(true);
      }
    };
    this._selectHitBox.event.collider.onEndContact = (
      thisObject: Collider,
      otherObject: Collider,
    ) => {
      console.debug("onEndContact", thisObject, otherObject);
      if (otherObject.parent.constructor.name === "NodeComponent") {
        let node = otherObject.parent as NodeComponent;
        node.setSelected(false);
      }
    };
  }

  onGlobalCursorMove(prop: cursorMoveProp): void {
    if (this._state === "dragging") {
      let [boxOriginX, boxOriginY] = [
        Math.min(this._mouseDownX, prop.worldX),
        Math.min(this._mouseDownY, prop.worldY),
      ];
      let [boxWidth, boxHeight] = [
        Math.abs(prop.worldX - this._mouseDownX),
        Math.abs(prop.worldY - this._mouseDownY),
      ];
      this.dom.style = {
        width: `${boxWidth}px`,
        height: `${boxHeight}px`,
      };
      this.worldPosition = [boxOriginX, boxOriginY];
      this._selectHitBox.localX = this.position.worldX - boxOriginX;
      this._selectHitBox.localY = this.position.worldY - boxOriginY;
      this._selectHitBox.width = boxWidth;
      this._selectHitBox.height = boxHeight;
      this.requestPostWrite();
    }
  }

  onGlobalCursorUp(prop: cursorUpProp): void {
    this.dom.style = {
      display: "none",
    };
    this._state = "none";

    this._selectHitBox.event.collider.onBeginContact = null;
    this._selectHitBox.event.collider.onEndContact = null;
    this.requestPostWrite();
  }

  onCollideNode(hitBox: Collider, node: Collider): void {}
}

export { RectSelectComponent };
