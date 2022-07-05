import { NodeUI } from "../node";
import { ComponentConfig, GlobalStats } from "../types"

/*
    Root class of all classes. 
*/
export abstract class Base {

    g: GlobalStats;
    gid: string;
    position_x: number;
    position_y: number;

    constructor(globals: GlobalStats) {
        this.g = globals;
        
        globals.gid++;
        this.gid = globals.gid.toString();

        this.position_x = 0;
        this.position_y = 0;
    }

    bindFunction(dom: HTMLElement){
        dom.onmousedown = this.domMouseDown.bind(this);
    }

    domMouseDown(e: MouseEvent):void {
        console.debug(this)
        this.g.isMouseDown = true;
        this.g.targetNode = this;
        this.g.mousedown_x = e.clientX;
        this.g.mousedown_y = e.clientY;
        this.g.dx = 0;
        this.g.dy = 0;
        this.g.dx_offset = 0;
        this.g.dy_offset = 0;

        this.onFocus();
        this.customMouseDown(e);
        e.stopPropagation();
    }
    customMouseDown(e: MouseEvent): void { console.debug(e); }

    domMouseUp(): void {}
    onFocus(): void {}
    offFocus(): void {}
    onDrag(): void {}
    onPan(): void {}
}

/*
    Base for all components
*/
export class ComponentBase extends Base{
    
    parent: NodeUI | null;
    config: ComponentConfig;
    dom: HTMLElement| null;

    constructor(config: ComponentConfig, parent: NodeUI | null, globals: GlobalStats) {
        super(globals);
        this.config = config;
        this.parent = parent
        this.dom = null;
    }
}