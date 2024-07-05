import { GlobalStats, ObjectTypes, mouseDownButton } from "./types";
import { NodeComponent } from "./components/node";
import { ConnectorComponent } from "./components/connector";
import Camera from "./camera";

// Uncomment the theme you want to use
import "./theme/standard_light.scss";
// import './theme/standard_dark.scss';
// import './theme/retro.scss';

/**
 * SnapLine class manages all the global states for the library.
 */
export default class SnapLine {
  g: GlobalStats; // Global state

  _containerStyle: Record<string, string> = {}; // Style for the container element
  _canvasStyle: Record<string, string> = {}; // Style for the canvas element
  _selectionBoxStyle: Record<string, string> = {}; // Style for the selection box element
  _backgroundStyle: Record<string, string> = {}; // Style for the background element

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
    this.setRenderContainerCallback =
      this.setRenderContainerCallback.bind(this);
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

      _currentMouseDown: mouseDownButton.none,
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

    const g = this.g;

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

    this._renderContainer(this._containerStyle);
    this._renderCanvas(this._canvasStyle);
    this._renderBackground(this._backgroundStyle);
    this._renderSelectionBox(this._selectionBoxStyle);

    g.canvasContainer.addEventListener("mouseup", this.onMouseUp.bind(this));
    g.canvasContainer.addEventListener(
      "mousemove",
      this.onMouseMove.bind(this),
    );
    g.canvasContainer.addEventListener(
      "mousedown",
      this.onMouseDown.bind(this),
    );
    g.canvasContainer.addEventListener("wheel", this.onWheel.bind(this));
    g.canvasContainer.addEventListener("keydown", this.onKeyDown.bind(this));

    document.addEventListener("mousemove", this.onMouseMove.bind(this));
    document.addEventListener("mouseup", this.onMouseUp.bind(this));

    g.canvasContainer.addEventListener(
      "touchstart",
      this.onTouchStart.bind(this),
    );
    g.canvasContainer.addEventListener(
      "touchmove",
      this.onTouchMove.bind(this),
    );
    g.canvasContainer.addEventListener("touchend", this.onTouchEnd.bind(this));

    window.requestAnimationFrame(this.step.bind(this));
  }

  _setCanvasStyle(newStyle: Record<string, string>) {
    this._canvasStyle = Object.assign({}, this._canvasStyle, newStyle);
    this._canvasStyle._requestUpdate = "true";
  }

  // private set_containerStyle(newStyle: Record<string, string>) {
  //   this._containerStyle = Object.assign({}, this._containerStyle, newStyle);
  //   this._containerStyle._requestUpdate = "true";
  // }

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

  _renderContainer(style: Record<string, string>) {
    for (const key in style) {
      this.g.canvasContainer.style[key as any] = style[key];
    }
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

  setRenderContainerCallback(
    callback: (style: Record<string, string>) => void,
  ) {
    this._renderContainer = callback;
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

  onTouchStart(e: TouchEvent) {
    // If multiple touches are detected, treat it as a middle mouse button press (pan camera)
    if (e.touches.length > 1) {
      // If there was only one touch previously, it means up until now it has been handled as a mouse press or drag.
      // Call the cursor up handler to reset the state
      if (this.g.prevTouches && this.g.prevTouches.length == 1) {
        this.onCursorUp();
      }

      this.g._currentMouseDown = mouseDownButton.middle;

      // Use the middle of the two touches as the mouse position.
      const middleX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const middleY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      this.onCursorDown(mouseDownButton.middle, middleX, middleY);

      this.g.prevTouches = e.touches;

      return;
    }

    // If there is only one touch, treat it as a left mouse button press.
    this.onCursorDown(
      mouseDownButton.left,
      e.touches[0].clientX,
      e.touches[0].clientY,
    );
  }

  onMouseDown(e: MouseEvent) {
    let button = mouseDownButton.invalid;
    switch (e.button) {
      case 0:
        button = mouseDownButton.left;
        break;
      case 1:
        button = mouseDownButton.middle;
        break;
      default:
        return;
    }
    this.onCursorDown(button, e.clientX, e.clientY);
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
  onCursorDown(button: mouseDownButton, clientX: number, clientY: number) {
    this.g._currentMouseDown = button;

    //console.debug("Cursor down: " + button);

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

    //console.debug("Cursor down");

    // Reset the selection box
    if (g._currentMouseDown != mouseDownButton.none) {
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

    if (g._currentMouseDown == mouseDownButton.middle) {
      this.g.camera.handlePanStart();
    }
  }

  onTouchMove(e: TouchEvent) {
    /* Single touch move is same as mouse drag */
    if (e.touches.length <= 0) {
      const element = document.elementFromPoint(
        e.touches[0].clientX,
        e.touches[0].clientY,
      );
      this.onCursorMove(element, e.touches[0].clientX, e.touches[0].clientY);
      this.g.prevTouches = e.touches;
      return;
    }

    /* If there are multiple touches moving, it is a camera pan and zoom */

    /*  If there are more or less than two touches, then ignore as ir is likely the user was
            trying to drag and accidentally touched the screen with another finger */
    if (this.g.prevTouches == null || this.g.prevTouches.length != 2) {
      if (e.touches.length == 2) this.g.prevTouches = e.touches;
      return;
    }

    const cur1 = e.touches[0];
    const cur2 = e.touches[1];

    let prev1 = null;
    let prev2 = null;

    /* Find the previous touch positions for each finger */
    for (let i = 0; i < e.touches.length; i++) {
      if (cur1.identifier == this.g.prevTouches[i].identifier) {
        prev1 = this.g.prevTouches[i];
      } else if (cur2.identifier == this.g.prevTouches[i].identifier) {
        prev2 = this.g.prevTouches[i];
      }
    }

    if (prev1 == null || prev2 == null) {
      return;
    }

    const curDistance = Math.sqrt(
      Math.pow(cur1.clientX - cur2.clientX, 2) +
        Math.pow(cur1.clientY - cur2.clientY, 2),
    );
    const prevDistance = Math.sqrt(
      Math.pow(prev1.clientX - prev2.clientX, 2) +
        Math.pow(prev1.clientY - prev2.clientY, 2),
    );
    const d_zoom = -2 * (curDistance - prevDistance);

    const middle_x = (cur1.clientX + cur2.clientX) / 2;
    const middle_y = (cur1.clientY + cur2.clientY) / 2;

    const newMouseX = middle_x - this.g.canvasContainer.offsetLeft;
    const newMouseY = middle_y - this.g.canvasContainer.offsetTop;

    this.onCursorMove(
      document.elementFromPoint(newMouseX, newMouseY),
      newMouseX,
      newMouseY,
    );

    this.g.mouse_x = newMouseX;
    this.g.mouse_y = newMouseY;

    this.onZoom(d_zoom);
    this.g.prevTouches = e.touches;

    return;
  }

  onMouseMove(e: MouseEvent) {
    this.onCursorMove(e.target, e.clientX, e.clientY);
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
  onCursorMove(target: EventTarget | null, clientX: number, clientY: number) {
    const g = this.g;

    console.debug("Cursor move", g._currentMouseDown, g.targetObject);

    g.hoverDOM = target;
    g.mouse_x = clientX - g.canvasContainer.offsetLeft;
    g.mouse_y = clientY - g.canvasContainer.offsetTop;

    /* Adjust mouse position to world coordinates */
    [g.mouse_x_world, g.mouse_y_world] = this.g.camera.getWorldFromCamera(
      g.mouse_x,
      g.mouse_y,
    );

    g.dx = clientX - g.mousedown_x + g.dx_offset;
    g.dy = clientY - g.mousedown_y + g.dy_offset;

    /* Handle cases where a mouse button is pressed, i.e. dragging */
    if (g._currentMouseDown == mouseDownButton.none || g.overrideDrag) {
      console.debug(`Mouse move: ${g._currentMouseDown}`, g.overrideDrag);
      return;
    }

    if (g.dx !== 0 || g.dy !== 0) {
      g.mouseHasMoved = true;
    }

    /* If nothing is selected, then this drag is either a camera pan or a selection box */
    if (g.targetObject == null) {
      if (g._currentMouseDown == mouseDownButton.middle) {
        this.g.camera.handlePanDrag(g.dx, g.dy);

        this._setCanvasStyle({
          transform: this.g.camera.canvasStyle,
          cursor: "grabbing",
        });
        this._setBackgroundStyle({
          transform: `translate(${this.g.camera.cameraX + -this.g.camera.cameraWidth * 5}px, ${this.g.camera.cameraY + -this.g.camera.cameraHeight * 5}px)`,
          backgroundPosition: `${-this.g.camera.cameraX}px ${-this.g.camera.cameraY}px`,
        });
      } else if (g._currentMouseDown == mouseDownButton.left) {
        // Select multiple boxes if left mouse button is pressed
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
      console.debug("Target object: " + g.targetObject.gid);
      /* If an object is selected, then this drag is for that object */
      if (g.targetObject.type == ObjectTypes.node) {
        /* If the object being dragged is a node, then handle mouse move for all selected nodes */
        for (const node of g.focusNodes) {
          node.onDrag();
        }
      } else {
        /* Otherwise, just handle mouse move for the selected object */
        g.targetObject.onDrag();
      }
    }
  }

  onMouseUp(_: MouseEvent) {
    this.onCursorUp();
  }

  onTouchEnd(_: TouchEvent) {
    this.onCursorUp();
  }

  onCursorUp() {
    const g = this.g;

    console.debug("Cursor up");

    if (g.ignoreMouseUp) {
      g.ignoreMouseUp = false;
      return;
    }

    if (g._currentMouseDown == mouseDownButton.left) {
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
          console.debug("Mouse up with target node: " + node.gid);
          node.domCursorUp();
        }
      } else {
        // Otherwise, just handle mouse up for the selected object.
        g.targetObject.domCursorUp();
      }

      // if (g.targetObject?.type == ObjectTypes.outputConnector) {
      //     this.requestLineRender = <OutputConnector>g.targetObject;
      // }
    } else if (g._currentMouseDown == mouseDownButton.middle) {
      this.g.camera.handlePanEnd();
    }

    g._currentMouseDown = mouseDownButton.none;

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
    g.dx = 0;
    g.dy = 0;
    g.dx_offset = 0;
    g.dy_offset = 0;

    g.mouseHasMoved = false;
  }

  onWheel(e: WheelEvent) {
    this.onZoom(e.deltaY);
    e.preventDefault();
  }

  onZoom(deltaY = 0) {
    this.g.camera.handleScroll(deltaY, this.g.mouse_x, this.g.mouse_y);
    this._setCanvasStyle({
      transform: this.g.camera.canvasStyle,
    });
  }

  onKeyDown(e: KeyboardEvent) {
    console.debug("Keydown: " + e.key);
    switch (e.key) {
      case "Backspace":
      case "Delete":
        if (this.g.targetObject?.type != ObjectTypes.node) {
          return;
        }

        if (this.g.focusNodes.length > 0) {
          // this.deleteNode(g.focusNode.gid);
          for (const node of this.g.focusNodes) {
            console.debug("Deleting node: " + node.gid);
            this.deleteNode(node.gid);
          }
        }
        break;
    }
  }

  /**
   * Renders elements currently in the canvas.
   */
  renderElements() {
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
      target.renderAllLines(target.lineArray);
    }
  }

  step() {
    this.renderElements();
    this._renderContainer(this._containerStyle);
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

    // n.domMouseDown();
    // n.onDrag();
    // n.domMouseUp();
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

    this.g._currentMouseDown = mouseDownButton.left;
    this.g.mousedown_x = this.g.mouse_x;
    this.g.mousedown_y = this.g.mouse_y;
    this.g.focusNodes = [node];
    this.g.targetObject = node;

    for (const node of this.g.globalNodeList) {
      node.offFocus();
    }

    this.onMouseMove(e);

    // this.g.canvasBackground!.style.cursor = "none";
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
