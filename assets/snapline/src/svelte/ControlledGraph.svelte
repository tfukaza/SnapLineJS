<script lang="ts">
  import {
    attachControlledGraph,
    type LineChangeRequest,
    type LineRecord,
    type ReconciliationError,
  } from "@snap-engine/snapline";
  import type { Engine } from "@snap-engine/core";
  import { getContext, onDestroy } from "svelte";

  let {
    onLineChangeRequest,
    onDiagnosticsChanged = undefined,
  }: {
    /** One atomic proposal per gesture. Return the list that should now be
     * canonical — adopting a proposed id settles the line in place; returning
     * the list unchanged rejects. Must be synchronous. */
    onLineChangeRequest: (request: LineChangeRequest) => readonly LineRecord[];
    onDiagnosticsChanged?: (
      diagnostics: readonly ReconciliationError[],
    ) => void;
  } = $props();

  const engine: Engine = getContext("engine");
  const handle = attachControlledGraph(engine, {
    onLineChangeRequest: (request) => onLineChangeRequest(request),
    onDiagnosticsChanged: (diagnostics) => onDiagnosticsChanged?.(diagnostics),
  });

  /**
   * Push records that no originating request asked for: hydration/load,
   * undo/redo, or a collaborator's edit. Reach it with `bind:this`.
   *
   * Gesture-driven changes need none of this — returning the list from
   * `onLineChangeRequest` already delivers them.
   */
  export function setLines(lines: readonly LineRecord[]): void {
    handle.setCanonicalGraph({ lines });
  }

  /** Run any pending reconciliation synchronously (tests, imperative flows). */
  export function flush(): void {
    handle.flush();
  }

  onDestroy(() => handle.dispose());
</script>
