import { CameraConfig, GlobalStats, NodeConfig, ObjectTypes } from "./types";
import { NodeComponent } from "./components/node";
import { ConnectorComponent } from "./components/connector";
import { returnUpdatedDict } from "./helper";
import { setDomStyle } from "./helper";
import Camera from "./camera";
import { InputControl, cursorState } from "./input";

// Uncomment the theme you want to use
import "./theme/standard_light.scss";
// import "./theme/standard_dark.scss";

/**
 * SnapLine class manages all the global states for the library.
 */
class SnapLine {
  g: GlobalStats;
  cameraConfig: CameraConfig;
  _containerStyle: { [key: string]: string } = {};
  _canvasStyle: { [key: string]: string } = {};
  _selectionBoxStyle: { [key: string]: string } = {};
  _backgroundStyle: { [key: string]: string } = {};

  _inputControl: InputControl | null = null;

  // ============== Private functions ==============

  /**
   * Main loop for rendering the canvas.
   */
  #step(): void {
    this._renderElements();
    this._renderCanvas(this._canvasStyle);
    this._renderBackground(this._backgroundStyle);
    this._renderSelectionBox(this._selectionBoxStyle);

    window.requestAnimationFrame(this.#step.bind(this));
  }

  // ============== Hidden functions ==============

  /**
   * Update the dictionary containing the CSS style for the canvas.
   * @param newStyle The new style to be added to the canvas.
   */
  _setCanvasStyle(newStyle: { [key: string]: string }) {
    this._canvasStyle = returnUpdatedDict(this._canvasStyle, newStyle);
  }

  /**
   * Update the dictionary containing the CSS style for the background.
   * @param newStyle The new style to be added to the background.
   */
  _setBackgroundStyle(newStyle: { [key: string]: string }) {
    this._backgroundStyle = returnUpdatedDict(this._backgroundStyle, newStyle);
  }

  /**
   * Update the dictionary containing the CSS style for the selection box.
   * @param newStyle The new style to be added to the selection box.
   */
  _setSelectionBoxStyle(newStyle: { [key: string]: string }) {
    this._selectionBoxStyle = returnUpdatedDict(
      this._selectionBoxStyle,
      newStyle,
    );
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
  _onCursorDown(
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
      this.g.targetObject._type == ObjectTypes.connector
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

    [g.mousedown_x, g.mousedown_y] = this.g.camera.getCameraFromScreen(
      clientX,
      clientY,
    );

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
  _onCursorMove(
    _: Event,
    ___: Element | null,
    __: cursorState,
    clientX: number,
    clientY: number,
  ) {
    const g = this.g;

    g.hoverDOM = document.elementFromPoint(clientX, clientY);
    [g.mouseCameraX, g.mouseCameraY] = this.g.camera.getCameraFromScreen(
      clientX,
      clientY,
    );

    [g.mouseWorldX, g.mouseWorldY] = this.g.camera.getWorldFromCamera(
      g.mouseCameraX,
      g.mouseCameraY,
    );

    g.dx = g.mouseCameraX - g.mousedown_x;
    g.dy = g.mouseCameraY - g.mousedown_y;

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
          transform: `translate(${this.g.camera.cameraPositionX + -this.g.camera.cameraWidth * 5}px, ${this.g.camera.cameraPositionY + -this.g.camera.cameraHeight * 5}px)`,
          backgroundPosition: `${-this.g.camera.cameraPositionX}px ${-this.g.camera.cameraPositionY}px`,
        });
      } else if (
        g._currentMouseDown == cursorState.mouseLeft ||
        g._currentMouseDown == cursorState.touchSingle
      ) {
        // Handle selection box
        let [left, top] = [
          Math.min(g.mousedown_x, g.mouseCameraX),
          Math.min(g.mousedown_y, g.mouseCameraY),
        ];
        this._setSelectionBoxStyle({
          width: Math.abs(g.dx) + "px",
          height: Math.abs(g.dy) + "px",
          left: left + "px",
          top: top + "px",
          opacity: "1",
          position: "absolute",
        });
        // Check if any nodes are inside the selection box
        const [adjStartX, adjStartY] = this.g.camera.getWorldFromCamera(
          left,
          top,
        );

        const [adjEndX, adjEndY] = this.g.camera.getWorldFromCamera(
          Math.max(g.mousedown_x, g.mouseCameraX),
          Math.max(g.mousedown_y, g.mouseCameraY),
        );

        const selectedNodes = [];

        /* Focus on nodes that are inside the selection box */
        // TODO: Optimize this
        for (const node of g.globalNodeList) {
          if (
            node.positionX + node._nodeWidth > adjStartX &&
            node.positionX < adjEndX &&
            node.positionY + node._nodeHeight > adjStartY &&
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
      if (g.targetObject._type == ObjectTypes.node) {
        // If the object being dragged is a node, then handle mouse move for all selected nodes
        for (const node of g.focusNodes) {
          node._onDrag();
        }
      } else {
        // Otherwise, just handle mouse move for the selected object
        g.targetObject._onDrag();
      }
    }
  }

  /**
   * Event handler when mouse or touchscreen is released.
   * @returns
   */
  _onCursorUp(
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
      } else if (g.targetObject._type == ObjectTypes.node) {
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
  _onZoom(
    _: Event,
    __: Element | null,
    ______: cursorState,
    ____: number,
    _____: number,
    deltaY: number,
  ) {
    this.g.camera.handleScroll(
      deltaY / 1000,
      this.g.mouseCameraX,
      this.g.mouseCameraY,
    );
    this._setCanvasStyle({
      transform: this.g.camera.canvasStyle,
    });
  }

  /**
   * Applies the canvas CSS styles to the canvas DOM element.
   * This function is typically used in vanilla JS projects which does not have a reactive system to automatically update the DOM.
   * @param style Dictionary of CSS styles to be applied to the canvas.
   */
  _renderCanvas(style: { [key: string]: string }) {
    setDomStyle(this.g.canvas, style);
  }

  /**
   * Applies the background CSS styles to the background DOM element.
   * This function is typically used in vanilla JS projects which does not have a reactive system to automatically update the DOM.
   * @param style Dictionary of CSS styles to be applied to the background.
   */
  _renderBackground(style: { [key: string]: string }) {
    setDomStyle(this.g.canvasBackground, style);
  }

  /**
   * Applies the selection box CSS styles to the selection box DOM element.
   * This function is typically used in vanilla JS projects which does not have a reactive system to automatically update the DOM.
   * @param style Dictionary of CSS styles to be applied to the selection box.
   */
  _renderSelectionBox(style: { [key: string]: string }) {
    setDomStyle(this.g.selectionBox, style);
  }

  /**
   * Renders elements currently in the canvas.
   * This function is used by Vanilla JS projects that do not have a reactive system to automatically update the DOM.
   */
  _renderElements(): void {
    const target: any = this.g.targetObject; // The object that is currently selected

    if (target == null) {
      return;
    }

    if (target._type == ObjectTypes.node) {
      // If the target object is a node, render the node
      for (const node of this.g.focusNodes) {
        node._renderNode(node._nodeStyle);
      }
    } else if (target._type == ObjectTypes.connector) {
      // If the target object is an output connector, render the lines
      const target = this.g.targetObject as ConnectorComponent;
      target.parent._renderNodeLines();
    }
  }

  // ============== Public functions ==============

  /**
   * Constructor for SnapLine class.
   */
  constructor(
    config: CameraConfig = {
      enableZoom: true,
      enablePan: true,
      panBounds: { top: null, left: null, right: null, bottom: null },
    },
  ) {
    this.g = {} as any;
    this.cameraConfig = config;

    this._containerStyle = {
      position: "relative",
      overflow: "hidden",
    };
    this._selectionBoxStyle = {
      position: "absolute",
      pointerEvents: "none",
    };

    this.init = this.init.bind(this);
    this.setRenderCanvasCallback = this.setRenderCanvasCallback.bind(this);
    this.setRenderBackgroundCallback =
      this.setRenderBackgroundCallback.bind(this);
    this.setRenderSelectionBoxCallback =
      this.setRenderSelectionBoxCallback.bind(this);
  }

  /**
   * Initialize global stats, dom elements, and event listeners for the library.
   * @param containerDom: The element that will be used to render the canvas and it's nodes.
   * @param canvasDom: The canvas element that will contain the nodes and all other components. It should be a direct child of the containerDom.
   * @param backgroundDom: The background element that will be used to render the background of the canvas. It should be a direct child of the containerDom.
   * @param selectionBoxDom: The element that will be used as the selection box. It should be a direct child of the containerDom.
   */
  init(
    containerDom: HTMLElement,
    canvasDom: HTMLElement,
    backgroundDom: HTMLElement,
    selectionBoxDom: HTMLElement,
  ) {
    /* Initialize global stats */
    this.g = {
      canvas: canvasDom,
      canvasContainer: containerDom,
      canvasBackground: backgroundDom,
      selectionBox: selectionBoxDom,

      _currentMouseDown: cursorState.none,
      mousedown_x: 0,
      mousedown_y: 0,
      mouseCameraX: 0,
      mouseCameraY: 0,
      mouseWorldX: 0,
      mouseWorldY: 0,
      dx: 0,
      dy: 0,
      dx_offset: 0,
      dy_offset: 0,

      camera: new Camera(containerDom, canvasDom, this.cameraConfig),

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
      position: "absolute",
    });

    this._renderCanvas(this._canvasStyle);
    this._renderBackground(this._backgroundStyle);
    this._renderSelectionBox(this._selectionBoxStyle);

    this._inputControl = new InputControl(containerDom, document);
    this._inputControl.setCursorDownCallback(this._onCursorDown.bind(this));
    this._inputControl.setCursorMoveCallback(this._onCursorMove.bind(this));
    this._inputControl.setCursorUpCallback(this._onCursorUp.bind(this));
    this._inputControl.setScrollCallback(this._onZoom.bind(this));

    window.requestAnimationFrame(this.#step.bind(this));
  }

  /**
   * Creates an instance of a node.
   * Note that this function will not add the DOM to the canvas.
   * The caller must manually add the DOM using document.appendChild() or use a framework that will automatically add the DOM.
   *
   * @param dom: The DOM element that will be used as the node. If null, NodeComponent.init() must be called later to specify the DOM element.
   * @param x: The x position of the node.
   * @param y: The y position of the node.
   * @returns A reference to the node.
   */
  createNode(
    dom: HTMLElement | null = null,
    x: number = 0,
    y: number = 0,
    config: NodeConfig,
  ) {
    const node: NodeComponent = new NodeComponent(dom, x, y, this.g, config);
    this.g.globalNodeTable[node.gid] = node;
    return node;
  }

  // addNodeAtMouse(node: NodeComponent, e: MouseEvent) {
  //   this.g.ignoreMouseUp = true;

  //   const x = this.g.mouseWorldX;
  //   const y = this.g.mouseWorldY;

  //   console.debug("Adding node at " + x + ", " + y);

  //   this.addNode(node, x, y);
  //   node.setStartPositions();

  //   this.g._currentMouseDown = cursorState.mouseLeft;
  //   this.g.mousedown_x = this.g.mouseCameraX;
  //   this.g.mousedown_y = this.g.mouseCameraY;
  //   this.g.focusNodes = [node];
  //   this.g.targetObject = node;

  //   for (const node of this.g.globalNodeList) {
  //     node.offFocus();
  //   }

  //   this._onCursorMove(e, null, this.g._currentMouseDown, e.clientX, e.clientY);
  // }

  /**
   * Deletes a node from the canvas.
   * Note that this function will not remove the DOM from the canvas - the caller
   * must manually remove the DOM using document.removeChild() or use a framework that will automatically remove the DOM.
   * @param gid The global id of the node to be deleted.
   * @returns True if the node was successfully deleted, false otherwise.
   */
  deleteNode(gid: string): boolean {
    if (!(gid in this.g.globalNodeTable)) {
      console.error("Node not found: " + gid);
      return false;
    }
    this.g.globalNodeTable[gid].delete();
    const { [gid]: _, ...rest } = this.g.globalNodeTable;
    this.g.globalNodeTable = rest;

    return true;
  }

  /**
   * Focus on a node with the given global id.
   * @param gid The global id of the node to be focused.
   * @returns True if the node was successfully focused, false otherwise.
   */
  focusNode(gid: string): boolean {
    if (!(gid in this.g.globalNodeTable)) return false;
    const node = this.g.globalNodeTable[gid];
    node.onFocus();
    return true;
  }

  /**
   * Set the canvas render function to the given callback.
   * @param gid The global id of the node to be unfocused.
   * @returns True if the node was successfully unfocused, false otherwise.
   */
  setRenderCanvasCallback(
    callback: (style: { [key: string]: string }) => void,
  ) {
    this._renderCanvas = callback;
  }

  setRenderBackgroundCallback(
    callback: (style: { [key: string]: string }) => void,
  ) {
    this._renderBackground = callback;
  }

  setRenderSelectionBoxCallback(
    callback: (style: { [key: string]: string }) => void,
  ) {
    this._renderSelectionBox = callback;
  }
}

export { SnapLine };
