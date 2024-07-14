import { Base } from "./base";
import {
  GlobalStats,
  lineObject,
  ObjectTypes,
  customCursorDownProp,
} from "../types";
import { ConnectorComponent } from "./connector";
import { InputForm } from "./component";
import { ComponentBase } from "./component";

class NodeComponent extends Base {
  type: ObjectTypes = ObjectTypes.node;
  nodeType: string;

  dom: HTMLElement | null;
  connectors: { [key: string]: ConnectorComponent }; // Dictionary of all connectors in the node, using the name as the key
  components: { [key: string]: ComponentBase }; // Dictionary of all components in the node except connectors
  allOutgoingLines: { [key: string]: lineObject[] }; // Dictionary of all lines going out of the node
  allIncomingLines: { [key: string]: lineObject[] }; // Dictionary of all lines coming into the node

  nodeWidth = 0;
  nodeHeight = 0;
  dragStartX = 0;
  dragStartY = 0;

  freeze: boolean; // If true, the node cannot be moved

  prop: { [key: string]: any }; // Properties of the node
  propSetCallback: { [key: string]: (value: any) => void }; // Callbacks called when a property is set

  nodeStyle: any;

  constructor(dom: HTMLElement | null, globals: GlobalStats) {
    super(globals);

    this.nodeType = "";

    this.dom = dom;
    this.connectors = {};
    this.components = {};
    this.allOutgoingLines = {};
    this.allIncomingLines = {};

    this.dragStartX = this.positionX;
    this.dragStartY = this.positionY;

    this.freeze = false;

    this.prop = {};
    this.prop = new Proxy(this.prop, {
      set: (target, prop, value) => {
        prop = prop.toString();
        target[prop] = value;
        if (this.propSetCallback[prop]) {
          this.propSetCallback[prop](value);
        }
        if (prop in this.connectors) {
          const peers = this.connectors[prop].outgoingLines
            .filter((line) => line.target && !line.requestDelete)
            .map((line) => line.target);
          if (peers) {
            for (const peer of peers) {
              if (!peer) continue;
              peer.parent.prop[peer.name] = value;
              if (peer.parent.propSetCallback[peer.name]) {
                peer.parent.propSetCallback[peer.name](value);
              }
            }
          }
        }
        return true;
      },
    });

    this.propSetCallback = {};

    this.setNodeStyle({
      willChange: "transform",
      position: "absolute",
      transformOrigin: "top left",
    });

    this.g.globalNodeList.push(this);

    /* Public functions */
    this.initNode = this.initNode.bind(this);
    this.addConnector = this.addConnector.bind(this);
    this.addInputForm = this.addInputForm.bind(this);
    this.addPropSetCallback = this.addPropSetCallback.bind(this);

    this.setRenderNodeCallback = this.setRenderNodeCallback.bind(this);
    this.setRenderLinesCallback = this.setRenderLinesCallback.bind(this);
  }

  initNode(dom: HTMLElement) {
    this.dom = dom;
    this.dom.id = this.gid;

    this.renderNode(this.nodeStyle);

    this.bindFunction(this.dom);
    new ResizeObserver(() => {
      this.updateDOMproperties();
    }).observe(this.dom);
  }

  /**
   * Updates the DOM properties of the node, such as height, width, etc.
   * Also updates the DOM properties of all connectors.
   * Called when the node is first created, and when the node is resized.
   * @returns
   */
  updateDOMproperties() {
    if (!this.dom) return;
    this.nodeHeight = this.dom.offsetHeight;
    this.nodeWidth = this.dom.offsetWidth;
    for (const connector of Object.values(this.connectors)) {
      connector.updateDOMproperties();
    }
  }

  setNodeStyle(style: any) {
    this.nodeStyle = Object.assign({}, this.nodeStyle, style);
  }

  filterDeletedLines(svgLines: lineObject[]) {
    for (let i = 0; i < svgLines.length; i++) {
      if (svgLines[i].requestDelete && svgLines[i].completedDelete) {
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
  _renderOutgoingLines(outgoingLines: lineObject[]) {
    // console.debug(
    //   "Rendering outgoing lines",
    //   outgoingLines,
    //   outgoingLines.length,
    // );
    for (const line of outgoingLines) {
      const connector = line.start;
      if (!line.svg) {
        line.svg = connector.createLineDOM();
      } else if (line.requestDelete && !line.completedDelete) {
        this.g.canvas.removeChild(line.svg as Node);
        line.completedDelete = true;
        continue;
      }

      if (!line.svg) {
        continue;
      }
      line.connector_x = connector.connectorX;
      line.connector_y = connector.connectorY;
      if (line.target) {
        line.x2 = line.target.connectorX - connector.connectorX;
        line.y2 = line.target.connectorY - connector.connectorY;
      }
      line.svg.style.transform = `translate3d(${connector.connectorX}px, ${connector.connectorY}px, 0)`;
      connector.renderLinePosition(line);
    }

    this.filterDeletedLines(outgoingLines);
  }

  setRenderLinesCallback(callback: (svgLines: lineObject[]) => void) {
    this._renderOutgoingLines = (svgLines: lineObject[]) => {
      this.filterDeletedLines(svgLines);
      callback(svgLines);
    };
  }

  _iterateDict(
    dict: { [key: string]: any },
    callback: (lines: lineObject[]) => void,
    bind: any = this,
  ) {
    for (const key in dict) {
      callback.bind(bind)(dict[key]);
    }
  }

  _renderNodeLines() {
    // Flatten the allOutgoingLines object into an array and call the renderLines function
    this._iterateDict(this.allOutgoingLines, this._renderOutgoingLines);
    // For incoming lines, the renderLines function of the peer node is called.
    // This is to prevent duplicate rendering of lines on some declarative frontend frameworks.
    this._iterateDict(this.allIncomingLines, (lines: lineObject[]) => {
      for (const line of lines) {
        const peerNode = line.start.parent;
        this._iterateDict(
          peerNode.allOutgoingLines,
          peerNode._renderOutgoingLines,
          peerNode,
        );
      }
    });
  }

  renderNode(style: any) {
    if (!this.dom) return;
    for (const key in style) {
      if (key[0] == "_") continue;
      this.dom.style[key as any] = style[key];
    }

    if (style._focus) {
      this.dom.classList.add("focus");
    } else {
      this.dom.classList.remove("focus");
    }

    this._renderNodeLines();
  }

  setRenderNodeCallback(callback: (style: any) => void) {
    this.renderNode = (style: any) => {
      callback(style);
      this._renderNodeLines();
    };
  }

  addNodeToCanvas(x: number, y: number) {
    this.positionX = x;
    this.positionY = y;
    this.nodeWidth = this.dom!.offsetWidth;
    this.nodeHeight = this.dom!.offsetHeight;
    this.setNodeStyle({
      transform: `translate3d(${this.positionX}px, ${this.positionY}px, 0)`,
    });
    this.renderNode(this.nodeStyle);

    this.updateDOMproperties();

    this.g.canvas!.appendChild(this.dom!);
  }

  addConnector(
    dom: HTMLElement,
    name: string,
    maxConnectors = 1,
    allowDragOut = true,
  ) {
    this.allOutgoingLines[name] = [];
    this.allIncomingLines[name] = [];
    const connector = new ConnectorComponent(
      dom,
      { name: name, maxConnectors: maxConnectors, allowDragOut: allowDragOut },
      this,
      this.g,
      this.allOutgoingLines[name],
      this.allIncomingLines[name],
    );
    this.connectors[name] = connector;
    this.prop[name] = null;
    return connector;
  }

  addInputForm(dom: HTMLElement, name: string) {
    const input = new InputForm(dom, { name: name }, this, this.g);
    this.prop[name] = null;

    return input;
  }

  addPropSetCallback(callback: (value: any) => void, name: string) {
    this.propSetCallback[name] = callback;
  }

  // findInput(id: string): InputConnector | null {
  //   for (const input of Object.values(this.inputConnectors)) {
  //     if (input.name == id) {
  //       return input;
  //     }
  //   }
  //   return null;
  // }

  // findOutput(id: string): OutputConnector | null {
  //   for (const output of Object.values(this.outputConnectors)) {
  //     if (output.name == id) {
  //       return output;
  //     }
  //   }
  //   return null;
  // }

  setStartPositions() {
    this.dragStartX = this.positionX;
    this.dragStartY = this.positionY;
  }

  componentCursorDown(_: customCursorDownProp): void {
    console.debug(`Node class mousedown event triggered on ${this.gid}!`);

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
        this.g.focusNodes[i].setStartPositions();
      }
    }

    this.setStartPositions();
  }

  componentCursorUp() {
    if (this.freeze) return;

    const [dx, dy] = this.g.camera.getWorldDeltaFromCameraDelta(
      this.g.dx,
      this.g.dy,
    );
    this.positionX = this.dragStartX + dx;
    this.positionY = this.dragStartY + dy;

    /* If the mouse has not moved since being pressed, then it is a regular click
            unselect other nodes in focusNodes */
    console.debug("Mouse has moved: " + this.g.mouseHasMoved);
    if (
      !this.g.mouseHasMoved &&
      this.g.targetObject &&
      this.g.targetObject.gid == this.gid
    ) {
      console.debug("Mouse has not moved");
      for (let i = 0; i < this.g.focusNodes.length; i++) {
        this.g.focusNodes[i].offFocus();
      }
      this.g.focusNodes = [this];
      this.onFocus();
      return;
    }

    this.renderNode(this.nodeStyle);

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
   * Fired every time requestAnimationFrame is called,
   * if this object is being dragged.
   * It reads the internal states like current mouse position,
   * and updates the DOM element accordingly.
   * @returns
   */
  onDrag() {
    if (this.freeze) return;

    const [adjustedDeltaX, adjustedDeltaY] =
      this.g.camera.getWorldDeltaFromCameraDelta(this.g.dx, this.g.dy);

    this.positionX = this.dragStartX + adjustedDeltaX;
    this.positionY = this.dragStartY + adjustedDeltaY;
    this.setNodeStyle({
      transform: `translate3d(${this.positionX}px, ${this.positionY}px, 0)`,
    });

    for (const connector of Object.values(this.connectors)) {
      connector.setAllLinePositions();
    }

    //this.overlapping = null;

    if (Object.keys(this.connectors).length == 0) return;
  }

  onFocus() {
    console.debug("On focus");
    this.setNodeStyle({ _focus: true });
    this.renderNode(this.nodeStyle);
  }

  offFocus() {
    console.debug("Off focus");
    this.setNodeStyle({ _focus: false });
    this.renderNode(this.nodeStyle);
  }

  evaluate(varName: string) {
    console.debug("Update all nodes connected to " + varName);
    const connector = this.connectors[varName];
    if (!connector) return;
    for (const peer of connector.outgoingLines) {
      const peerConnector = peer.target;
      if (!peerConnector) {
        continue;
      }
      peerConnector.parent.prop[peerConnector.name] = this.prop[varName];
      peerConnector.updateFunction();
    }
  }

  exec() {}

  destroy() {
    this.g.canvas?.removeChild(this.dom!);
    for (const connector of Object.values(this.connectors)) {
      connector.destroy();
    }
  }
}

export { NodeComponent };
