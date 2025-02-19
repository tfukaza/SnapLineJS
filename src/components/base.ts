import { cursorState } from "../input";
import { GlobalStats, ObjectTypes, customCursorDownProp } from "../types";
import { NodeComponent } from "./node";

/**
 * Base class for all classes.
 * It contains attributes and methods that are common to all classes,
 * such as position, id, etc.
 */
export abstract class Base {
  g: GlobalStats | null; /* Reference to the global stats object */
  gid: string; /* Unique identifier for the object */
  positionX: number; /* Position of the object in x-axis */
  positionY: number;
  _type: ObjectTypes; /* Type of the object */

  constructor() {
    this.g = null;
    this.gid = "";
    this.positionX = 0;
    this.positionY = 0;
    this._type = ObjectTypes.unspecified;
  }

  /**
   * Updates the class with globals.
   * @param globals: The globals object.
   */
  updateGlobals(globals: GlobalStats) {
    this.g = globals;
    this.gid = (++globals.gid).toString();
  }

  /**
   * Binds the mousedown event to the given DOM element.
   * @param dom The DOM element to bind the function to
   */
  bindFunction(dom: HTMLElement) {
    //dom.onmousedown = this.domMouseDown.bind(this);
    dom.ontouchstart = this.domTouchStart.bind(this);
    dom.onmousedown = this.domMouseDown.bind(this);
  }

  domMouseDown(e: MouseEvent): void {
    console.debug(`Mouse down event triggered on ${this.gid}`);
    this.domCursorDown({
      event: e,
      button: e.button,
      clientX: e.clientX,
      clientY: e.clientY,
    });
    // e.stopPropagation();
  }

  domTouchStart(e: TouchEvent): void {
    if (this.g == null) {
      return;
    }
    console.debug(`Touch start event triggered on ${this.gid}`);
    this.domCursorDown({
      event: e,
      button: 0,
      clientX: e.touches[0].clientX,
      clientY: e.touches[0].clientY,
    });
    // Touch control has more states than mouse control, so we need to pass the event to the
    // inputControl to handle the touch event.
    this.g.snapline._inputControl?.onTouchStart(e);
  }

  /**
   * Mouse down event common to all elements.
   * Triggered when the dom of this object is clicked.
   * @param button: The mouse button that was clicked
   * @param clientX: The x-coordinate of the mouse click
   * @param clientY: The y-coordinate of the mouse click
   */
  domCursorDown(prop: customCursorDownProp): void {
    if (this.g == null) {
      return;
    }
    const button = prop.button;
    const clientX = prop.clientX;
    const clientY = prop.clientY;

    if (button == 0) {
      this.g._currentMouseDown = cursorState.mouseLeft;
    } else if (button == 1) {
      this.g._currentMouseDown = cursorState.mouseMiddle;
    } else if (button == 2) {
      this.g._currentMouseDown = cursorState.mouseRight;
    }
    console.debug(
      `Base class mousedown event triggered on ${this.gid}, button: ${this.g._currentMouseDown}, clientX: ${clientX}, clientY: ${clientY}, class: ${this.constructor.name}`,
    );
    // If there is a current target object, it means we were performing some action like dragging a line.
    // In this case, we need to delete the line.
    // if (
    //   this.g.targetObject &&
    //   this.g.targetObject._type == ObjectTypes.connector
    // ) {
    //   console.debug(
    //     "Cursor event detected while dragging a line, deleting line",
    //   );
    //   const connector = this.g.targetObject as ConnectorComponent;
    //   connector.domCursorUp();
    // }
    // Iterate through the dictionary values
    for (const [gid, callback] of Object.entries(this.g.cursorUpCallback)) {
      callback();
    }
    this.g.cursorUpCallback = {};
    this.g.targetObject = this;
    [this.g.mousedown_x, this.g.mousedown_y] =
      this.g.camera.getCameraFromScreen(clientX, clientY);
    this.g.dx = 0;
    this.g.dy = 0;
    this.g.dx_offset = 0;
    this.g.dy_offset = 0;

    this._componentCursorDown(prop);

    prop.event.stopPropagation();
    // prop.event.preventDefault();
  }

  _componentCursorDown(_: customCursorDownProp): void {
    console.debug(
      `Base class componentCursorDown event triggered on ${this.gid} with prop ${JSON.stringify(_)}`,
    );
    // To be implemented by the child class
  }

  /**
   * Mouse up event common to all elements.
   * Triggered when the dom of this object is released.
   */
  domCursorUp(): void {
    this._componentCursorUp();
  }

  _componentCursorUp(): void {
    // To be implemented by the child class
  }

  addCursorUpCallback(callback: () => void): void {
    if (this.g == null) {
      return;
    }
    if (this.g.cursorUpCallback[this.gid]) {
      console.warn(
        `Cursor up callback already exists for ${this.gid}, ignoring new callback`,
      );
      return;
    }
    this.g.cursorUpCallback[this.gid] = callback.bind(this);
  }

  deleteCursorUpCallback(): void {
    if (this.g == null) {
      return;
    }
    delete this.g.cursorUpCallback[this.gid];
  }

  /**
   *  Focuses on the object.
   */
  onFocus(): void {
    // To be implemented by the child class
  }

  /**
   *  Removes focus from the object.
   */
  offFocus(): void {
    // To be implemented by the child class
  }

  /**
   *  Called for every frame when the object is being dragged.
   */
  _onDrag(): void {
    // To be implemented by the child class
  }

  /**
   *  Called for every frame when the camera is being panned.
   */
  onPan(): void {
    // To be implemented by the child class
  }

  /**
   *  Called when the object is being deleted.
   */
  delete(): void {
    // To be implemented by the child class
  }

  getClassFromGid(gid: string): typeof Base | null {
    if (this.g == null) {
      return null;
    }
    return this.g.globalNodeTable[gid] as unknown as typeof Base;
  }

  getClassFromDOM(dom: HTMLElement): typeof Base | null {
    if (this.g == null) {
      return null;
    }
    const gid = dom.getAttribute("data-snapline-gid");
    if (!gid) {
      return null;
    }
    return this.getClassFromGid(gid);
  }
}

/**
 * Components refer to any element that is part of a node.
 */
export class ComponentBase extends Base {
  parent: NodeComponent | null;
  dom: HTMLElement | null;

  constructor(
    parent: NodeComponent | null,
    globals: GlobalStats | null = null,
  ) {
    super();

    this.parent = parent;
    this.dom = null;
    if (globals) {
      this.updateGlobals(globals);
    }
  }
}
