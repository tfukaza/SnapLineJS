import { GlobalStats, ObjectTypes } from "./types";
import { NodeComponent } from "./components/node";
import { ConnectorComponent } from "./components/connector";
import Camera from "./camera";
import { InputControl, cursorState } from "./input";

// Uncomment the theme you want to use
import "./theme/standard_light.scss";
// import './theme/standard_dark.scss';
// import './theme/retro.scss';

/**
 * SnapLine class manages all the global states for the library.
 */
export default class SnapLine {
  g: GlobalStats; // Global state

  _containerStyle: { [key: string]: string } = {};
  _canvasStyle: { [key: string]: string } = {};
  _selectionBoxStyle: { [key: string]: string } = {};
  _backgroundStyle: { [key: string]: string } = {};

  _inputControl: InputControl | null = null;

  constructor() {
    this.g = null as any;

    this._containerStyle = {
      position: "relative",
      overflow: "hidden",
    };
    this._selectionBoxStyle = {
      position: "absolute",
      pointerEvents: "none",
    };

    // Public functions
    this.initSnapLine = this.initSnapLine.bind(this);
    this.setRenderCanvasCallback = this.setRenderCanvasCallback.bind(this);
    this.setRenderBackgroundCallback =
      this.setRenderBackgroundCallback.bind(this);
    this.setRenderSelectionBoxCallback =
      this.setRenderSelectionBoxCallback.bind(this);
  }

  initSnapLine(
    containerDom: HTMLElement,
    canvasDom: HTMLElement,
    backgroundDom: HTMLElement,
    selectionBoxDom: HTMLElement,
  ) {
    this.g = {
      canvas: canvasDom,
      canvasContainer: containerDom,
      canvasBackground: backgroundDom,
      selectionBox: selectionBoxDom,

      _currentMouseDown: cursorState.none,
      mousedown_x: 0,
      mousedown_y: 0,
      mouse_x: 0,
      mouse_y: 0,
      mouse_x_world: 0,
      mouse_y_world: 0,
      dx: 0,
      dy: 0,
      dx_offset: 0,
      dy_offset: 0,

      camera: new Camera(containerDom, canvasDom),

      overrideDrag: false,

      targetObject: null,
      focusNodes: [],
      hoverDOM: null,
      gid: 0,

      globalNodeList: [],
      globalNodeTable: {},

      mouseHasMoved: false,
      ignoreMouseUp: false,

      prevTouches: null,
      prevSingleTouchTime: 0,

      snapline: this,
    };

    this._setCanvasStyle({
      position: "relative",
      top: "0px",
      left: "0px",
      width: "0px",
      height: "0px",
      transform: this.g.camera.canvasStyle,
    });
    this._setBackgroundStyle({
      width: this.g.camera.cameraWidth * 10 + "px",
      height: this.g.camera.cameraHeight * 10 + "px",
      transform: `translate(${-this.g.camera.cameraWidth * 5}px, ${-this.g.camera.cameraHeight * 5}px)`,
      transformOrigin: "center",
      zIndex: "0",
      position: "absolute",
    });

    this._renderCanvas(this._canvasStyle);
    this._renderBackground(this._backgroundStyle);
    this._renderSelectionBox(this._selectionBoxStyle);

    this._inputControl = new InputControl(containerDom);
    this._inputControl.setCursorDownCallback(this.onCursorDown.bind(this));
    this._inputControl.setCursorMoveCallback(this.onCursorMove.bind(this));
    this._inputControl.setCursorUpCallback(this.onCursorUp.bind(this));
    this._inputControl.setScrollCallback(this.onZoom.bind(this));

    window.requestAnimationFrame(this.step.bind(this));
  }

  _setCanvasStyle(newStyle: Record<string, string>) {
    this._canvasStyle = Object.assign({}, this._canvasStyle, newStyle);
    this._canvasStyle._requestUpdate = "true";
  }

  _setBackgroundStyle(newStyle: Record<string, string>) {
    this._backgroundStyle = Object.assign({}, this._backgroundStyle, newStyle);
    this._backgroundStyle._requestUpdate = "true";
  }

  _setSelectionBoxStyle(newStyle: Record<string, string>) {
    this._selectionBoxStyle = Object.assign(
      {},
      this._selectionBoxStyle,
      newStyle,
    );
    this._selectionBoxStyle._requestUpdate = "true";
  }

  _renderCanvas(style: Record<string, string>) {
    for (const key in style) {
      this.g.canvas.style[key as any] = style[key];
    }
  }

  _renderBackground(style: Record<string, string>) {
    for (const key in style) {
      this.g.canvasBackground.style[key as any] = style[key];
    }
  }

  _renderSelectionBox(style: Record<string, string>) {
    for (const key in style) {
      this.g.selectionBox.style[key as any] = style[key];
    }
  }

  setRenderCanvasCallback(callback: (style: Record<string, string>) => void) {
    this._renderCanvas = callback;
  }

  setRenderBackgroundCallback(
    callback: (style: Record<string, string>) => void,
  ) {
    this._renderBackground = callback;
  }

  setRenderSelectionBoxCallback(
    callback: (style: Record<string, string>) => void,
  ) {
    this._renderSelectionBox = callback;
  }

  /**
   * Event handler when mouse or touchscreen is pressed.
   * Can be called by mousedown ot touch start.
   * Because most elements have stopPropagation on mousedown,
   * this will only be called if the user clicks on the canvas background.
   *
   * Usually this means the user is performing a camera pan or selecting multiple nodes.
   *
   * @param button: The mouse button that was pressed.
   * @param clientX: The x position of the cursor.
   * @param clientY: The y position of the cursor.
   * @returns
   */
  onCursorDown(
    _: Event,
    element: Element | null,
    button: cursorState,
    clientX: number,
    clientY: number,
  ) {
    if (
      element !== this.g.canvasContainer &&
      element !== this.g.canvasBackground
    ) {
      console.debug("Ignoring cursor down event");
      return;
    }

    this.g._currentMouseDown = button;

    // If the user is dragging a line when another cursor down event is detected, then the line should be deleted.
    if (
      this.g.targetObject &&
      this.g.targetObject.type == ObjectTypes.connector
    ) {
      const connector = this.g.targetObject as ConnectorComponent;
      connector.domCursorUp();
    }

    const g = this.g;

    if (g.overrideDrag) {
      return;
    }

    // Reset the selection box
    if (g._currentMouseDown != cursorState.none) {
      this._setSelectionBoxStyle({
        width: "0px",
        height: "0px",
        left: "0px",
        top: "0px",
        pointerEvents: "none",
        opacity: "0",
      });
    }

    // Unselect all nodes
    g.focusNodes = [];
    for (const node of g.globalNodeList) {
      node.offFocus();
    }

    g.mousedown_x = clientX;
    g.mousedown_y = clientY;

    if (
      button == cursorState.mouseMiddle ||
      button == cursorState.touchDouble
    ) {
      this.g.camera.handlePanStart();
    }
  }

  /**
   * Handle cursor move events.
   * This usually means the camera is panned or a selection box is being drawn.
   *
   * @param target
   * @param clientX
   * @param clientY
   * @returns
   */
  onCursorMove(
    _: Event,
    ___: Element | null,
    __: cursorState,
    clientX: number,
    clientY: number,
  ) {
    const g = this.g;

    g.hoverDOM = document.elementFromPoint(clientX, clientY);
    g.mouse_x = clientX - g.canvasContainer.offsetLeft;
    g.mouse_y = clientY - g.canvasContainer.offsetTop;

    /* Adjust mouse position to world coordinates */
    [g.mouse_x_world, g.mouse_y_world] = this.g.camera.getWorldFromCamera(
      g.mouse_x,
      g.mouse_y,
    );

    g.dx = clientX - g.mousedown_x + g.dx_offset;
    g.dy = clientY - g.mousedown_y + g.dy_offset;

    // Do nothing if mouse is not pressed or touch is not active
    // if (button == cursorState.none) {
    //   return;
    // }

    if (g.dx !== 0 || g.dy !== 0) {
      g.mouseHasMoved = true;
    }

    // If nothing is selected, then this drag is either a camera pan or a selection box
    if (g.targetObject == null) {
      if (
        g._currentMouseDown == cursorState.mouseMiddle ||
        g._currentMouseDown == cursorState.touchDouble
      ) {
        // Handle camera pan
        this.g.camera.handlePanDrag(g.dx, g.dy);

        this._setCanvasStyle({
          transform: this.g.camera.canvasStyle,
          cursor: "grabbing",
        });
        this._setBackgroundStyle({
          transform: `translate(${this.g.camera.cameraX + -this.g.camera.cameraWidth * 5}px, ${this.g.camera.cameraY + -this.g.camera.cameraHeight * 5}px)`,
          backgroundPosition: `${-this.g.camera.cameraX}px ${-this.g.camera.cameraY}px`,
        });
      } else if (
        g._currentMouseDown == cursorState.mouseLeft ||
        g._currentMouseDown == cursorState.touchSingle
      ) {
        // Handle selection box
        this._setSelectionBoxStyle({
          width: Math.abs(g.dx) + "px",
          height: Math.abs(g.dy) + "px",
          left: Math.min(g.mousedown_x, g.mouse_x) + "px",
          top: Math.min(g.mousedown_y, g.mouse_y) + "px",
          opacity: "1",
        });
        // Check if any nodes are inside the selection box
        const [adjStartX, adjStartY] = this.g.camera.getWorldFromCamera(
          Math.min(g.mousedown_x, g.mouse_x),
          Math.min(g.mousedown_y, g.mouse_y),
        );

        const [adjEndX, adjEndY] = this.g.camera.getWorldFromCamera(
          Math.max(g.mousedown_x, g.mouse_x),
          Math.max(g.mousedown_y, g.mouse_y),
        );

        const selectedNodes = [];

        /* Focus on nodes that are inside the selection box */
        // TODO: Optimize this
        for (const node of g.globalNodeList) {
          if (
            node.positionX + node.nodeWidth > adjStartX &&
            node.positionX < adjEndX &&
            node.positionY + node.nodeHeight > adjStartY &&
            node.positionY < adjEndY
          ) {
            node.onFocus();
            selectedNodes.push(node);
          } else {
            node.offFocus();
          }
        }
        g.focusNodes = selectedNodes;
      }
    } else {
      // If an object is selected, then this drag is for that object
      if (g.targetObject.type == ObjectTypes.node) {
        // If the object being dragged is a node, then handle mouse move for all selected nodes
        for (const node of g.focusNodes) {
          node.onDrag();
        }
      } else {
        // Otherwise, just handle mouse move for the selected object
        g.targetObject.onDrag();
      }
    }
  }

  /**
   * Event handler when mouse or touchscreen is released.
   * @returns
   */
  onCursorUp(
    _: Event,
    __: Element | null,
    ___: cursorState,
    ____: number,
    _____: number,
  ) {
    const g = this.g;

    if (g.ignoreMouseUp) {
      g.ignoreMouseUp = false;
      return;
    }

    if (
      g._currentMouseDown == cursorState.mouseLeft ||
      g._currentMouseDown == cursorState.touchSingle
    ) {
      if (g.targetObject == null) {
        // If nothing is selected, then this drag was a selection box. Reset the selection box.
        this._setSelectionBoxStyle({
          width: "0px",
          height: "0px",
          left: "0px",
          top: "0px",
        });
      } else if (g.targetObject.type == ObjectTypes.node) {
        // If the object being dragged was a node, then handle mouse up for all selected nodes */
        for (const node of g.focusNodes) {
          node.domCursorUp();
        }
      } else {
        // Otherwise, just handle mouse up for the selected object.
        g.targetObject.domCursorUp();
      }
    } else if (
      g._currentMouseDown == cursorState.mouseMiddle ||
      g._currentMouseDown == cursorState.touchDouble
    ) {
      this.g.camera.handlePanEnd();
    }

    g._currentMouseDown = cursorState.none;

    if (g.overrideDrag) {
      this._setCanvasStyle({
        cursor: "default",
      });
    }

    g.overrideDrag = false;
    this._setCanvasStyle({
      cursor: "default",
    });

    g.targetObject = null;
    console.debug("targetObject set to null");
    g.dx = 0;
    g.dy = 0;
    g.dx_offset = 0;
    g.dy_offset = 0;

    g.mouseHasMoved = false;
  }

  /**
   * Event handler for mouse scroll events.
   * @param deltaY: The amount the user scrolled.
   */
  onZoom(
    _: Event,
    __: Element | null,
    ______: cursorState,
    ____: number,
    _____: number,
    deltaY: number,
  ) {
    this.g.camera.handleScroll(deltaY, this.g.mouse_x, this.g.mouse_y);
    this._setCanvasStyle({
      transform: this.g.camera.canvasStyle,
    });
    console.debug(
      "Zooming",
      `Camera position: ${this.g.camera.cameraX}, ${this.g.camera.cameraY}`,
    );
  }

  /**
   * Renders elements currently in the canvas.
   */
  _renderElements() {
    const target: any = this.g.targetObject; // The object that is currently selected

    if (target == null) {
      return;
    }

    if (target.type == ObjectTypes.node) {
      // If the target object is a node, render the node
      for (const node of this.g.focusNodes) {
        node.renderNode(node.nodeStyle);
      }
    } else if (target.type == ObjectTypes.connector) {
      // If the target object is an output connector, render the lines
      const target = this.g.targetObject as ConnectorComponent;
      target.parent._renderNodeLines();
    }
  }

  step() {
    this._renderElements();
    this._renderCanvas(this._canvasStyle);
    this._renderBackground(this._backgroundStyle);
    this._renderSelectionBox(this._selectionBoxStyle);

    window.requestAnimationFrame(this.step.bind(this));
  }

  addNodeObject(): [
    NodeComponent,
    Record<string, NodeComponent | ConnectorComponent>,
  ] {
    const n: NodeComponent = new NodeComponent(null, this.g);
    this.g.globalNodeTable[n.gid] = n;
    return [n, this.g.globalNodeTable];
  }

  createNode(dom: HTMLElement) {
    const n: NodeComponent = new NodeComponent(dom, this.g);
    this.g.globalNodeTable[n.gid] = n;
    return n;
  }

  addNode(node: NodeComponent, x: number, y: number) {
    node.addNodeToCanvas(x, y);
  }

  addNodeAtMouse(node: NodeComponent, e: MouseEvent) {
    this.g.ignoreMouseUp = true;

    const x = this.g.mouse_x_world;
    const y = this.g.mouse_y_world;

    console.debug("Adding node at " + x + ", " + y);

    this.addNode(node, x, y);
    node.setStartPositions();

    this.g._currentMouseDown = cursorState.mouseLeft;
    this.g.mousedown_x = this.g.mouse_x;
    this.g.mousedown_y = this.g.mouse_y;
    this.g.focusNodes = [node];
    this.g.targetObject = node;

    for (const node of this.g.globalNodeList) {
      node.offFocus();
    }

    this.onCursorMove(e, null, this.g._currentMouseDown, e.clientX, e.clientY);
  }

  deleteNode(id: string) {
    if (!(id in this.g.globalNodeTable)) {
      console.error("Node not found: " + id);
      return null;
    }
    this.g.globalNodeTable[id].destroy();
    const { [id]: _, ...rest } = this.g.globalNodeTable;
    this.g.globalNodeTable = rest;

    return id;
  }

  focusNode(id: string) {
    if (!(id in this.g.globalNodeTable)) return null;
    const node = this.g.globalNodeTable[id];
    node.onFocus();
    return id;
  }
}
