import { GlobalManager } from "../global";
import { BaseObject, DomElement, ElementObject } from "../object";
import { cursorMoveProp } from "../input";

class Background extends ElementObject {
  _tileSize: number = 40;

  constructor(globals: GlobalManager, parent: BaseObject | null) {
    super(globals, parent);
    this.event.global.onCursorMove = this.moveBackground;
  }

  addDom(dom: HTMLElement): DomElement {
    const domElement = super.addDom(dom);
    domElement.style = {
      position: "absolute",
      top: "0",
      left: "0",
      backgroundSize: `${this._tileSize}px ${this._tileSize}px`,
    };
    this.moveBackground();
    return domElement;
  }

  moveBackground(_?: cursorMoveProp) {
    let x = this.global.camera?.cameraPositionX;
    let y = this.global.camera?.cameraPositionY;
    let width = this.global.camera?.cameraWidth! * 5;
    let height = this.global.camera?.cameraHeight! * 5;
    this.worldPosition = [
      Math.floor(x! / this._tileSize) * this._tileSize - width / 2,
      Math.floor(y! / this._tileSize) * this._tileSize - height / 2,
    ];
    this.dom.style = {
      width: `${width}px`,
      height: `${height}px`,
    };
    this.requestPostWrite();
  }
}

export { Background };
