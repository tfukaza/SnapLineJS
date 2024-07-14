import { cursorState } from "../input";
import { GlobalStats, ObjectTypes, customCursorDownProp } from "../types";

/**
 * Base class for all classes.
 * It contains attributes and methods that are common to all classes,
 * such as position, id, etc.
 */
export abstract class Base {
  g: GlobalStats; /* Reference to the global stats object */
  gid: string; /* Unique identifier for the object */
  positionX: number; /* Position of the object in x-axis */
  positionY: number;
  type: ObjectTypes; /* Type of the object */

  constructor(globals: GlobalStats) {
    this.g = globals;
    this.gid = (++globals.gid).toString();
    this.positionX = 0;
    this.positionY = 0;
    this.type = ObjectTypes.unspecified;
  }

  /**
   * Binds the mousedown event to the given DOM element.
   * @param dom The DOM element to bind the function to
   */
  bindFunction(dom: HTMLElement) {
    //dom.onmousedown = this.domMouseDown.bind(this);
    dom.ontouchstart = this.domTouchStart.bind(this);
    dom.onpointerdown = this.domMouseDown.bind(this);
  }

  domMouseDown(e: MouseEvent): void {
    console.debug(`Mouse down event triggered on ${this.gid}`);
    this.domCursorDown({
      button: e.button,
      clientX: e.clientX,
      clientY: e.clientY,
    });
    e.stopPropagation();
  }

  domTouchStart(e: TouchEvent): void {
    console.debug(`Touch start event triggered on ${this.gid}`);
    this.domCursorDown({
      button: 0,
      clientX: e.touches[0].clientX,
      clientY: e.touches[0].clientY,
    });
    e.stopPropagation();
  }

  /**
   * Mouse down event common to all elements.
   * Triggered when the dom of this object is clicked.
   * @param button: The mouse button that was clicked
   * @param clientX: The x-coordinate of the mouse click
   * @param clientY: The y-coordinate of the mouse click
   */
  domCursorDown(prop: customCursorDownProp): void {
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
      `Base class mousedown event triggered on ${this.gid}, button: ${button}, clientX: ${clientX}, clientY: ${clientY}`,
    );
    this.g.targetObject = this;
    [this.g.mousedown_x, this.g.mousedown_y] =
      this.g.camera.getCameraFromScreen(clientX, clientY);
    this.g.dx = 0;
    this.g.dy = 0;
    this.g.dx_offset = 0;
    this.g.dy_offset = 0;

    this.componentCursorDown(prop);
  }

  componentCursorDown(_: customCursorDownProp): void {
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
    this.componentCursorUp();
  }

  componentCursorUp(): void {
    // To be implemented by the child class
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
  onDrag(): void {
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
  destroy(): void {
    // To be implemented by the child class
  }
}
