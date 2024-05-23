
import { GlobalStats, ObjectTypes, customCursorDownProp, mouseDownButton } from "../types"

/**
 * Base class for all classes.
 * It contains attributes and methods that are common to all classes,
 * such as position, id, etc.
*/
export abstract class Base {

    g: GlobalStats;         /* Reference to the global stats object */
    gid: string;            /* Unique identifier for the object */
    positionX: number;     /* Position of the object in x-axis */
    positionY: number;
    type: ObjectTypes;      /* Type of the object */

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
        dom.onmousedown = this.domMouseDown.bind(this);
        dom.ontouchstart = this.domTouchStart.bind(this);
    }


    domMouseDown(e: MouseEvent): void {
        this.domCursorDown({ button: e.button, clientX: e.clientX, clientY: e.clientY });
        e.stopPropagation();
    }


    domTouchStart(e: TouchEvent): void {
        this.domCursorDown({ button: 0, clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
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

        let button = prop.button;
        let clientX = prop.clientX;
        let clientY = prop.clientY;

        console.debug(`Base class mousedown event triggered on ${this.gid}!`);

        if (button == 0) {
            this.g.currentMouseDown = mouseDownButton.left;
        } else if (button == 1) {
            this.g.currentMouseDown = mouseDownButton.middle;
        } else if (button == 2) {
            this.g.currentMouseDown = mouseDownButton.right;
        }

        this.g.targetObject = this;
        this.g.mousedown_x = clientX;
        this.g.mousedown_y = clientY;
        this.g.dx = 0;
        this.g.dy = 0;
        this.g.dx_offset = 0;
        this.g.dy_offset = 0;

        this.componentCursorDown(prop);
    }


    componentCursorDown(_: customCursorDownProp): void { }


    /**
     * Mouse up event common to all elements.
     * Triggered when the dom of this object is released.
     */
    domCursorUp(): void {
        console.debug(`Base class mouseup event triggered on ${this.gid}!`);
        this.componentCursorUp();
    }

    componentCursorUp(): void { }

    /**
     *  Focuses on the object.
     */
    onFocus(): void { }


    /**
     *  Removes focus from the object.
     */
    offFocus(): void { }


    /**
     *  Called for every frame when the object is being dragged.
     */
    onDrag(): void { }


    /**
     *  Called for every frame when the camera is being panned.
     */
    onPan(): void { }


    /**
     *  Called when the object is being deleted.
     */
    destroy(): void { }
}

