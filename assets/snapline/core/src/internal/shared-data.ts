import { GraphRegistry } from "./graph-registry";

/**
 * The shape of everything SnapLine stores on the engine's shared `global.data`
 * bag. This is the single declaration site for these cross-module contracts —
 * every reader/writer goes through the typed accessors below instead of
 * re-deriving the shape inline.
 *
 */
export interface SnapLineSharedData {
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
