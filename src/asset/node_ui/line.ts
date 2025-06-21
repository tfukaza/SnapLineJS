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
    const center = this.start.center;
    this.setLineStart(center.x, center.y);
  }

  setLineEndAtConnector() {
    if (this.target) {
      const center = this.target.center;
      this.setLineEnd(center.x, center.y);
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

  moveLineToConnectorTransform() {
    this.setLineStartAtConnector();
    if (!this.target) {
      // this.setLineEnd(this.global.cursor.worldX, this.global.cursor.worldY);
    } else {
      this.setLineEndAtConnector();
    }
  }
}

export { LineComponent };
