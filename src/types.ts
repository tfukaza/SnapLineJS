import { Base } from "./components/base";
import { InputConnector, OutputConnector } from "./components/connector";
import { NodeUI } from "./components/node";

export enum mouseDownButton {
    none = "none",
    left = "left",
    middle = "middle",
    right = "right",
    invalid = "invalid"
}

export enum ObjectTypes {
    node = "node",
    connector = "connector",
    line = "line",
    unspecified = "unspecified",
    invalid = "invalid"
}

export interface GlobalStats {
    canvas: HTMLElement | null,             // Root element 
    canvasContainer: HTMLElement | null,    // Container for all elements on canvas 
    canvasBackground: HTMLElement | null,

    currentMouseDown: mouseDownButton,    // Current mouse button being pressed
    mousedown_x: number,            // Initial mouse  position when mouse is pressed
    mousedown_y: number,
    mouse_x: number,                // Current mouse position, in camera space
    mouse_y: number,
    mouse_x_world: number,          // Current mouse position, in world space
    mouse_y_world: number,
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

    overrideDrag: boolean,

    //outputNode: HTMLElement | null,        // Node used to output values
    targetObject: Base | null,
    focusNodes: Array<NodeUI>,
    hoverDOM: EventTarget | null,
    gid: number,

    nodeArray: Array<NodeUI>,  // List of all nodes
    //inputArray: Array<InputComponent>
    globalLines: Array<lineObject>,
    globalNodes: { [key: string]: Base },

    selectionBox: HTMLElement | null,

    mouseHasMoved: boolean,
    ignoreMouseUp: boolean,

    prevTouches: TouchList | null,
    prevSingleTouchTime: number,
    // timer: NodeJS.Timeout | null,
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
    name: string;
    type: comType;
    [key: string]: any;
}

export type inputType = "input-text" | "input-bool" | "input-float" | "input-float-infinite";
export type uiType = "ui-paragraph" | "ui-display" | "ui-dropdown";
export type outputType = "output-text";
export type comType = inputType | uiType | outputType | "custom"

export interface lineObject {
    svg: SVGSVGElement | SVGLineElement;
    line: SVGSVGElement | SVGLineElement;
    to: InputConnector;
    from: OutputConnector;
    connector_x: number;
    connector_y: number;
    x2: number;
    y2: number;
    connector: OutputConnector;
}

export interface customCursorDownProp {
    button: number;
    clientX: number;
    clientY: number;
}