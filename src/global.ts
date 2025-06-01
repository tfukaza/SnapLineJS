import Camera from "./camera";
import {
  BaseObject,
  preReadEntry,
  writeEntry,
  readEntry,
  postWriteEntry,
} from "./object";
import { AnimationObject, SequenceObject } from "./animation";
import { GlobalInputControl } from "./input";
import { CollisionEngine } from "./collision";
import { SnapLine } from "./snapline";

interface coordinates {
  worldX: number;
  worldY: number;
  cameraX: number;
  cameraY: number;
  screenX: number;
  screenY: number;
}

interface debugMarker {
  type: "point" | "rect" | "circle" | "text";
  gid: string;
  id: string;
  persistent: boolean; // Persists on screen until cleared or replaced
  color: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  text?: string;
}

class GlobalManager {
  containerElement: HTMLElement | null;
  cursor: coordinates;
  camera: Camera | null;
  inputEngine: GlobalInputControl | null;
  collisionEngine: CollisionEngine | null;
  objectTable: Record<string, BaseObject>;

  currentStage: "preRead" | "write" | "read" | "adjust" | "idle";
  preReadQueue: Record<string, preReadEntry>;
  writeQueue: Record<string, writeEntry>;
  readQueue: Record<string, readEntry>;
  postWriteQueue: Record<string, postWriteEntry>;

  animationList: (AnimationObject | SequenceObject)[] = [];
  animationFragment: HTMLDivElement;

  debugMarkerList: Record<string, debugMarker> = {};

  data: any;
  snapline: SnapLine | null;

  gid: number;

  constructor() {
    this.containerElement = null;
    this.cursor = {
      worldX: 0,
      worldY: 0,
      cameraX: 0,
      cameraY: 0,
      screenX: 0,
      screenY: 0,
    };
    this.camera = null;
    this.inputEngine = new GlobalInputControl(this);
    this.collisionEngine = null;
    this.objectTable = {};

    this.currentStage = "idle";
    this.preReadQueue = {};
    this.writeQueue = {};
    this.readQueue = {};
    this.postWriteQueue = {};
    this.animationList = [];
    this.animationFragment = document.createElement("div");
    document.body.appendChild(this.animationFragment);

    this.data = {};
    this.snapline = null;
    this.gid = 0;
  }

  getGlobalId() {
    this.gid++;
    return this.gid.toString();
  }
}

export { GlobalManager };
