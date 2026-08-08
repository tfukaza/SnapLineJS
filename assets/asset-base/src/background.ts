import { BaseObject, ElementObject } from "@snap-engine/core";
import type { pointerMoveProp } from "@snap-engine/core";

class Background extends ElementObject {
  _tileSize: number = 40;

  constructor(engine: any, parent: BaseObject | null) {
    super(engine, parent);
    this.event.global.pointerMove = this.moveBackground;
    this.style = {
      position: "absolute",
      top: "0",
      left: "0",
      backgroundSize: `${this._tileSize}px ${this._tileSize}px`,
    };
    this.moveBackground();
  }

  moveBackground(_?: pointerMoveProp) {
    let x = this.engine.camera?.cameraPositionX;
    let y = this.engine.camera?.cameraPositionY;
    let width = this.engine.camera?.cameraWidth! * 5;
    let height = this.engine.camera?.cameraHeight! * 5;
    this.worldTransform = {
      x: Math.floor(x! / this._tileSize) * this._tileSize - width / 2,
      y: Math.floor(y! / this._tileSize) * this._tileSize - height / 2,
    };
    this.style = {
      width: `${width}px`,
      height: `${height}px`,
    };
    this.schedule(() => this.writeDom(), {
      stage: "WRITE_1",
      queueId: "WRITE_1",
    });
  }
}

export { Background };
