import { LineReconciler } from "./internal/line-reconciler";
import { getGraphRegistry } from "./internal/shared-data";
import type {
  ControlledGraphCallbacks,
  ControlledGraphHandle,
  LineChangeRequest,
  LineRecord,
} from "./types";

/**
 * Apply one atomic {@link LineChangeRequest} to a line list, returning a new
 * list. This is the whole body of a typical `onLineChangeRequest`:
 *
 * ```ts
 * onLineChangeRequest={(r) => (lines = applyLineChange(lines, r))}
 * ```
 *
 * Removals are dropped, endpoint updates are applied, and additions are
 * appended — in that order, as one commit. `intent` is not consulted: it
 * describes the gesture for logging, and the three lists already say what to
 * do.
 *
 * **Adopt the proposed ids.** `request.add` carries SnapLine-minted ids;
 * keeping them settles the dragged line in place with no flicker. Substituting
 * your own id works, but recreates the mirror.
 *
 * Consumer-owned fields survive an update (the record is spread), but cannot
 * be invented for an addition — seed those at drag start with
 * `node.callbacks.resolveNewLine`, and they ride into `request.add` for you.
 *
 * Replace-not-mutate by construction: every call builds a new array, which is
 * what makes `$state.raw` safe for the list in Svelte.
 */
export function applyLineChange<T extends LineRecord>(
  lines: readonly T[],
  request: LineChangeRequest,
): T[] {
  const removed = new Set(request.remove);
  const next: T[] = [];
  for (const record of lines) {
    if (removed.has(record.id)) continue;
    const update = request.update.find((entry) => entry.id === record.id);
    next.push(
      update ? { ...record, toConnectorId: update.toConnectorId } : record,
    );
  }
  for (const addition of request.add) next.push(addition as unknown as T);
  return next;
}

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
