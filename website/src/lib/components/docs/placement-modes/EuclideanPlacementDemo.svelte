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
  import { untrack } from "svelte";
  import PlacementDemoShell from "./PlacementDemoShell.svelte";

  let {
    comparison = false,
    compact = false,
  }: {
    comparison?: boolean;
    compact?: boolean;
  } = $props();

  type DemoItem = { id: string; label: string };
  const comparisonItems: DemoItem[] = [
    { id: "one", label: "Tiny" },
    { id: "two", label: "Longest token" },
    { id: "three", label: "Mid" },
    { id: "four", label: "Wide label" },
    { id: "five", label: "Narrow" },
    { id: "six", label: "Token" },
  ];
  const listItems: DemoItem[] = [
    { id: "one", label: "One" },
    { id: "two", label: "Two" },
    { id: "three", label: "Three" },
    { id: "four", label: "Four" },
  ];

  let items = $state.raw(
    createRenderTree(
      createRenderEntries(
        untrack(() => comparison) ? comparisonItems : listItems,
        (item) => item.id,
      ),
    ),
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

<PlacementDemoShell {compact}>
  <Engine id={`placement-mode-euclidean-${comparison ? "comparison" : "default"}`}>
    <Container
      itemId={`placement-euclidean-${comparison ? "comparison" : "default"}-root`}
      className={`euclidean-demo-list${comparison ? " comparison" : ""} card`}
      config={{
        animation: defaultAnimations,
        mode: "euclidean",
        direction: comparison ? "row" : "column",
        callbacks,
      }}
    >
      {#each items.entries as entry (entry.itemId)}
        {#if entry.isGhost}
          <Ghost ghost={entry.ghost} className="euclidean-demo-ghost" />
        {:else}
          <Item
            itemId={entry.itemId}
            className={`euclidean-demo-item is-${entry.itemId}`}
          >
            <span>{entry.value.label}</span>
          </Item>
        {/if}
      {/each}
    </Container>
  </Engine>
</PlacementDemoShell>

<style>
  :global(.euclidean-demo-list) {
    width: min(100%, 22rem);
    margin: 0 auto;
    gap: var(--size-8);
    overflow: visible;
    box-sizing: border-box;
  }

  :global(.euclidean-demo-list.comparison) {
    width: min(100%, 30.5rem);
  }

  :global(.euclidean-demo-item) {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: 100% !important;
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

  :global(.euclidean-demo-item[data-snapsort-dragging="true"]) {
    opacity: 1 !important;
  }

  :global(.euclidean-demo-item span),
  :global(.euclidean-demo-ghost span) {
    font-family: "Bitcount Grid Single", monospace;
    font-size: 0.8rem;
    font-weight: 350;
  }

  :global(.euclidean-demo-list:not(.comparison) .is-one) {
    height: 38px !important;
  }

  :global(.euclidean-demo-list:not(.comparison) .is-two) {
    height: 48px !important;
  }

  :global(.euclidean-demo-list:not(.comparison) .is-three) {
    height: 42px !important;
  }

  :global(.euclidean-demo-list:not(.comparison) .is-four) {
    height: 54px !important;
  }

  :global(.euclidean-demo-list.comparison .euclidean-demo-item) {
    height: 48px !important;
  }

  :global(.euclidean-demo-list.comparison .is-one) {
    width: 64px !important;
  }

  :global(.euclidean-demo-list.comparison .is-two) {
    width: 176px !important;
  }

  :global(.euclidean-demo-list.comparison .is-three) {
    width: 84px !important;
  }

  :global(.euclidean-demo-list.comparison .is-four) {
    width: 144px !important;
  }

  :global(.euclidean-demo-list.comparison .is-five) {
    width: 76px !important;
  }

  :global(.euclidean-demo-list.comparison .is-six) {
    width: 104px !important;
  }

  :global(.euclidean-demo-ghost) {
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
