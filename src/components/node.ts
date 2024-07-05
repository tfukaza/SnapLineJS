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
  nodeType: string; /* Type of the node */

  dom: HTMLElement | null; /* The DOM element of the node */
  connectors: { [key: string]: ConnectorComponent }; // Dictionary of all connectors in the node, using the name as the key
  components: { [key: string]: ComponentBase }; // Dictionary of all components in the node except connectors

  nodeWidth = 0;
  nodeHeight = 0;
  dragStartX = 0;
  dragStartY = 0;

  overlapping: lineObject | null; // Line that the node is overlapping with
  freeze: boolean; /* If true, the node cannot be moved */

  prop: { [key: string]: any }; // Properties of the node
  propSetCallback: { [key: string]: (value: any) => void }; // Callbacks called when a property is set

  nodeStyle: any; // Style of the node

  constructor(dom: HTMLElement | null, globals: GlobalStats) {
    super(globals);

    this.nodeType = "";

    this.dom = dom;
    this.connectors = {};
    this.components = {};

    this.dragStartX = this.positionX;
    this.dragStartY = this.positionY;

    this.overlapping = null;
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
          const peers = this.connectors[prop].lineArray
            .filter(
              (line) =>
                line.start == this.connectors[prop] &&
                line.target &&
                !line.requestDelete,
            )
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

    for (const connector of Object.values(this.connectors)) {
      // Only render outgoing lines
      // const lines = connector.lineArray.filter(
      //   (line) => line.start == connector,
      // );
      connector.renderAllLines(connector.lineArray);
    }
  }

  setRenderNodeCallback(callback: (style: any) => void) {
    this.renderNode = (style: any) => {
      callback(style);
      for (const connector of Object.values(this.connectors)) {
        const lines = connector.lineArray.filter(
          (line) => line.start == connector,
        );
        connector.renderAllLines(lines);
      }
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
    const connector = new ConnectorComponent(
      dom,
      { name: name, maxConnectors: maxConnectors, allowDragOut: allowDragOut },
      this,
      this.g,
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

    if (this.overlapping == null) {
      return;
    }

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

    this.overlapping = null;

    if (Object.keys(this.connectors).length == 0) return;
  }

  onFocus() {
    this.setNodeStyle({ _focus: true });
    this.renderNode(this.nodeStyle);
  }

  offFocus() {
    this.setNodeStyle({ _focus: false });
    this.renderNode(this.nodeStyle);
  }

  evaluate(varName: string) {
    console.debug("Update all nodes connected to " + varName);
    const connector = this.connectors[varName];
    if (!connector) return;
    for (const peer of connector.peerConnectors) {
      console.debug(
        `Update input ${peer.name} connected to ${varName} with value ${this.prop[varName]}`,
      );
      peer.parent.prop[peer.name] = this.prop[varName];
      peer.updateFunction();
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
