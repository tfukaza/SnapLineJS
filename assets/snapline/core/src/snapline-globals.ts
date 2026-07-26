import type { RectCollider } from "@snap-engine/core/collision";
import type { eventPosition } from "@snap-engine/core";
import {
  GraphMirror,
  SnapLineAuthorityError,
  type GraphAuthority,
} from "./graph-mirror";

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
  /** Registered resize hitboxes; input.ts routes pointerdowns over them. */
  resizeHandles?: RectCollider[];
  /** Registered headless source surfaces; input.ts routes pointerdowns to them. */
  sourceSurfaces?: SourceSurfaceOwner[];
  /**
   * @deprecated Legacy camera-control boolean (last-writer-wins), read by the
   * camera for third-party writers only. In-repo gesture owners block the
   * camera at the input-dispatch layer instead: `engine.input.claimPointer()`
   * (claims auto-release when the gesture ends).
   */
  allowCameraControl?: boolean;
  /**
   * Per-engine SnapLine registries. GlobalManager is application-wide, so the
   * map is keyed by engine; `getGraphMirror` lazy-creates entries the first
   * time a SnapLine mirror registers on that engine. WeakMap so a destroyed
   * engine releases its registry (and every mirror it indexes) — nothing ever
   * enumerates this map.
   */
  graphMirrors?: WeakMap<object, GraphMirror>;
}

/** Typed view over the untyped global data bag (cast at the boundary). */
export function snapData(global: { data: any }): SnapLineSharedData {
  return global.data as SnapLineSharedData;
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


export function getGraphMirror(engine: {
  global: { data: any } | null;
}): GraphMirror {
  if (!engine.global) {
    throw new Error("SnapLine: getGraphMirror requires an initialized engine.");
  }
  const data = snapData(engine.global);
  if (!data.graphMirrors) data.graphMirrors = new WeakMap();
  const key = engine as unknown as object;
  let mirror = data.graphMirrors.get(key);
  if (!mirror) {
    mirror = new GraphMirror(engine);
    data.graphMirrors.set(key, mirror);
  }
  return mirror;
}

/**
 * Declare the engine's authority model. Required before any imperative
 * topology command; the controlled bridge declares "controlled" itself.
 * Re-declaring the same mode is a no-op; a different mode fails fast.
 */
export function setGraphAuthority(
  engine: { global: { data: any } | null },
  authority: GraphAuthority,
): void {
  const mirror = getGraphMirror(engine);
  if (mirror.authority && mirror.authority !== authority) {
    throw new SnapLineAuthorityError(
      `SnapLine: this engine's graph authority is already "${mirror.authority}"; one engine has exactly one authority mode. Run a second engine for the other model.`,
    );
  }
  mirror.authority = authority;
}
