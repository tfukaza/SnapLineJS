import { GlobalManager } from "../../global";
import { BaseObject, ElementObject } from "../../object";
import { pointerDownProp, pointerMoveProp, pointerUpProp } from "../../input";
import { RectCollider, Collider } from "../../collision";
import { NodeComponent } from "./node";

class RectSelectComponent extends ElementObject {
  _state: "none" | "dragging";
  _mouseDownX: number;
  _mouseDownY: number;
  _selectHitBox: Collider;
  constructor(globals: GlobalManager, parent: BaseObject | null) {
    super(globals, parent);

    this._state = "none";
    this._mouseDownX = 0;
    this._mouseDownY = 0;

    this.event.global.pointerDown = this.onGlobalCursorDown;
    this.event.global.pointerMove = this.onGlobalCursorMove;
    this.event.global.pointerUp = this.onGlobalCursorUp;

    this._selectHitBox = new RectCollider(globals, this, 0, 0, 0, 0);
    this._selectHitBox.transform.x = 0;
    this._selectHitBox.transform.y = 0;
    this._selectHitBox.event.collider.onCollide = this.onCollideNode;

    this.addCollider(this._selectHitBox);

    this.global.data.select = [];

    this.dom.style = {
      width: "0px",
      height: "0px",
      transformOrigin: "top left",
      position: "absolute",
      left: "0px",
      top: "0px",
      pointerEvents: "none",
    };
    this.requestWrite();
  }

  onGlobalCursorDown(prop: pointerDownProp): void {
    if (
      prop.event.button !== 0 ||
      (prop.event.target &&
        (prop.event.target as HTMLElement).id !== "sl-background")
    ) {
      return;
    }
    for (let node of this.global.data.select) {
      node.setSelected(false);
    }

    this.global.data.select = [];
    this.worldPosition = [prop.position.x, prop.position.y];
    this._selectHitBox.recalculate();
    this._state = "dragging";
    this.dom.style = {
      display: "block",
      width: "0px",
      height: "0px",
    };
    this._mouseDownX = prop.position.x;
    this._mouseDownY = prop.position.y;

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
      this.dom.style = {
        width: `${boxWidth}px`,
        height: `${boxHeight}px`,
      };
      this.worldPosition = [boxOriginX, boxOriginY];
      this._selectHitBox.transform.x = this.transform.x - boxOriginX;
      this._selectHitBox.transform.y = this.transform.y - boxOriginY;
      this._selectHitBox.transform.width = boxWidth;
      this._selectHitBox.transform.height = boxHeight;
      this.requestPostWrite();
    }
  }

  onGlobalCursorUp(prop: pointerUpProp): void {
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
