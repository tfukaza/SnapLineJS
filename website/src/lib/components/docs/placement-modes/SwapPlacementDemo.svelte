<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type {
    ContainerCallbacks,
    DragItemHoverEvent,
    GhostLifecycleEvent,
    ItemSwapEvent,
  } from "@snap-engine/snapsort";
  import {
    createRenderEntries,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
  } from "@snap-engine/snapsort";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";
  import PlacementDemoShell from "./PlacementDemoShell.svelte";

  const initialItems = [
    { id: "one", label: "One" },
    { id: "two", label: "Two" },
    { id: "three", label: "Three" },
    { id: "four", label: "Four" },
  ];
  let items = $state.raw(
    createRenderTree(createRenderEntries(initialItems, (item) => item.id)),
  );
  let hoveredItemId = $state<string | null>(null);

  function handleSwap(event: ItemSwapEvent) {
    items = reduceRenderTree(items, event);
  }

  function handleGhost(event: GhostLifecycleEvent) {
    items = reduceRenderTree(items, event);
  }

  function highlightTarget(event: DragItemHoverEvent) {
    hoveredItemId = String(event.overItemId);
  }

  function clearTarget(event: DragItemHoverEvent) {
    if (hoveredItemId === String(event.overItemId)) hoveredItemId = null;
  }

  const callbacks = {
    onItemSwap: handleSwap,
    onGhostInsert: handleGhost,
    onGhostMove: handleGhost,
    onGhostRemove: handleGhost,
    onDragItemEnter: highlightTarget,
    onDragItemMove: highlightTarget,
    onDragItemLeave: clearTarget,
    onDragEnd: () => {
      hoveredItemId = null;
    },
  } satisfies ContainerCallbacks;
</script>

<PlacementDemoShell>
  <Engine id="placement-mode-swap-default">
    <Container
      itemId="placement-swap-default-root"
      className="swap-demo-list card"
      config={{
        animation: defaultAnimations,
        mode: "swap",
        direction: "row",
        callbacks,
      }}
    >
      {#each items.entries as entry (entry.itemId)}
        {#if entry.isGhost}
          <Ghost ghost={entry.ghost} className="swap-demo-ghost">
            {#if entry.ghost.type === "pointer-preview"}
              <span>{String(entry.ghost.original.metadata.label ?? "Dragging")}</span>
            {/if}
          </Ghost>
        {:else}
          <Item
            itemId={entry.itemId}
            metadata={{ label: entry.value.label }}
            className={`swap-demo-item${hoveredItemId === entry.itemId ? " is-targeted" : ""}`}
          >
            <span>{entry.value.label}</span>
          </Item>
        {/if}
      {/each}
    </Container>
  </Engine>
</PlacementDemoShell>

<style>
  :global(.swap-demo-list) {
    width: min(100%, 20rem);
    margin: 0 auto;
    gap: var(--size-8);
    justify-content: center;
    overflow: visible;
    box-sizing: border-box;
  }

  :global(.swap-demo-item) {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: calc(50% - var(--size-4)) !important;
    height: 64px !important;
    padding: var(--size-4) var(--size-8);
    border: 1px solid
      color-mix(in srgb, var(--color-background-dark) 24%, transparent);
    border-radius: var(--size-4);
    background: color-mix(
      in srgb,
      var(--color-background) 88%,
      var(--color-background-tint)
    );
    box-sizing: border-box;
    cursor: grab;
  }

  :global(.swap-demo-item[data-snapsort-dragging="true"]) {
    opacity: 1 !important;
  }

  :global(.swap-demo-item.is-targeted) {
    border-color: var(--color-primary);
    outline: 2px solid
      color-mix(in srgb, var(--color-primary) 38%, transparent);
    outline-offset: -2px;
    background: color-mix(
      in srgb,
      var(--color-primary) 10%,
      var(--color-background)
    );
  }

  :global(.swap-demo-item span),
  :global(.swap-demo-ghost span) {
    font-family: "Bitcount Grid Single", monospace;
    font-size: 0.8rem;
    font-weight: 350;
  }

  :global(.swap-demo-ghost) {
    display: grid;
    place-items: center;
    padding: 0;
    border: 2px dashed
      color-mix(in srgb, var(--color-primary) 62%, transparent) !important;
    border-radius: var(--size-8) !important;
    background: color-mix(
      in srgb,
      var(--color-primary) 14%,
      var(--color-background)
    ) !important;
    box-sizing: border-box;
    opacity: 1;
  }
</style>
