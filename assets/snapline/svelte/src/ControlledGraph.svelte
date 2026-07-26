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
    lines,
    onLineChangeRequest,
    onDiagnosticsChanged = undefined,
  }: {
    /** The application-owned canonical line records (stable ids). */
    lines: readonly LineRecord[];
    /** One atomic proposal per gesture; accept/normalize/reject by updating
     * the records — adopting a proposed id settles the line in place. */
    onLineChangeRequest: (request: LineChangeRequest) => void;
    onDiagnosticsChanged?: (
      diagnostics: readonly ReconciliationError[],
    ) => void;
  } = $props();

  const engine: Engine = getContext("engine");
  const handle = attachControlledGraph(engine, {
    onLineChangeRequest: (request) => {
      onLineChangeRequest(request);
      // Guaranteed post-request push: reads the live prop after the app's
      // synchronous document update, queued ahead of the decisive
      // reconciliation pass so acceptance and rejection both resolve
      // without timing inference.
      queueMicrotask(() => handle.setCanonicalGraph({ lines }));
    },
    onDiagnosticsChanged: (diagnostics) => onDiagnosticsChanged?.(diagnostics),
  });

  $effect(() => {
    handle.setCanonicalGraph({ lines });
  });

  onDestroy(() => handle.dispose());
</script>
