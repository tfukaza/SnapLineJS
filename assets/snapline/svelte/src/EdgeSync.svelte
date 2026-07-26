<script lang="ts">
  import {
    EdgeSyncController,
    type ConnectorComponent,
    type EdgeConnectIntentEvent,
    type EdgeDisconnectIntentEvent,
    type EdgeEndpoint,
    type EdgeLike,
  } from "@snap-engine/snapline";
  import type { Engine } from "@snap-engine/core";
  import { getContext, onDestroy, tick } from "svelte";

  let {
    edges,
    identity,
    onEdgeConnect = undefined,
    onEdgeDisconnect = undefined,
  }: {
    /** The consumer's edge document — the single source of truth. */
    edges: readonly EdgeLike[];
    /** Maps a connector to its semantic endpoint, or null for unmanaged connectors. */
    identity: (connector: ConnectorComponent) => EdgeEndpoint | null;
    onEdgeConnect?: ((event: EdgeConnectIntentEvent) => void) | undefined;
    onEdgeDisconnect?: ((event: EdgeDisconnectIntentEvent) => void) | undefined;
  } = $props();

  let engine: Engine = getContext("engine");

  const controller = new EdgeSyncController({
    engine,
    identity: (connector) => identity(connector),
    // $props getters keep this read live — sync always sees the current doc.
    getEdges: () => edges,
    callbacks: {
      // Gesture intents fire synchronously inside the drop dispatch; the
      // consumer writes its document in the handler. Reconciling in a
      // microtask keeps the accept AND reject paths inside the same task —
      // before the browser paints — without re-entering the gesture stack.
      onEdgeConnect: (event) => {
        onEdgeConnect?.(event);
        queueMicrotask(() => controller.sync());
      },
      onEdgeDisconnect: (event) => {
        onEdgeDisconnect?.(event);
        queueMicrotask(() => controller.sync());
      },
    },
  });

  // Doc changes (presets, programmatic edits, node mounts) reconcile after
  // tick so freshly mounted connectors are registered before lines hydrate.
  $effect(() => {
    void edges;
    void tick().then(() => controller.sync());
  });

  onDestroy(() => controller.dispose());
</script>
