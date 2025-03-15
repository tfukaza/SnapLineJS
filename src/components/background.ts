import { GlobalManager } from "../global";
import { BaseObject, DomElement, ElementObject } from "./object";
import { cursorMoveProp } from "../input";

class Background extends ElementObject {
  _tileSize: number = 40;
  constructor(globals: GlobalManager, parent: BaseObject) {
    super(globals, parent);

    this.event.global.onCursorMove = this.moveBackground;
  }

  addDom(dom: HTMLElement): DomElement {
    const domElement = super.addDom(dom);
    domElement.style = {
      position: "absolute",
      top: "0",
      left: "0",
      width: `100px`,
      height: `100px`,
      backgroundSize: `${this._tileSize}px ${this._tileSize}px`,
      transform: "translate(0px, 0px)",
    };
    return domElement;
  }

  moveBackground(prop: cursorMoveProp) {
    // console.debug("moveBackground");
    let x = this.global.camera?.cameraPositionX;
    let y = this.global.camera?.cameraPositionY;
    let width = this.global.camera?.cameraWidth! * 5;
    let height = this.global.camera?.cameraHeight! * 5;
    this.worldX = Math.floor(x! / this._tileSize) * this._tileSize;
    this.worldY = Math.floor(y! / this._tileSize) * this._tileSize;
    this.dom.style = {
      transform: `translate(${this.worldX - width! / 2}px, ${
        this.worldY - height! / 2
      }px)`,
      width: `${width}px`,
      height: `${height}px`,
    };
    // this.submitRender();
  }

  //   render() {
  //     let x = this.global.camera?.cameraPositionX;
  //     let y = this.global.camera?.cameraPositionY;
  //     setDomStyle(this._dom!, {
  //       transform: `translate(${x}px, ${y}px)`,
  //     });
  //     // super.render();
  //     // this.requestRender = false;
  //     // this.submitRender();
  //   }
}

export { Background };
