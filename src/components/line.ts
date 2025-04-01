import { GlobalManager } from "../global";
import { ElementObject } from "./object";
import { ConnectorComponent } from "./connector";

class LineComponent extends ElementObject {
  endWorldX: number;
  endWorldY: number;

  start: ConnectorComponent;
  target: ConnectorComponent | null;

  constructor(globals: GlobalManager, parent: ConnectorComponent) {
    super(globals, parent);

    this.endWorldX = 0;
    this.endWorldY = 0;

    this.start = parent;
    this.target = null;
  }

  setLineStartAtConnector() {
    this.setLineStart(this.start.worldPosition[0], this.start.worldPosition[1]);
  }

  setLineEndAtConnector() {
    if (this.target) {
      this.setLineEnd(...this.target.worldPosition);
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
      this.setLineEnd(this.global.cursor.worldX, this.global.cursor.worldY);
    } else {
      this.setLineEndAtConnector();
    }
  }
}

export { LineComponent };
