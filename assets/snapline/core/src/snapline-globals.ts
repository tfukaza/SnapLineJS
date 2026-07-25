import type { RectCollider } from "@snap-engine/core/collision";
import type { eventPosition } from "@snap-engine/core";
import type { NodeComponent } from "./node";
import { NodeManager } from "./node-manager";

/**
 * Structural stand-in for GroupNodeComponent so node.ts can notify groups on
 * settle without importing the group module (no group→node import cycle).
 */
export interface GroupLike {
  refreshMembership(fireDelta: boolean): void;
}

/**
 * Structural source-surface contract shared with engine input. Keeping this
 * shape here avoids an engine-core -> SnapLine dependency while still allowing
 * a headless connector to own pointer input outside its parent's DOM bounds.
 */
export interface SourceSurfaceOwner {
  id: string;
  engine: unknown;
  isDeleteRequested: boolean;
  resolveSourceHit(position: eventPosition): {
    candidate: {
      hit: {
        distance: number;
        priority?: number;
      };
    };
    strategyIndex: number;
  } | null;
}

/**
 * The shape of everything SnapLine stores on the engine's shared `global.data`
 * bag. This is the single declaration site for these cross-module contracts —
 * every reader/writer goes through the typed accessors below instead of
 * re-deriving the shape inline.
 *
 * NOTE for engine core: `input.ts#resolveResizeOwner` reads `resizeHandles`
 * and `input.ts#resolveSourceSurfaceOwner` reads `sourceSurfaces` duck-typed
 * (engine core cannot import snapline); keep their structural types in sync
 * with this declaration.
 */
export interface SnapLineSharedData {
  /** Currently-selected nodes (multi-select drag moves all of them). */
  select?: NodeComponent[];
  /** All live groups; notified on any node's drop so membership stays settled. */
  groups?: GroupLike[];
  /** Registered resize hitboxes; input.ts routes pointerdowns over them. */
  resizeHandles?: RectCollider[];
  /** Registered headless source surfaces; input.ts routes pointerdowns to them. */
  sourceSurfaces?: SourceSurfaceOwner[];
  /** The node mid-resize, so an unrelated pointerUp doesn't click-select. */
  resizingNode?: NodeComponent | null;
  /**
   * @deprecated Legacy camera-control boolean (last-writer-wins), read by the
   * camera for third-party writers only. In-repo gesture owners block the
   * camera at the input-dispatch layer instead: `engine.input.claimPointer()`
   * (claims auto-release when the gesture ends).
   */
  allowCameraControl?: boolean;
  /**
   * Per-engine SnapLine registries. GlobalManager is application-wide, so the
   * map is keyed by engine; `getNodeManager` lazy-creates entries the first
   * time a SnapLine component registers on that engine.
   */
  nodeManagers?: Map<unknown, NodeManager>;
}

/** Typed view over the untyped global data bag (cast at the boundary). */
export function snapData(global: { data: any }): SnapLineSharedData {
  return global.data as SnapLineSharedData;
}

export function getSelectList(global: { data: any }): NodeComponent[] {
  const data = snapData(global);
  if (!data.select) data.select = [];
  return data.select;
}

export function getGroups(global: { data: any }): GroupLike[] {
  const data = snapData(global);
  if (!data.groups) data.groups = [];
  return data.groups;
}

export function getResizeHandles(global: { data: any }): RectCollider[] {
  const data = snapData(global);
  if (!data.resizeHandles) data.resizeHandles = [];
  return data.resizeHandles;
}

export function getSourceSurfaces(global: {
  data: any;
}): SourceSurfaceOwner[] {
  const data = snapData(global);
  if (!data.sourceSurfaces) data.sourceSurfaces = [];
  return data.sourceSurfaces;
}


export function getNodeManager(engine: {
  global: { data: any } | null;
}): NodeManager {
  if (!engine.global) {
    throw new Error("SnapLine: getNodeManager requires an initialized engine.");
  }
  const data = snapData(engine.global);
  if (!data.nodeManagers) data.nodeManagers = new Map();
  let manager = data.nodeManagers.get(engine);
  if (!manager) {
    manager = new NodeManager(engine);
    data.nodeManagers.set(engine, manager);
  }
  return manager;
}
