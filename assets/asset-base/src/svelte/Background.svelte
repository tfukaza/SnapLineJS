<script lang="ts">
  import { getContext, onDestroy, onMount, setContext } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { Background as BackgroundObject } from "@snap-engine/asset-base";
  import type { Engine } from "@snap-engine/core";

  type BackgroundProps = HTMLAttributes<HTMLDivElement> & {
    backgroundObject?: BackgroundObject | null;
    className?: string;
  };

  let {
    backgroundObject = $bindable<BackgroundObject | null>(null),
    class: classValue = "",
    className = "",
    id = "sl-background",
    style = "",
    ...divProps
  }: BackgroundProps = $props();

  const engine: Engine | null = getContext("engine");
  if (!engine) {
    throw new Error("SnapEngine Svelte background consumers must be rendered inside <Engine>.");
  }

  const ownsBackground = backgroundObject == null;
  const resolvedBackground = backgroundObject ?? new BackgroundObject(engine, null);
  if (resolvedBackground.engine !== engine) {
    throw new Error("The injected Background belongs to another Engine.");
  }
  backgroundObject = resolvedBackground;
  setContext("bg", resolvedBackground);

  let backgroundElement: HTMLDivElement | null = null;
  const mergedClass = $derived(`${classValue} ${className}`.trim());
  const mergedStyle = $derived(
    `background-color:#fff;background-image:radial-gradient(circle, #cccccc 2px, transparent 1px);user-select:none;${style ?? ""}`,
  );

  onMount(() => {
    if (backgroundElement) {
      resolvedBackground.element = backgroundElement;
    }
  });

  onDestroy(() => {
    if (ownsBackground) {
      resolvedBackground.destroy(false);
    }
  });
</script>

<div
  {...divProps}
  {id}
  class={mergedClass || undefined}
  bind:this={backgroundElement}
  style={mergedStyle}
></div>
