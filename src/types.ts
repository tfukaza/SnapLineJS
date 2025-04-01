export enum ObjectTypes {
  node = 0,
  connector = 1,
  line = 2,
  unspecified = 3,
  inputConnector = 4,
  outputConnector = 5,
  invalid = 6,
}

export interface CameraConfig {
  enableZoom?: boolean;
  zoomBounds?: {
    min: number;
    max: number;
  };
  enablePan?: boolean;
  panBounds?: {
    top: number | null;
    left: number | null;
    right: number | null;
    bottom: number | null;
  };
}

export interface SnapLineConfig {
  backgroundZIndex?: number;
  canvasZIndex?: number;
  cameraConfig?: CameraConfig;
}

export interface NodeConfig {
  nodeClass?: string; // Type of node
  lockPosition?: boolean;
}

export interface FormConfig {
  name?: string;
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
