import Camera from "./camera";
import { BaseObject, queueEntry } from "./object";
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

  currentStage:
    | "IDLE"
    | "READ_1"
    | "WRITE_1"
    | "READ_2"
    | "WRITE_2"
    | "READ_3"
    | "WRITE_3";
  read1Queue: Record<string, Map<string, queueEntry>>;
  write1Queue: Record<string, Map<string, queueEntry>>;
  read2Queue: Record<string, Map<string, queueEntry>>;
  write2Queue: Record<string, Map<string, queueEntry>>;
  read3Queue: Record<string, Map<string, queueEntry>>;
  write3Queue: Record<string, Map<string, queueEntry>>;

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

    this.currentStage = "IDLE";
    this.read1Queue = {};
    this.write1Queue = {};
    this.read2Queue = {};
    this.write2Queue = {};
    this.read3Queue = {};
    this.write3Queue = {};
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
