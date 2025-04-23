import { BaseObject, frameStats } from "../../object";
import { ConnectorComponent } from "./connector";
import { ElementObject } from "../../object";
import { LineComponent } from "./line";
import {
  cursorUpProp,
  cursorDownProp,
  cursorState,
  cursorMoveProp,
} from "../../input";
import { RectCollider } from "../../collision";
import { GlobalManager } from "../../global";

export interface NodeConfig {
  lockPosition?: boolean;
}

class NodeComponent extends ElementObject {
  _config: NodeConfig;
  _connectors: { [key: string]: ConnectorComponent };
  _components: { [key: string]: ElementObject };
  _nodeWidth = 0;
  _nodeHeight = 0;
  _dragStartX = 0;
  _dragStartY = 0;
  _prop: { [key: string]: any };
  _propSetCallback: { [key: string]: (value: any) => void };
  _nodeStyle: any;
  _lineListCallback: ((lines: LineComponent[]) => void) | null;
  _hitBox: RectCollider;
  _selected: boolean;
  _mouseDownX: number;
  _mouseDownY: number;
  _hasMoved: boolean;

  constructor(
    global: GlobalManager,
    parent: BaseObject | null,
    config: NodeConfig = {},
  ) {
    super(global, parent);
    this._config = config;

    this._connectors = {};
    this._components = {};
    this._dragStartX = this.transform.x;
    this._dragStartY = this.transform.y;
    this._mouseDownX = 0;
    this._mouseDownY = 0;
    this._prop = {};
    this._propSetCallback = {};
    this.transform.x = 0;
    this.transform.y = 0;
    this._lineListCallback = null;

    this.event.dom.onCursorDown = this.onCursorDown;
    this._hitBox = new RectCollider(this.global, this, 0, 0, 0, 0);
    this.addCollider(this._hitBox);

    this._selected = false;
    this._hasMoved = false;

    this.event.dom.onResize = () => {
      let stats: frameStats = this.getCurrentStats();
      this.read(stats);
      this.generateCache();
      for (const connector of Object.values(this._connectors)) {
        connector.read(stats);
        connector.generateCache(true);
        connector.postWrite(stats);
      }
      for (const line of [
        ...this.getAllOutgoingLines(),
        ...this.getAllIncomingLines(),
      ]) {
        line.calculateCache();
        line.applyCache();
        line.postWrite(stats);
      }
      this.postWrite(stats);
    };

    this.dom.style = {
      willChange: "transform",
      position: "absolute",
      transformOrigin: "top left",
    };
    this._hitBox.assignDom(dom);
  }

  #setStartPositions() {
    this._dragStartX = this.worldX;
    this._dragStartY = this.worldY;
  }

  setSelected(selected: boolean) {
    this._selected = selected;
    this.dom.dataAttribute = {
      selected: selected,
    };
    if (selected) {
      this._dom?.classList.add("selected");
      this.global.data.select.push(this);
    } else {
      this._dom?.classList.remove("selected");
      this.global.data.select = this.global.data.select.filter(
        (node: NodeComponent) => node.gid !== this.gid,
      );
    }
    this.requestWrite();
  }

  _filterDeletedLines(svgLines: LineComponent[]) {
    for (let i = 0; i < svgLines.length; i++) {
      if (svgLines[i]._requestDelete) {
        svgLines.splice(i, 1);
        i--;
      }
    }
  }

  updateNodeLines(): void {
    for (const connector of Object.values(this._connectors)) {
      connector.updateAllLines();
    }
  }

  updateNodeLineList(): void {
    if (this._lineListCallback) {
      this._lineListCallback(this.getAllOutgoingLines());
    }
  }

  setLineListCallback(callback: (lines: LineComponent[]) => void) {
    this._lineListCallback = callback;
  }

  onCursorDown(e: cursorDownProp): void {
    if (e.button != cursorState.mouseLeft) {
      return;
    }
    this.calculateCache();

    if (this.global.data.select?.includes(this) == false) {
      for (const node of this.global.data.select) {
        node.setSelected(false);
      }
      this.setSelected(true);
    }

    this._hasMoved = false;

    for (const node of this.global.data.select ?? []) {
      node.#setStartPositions();
      node._mouseDownX = e.worldX;
      node._mouseDownY = e.worldY;
    }

    this.event.global.onCursorMove = this.onDrag;
    this.event.global.onCursorUp = this.onUp;
  }

  onDrag(prop: cursorMoveProp): void {
    if (this.global == null) {
      console.error("Global stats is null");
      return;
    }
    if (this._config.lockPosition) return;

    this._hasMoved = true;

    for (const node of this.global.data.select ?? []) {
      node.setDragPosition(prop);
    }
  }

  setDragPosition(prop: cursorMoveProp) {
    const dx = prop.worldX - this._mouseDownX;
    const dy = prop.worldY - this._mouseDownY;

    this.worldPosition = [this._dragStartX + dx, this._dragStartY + dy];
    this.calculateCache();
    this.updateNodeLines();
    this.requestPostWrite();
  }

  onUp(prop: cursorUpProp) {
    this.event.global.onCursorMove = null;
    this.event.global.onCursorUp = null;

    if (this._hasMoved == false) {
      for (const node of this.global.data.select ?? []) {
        node.setSelected(false);
      }
      this.setSelected(true);
      return;
    }

    for (const node of this.global.data.select ?? []) {
      node.setUpPosition(prop);
    }
  }

  setUpPosition(prop: cursorUpProp) {
    const [dx, dy] = [
      prop.worldX - this._mouseDownX,
      prop.worldY - this._mouseDownY,
    ];
    this.worldPosition = [this._dragStartX + dx, this._dragStartY + dy];
    this.calculateCache();
    this.updateNodeLines();
  }

  getConnector(name: string): ConnectorComponent | null {
    if (!(name in this._connectors)) {
      console.error(`Connector ${name} does not exist in node ${this.gid}`);
      return null;
    }
    return this._connectors[name];
  }

  addConnectorObject(connector: ConnectorComponent) {
    connector.assignToNode(this);
  }

  addSetPropCallback(callback: (value: any) => void, name: string) {
    this._propSetCallback[name] = callback;
  }

  getAllOutgoingLines(): LineComponent[] {
    return Object.values(this._connectors).flatMap(
      (connector) => connector.outgoingLines,
    );
  }

  getAllIncomingLines(): LineComponent[] {
    return Object.values(this._connectors).flatMap(
      (connector) => connector.incomingLines,
    );
  }

  getProp(name: string) {
    return this._prop[name];
  }

  setProp(name: string, value: any) {
    if (name in this._propSetCallback) {
      this._propSetCallback[name](value);
    }
    this._prop[name] = value;

    if (!(name in this._connectors)) {
      return;
    }
    const peers = this._connectors[name].outgoingLines
      .filter((line) => line.target && !line._requestDelete)
      .map((line) => line.target);
    if (!peers) {
      return;
    }
    for (const peer of peers) {
      if (!peer) continue;
      if (!peer.parent) continue;
      let parent = peer.parent as NodeComponent;
      parent._prop[peer.name] = value;
      if (parent._propSetCallback[peer.name]) {
        parent._propSetCallback[peer.name](value);
      }
    }
  }
}

export { NodeComponent };
