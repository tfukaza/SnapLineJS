import type { CircleCollider } from "@snap-engine/core/collision";
import type { NodeComponent } from "./node";

/**
 * Structural stand-in for GroupNodeComponent so node.ts can notify groups on
 * settle without importing the group module (no group→node import cycle).
 */
export interface GroupLike {
  refreshMembership(fireDelta: boolean): void;
}

/**
 * The shape of everything SnapLine stores on the engine's shared `global.data`
 * bag. This is the single declaration site for these cross-module contracts —
 * every reader/writer goes through the typed accessors below instead of
 * re-deriving the shape inline.
 *
 * NOTE for engine core: `input.ts#resolveResizeOwner` reads `resizeHandles`
 * duck-typed (engine core cannot import snapline); keep its structural type in
 * sync with this declaration.
 */
export interface SnapLineSharedData {
  /** Currently-selected nodes (multi-select drag moves all of them). */
  select?: NodeComponent[];
  /** All live groups; notified on any node's drop so membership stays settled. */
  groups?: GroupLike[];
  /** Registered resize hitboxes; input.ts routes pointerdowns over them. */
  resizeHandles?: CircleCollider[];
  /** The node mid-resize, so an unrelated pointerUp doesn't click-select. */
  resizingNode?: NodeComponent | null;
  /**
   * @deprecated Legacy camera-control boolean (last-writer-wins). Superseded by
   * `global.suspend("cameraControl", token)` — the camera still honors `false`
   * for third-party writers.
   */
  allowCameraControl?: boolean;
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

export function getResizeHandles(global: { data: any }): CircleCollider[] {
  const data = snapData(global);
  if (!data.resizeHandles) data.resizeHandles = [];
  return data.resizeHandles;
}
