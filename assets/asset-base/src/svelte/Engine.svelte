<script lang="ts">
  import { onDestroy, onMount, setContext, type Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { Engine as CoreEngine } from "@snap-engine/core";
  import { DebugRenderer } from "@snap-engine/core/debug";
  import { CollisionEngine } from "@snap-engine/core/collision";

  type EngineProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    children: Snippet;
    className?: string;
    engine?: CoreEngine | null;
    debug?: boolean;
  };

  let {
    children,
    class: classValue = "",
    className = "",
    debug = false,
    engine = $bindable<CoreEngine | null>(null),
    id = "snap-canvas",
    style = "",
    ...divProps
  }: EngineProps = $props();

  const ownsEngine = typeof document !== "undefined" && engine == null;
  const resolvedEngine =
    typeof document === "undefined" ? null : (engine ?? new CoreEngine());
  engine = resolvedEngine;
  setContext("engine", resolvedEngine);

  if (resolvedEngine && !resolvedEngine.collisionEngine) {
    resolvedEngine.setCollisionEngine(new CollisionEngine());
  }

  let canvas: HTMLDivElement | null = null;
  let mounted = $state(false);
  let pendingDebugEnable = $state(false);
  const mergedClass = $derived(
    `snap-engine-canvas ${classValue} ${className}`.trim(),
  );
  const mergedStyle = $derived(
    `height:100%;overflow:visible;position:relative;${style ?? ""}`,
  );

  onMount(() => {
    if (!resolvedEngine || !canvas) return;
    resolvedEngine.assignDom(canvas);
    resolvedEngine.camera?.setCameraPosition(0, 0);
    mounted = true;

    if (pendingDebugEnable) {
      resolvedEngine.setDebugRenderer(new DebugRenderer());
      pendingDebugEnable = false;
    }
  });

  onDestroy(() => {
    if (!resolvedEngine) return;
    resolvedEngine.disableDebug();
    if (ownsEngine) {
      // Child onDestroy callbacks must unregister their objects first.
      queueMicrotask(() => resolvedEngine.destroy());
    }
  });

  $effect(() => {
    if (!resolvedEngine) return;
    if (debug) {
      if (mounted) {
        resolvedEngine.setDebugRenderer(new DebugRenderer());
      } else {
        pendingDebugEnable = true;
      }
    } else {
      resolvedEngine.disableDebug();
      pendingDebugEnable = false;
    }
  });

  export function enableDebug() {
    if (!resolvedEngine) return;
    if (mounted) {
      resolvedEngine.setDebugRenderer(new DebugRenderer());
    } else {
      pendingDebugEnable = true;
    }
  }

  export function disableDebug() {
    if (!resolvedEngine) return;
    resolvedEngine.disableDebug();
    pendingDebugEnable = false;
  }
</script>

<div
  {...divProps}
  {id}
  class={mergedClass || undefined}
  bind:this={canvas}
  style={mergedStyle}
>
  {#if mounted}
    {@render children()}
  {/if}
</div>
