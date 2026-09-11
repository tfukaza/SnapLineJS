<script lang="ts">
  import { getContext, type Snippet } from "svelte";
  import type { Action } from "svelte/action";
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
  const mergedClass = $derived(`snapsort-handle ${classValue} ${className}`.trim());

  const inputAlias: Action<HTMLElement> = (node) => {
    item?.addInputAlias(node);
    return {
      destroy: () => item?.removeInputAlias(node),
    };
  };
</script>

<div
  {...divProps}
  class={mergedClass}
  use:inputAlias
  {style}
>
  {@render children()}
</div>

<style>

</style>
