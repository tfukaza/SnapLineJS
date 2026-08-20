<script lang="ts">
  import { Container as SnapSortContainer } from "@snap-engine/snapsort";
  import type {
    ContainerConfig,
    ItemMetadata,
    SnapSortAdapter,
  } from "@snap-engine/snapsort";

  import {
    flushSync,
    getContext,
    setContext,
    onMount,
    onDestroy,
    untrack,
  } from "svelte";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Engine } from "@snap-engine/core";

  type ContainerProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    children?: Snippet;
    config?: ContainerConfig;
    itemId: string;
    container?: SnapSortContainer | null;
    locked?: boolean;
    selected?: boolean;
    className?: string;
    metadata?: ItemMetadata;
  };

  let {
    children,
    config = {},
    itemId,
    container = $bindable(),
    locked = true,
    selected = false,
    class: classValue = "",
    className = "",
    metadata = {},
    style = "",
    ...divProps
  }: ContainerProps = $props();
  const engine: Engine = getContext("engine");
  const parentContainer: SnapSortContainer | null = getContext("container");
  const initial = untrack(() => ({
    config,
    itemId,
    locked,
    metadata,
    selected,
  }));

  function validateFrameworkConfig(value: ContainerConfig): void {
    if (
      !parentContainer &&
      value.mode === "swap" &&
      !value.callbacks?.onItemSwap
    ) {
      throw new Error(
        "SnapSort Container: swap mode in the Svelte adapter requires callbacks.onItemSwap so Svelte state can commit the pairwise exchange atomically.",
      );
    }
  }

  function validateMetadata(value: ItemMetadata): void {
    if ("itemId" in value) {
      throw new Error(
        "SnapSort Container: `metadata.itemId` was removed. Pass `itemId` as its own prop instead.",
      );
    }
  }

  validateFrameworkConfig(initial.config);
  validateMetadata(initial.metadata);
  if (!initial.itemId) {
    throw new Error("SnapSort Container: missing required `itemId` prop.");
  }

  const parentAdapter: SnapSortAdapter | undefined =
    getContext("snapsort-adapter");
  const adapter: SnapSortAdapter = parentAdapter ?? {
    callbacks: {},
    commit: (mutation) => flushSync(mutation),
  };

  let itemContainer: SnapSortContainer = new SnapSortContainer(
    engine,
    parentContainer,
    {
      ...initial.config,
      itemId: initial.itemId,
      adapter,
      callbacks: initial.config.callbacks,
    },
  );
  itemContainer.locked = initial.locked;
  itemContainer.selected = initial.selected;
  itemContainer.metadata = initial.metadata;
  itemContainer.direction = initial.config.direction ?? "column";
  itemContainer.mainAxisAlign = initial.config.mainAxisAlign ?? "start";
  itemContainer.wrap = initial.config.wrap ?? "auto";
  itemContainer.stretchItems = initial.config.stretchItems ?? false;
  itemContainer.dropPriority = initial.config.dropPriority ?? 0;
  const direction = $derived(config.direction ?? "column");
  const justifyContent = $derived(
    config.mainAxisAlign === "center" ? "center" : "flex-start",
  );
  const mergedClass = $derived(
    `snapsort-container snapsort-mode-${itemContainer.mode} ${classValue} ${className}`.trim(),
  );
  const mergedStyle = $derived(
    `flex-direction:${direction};justify-content:${justifyContent};${style ?? ""}`,
  );
  setContext("container", itemContainer);
  setContext("item", itemContainer);
  setContext("snapsort-adapter", adapter);

  $effect(() => {
    validateFrameworkConfig(config);
    validateMetadata(metadata);
    if (itemId !== initial.itemId) {
      throw new Error(
        "SnapSort Container: the `itemId` prop cannot change after mount. Remount the Container with a new key.",
      );
    }
    itemContainer.locked = locked;
    itemContainer.selected = selected;
    itemContainer.metadata = metadata;
    itemContainer.mode = config.mode ?? itemContainer.mode;
    itemContainer.direction = direction;
    itemContainer.mainAxisAlign = config.mainAxisAlign ?? "start";
    itemContainer.wrap = config.wrap ?? "auto";
    itemContainer.stretchItems = config.stretchItems ?? false;
    itemContainer.dropPriority = config.dropPriority ?? 0;
    itemContainer.config.animation = config.animation;
    itemContainer.callbacks = config.callbacks ?? {};
  });

  onMount(() => {
    container = itemContainer;
    if (!parentContainer) {
      itemContainer.takeRootSnapshot();
    }
  });

  onDestroy(() => {
    if (container === itemContainer) {
      container = null;
    }
    itemContainer.destroy(false);
  });
</script>

<div
  {...divProps}
  class={mergedClass}
  style={mergedStyle}
  bind:this={itemContainer.element}
>
  {@render children?.()}
</div>

<style>
  .snapsort-container {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
  }
</style>
