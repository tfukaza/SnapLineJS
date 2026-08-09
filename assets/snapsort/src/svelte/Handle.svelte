<script lang="ts">
  import { getContext, onDestroy, onMount, type Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import type {
    Item,
  } from "@snap-engine/snapsort";

  type HandleProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    children: Snippet;
    className?: string;
  };

  let {
    children,
    style = "",
    class: classValue = "",
    className = "",
    ...divProps
  }: HandleProps = $props();

  const item: Item | null = getContext("item");
  let handleElement: HTMLElement | null = null;
  const mergedClass = $derived(`snapsort-handle ${classValue} ${className}`.trim());

  onMount(() => {
    if (item && handleElement) {
      item.addInputAlias(handleElement);
    }
  });

  onDestroy(() => {
    if (item && handleElement) {
      item.removeInputAlias(handleElement);
    }
  });
</script>

<div
  {...divProps}
  class={mergedClass}
  bind:this={handleElement}
  {style}
>
  {@render children()}
</div>

<style>

</style>
