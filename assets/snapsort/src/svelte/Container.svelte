<script lang="ts" generics="T">
  import {
    Container as SnapSortContainer,
  } from "@snap-engine/snapsort";
  import type {
    ContainerCallbacks,
    ContainerConfig,
    GhostCreateEvent,
    GhostInsertEvent,
    GhostRemoveEvent,
  } from "@snap-engine/snapsort";

  import { flushSync, getContext, setContext, onMount, onDestroy, untrack } from "svelte";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Engine } from "@snap-engine/core";
  import Ghost from "./Ghost.svelte";

  type ContainerProps<T> = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
    config: ContainerConfig;
    before?: Snippet<[]>;
    after?: Snippet<[]>;
    itemId?: string;
    items?: T[];
    getItemId?: (entry: T) => string;
    entry?: Snippet<[T]>;
    ghost?: Snippet<[GhostInsertEvent]>;
    container?: SnapSortContainer;
    locked?: boolean;
    selected?: boolean;
    className?: string;
    metadata?: Record<string, unknown>;
  };

  let {
    config,
    before,
    after,
    itemId,
    items,
    getItemId = (entry: T) => (entry as { id: string }).id,
    entry: entrySnippet,
    ghost: ghostSnippet,
    container = $bindable(),
    locked = true,
    selected = false,
    class: classValue = "",
    className = "",
    metadata = {},
    style = "",
    ...divProps
  }: ContainerProps<T> = $props();
  const engine: Engine = getContext("engine");
  const parentContainer: SnapSortContainer | null = getContext("container");
  const initial = untrack(() => ({ config, entrySnippet, itemId, locked, metadata, selected }));

  if (!initial.entrySnippet) {
    throw new Error("SnapSort Container: missing required `entry` snippet.");
  }
  const renderEntry: Snippet<[T]> = initial.entrySnippet;

  function validateFrameworkConfig(value: ContainerConfig): void {
    if (value.callbacks?.createGhost) {
      throw new Error(
        "SnapSort Container: callbacks.createGhost cannot be used with the Svelte adapter because Svelte owns ghost DOM. Use the `ghost` snippet to customize ghost content.",
      );
    }
    if (value.mode === "swap" && !value.callbacks?.onItemSwap) {
      throw new Error(
        "SnapSort Container: swap mode in the Svelte adapter requires callbacks.onItemSwap so Svelte state can commit the pairwise exchange atomically.",
      );
    }
  }
  validateFrameworkConfig(initial.config);

  interface GhostEntryState {
    event: GhostInsertEvent;
  }
  let ghostEntries = $state<GhostEntryState[]>([]);

  function handleFrameworkCreateGhost(_event: GhostCreateEvent): void {
    // Returning void marks this ghost as framework-managed in core. Its DOM
    // node is created by the keyed entry below for every ghost kind/role.
  }

  function handleFrameworkGhostInsert(event: GhostInsertEvent): void {
    ghostEntries = [
      ...ghostEntries.filter((g) => g.event.ghostItem !== event.ghostItem),
      { event },
    ];
    config.callbacks?.onGhostInsert?.(event);
  }

  function handleFrameworkGhostRemove(event: GhostRemoveEvent): void {
    ghostEntries = ghostEntries.filter((g) => g.event.ghostItem !== event.ghostItem);
    config.callbacks?.onGhostRemove?.(event);
  }

  function frameworkCallbacks(
    consumerCallbacks: ContainerCallbacks | undefined,
  ): ContainerCallbacks {
    return {
      ...consumerCallbacks,
      createGhost: handleFrameworkCreateGhost,
      onGhostInsert: handleFrameworkGhostInsert,
      onGhostRemove: handleFrameworkGhostRemove,
      // Commit the state mutation before core advances to its final geometry
      // read and inverse-transform write in this rendering opportunity.
      flushMutation: (mutation) => flushSync(mutation),
    };
  }

  type RenderedEntry =
    | { kind: "item"; id: string; entry: T }
    | { kind: "ghost"; id: string; ghost: GhostEntryState };

  const renderedEntries = $derived.by((): RenderedEntry[] => {
    const base: RenderedEntry[] = (items ?? []).map((entry) => ({
      kind: "item" as const,
      id: getItemId(entry),
      entry,
    }));
    if (ghostEntries.length === 0) return base;

    const session = ghostEntries[0].event.session;
    const draggedIds = new Set(
      session.items.map((i) => i.resolvedItemId),
    );
    const sorted = ghostEntries.slice().sort((a, b) => a.event.index - b.event.index);
    const result = base.slice();
    for (const g of sorted) {
      let count = 0;
      let p = 0;
      while (p < result.length && count < g.event.index) {
        if (!draggedIds.has(result[p].id)) count++;
        p++;
      }
      while (p < result.length && result[p].kind === "item" && draggedIds.has(result[p].id)) {
        p++;
      }
      result.splice(p, 0, { kind: "ghost", id: `ghost:${g.event.ghostItem.id}`, ghost: g });
    }
    return result;
  });

  let itemContainer: SnapSortContainer = new SnapSortContainer(engine, parentContainer, {
    ...initial.config,
    domOwnership: "framework",
    callbacks: frameworkCallbacks(initial.config.callbacks),
  });
  itemContainer.itemId = initial.itemId;
  itemContainer.locked = initial.locked;
  itemContainer.selected = initial.selected;
  itemContainer.metadata = initial.metadata;
  itemContainer.direction = initial.config.direction ?? "column";
  itemContainer.mainAxisAlign = initial.config.mainAxisAlign ?? "start";
  itemContainer.wrap = initial.config.wrap ?? "auto";
  itemContainer.stretchItems = initial.config.stretchItems ?? false;
  itemContainer.dropArea = initial.config.dropArea ?? false;
  itemContainer.noDrop = initial.config.noDrop ?? false;
  const justifyContent = $derived(config.mainAxisAlign === "center" ? "center" : "flex-start");
  const mergedClass = $derived(
    `snapsort-container snapsort-mode-${itemContainer.mode} ${classValue} ${className}`.trim(),
  );
  const mergedStyle = $derived(
    `flex-direction:${config.direction};justify-content:${justifyContent};${style ?? ""}`,
  );
  setContext("container", itemContainer);
  setContext("item", itemContainer);

  $effect(() => {
    validateFrameworkConfig(config);
    itemContainer.itemId = itemId;
    itemContainer.locked = locked;
    itemContainer.selected = selected;
    itemContainer.metadata = metadata;
    itemContainer.direction = config.direction ?? "column";
    itemContainer.mainAxisAlign = config.mainAxisAlign ?? "start";
    itemContainer.wrap = config.wrap ?? "auto";
    itemContainer.stretchItems = config.stretchItems ?? false;
    itemContainer.dropArea = config.dropArea ?? false;
    itemContainer.noDrop = config.noDrop ?? false;
    itemContainer.config.domOwnership = "framework";
    itemContainer.config.callbacks = frameworkCallbacks(config.callbacks);
  });

  onMount(() => {
    container = itemContainer;
    if (!parentContainer) {
      itemContainer.takeRootSnapshot();
    }
  });

  onDestroy(() => {
    itemContainer.destroy(false);
  });
</script>

{#snippet defaultGhost(event: GhostInsertEvent)}
  <Ghost {event} className="ghost" />
{/snippet}

<div
  {...divProps}
  class={mergedClass}
  style={mergedStyle}
  bind:this={itemContainer.element}
>
  {@render before?.()}
  {#each renderedEntries as re (re.id)}
    {#if re.kind === "ghost"}
      {@render (ghostSnippet ?? defaultGhost)(re.ghost.event)}
    {:else}
      {@render renderEntry(re.entry)}
    {/if}
  {/each}
  {@render after?.()}
</div>

<style>
  .snapsort-container {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
  }
</style>
