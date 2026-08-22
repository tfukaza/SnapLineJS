<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type {
    ContainerCallbacks,
    GhostLifecycleEvent,
    ItemMoveEvent,
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
    { id: "one", label: "Tiny" },
    { id: "two", label: "Longest token" },
    { id: "three", label: "Mid" },
    { id: "four", label: "Wide label" },
    { id: "five", label: "Narrow" },
    { id: "six", label: "Token" },
  ];
  let items = $state.raw(
    createRenderTree(createRenderEntries(initialItems, (item) => item.id)),
  );

  function reduce(event: ItemMoveEvent | GhostLifecycleEvent) {
    items = reduceRenderTree(items, event);
  }

  const callbacks = {
    onItemMove: reduce,
    onGhostInsert: reduce,
    onGhostMove: reduce,
    onGhostRemove: reduce,
  } satisfies ContainerCallbacks;
</script>

<PlacementDemoShell compact>
  <Engine id="placement-mode-progressive-comparison">
    <Container
      itemId="placement-progressive-comparison-root"
      className="progressive-demo-list card"
      config={{
        animation: defaultAnimations,
        mode: "progressive",
        direction: "row",
        callbacks,
      }}
    >
      {#each items.entries as entry (entry.itemId)}
        {#if entry.isGhost}
          <Ghost ghost={entry.ghost} className="progressive-demo-ghost" />
        {:else}
          <Item
            itemId={entry.itemId}
            className={`progressive-demo-item is-${entry.itemId}`}
          >
            <span>{entry.value.label}</span>
          </Item>
        {/if}
      {/each}
    </Container>
  </Engine>
</PlacementDemoShell>

<style>
  :global(.progressive-demo-list) {
    width: min(100%, 30.5rem);
    margin: 0 auto;
    gap: var(--size-8);
    overflow: visible;
    box-sizing: border-box;
  }

  :global(.progressive-demo-item) {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    height: 48px !important;
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

  :global(.progressive-demo-item[data-snapsort-dragging="true"]) {
    opacity: 1 !important;
  }

  :global(.progressive-demo-item span) {
    font-family: "Bitcount Grid Single", monospace;
    font-size: 0.8rem;
    font-weight: 350;
  }

  :global(.progressive-demo-list .is-one) {
    width: 64px !important;
  }

  :global(.progressive-demo-list .is-two) {
    width: 176px !important;
  }

  :global(.progressive-demo-list .is-three) {
    width: 84px !important;
  }

  :global(.progressive-demo-list .is-four) {
    width: 144px !important;
  }

  :global(.progressive-demo-list .is-five) {
    width: 76px !important;
  }

  :global(.progressive-demo-list .is-six) {
    width: 104px !important;
  }

  :global(.progressive-demo-ghost) {
    padding: 0;
    border: 2px dashed
      color-mix(in srgb, var(--color-primary) 62%, transparent) !important;
    border-radius: var(--size-4);
    background: color-mix(
      in srgb,
      var(--color-primary) 14%,
      var(--color-background)
    ) !important;
    box-sizing: border-box;
    opacity: 1;
  }
</style>
