import { Base, ComponentBase } from "./base";
import { OutputComponent, InputComponent } from "./component";
import { NodeUI } from "./node";

export interface GlobalStats {
    canvas: HTMLElement | null,             // Root element 
    canvasContainer: HTMLElement | null,    // Container for all elements on canvas 
    
    isMouseDown: boolean            // If mouse is being pressed
    mousedown_x: number,            // Initial mouse  position when mouse is pressed
    mousedown_y: number,         
    mouse_x: number,                // Current mouse position
    mouse_y: number,
    dx: number,                     // How much the mouse has moved since being pressed
    dy: number,
    dx_offset: number,              // Offset for dx and dy
    dy_offset: number,
    
    camera_x: number,               // Current camera position
    camera_y: number,
    camera_pan_start_x: number,     // Initial camera position when camera is being panned
    camera_pan_start_y: number,
    zoom: number,
    cameraWidth: number,
    cameraHeight: number,

    //outputNode: HTMLElement | null,        // Node used to output values
    targetNode: Base | null,
    hoverDOM: EventTarget | null,
    gid: number,
    
    nodeArray: Array<NodeUI>,  // List of all nodes
    //inputArray: Array<InputComponent>
    globalLines: Array<lineObject>,
    globalNodes: {[key: string]: Base},
}

export type NodeConfigFunction = Array<{
    name: string;
    inputs: Array<string>;
    outputs: Array<string>;
    functionInit?: Function;
    functionUpdate: Function;
}>;


export interface NodeConfig {
    functions: NodeConfigFunction;
    elements: Array<Array<ComponentConfig> | ComponentConfig>;
}

export interface ComponentConfig {
    name:string;
    type: comType;
    [key: string]: any;
}

export type inputType = "input-text" | "input-bool";
export type uiType = "ui-paragraph" | "ui-display" | "ui-dropdown";
export type outputType = "output-text";
export type comType =  inputType | uiType| outputType | "custom"

export interface lineObject {
    svg:SVGSVGElement | SVGLineElement;
    line: SVGSVGElement | SVGLineElement;
    to: InputComponent;
    from: OutputComponent;
    connector_x: number;
    connector_y: number;
    x2: number;
    y2: number;
    connector: OutputComponent;   
}