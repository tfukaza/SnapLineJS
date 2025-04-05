import Camera from "./camera";
import {
  BaseObject,
  preReadEntry,
  writeEntry,
  readEntry,
  postWriteEntry,
} from "./object";
import { AnimationObject } from "./animation";
import { cursorState } from "./input";
import { InputControl } from "./input";
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

class GlobalManager {
  containerElement: HTMLElement | null;
  currentCursor: cursorState;
  cursor: coordinates;
  camera: Camera | null;
  inputEngine: InputControl | null;
  collisionEngine: CollisionEngine | null;
  objectTable: Record<string, BaseObject>;

  currentStage: "preRead" | "write" | "read" | "adjust" | "idle";
  preReadQueue: Record<string, preReadEntry>;
  writeQueue: Record<string, writeEntry>;
  readQueue: Record<string, readEntry>;
  postWriteQueue: Record<string, postWriteEntry>;

  animationList: AnimationObject[] = [];

  data: any;
  snapline: SnapLine | null;

  gid: number;

  constructor() {
    this.containerElement = null;
    this.currentCursor = cursorState.none;
    this.cursor = {
      worldX: 0,
      worldY: 0,
      cameraX: 0,
      cameraY: 0,
      screenX: 0,
      screenY: 0,
    };
    this.camera = null;
    this.inputEngine = null;
    this.collisionEngine = null;
    this.objectTable = {};

    this.currentStage = "idle";
    this.preReadQueue = {};
    this.writeQueue = {};
    this.readQueue = {};
    this.postWriteQueue = {};
    this.animationList = [];

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
