import { GlobalManager } from "../global";
import { BaseObject, DomElement, ElementObject } from "./object";
import { ObjectTypes } from "../types";
import {
  cursorDownProp,
  cursorMoveProp,
  cursorState,
  cursorUpProp,
} from "../input";
import { RectCollider, Collider } from "../collision";
import { NodeComponent } from "./node";

/**
 * Connector components connect together nodes using lines.
 */
class RectSelectComponent extends ElementObject {
  _state: string;
  _mouseDownX: number;
  _mouseDownY: number;
  _selectHitBox: Collider;
  constructor(globals: GlobalManager, parent: BaseObject) {
    super(globals, parent);

    // this.style = {
    //   width: "0px",
    //   height: "0px",
    //   transformOrigin: "top left",
    //   position: "absolute",
    //   // left: "0px",
    //   // top: "0px",
    //   pointerEvents: "none",
    //   // opacity: "0",
    // };

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
      // opacity: "0",
    };
    return domElement;
  }

  onGlobalCursorDown(prop: cursorDownProp): void {
    if (
      prop.button !== cursorState.mouseLeft ||
      (prop.element && prop.element.id !== "sl-background")
    ) {
      return;
    }
    console.debug(`onRectSelectDown at ${prop.worldX}, ${prop.worldY}`);
    // let [cameraX, cameraY] = this.g.camera.getCameraFromScreen(
    //   prop.clientX,
    //   prop.clientY,
    // );
    // let [worldX, worldY] = this.g.camera.getWorldFromCamera(cameraX, cameraY);
    this.worldPosition = [prop.worldX, prop.worldY];
    // this.dom.worldPosition = [prop.worldX, prop.worldY];
    this._selectHitBox.updateProperty();
    this._state = "dragging";
    this.dom.style = {
      display: "block",
      // transform: `translate3d(${prop.worldX}px, ${prop.worldY}px, 0)`,
      width: "0px",
      height: "0px",
    };
    this._mouseDownX = prop.worldX;
    this._mouseDownY = prop.worldY;

    this._selectHitBox.event.collider.onBeginContact = (
      thisObject: Collider,
      otherObject: Collider,
    ) => {
      if (otherObject.parent instanceof NodeComponent) {
        otherObject.parent.setSelected(true);
      }
    };
    this._selectHitBox.event.collider.onEndContact = (
      thisObject: Collider,
      otherObject: Collider,
    ) => {
      console.debug(`onEndContact between ${thisObject} and ${otherObject}`);
      if (otherObject.parent instanceof NodeComponent) {
        otherObject.parent.setSelected(false);
      }
    };
  }

  onGlobalCursorMove(prop: cursorMoveProp): void {
    if (this._state === "dragging") {
      // console.debug(
      //   `onRectSelectMove, dx: ${prop.clientX - this._mouseDownX}, dy: ${prop.clientY - this._mouseDownY}`,
      // );
      // let [cameraX, cameraY] = this.g.camera.getCameraFromScreen(
      //   prop.clientX,
      //   prop.clientY,
      // );
      // let [worldX, worldY] = this.g.camera.getWorldFromCamera(cameraX, cameraY);
      // this.worldPosition = [worldX, worldY];
      let [boxOriginX, boxOriginY] = [
        Math.min(this._mouseDownX, prop.worldX),
        Math.min(this._mouseDownY, prop.worldY),
      ];
      let [boxWidth, boxHeight] = [
        Math.abs(prop.worldX - this._mouseDownX),
        Math.abs(prop.worldY - this._mouseDownY),
      ];
      this.dom.style = {
        // transform: `translate3d(${boxOriginX}px, ${boxOriginY}px, 0)`,
        width: `${boxWidth}px`,
        height: `${boxHeight}px`,
      };
      this.worldPosition = [boxOriginX, boxOriginY];
      this._selectHitBox.localX = this.position.worldX - boxOriginX;
      this._selectHitBox.localY = this.position.worldY - boxOriginY;
      this._selectHitBox.width = boxWidth;
      this._selectHitBox.height = boxHeight;
      // this._selectHitBox.updateProperty();
      // console.debug(
      //   `hithbox, localX: ${this._selectHitBox.localX}, localY: ${this._selectHitBox.localY}, width: ${this._selectHitBox.width}, height: ${this._selectHitBox.height}`,
      // );

      // this.submitRender();
    }
  }

  onGlobalCursorUp(prop: cursorUpProp): void {
    console.debug(`onRectSelectUp at ${prop.worldX}, ${prop.worldY}`);
    this.dom.style = {
      display: "none",
    };
    this._state = "none";

    this._selectHitBox.event.collider.onBeginContact = null;
    this._selectHitBox.event.collider.onEndContact = null;
    // this.submitRender();
  }

  onCollideNode(hitBox: Collider, node: Collider): void {
    // console.debug(
    //   `onCollideNode between ${hitBox.parent.gid} and ${node.parent.gid}`,
    // );
  }
}

export { RectSelectComponent };
