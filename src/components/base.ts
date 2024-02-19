import { NodeUI } from "./node";
import { ComponentConfig, GlobalStats, ObjectTypes, customCursorDownProp, mouseDownButton } from "../types"

/**
 * Base class for all classes.
 * It contains attributes and methods that are common to all classes,
 * such as position, id, etc.
*/
export abstract class Base {

    g: GlobalStats;
    gid: string;
    position_x: number;
    position_y: number;
    type: ObjectTypes;

    constructor(globals: GlobalStats) {
        this.g = globals;

        globals.gid++;
        this.gid = globals.gid.toString();

        this.position_x = 0;
        this.position_y = 0;

        this.type = ObjectTypes.unspecified;

    }

    /**
     * Binds the mousedown event to the given DOM element.
     * This overrides the default mousedown event.
     * 
     * @param dom The DOM element to bind the function to
     */
    bindFunction(dom: HTMLElement) {
        dom.onmousedown = this.domMouseDown.bind(this);
        dom.ontouchstart = this.domTouchStart.bind(this);
    }

    domMouseDown(e: MouseEvent): void {
        this.domCursorDown(e.button, e.clientX, e.clientY);
        e.stopPropagation();
    }
    domTouchStart(e: TouchEvent): void {
        this.domCursorDown(0, e.touches[0].clientX, e.touches[0].clientY);
        e.stopPropagation();
    }

    domCursorDown(button: number, clientX: number, clientY: number): void {

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



        this.customCursorDown({ button: button, clientX: clientX, clientY: clientY });

    }
    customCursorDown(_: customCursorDownProp): void { }

    domCursorUp(): void { }
    onFocus(): void { }
    offFocus(): void { }
    onDrag(): void { }
    onPan(): void { }

    destroy(): void { }
}

/**
 * Components are the buildings blocks of a node.
 */
export class ComponentBase extends Base {

    parent: NodeUI | null;
    config: ComponentConfig;
    dom: HTMLElement | null;

    constructor(config: ComponentConfig, parent: NodeUI | null, globals: GlobalStats) {
        super(globals);
        this.config = config;
        this.parent = parent
        this.dom = null;
    }
}