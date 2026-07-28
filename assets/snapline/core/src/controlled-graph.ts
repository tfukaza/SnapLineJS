import { LineReconciler } from "./internal/line-reconciler";
import { getGraphRegistry } from "./internal/shared-data";
import type { ControlledGraphCallbacks, ControlledGraphHandle } from "./types";

/**
 * Attach the controlled-graph bridge: declares "controlled" authority,
 * installs the line reconciler, and returns the handle the application (or
 * adapter) pushes canonical snapshots through.
 */
export function attachControlledGraph(
  engine: { global: { data: any } | null },
  callbacks: ControlledGraphCallbacks,
): ControlledGraphHandle {
  const registry = getGraphRegistry(engine);
  if (registry.reconciler) {
    console.warn(
      "SnapLine: replacing this engine's existing controlled-graph bridge.",
    );
  }
  const reconciler = new LineReconciler(registry, callbacks);
  registry.reconciler = reconciler;
  return {
    setCanonicalGraph: (snapshot) => reconciler.setCanonicalGraph(snapshot),
    flush: () => registry.flush(),
    dispose: () => reconciler.dispose(),
  };
}
