import Camera from "./camera";
import { BaseObject, DomElement } from "./components/object";
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
  domRenderQueue: Array<DomElement | BaseObject>;
  domDeleteQueue: Array<DomElement | BaseObject>;
  domFetchQueue: Array<DomElement | BaseObject>;
  domPaintQueue: Array<DomElement | BaseObject>;
  fetchQueue: Array<BaseObject>;
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
    this.domRenderQueue = [];
    this.domDeleteQueue = [];
    this.domFetchQueue = [];
    this.domPaintQueue = [];
    this.fetchQueue = [];
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
