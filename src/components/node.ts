import { BaseObject } from "./object";
import { NodeConfig } from "../types";
import { ConnectorComponent } from "./connector";
import { InputForm } from "./input";
import { ElementObject } from "./object";
import { LineComponent } from "./line";
import {
  cursorUpProp,
  cursorDownProp,
  cursorState,
  cursorMoveProp,
} from "../input";
import { RectCollider } from "../collision";
import { GlobalManager } from "../global";

class NodeComponent extends ElementObject {
  _config: NodeConfig;
  _dom: HTMLElement | null;
  _connectors: { [key: string]: ConnectorComponent }; // Dictionary of all connectors in the node, using the name as the key
  _components: { [key: string]: ElementObject }; // Dictionary of all components in the node except connectors
  // _allOutgoingLines: { [key: string]: LineComponent[] }; // Dictionary of all lines going out of the node
  // _allIncomingLines: { [key: string]: LineComponent[] }; // Dictionary of all lines coming into the node
  _nodeWidth = 0;
  _nodeHeight = 0;
  _dragStartX = 0;
  _dragStartY = 0;
  _prop: { [key: string]: any }; // Properties of the node
  _propSetCallback: { [key: string]: (value: any) => void }; // Callbacks called when a property is set
  _nodeStyle: any;
  _lineListCallback: ((lines: LineComponent[]) => void) | null;
  _hitBox: RectCollider;
  _selected: boolean;
  _mouseDownX: number;
  _mouseDownY: number;
  // _selected: boolean;

  // ================= Private functions =================

  constructor(
    global: GlobalManager,
    parent: BaseObject | null,
    dom: HTMLElement | null = null,
    config: NodeConfig = {},
  ) {
    super(global, parent);
    this._config = config;

    this._dom = dom;
    this._connectors = {};
    this._components = {};
    // this._allOutgoingLines = {};
    // this._allIncomingLines = {};

    this._dragStartX = this.worldX;
    this._dragStartY = this.worldY;
    this._mouseDownX = 0;
    this._mouseDownY = 0;

    this._prop = {};
    this._propSetCallback = {};

    this.position.worldX = 0;
    this.position.worldY = 0;

    // this.style = {
    //   willChange: "transform",
    //   position: "absolute",
    //   transformOrigin: "top left",
    //   transform: `translate3d(${this.worldX}px, ${this.worldY}px, 0)`,
    // };
    this._lineListCallback = null;

    this.event.dom.onCursorDown = this.onCursorDown;
    this._hitBox = new RectCollider(this.global, this, 0, 0, 0, 0);
    // this._hitBox.event.rigid.onCollide = this.onCollideNode;
    // this._hitBox.assignDom(this._dom);
    this.addCollider(this._hitBox);
    // this.event.dom.onCursorMove = this._onCursorMove;
    // this.event.dom.onCursorUp = this._onCursorUp;
    // this.event.dom.onCursorScroll = this._onCursorScroll;
    this._selected = false;
  }

  // set position(position: [number, number]) {
  //   super.worldPosition = position;
  //   this.style = {
  //     transform: `translate3d(${position[0]}px, ${position[1]}px, 0)`,
  //   };
  // }

  addDom(dom: HTMLElement) {
    let domElement = super.addDom(dom);
    domElement.style = {
      willChange: "transform",
      position: "absolute",
      transformOrigin: "top left",
      // transform: `translate3d(${this.worldX}px, ${this.worldY}px, 1px)`,
    };
    this._hitBox.assignDom(dom);
    return domElement;
  }

  /**
   *  Focuses on the object.
   */
  onFocus(): void {
    this._selected = true;
    // this.submitRender();
  }

  /**
   *  Removes focus from the object.
   */
  offFocus(): void {
    this._selected = false;
    // this.submitRender();
  }

  /**
   * Sets the starting position of the node when it is dragged.
   */
  #setStartPositions() {
    this._dragStartX = this.worldX;
    this._dragStartY = this.worldY;
  }

  // ================= Hidden functions =================

  setSelected(selected: boolean) {
    this._selected = selected;
    if (selected) {
      this._dom?.classList.add("selected");
      this.global.data.select.push(this);
    } else {
      this._dom?.classList.remove("selected");
      this.global.data.select = this.global.data.select.filter(
        (node: NodeComponent) => node.gid !== this.gid,
      );
    }
    this.submitRenderQueue();
  }

  /**
   * Filters out lines that have been requested to be deleted.
   * @param svgLines Array of all lines outgoing from the node or connector
   */
  _filterDeletedLines(svgLines: LineComponent[]) {
    for (let i = 0; i < svgLines.length; i++) {
      if (svgLines[i].requestDelete) {
        svgLines.splice(i, 1);
        i--;
      }
    }
  }

  /**
   * Renders the specified outgoing lines.
   * This function can be called by the node or a connector.on the node.
   * @param outgoingLines Array of all lines outgoing from the node or connector
   */
  // _renderOutgoingLines(outgoingLines: LineComponent[], key?: string) {
  // for (const line of outgoingLines) {
  //   const connector = line.start;
  //   if (!line.requestDelete && !line.initialRender) {
  //     // line.createLine();
  //   } else if (line.requestDelete && !line.completedDelete) {
  //     line.delete();
  //     line.render();
  //     line.completedDelete = true;
  //     continue;
  //   }
  //   if (!line._dom) {
  //     continue;
  //   }
  //   line.positionX = connector.positionX;
  //   line.positionY = connector.positionY;
  //   if (line.target) {
  //     line.endPositionX = line.target.positionX;
  //     line.endPositionY = line.target.positionY;
  //   }
  //   line.render();
  // }
  // this._filterDeletedLines(outgoingLines);
  // }

  /**
   * Update the position of all lines connected to the node.
   */
  updateNodeLines(): void {
    for (const connector of Object.values(this._connectors)) {
      connector.updateAllLines();
    }
  }

  updateNodeLineList(): void {
    if (this._lineListCallback) {
      this._lineListCallback(this.getAllOutgoingLines());
    }

    // for (const key in this._allIncomingLines) {
    //   for (const incomingLine of this._allIncomingLines[key]) {
    //     const peerNode: NodeComponent | null = incomingLine.start
    //       .parent as NodeComponent;
    //     if (!peerNode) continue;
    //     for (const key in peerNode._allOutgoingLines) {
    //       this._renderOutgoingLines(peerNode._allOutgoingLines[key], key);
    //     }
    //   }
    // }
  }

  // render(): void {
  //   super.render();
  //   this._renderNodeLines();
  // }

  /**
   * Sets the callback function that is called when lines owned by the node (i.e. outgoing lines) are rendered.
   * @param
   */
  setLineListCallback(callback: (lines: LineComponent[]) => void) {
    this._lineListCallback = callback;
  }

  // getRenderLinesCallback(): (lines: LineComponent[], name: string) => void {
  //   return this._renderOutgoingLines;
  // }

  onCursorDown(e: cursorDownProp): void {
    // super.onCursorDown(e);

    console.debug("onCursorDown", this.gid, e.button);

    if (e.button != cursorState.mouseLeft) {
      return;
    }

    if (this.global.data.select.includes(this) == false) {
      this.setSelected(true);
    }

    // let isInFocusNodes = false;
    // for (let i = 0; i < this.global.focusNodes.length; i++) {
    //   if (this.global.focusNodes[i].gid == this.gid) {
    //     isInFocusNodes = true;
    //     break;
    //   }
    // }
    // if (!isInFocusNodes) {
    //   /* If this node is not in focusNodes, then it is a regular click
    //    * Unselect other nodes in focusNodes */
    //   for (let i = 0; i < this.g.focusNodes.length; i++) {
    //     this.g.focusNodes[i].offFocus();
    //   }
    //   this.g.focusNodes = [this];
    //   this.onFocus();
    // } else {
    //   /* Otherwise, we are dragging multiple nodes.
    //    * Call the setStartPositions function for all nodes in focusNodes */
    //   for (let i = 0; i < this.g.focusNodes.length; i++) {
    //     this.g.focusNodes[i].#setStartPositions();
    //   }
    // }
    // this.#setStartPositions();
    // this._mouseDownX = e.worldX;
    // this._mouseDownY = e.worldY;

    // Repeat it for all nodes in select
    for (const node of this.global.data.select) {
      node.#setStartPositions();
      node._mouseDownX = e.worldX;
      node._mouseDownY = e.worldY;
    }

    this.event.global.onCursorMove = this.onDrag;
    this.event.global.onCursorUp = this.onUp;
  }

  onDrag(prop: cursorMoveProp): void {
    // console.debug("onDrag", this.global.data.select);
    // console.trace();
    if (this.global == null) {
      console.error("Global stats is null");
      return;
    }
    if (this._config.lockPosition) return;

    // this.setDragPosition(prop);

    // console.debug("onDrag", this.gid, this.global.data.select);

    // Repeat it for all nodes in select
    for (const node of this.global.data.select) {
      node.setDragPosition(prop);
    }
  }

  setDragPosition(prop: cursorMoveProp) {
    const dx = prop.worldX - this._mouseDownX;
    const dy = prop.worldY - this._mouseDownY;
    // this.global.camera?.getWorldDeltaFromCameraDelta(dx, dy) ?? [0, 0];

    this.worldPosition = [this._dragStartX + dx, this._dragStartY + dy];
    console.debug("setDragPosition", this.worldPosition);
    // this.dom.worldPosition = this.worldPosition;
    // this.style = {
    //   transform: `translate3d(${this.worldX}px, ${this.worldY}px, 0)`,
    // };
    this.updateProperty();
    this.updateNodeLines();
    this.submitRenderQueue();
  }

  onUp(prop: cursorUpProp) {
    console.debug("onCursorUp on Node", this.gid);
    this.event.global.onCursorMove = null;
    this.event.global.onCursorUp = null;
    // console.assert(this.global != null, "Global stats is null");
    // if (this._config.lockPosition) return;

    // Repeat it for all nodes in select
    for (const node of this.global.data.select) {
      node.setUpPosition(prop);
    }
  }
  setUpPosition(prop: cursorUpProp) {
    const [dx, dy] = [
      prop.worldX - this._mouseDownX,
      prop.worldY - this._mouseDownY,
    ];
    // const [dx, dy] = this.global.camera?.getWorldDeltaFromCameraDelta(
    //   prop.worldX - this._mouseDownX,
    //   prop.worldY - this._mouseDownY,
    // ) ?? [0, 0];
    this.worldPosition = [this._dragStartX + dx, this._dragStartY + dy];
    console.debug("onCursorUp", this.gid, this.worldX, this.worldY);
    // this.dom.worldPosition = this.worldPosition;
    console.debug("onCursorUp", this.gid, this.worldX, this.worldY);
    // this.style = {
    //   transform: `translate3d(${this.worldX}px, ${this.worldY}px, 0)`,
    // };

    this.updateProperty();
    this.updateNodeLines();
    // this.submitRender();

    /* If the mouse has not moved since being pressed, then it is a regular click
            unselect other nodes in focusNodes */
    // if (
    //   !this.g.mouseHasMoved &&
    //   this.g.targetObject &&
    //   this.g.targetObject.gid == this.gid
    // ) {
    //   for (let i = 0; i < this.g.focusNodes.length; i++) {
    //     this.g.focusNodes[i].offFocus();
    //   }
    //   this.g.focusNodes = [this];
    //   this.onFocus();
    //   return;
    // }

    // this.render();
    // this.requestRender = true;

    // if (this.overlapping == null) {
    //   return;
    // }

    /* Handle dropping node on line */
    // TODO: Make a separate function for this.
    // const from = this.overlapping.start;
    // const to = this.overlapping.target;
    // const firstInput = Object.values(this.inputConnectors)[0];
    // const firstOutput = Object.values(this.outputConnectors)[0];
    // if (to) {
    //   from.disconnectFromInput(to);
    //   from.connectToInput(firstInput);
    //   firstOutput.connectToInput(to);
    // }
  }

  // nodeDragEnd() {}

  // ================= Public functions =================

  // /**
  //  * Assigns the DOM element to the node.
  //  * @param dom
  //  */
  // assignDom(dom: HTMLElement) {
  //   super.assignDom(dom);
  //   this._hitBox.assignDom(dom);
  //   dom.setAttribute("data-snapline-type", "node");
  //   dom.setAttribute("data-snapline-state", "idle");
  //   if (this._config?.nodeClass) {
  //     dom.setAttribute("data-snapline-class", this._config.nodeClass);
  //   }
  // }

  /**
   * Returns the connector with the specified name.
   * @param name
   */
  getConnector(name: string): ConnectorComponent | null {
    if (!(name in this._connectors)) {
      console.error(`Connector ${name} does not exist in node ${this.gid}`);
      return null;
    }
    return this._connectors[name];
  }

  // addConnector(
  //   name: string,
  //   config: ConnectorConfig,
  //   connectorClass: typeof ConnectorComponent | null = null,
  // ) {
  //   this._allOutgoingLines[name] = [];
  //   this._allIncomingLines[name] = [];
  //   if (!connectorClass) {
  //     connectorClass = ConnectorComponent;
  //   }
  //   const connector = new connectorClass(this.g, this, config);
  //   this._connectors[name] = connector;
  //   this._prop[name] = null;
  //   this.children.push(connector);

  //   return connector;
  // }

  addConnectorObject(connector: ConnectorComponent) {
    connector.assignToNode(this);
  }

  addInputForm(dom: HTMLElement, name: string) {
    const input = new InputForm(this.global, this, { name: name });
    this._prop[name] = null;

    return input;
  }

  addSetPropCallback(callback: (value: any) => void, name: string) {
    this._propSetCallback[name] = callback;
  }

  // getLines(): { [key: string]: LineComponent[] } {
  //   return this._allOutgoingLines;
  // }

  getAllOutgoingLines(): LineComponent[] {
    return Object.values(this._connectors).flatMap(
      (connector) => connector.outgoingLines,
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
      .filter((line) => line.target && !line.requestDelete)
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
