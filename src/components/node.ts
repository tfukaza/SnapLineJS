import { Base } from "./base";
import {
  GlobalStats,
  lineObject,
  ObjectTypes,
  customCursorDownProp,
  NodeConfig,
} from "../types";
import { ConnectorComponent } from "./connector";
import { InputForm } from "./input";
import { ComponentBase } from "./base";
import { returnUpdatedDict, iterateDict, setDomStyle } from "../helper";
import { LineComponent } from "./line";
class NodeComponent extends Base {
  _type: ObjectTypes = ObjectTypes.node;
  _config: NodeConfig;
  _dom: HTMLElement | null;
  _connectors: { [key: string]: ConnectorComponent }; // Dictionary of all connectors in the node, using the name as the key
  _components: { [key: string]: ComponentBase }; // Dictionary of all components in the node except connectors
  _allOutgoingLines: { [key: string]: LineComponent[] }; // Dictionary of all lines going out of the node
  _allIncomingLines: { [key: string]: LineComponent[] }; // Dictionary of all lines coming into the node
  _nodeWidth = 0;
  _nodeHeight = 0;
  _dragStartX = 0;
  _dragStartY = 0;
  _freeze: boolean; // If true, the node cannot be moved
  _prop: { [key: string]: any }; // Properties of the node
  _propSetCallback: { [key: string]: (value: any) => void }; // Callbacks called when a property is set
  _nodeStyle: any;

  // ================= Private functions =================

  /**
   * Updates the DOM properties of the node, such as height, width, etc.
   * Also updates the DOM properties of all connectors.
   * Called when the node is first created, and when the node is resized.
   * @returns
   */
  #updateDomProperties() {
    if (!this._dom) return;
    this._nodeHeight = this._dom.offsetHeight;
    this._nodeWidth = this._dom.offsetWidth;
    for (const connector of Object.values(this._connectors)) {
      connector._updateDomProperties();
    }
    // this._setNodeStyle({
    //   width: this.nodeWidth + "px",
    //   height: this.nodeHeight + "px",
    // });
  }

  /**
   * Sets the starting position of the node when it is dragged.
   */
  #setStartPositions() {
    this._dragStartX = this.positionX;
    this._dragStartY = this.positionY;
  }

  // ================= Hidden functions =================

  /**
   * Sets the CSS style of the node.
   * Some styles are not CSS properties but internal properties, which are prefixed with an underscore.
   * @param style CSS style object
   */
  _setNodeStyle(style: any) {
    this._nodeStyle = returnUpdatedDict(this._nodeStyle, style);
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
  _renderOutgoingLines(outgoingLines: LineComponent[], key?: string) {
    for (const line of outgoingLines) {
      const connector = line.start;
      if (!line.requestDelete && !line.initialRender) {
        line.createLine();
      } else if (line.requestDelete && !line.completedDelete) {
        line.delete();
        line.completedDelete = true;
        continue;
      }

      if (!line.dom) {
        continue;
      }
      line.x_start = connector.connectorX;
      line.y_start = connector.connectorY;
      if (line.target) {
        line.x_end = line.target.connectorX;
        line.y_end = line.target.connectorY;
      }
      line.renderLine();
    }

    this._filterDeletedLines(outgoingLines);
  }

  /**
   * Renders all lines connected to the node.
   */
  _renderNodeLines(): void {
    iterateDict(this._allOutgoingLines, this._renderOutgoingLines, this);
    iterateDict(
      this._allIncomingLines,
      (lines: LineComponent[]) => {
        for (const line of lines) {
          const peerNode = line.start.parent;
          iterateDict(
            peerNode._allOutgoingLines,
            peerNode._renderOutgoingLines,
            peerNode,
          );
        }
      },
      this,
    );
  }

  /**
   * Renders the node with the specified style.
   * @param style CSS style object
   */
  _renderNode(style: any) {
    if (!this._dom) return;
    setDomStyle(this._dom, style);

    if (style._focus) {
      this._dom.setAttribute("data-snapline-state", "focus");
    } else {
      this._dom.setAttribute("data-snapline-state", "idle");
    }

    this._renderNodeLines();
  }

  _componentCursorDown(_: customCursorDownProp): void {
    let isInFocusNodes = false;
    for (let i = 0; i < this.g.focusNodes.length; i++) {
      if (this.g.focusNodes[i].gid == this.gid) {
        isInFocusNodes = true;
        break;
      }
    }
    if (!isInFocusNodes) {
      /* If this node is not in focusNodes, then it is a regular click
       * Unselect other nodes in focusNodes */
      for (let i = 0; i < this.g.focusNodes.length; i++) {
        this.g.focusNodes[i].offFocus();
      }
      this.g.focusNodes = [this];
      this.onFocus();
    } else {
      /* Otherwise, we are dragging multiple nodes.
       * Call the setStartPositions function for all nodes in focusNodes */
      for (let i = 0; i < this.g.focusNodes.length; i++) {
        this.g.focusNodes[i].#setStartPositions();
      }
    }

    this.#setStartPositions();
  }

  _componentCursorUp() {
    if (this._freeze) return;
    if (this._config.lockPosition) return;
    const [dx, dy] = this.g.camera.getWorldDeltaFromCameraDelta(
      this.g.dx,
      this.g.dy,
    );
    this.positionX = this._dragStartX + dx;
    this.positionY = this._dragStartY + dy;

    /* If the mouse has not moved since being pressed, then it is a regular click
            unselect other nodes in focusNodes */
    if (
      !this.g.mouseHasMoved &&
      this.g.targetObject &&
      this.g.targetObject.gid == this.gid
    ) {
      for (let i = 0; i < this.g.focusNodes.length; i++) {
        this.g.focusNodes[i].offFocus();
      }
      this.g.focusNodes = [this];
      this.onFocus();
      return;
    }

    this._renderNode(this._nodeStyle);

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

  /**
   * Fired every time requestAnimationFrame is called if this object is being dragged.
   * It reads the internal states like current mouse position,
   * and updates the DOM element accordingly.
   */
  _onDrag(): void {
    if (this._freeze) return;
    if (this._config.lockPosition) return;

    const [adjustedDeltaX, adjustedDeltaY] =
      this.g.camera.getWorldDeltaFromCameraDelta(this.g.dx, this.g.dy);

    this.positionX = this._dragStartX + adjustedDeltaX;
    this.positionY = this._dragStartY + adjustedDeltaY;
    this._setNodeStyle({
      transform: `translate3d(${this.positionX}px, ${this.positionY}px, 0)`,
    });

    for (const connector of Object.values(this._connectors)) {
      connector._setAllLinePositions();
    }

    if (Object.keys(this._connectors).length == 0) return;
  }

  // ================= Public functions =================

  constructor(
    dom: HTMLElement | null,
    x: number,
    y: number,
    globals: GlobalStats,
    config: NodeConfig = {},
  ) {
    super(globals);

    this._config = config;

    this._dom = dom;
    this._connectors = {};
    this._components = {};
    this._allOutgoingLines = {};
    this._allIncomingLines = {};

    this.positionX = x;
    this.positionY = y;
    this._dragStartX = this.positionX;
    this._dragStartY = this.positionY;

    this._freeze = false;

    this._prop = {};

    this._propSetCallback = {};

    this._setNodeStyle({
      willChange: "transform",
      position: "absolute",
      transformOrigin: "top left",
    });

    this.g.globalNodeList.push(this);

    /* Public functions */
    this.init = this.init.bind(this);
    this.addConnector = this.addConnector.bind(this);
    this.addInputForm = this.addInputForm.bind(this);
    this.addSetPropCallback = this.addSetPropCallback.bind(this);
    this.delete = this.delete.bind(this);
    this.onFocus = this.onFocus.bind(this);
    this.offFocus = this.offFocus.bind(this);
    this.getConnector = this.getConnector.bind(this);
    this.getLines = this.getLines.bind(this);
    this.getNodeStyle = this.getNodeStyle.bind(this);
    this.getProp = this.getProp.bind(this);
    this.setProp = this.setProp.bind(this);

    this.setRenderNodeCallback = this.setRenderNodeCallback.bind(this);
    this.setRenderLinesCallback = this.setRenderLinesCallback.bind(this);

    this._setNodeStyle({
      transform: `translate3d(${this.positionX}px, ${this.positionY}px, 0)`,
    });

    if (this._dom) {
      this.init(this._dom);
    }
  }

  /**
   * Assigns the DOM element to the node.
   * @param dom
   */
  init(dom: HTMLElement) {
    this._dom = dom;
    this._dom.id = this.gid;
    dom.setAttribute("data-snapline-type", "node");
    dom.setAttribute("data-snapline-state", "idle");
    if (this._config?.nodeClass) {
      dom.setAttribute("data-snapline-class", this._config.nodeClass);
    }

    this._renderNode(this._nodeStyle);

    this.bindFunction(this._dom);
    new ResizeObserver(() => {
      this.#updateDomProperties();
      this._renderNode(this._nodeStyle);
    }).observe(this._dom);
  }

  /**
   * Sets the callback function that is called when the node is rendered.
   * @param callback
   */
  setRenderNodeCallback(callback: (style: any) => void): void {
    this._renderNode = (style: any) => {
      callback(style);
      this._renderNodeLines();
    };
  }

  /**
   * Sets the callback function that is called when lines owned by the node (i.e. outgoing lines) are rendered.
   * @param
   */
  setRenderLinesCallback(
    callback: (lines: LineComponent[], name: string) => void,
  ) {
    this._renderOutgoingLines = (lines: LineComponent[], name: string) => {
      this._filterDeletedLines(lines);

      callback(lines, name);
    };
  }

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

  onFocus() {
    this._setNodeStyle({ _focus: true });
    this._renderNode(this._nodeStyle);
  }

  offFocus() {
    this._setNodeStyle({ _focus: false });
    this._renderNode(this._nodeStyle);
  }

  addConnector(
    dom: HTMLElement,
    name: string,
    maxConnectors = 1,
    allowDragOut = true,
    connectorClass: typeof ConnectorComponent | null = null,
  ) {
    this._allOutgoingLines[name] = [];
    this._allIncomingLines[name] = [];
    if (!connectorClass) {
      connectorClass = ConnectorComponent;
    }
    const connector = new connectorClass(
      dom,
      { name: name, maxConnectors: maxConnectors, allowDragOut: allowDragOut },
      this,
      this.g,
      this._allOutgoingLines[name],
      this._allIncomingLines[name],
    );
    this._connectors[name] = connector;
    this._prop[name] = null;
    return connector;
  }

  addInputForm(dom: HTMLElement, name: string) {
    const input = new InputForm(dom, this, this.g, { name: name });
    this._prop[name] = null;

    return input;
  }

  addSetPropCallback(callback: (value: any) => void, name: string) {
    this._propSetCallback[name] = callback;
  }

  delete() {
    if (this._dom) {
      this.g.canvas?.removeChild(this._dom);
    }
    // Todo: disconnect all connectors
    for (const connector of Object.values(this._connectors)) {
      connector.delete();
    }
  }

  getLines(): { [key: string]: LineComponent[] } {
    return this._allOutgoingLines;
  }

  getNodeStyle(): { [key: string]: any } {
    return this._nodeStyle;
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
      peer.parent._prop[peer.name] = value;
      if (peer.parent._propSetCallback[peer.name]) {
        peer.parent._propSetCallback[peer.name](value);
      }
    }
  }
}

export { NodeComponent };
