import { BaseObject, frameStats } from "../../object";
import { ConnectorComponent } from "./connector";
import { ElementObject } from "../../object";
import { LineComponent } from "./line";
import {
  pointerUpProp,
  pointerDownProp,
  dragStartProp,
  dragProp,
  dragEndProp,
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
    this._lineListCallback = null;
    this.transformMode = "direct";

    this.event.input.pointerDown = this.onCursorDown;
    this.event.input.dragStart = this.onDragStart;
    this.event.input.drag = this.onDrag;
    this.event.input.dragEnd = this.onDragEnd;
    this.event.input.pointerUp = this.onUp;
    this._hitBox = new RectCollider(this.global, this, 0, 0, 0, 0);
    this.addCollider(this._hitBox);

    this._selected = false;
    this._hasMoved = false;

    this.event.dom.onResize = () => {
      this.queueUpdate("READ_1", () => {
        this.readDom(false, "READ_1");
        for (const connector of Object.values(this._connectors)) {
          connector.readDom(false, "READ_1");
          connector.calculateLocalFromDom("READ_1");
          connector.calculateTransformFromLocal();
        }
      });
      for (const line of [
        ...this.getAllOutgoingLines(),
        ...this.getAllIncomingLines(),
      ]) {
        line.queueUpdate("WRITE_1", () => {
          line.moveLineToConnectorTransform(); // Move lines to the saved position of connectors
          line.setLineEndAtConnector();
          line.writeDom();
          line.writeTransform();
        });
      }
    };

    this.style = {
      willChange: "transform",
      position: "absolute",
      transformOrigin: "top left",
    };
    this.event.dom.onAssignDom = () => {
      this._hitBox.element = this.element!;
    };
  }

  setStartPositions() {
    this._dragStartX = this.transform.x;
    this._dragStartY = this.transform.y;
  }

  setSelected(selected: boolean) {
    this._selected = selected;
    this.dataAttribute = {
      selected: selected,
    };
    if (selected) {
      this.global.data.select.push(this);
    } else {
      this.classList = this.classList.filter(
        (className) => className !== "selected",
      );
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
      // console.log("updateNodeLineList", this.gid);
      this._lineListCallback(this.getAllOutgoingLines());
    }
  }

  setLineListCallback(callback: (lines: LineComponent[]) => void) {
    this._lineListCallback = callback;
  }

  onCursorDown(e: pointerDownProp): void {
    if (e.event.button != 0) {
      return;
    }

    if (this.global.data.select?.includes(this) == false) {
      for (const node of this.global.data.select) {
        node.setSelected(false);
      }
      this.setSelected(true);
    }
  }

  onDragStart(prop: dragStartProp): void {
    for (const node of this.global.data.select ?? []) {
      node.setStartPositions();
      node._mouseDownX = prop.start.x;
      node._mouseDownY = prop.start.y;
    }
    this._hasMoved = true;
  }

  onDrag(prop: dragProp): void {
    if (this.global == null) {
      console.error("Global stats is null");
      return;
    }
    if (this._config.lockPosition) return;

    for (const node of this.global.data.select ?? []) {
      node.setDragPosition(prop);
    }
  }

  setDragPosition(prop: dragProp) {
    const dx = prop.position.x - this._mouseDownX;
    const dy = prop.position.y - this._mouseDownY;

    this.worldPosition = [this._dragStartX + dx, this._dragStartY + dy];
    this.updateNodeLines();
    this.requestTransform("WRITE_2");
  }

  onDragEnd(prop: dragEndProp) {
    for (const node of this.global.data.select ?? []) {
      node.setUpPosition(prop);
    }
  }

  setUpPosition(prop: dragEndProp) {
    const [dx, dy] = [
      prop.end.x - this._mouseDownX,
      prop.end.y - this._mouseDownY,
    ];
    this.worldPosition = [this._dragStartX + dx, this._dragStartY + dy];
    // this.calculateLocalTransform();
    this.updateNodeLines();
  }

  onUp(prop: pointerUpProp) {
    if (this._hasMoved == false) {
      for (const node of this.global.data.select ?? []) {
        node.setSelected(false);
      }
      this.setSelected(true);
      return;
    }
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
      parent.setProp(peer.name, value);
    }
  }

  propagateProp() {
    for (const connector of Object.values(this._connectors)) {
      this.setProp(connector.name, this.getProp(connector.name));
    }
  }
}

export { NodeComponent };
