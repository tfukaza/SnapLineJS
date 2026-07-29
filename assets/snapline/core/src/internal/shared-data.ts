import type { eventPosition } from "@snap-engine/core";
import { GraphRegistry } from "./graph-registry";

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
 * NOTE for engine core: `input.ts#resolveSourceSurfaceOwner` reads
 * `sourceSurfaces` duck-typed (engine core cannot import snapline); keep its
 * structural type in sync with this declaration.
 */
export interface SnapLineSharedData {
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
   * map is keyed by engine; `getGraphRegistry` lazy-creates entries the first
   * time a SnapLine mirror registers on that engine. WeakMap so a destroyed
   * engine releases its registry (and every mirror it indexes) — nothing ever
   * enumerates this map.
   */
  graphRegistries?: WeakMap<object, GraphRegistry>;
}

/** Typed view over the untyped global data bag (cast at the boundary). */
export function snapData(global: { data: any }): SnapLineSharedData {
  return global.data as SnapLineSharedData;
}

export function getSourceSurfaces(global: { data: any }): SourceSurfaceOwner[] {
  const data = snapData(global);
  if (!data.sourceSurfaces) data.sourceSurfaces = [];
  return data.sourceSurfaces;
}

/** The per-engine registry, lazy-created on first access. */
export function getGraphRegistry(engine: {
  global: { data: any } | null;
}): GraphRegistry {
  if (!engine.global) {
    throw new Error(
      "SnapLine: getGraphRegistry requires an initialized engine.",
    );
  }
  const data = snapData(engine.global);
  if (!data.graphRegistries) data.graphRegistries = new WeakMap();
  const key = engine as unknown as object;
  let registry = data.graphRegistries.get(key);
  if (!registry) {
    registry = new GraphRegistry(engine);
    data.graphRegistries.set(key, registry);
  }
  return registry;
}
