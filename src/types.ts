import { Base } from "./components/base";
import { ConnectorComponent } from "./components/connector";
import { NodeComponent } from "./components/node";
import Camera from "./camera";
import SnapLine from "./snapline";
import { cursorState } from "./input";

export enum ObjectTypes {
  node = 0,
  connector = 1,
  line = 2,
  unspecified = 3,
  inputConnector = 4,
  outputConnector = 5,
  invalid = 6,
}

export enum userState {
  idle = "idle",
  dragging = "dragging",
  panning = "panning",
  connecting = "connecting",
  selecting = "selecting",
  invalid = "invalid",
}

export enum SnapLineDomType {
  container = 0,
  canvas = 1,
  background = 2,
  selectionBox = 3,
  invalid = 4,
}

export interface GlobalStats {
  canvas: HTMLElement; // Root element
  canvasContainer: HTMLElement; // Container for all elements on canvas
  canvasBackground: HTMLElement; // Background of canvas
  selectionBox: HTMLElement; // Selection box

  _currentMouseDown: cursorState; // Current mouse button being pressed
  mousedown_x: number; // Initial mouse  position when mouse is pressed
  mousedown_y: number;
  mouseCameraX: number; // Location of the mouse in camera space
  mouseCameraY: number;
  mouseWorldX: number; // Current mouse position, in world space
  mouseWorldY: number;
  dx: number; // How much the mouse has moved since being pressed
  dy: number;
  dx_offset: number; // Offset for dx and dy
  dy_offset: number;

  camera: Camera;

  overrideDrag: boolean;

  targetObject: Base | null;
  focusNodes: NodeComponent[];
  hoverDOM: EventTarget | null;
  gid: number;

  // globalLines: lineObject[];
  globalNodeList: NodeComponent[]; // List of all nodes
  globalNodeTable: Record<string, NodeComponent | ConnectorComponent>;

  mouseHasMoved: boolean;
  ignoreMouseUp: boolean;

  prevTouches: TouchList | null;
  prevSingleTouchTime: number;

  snapline: SnapLine;
}

export interface SnapLineConfig {
  backgroundZIndex?: number;
  canvasZIndex?: number;
}

export interface NodeConfig {
  nodeClass?: string; // Type of node
}

export interface FormConfig {
  name?: string;
}

export interface ConnectorConfig {
  name?: string;
  maxConnectors?: number;
  allowDragOut?: boolean;
}

export type inputType =
  | "input-text"
  | "input-bool"
  | "input-float"
  | "input-float-infinite";
export type uiType = "ui-paragraph" | "ui-display" | "ui-dropdown";
export type outputType = "output-text";
export type comType = inputType | uiType | outputType | "custom";

export type LineElement = SVGElement | HTMLElement | null;

export interface lineObject {
  svg: SVGElement | null;
  target: ConnectorComponent | null;
  start: ConnectorComponent;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  connector: ConnectorComponent | null;
  requestDelete: boolean;
  completedDelete: boolean;
}

export interface customCursorDownProp {
  button: number; // Must be a number since it's from MouseEvent
  clientX: number;
  clientY: number;
}
