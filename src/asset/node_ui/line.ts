import { GlobalManager } from "../../global";
import { ElementObject, BaseObject } from "../../object";
import { ConnectorComponent } from "./connector";

class LineComponent extends ElementObject {
  endWorldX: number;
  endWorldY: number;

  start: ConnectorComponent;
  target: ConnectorComponent | null;

  constructor(globals: GlobalManager, parent: BaseObject) {
    super(globals, parent);

    this.endWorldX = 0;
    this.endWorldY = 0;

    this.start = parent as unknown as ConnectorComponent;
    this.target = null;

    this.transformMode = "direct";
  }

  setLineStartAtConnector() {
    this.setLineStart(this.start.transform.x, this.start.transform.y);
  }

  setLineEndAtConnector() {
    if (this.target) {
      this.setLineEnd(this.target.transform.x, this.target.transform.y);
    }
  }

  setLineStart(startPositionX: number, startPositionY: number) {
    this.worldPosition = [startPositionX, startPositionY];
  }

  setLineEnd(endWorldX: number, endWorldY: number) {
    this.endWorldX = endWorldX;
    this.endWorldY = endWorldY;
  }

  setLinePosition(
    startWorldX: number,
    startWorldY: number,
    endWorldX: number,
    endWorldY: number,
  ) {
    this.setLineStart(startWorldX, startWorldY);
    this.setLineEnd(endWorldX, endWorldY);
  }

  applyCache() {
    this.setLineStartAtConnector();
    if (!this.target) {
      // this.setLineEnd(this.global.cursor.worldX, this.global.cursor.worldY);
    } else {
      this.setLineEndAtConnector();
    }
  }
}

export { LineComponent };
