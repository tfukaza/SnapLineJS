<script lang="ts">
  import ClientDemoFrame from "$lib/components/ClientDemoFrame.svelte";
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type {
    DragItemHoverEvent,
    ItemMoveEvent,
    ItemSwapEvent,
    SortMode,
  } from "@snap-engine/snapsort";
  import { defaultAnimations } from "@snap-engine/snapsort";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";
  import { untrack } from "svelte";

  let {
    mode,
    comparison = false,
    compact = false,
    debug = false,
  }: {
    mode: SortMode;
    comparison?: boolean;
    compact?: boolean;
    debug?: boolean;
  } = $props();

  type DemoItem = { id: string; label: string };
  let items = $state<DemoItem[]>(
    untrack(() => comparison)
      ? [
          { id: "one", label: "Tiny" },
          { id: "two", label: "Longest token" },
          { id: "three", label: "Mid" },
          { id: "four", label: "Wide label" },
          { id: "five", label: "Narrow" },
          { id: "six", label: "Token" },
        ]
      : [
          { id: "one", label: "One" },
          { id: "two", label: "Two" },
          { id: "three", label: "Three" },
          { id: "four", label: "Four" },
        ],
  );
  let hoveredItemId = $state<string | null>(null);
  function handleMove(event: ItemMoveEvent) {
    const id = String(event.itemId);
    const item = items.find((entry) => entry.id === id);
    if (!item) return;

    const next = items.filter((entry) => entry.id !== id);
    next.splice(Math.min(event.to.index, next.length), 0, item);
    items = next;
  }

  function handleSwap(event: ItemSwapEvent) {
    const a = String(event.a.itemId);
    const b = String(event.b.itemId);
    const aIndex = items.findIndex((item) => item.id === a);
    const bIndex = items.findIndex((item) => item.id === b);
    if (aIndex === -1 || bIndex === -1) return;

    const next = [...items];
    [next[aIndex], next[bIndex]] = [next[bIndex], next[aIndex]];
    items = next;
  }

  function highlightTarget(event: DragItemHoverEvent) {
    hoveredItemId = String(event.overItemId);
  }

  function clearTarget(event: DragItemHoverEvent) {
    if (hoveredItemId === String(event.overItemId)) {
      hoveredItemId = null;
    }
  }

  function clearHighlight() {
    hoveredItemId = null;
  }

  const baseCallbacks = {
    onItemMove: handleMove,
    onItemSwap: handleSwap,
  };
  const callbacks = $derived(
    mode === "swap"
      ? {
          ...baseCallbacks,
          onDragItemEnter: highlightTarget,
          onDragItemMove: highlightTarget,
          onDragItemLeave: clearTarget,
          onDragEnd: clearHighlight,
        }
      : baseCallbacks,
  );
  const direction = $derived(
    mode === "insertion" || (mode === "euclidean" && !comparison)
      ? "column"
      : "row",
  );
</script>

<div class="placement-demo" class:swap={mode === "swap"} class:compact>
  <ClientDemoFrame className="placement-demo-skeleton">
      <Engine id={`placement-mode-${mode}-${comparison ? "comparison" : "default"}`} {debug}>
      <Container
        className={`placement-demo-list placement-demo-${mode}${comparison ? " placement-demo-comparison" : ""} card`}
        config={{ animation: defaultAnimations, mode, direction, callbacks }}
        items={items}
      >
        {#snippet entry(item)}
          <Item
            itemId={item.id}
            className={`placement-demo-item is-${item.id}${mode === "swap" && hoveredItemId === item.id ? " is-targeted" : ""}`}
          >
            <span>{item.label}</span>
          </Item>
        {/snippet}
        {#snippet ghost(event)}
          <Ghost {event} className="placement-demo-ghost" />
        {/snippet}
      </Container>
    </Engine>
  </ClientDemoFrame>
</div>

<style>
  .placement-demo {
    width: min(100%, var(--doc-reading-width, 700px));
    margin: var(--size-24) auto var(--size-32);
    padding: var(--size-24);
    border-radius: var(--ui-radius);
    background: var(--color-background-tint);
    box-sizing: border-box;
    user-select: none;
  }

  :global(.placement-demo-list) {
    margin: 0 auto;
    gap: var(--size-8);
    box-sizing: border-box;
    overflow: visible;
  }

  :global(.placement-demo .snap-engine-canvas) {
    overflow: visible !important;
  }

  :global(.placement-demo-euclidean.placement-demo-comparison),
  :global(.placement-demo-progressive) {
    width: min(100%, 30.5rem);
  }

  :global(.placement-demo-euclidean:not(.placement-demo-comparison)) {
    width: min(100%, 22rem);
  }

  :global(.placement-demo-insertion) {
    width: min(100%, 22rem);
  }

  :global(.placement-demo-swap) {
    width: min(100%, 20rem);
    justify-content: center;
  }

  :global(.placement-demo-item) {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    padding: var(--size-4) var(--size-8);
    border: 1px solid color-mix(in srgb, var(--color-background-dark) 24%, transparent);
    border-radius: var(--size-4);
    background: color-mix(in srgb, var(--color-background) 88%, var(--color-background-tint));
    box-sizing: border-box;
    cursor: grab;
  }

  :global(.placement-demo-item[data-snapsort-dragging="true"]) {
    opacity: 1 !important;
  }

  :global(.placement-demo-swap .placement-demo-item.is-targeted) {
    border-color: var(--color-primary);
    outline: 2px solid color-mix(in srgb, var(--color-primary) 38%, transparent);
    outline-offset: -2px;
    background: color-mix(in srgb, var(--color-primary) 10%, var(--color-background));
  }

  :global(.placement-demo-euclidean.placement-demo-comparison .placement-demo-item),
  :global(.placement-demo-progressive .placement-demo-item) {
    height: 48px !important;
  }

  :global(.placement-demo-euclidean.placement-demo-comparison .is-one),
  :global(.placement-demo-progressive .is-one) {
    width: 64px !important;
  }

  :global(.placement-demo-euclidean.placement-demo-comparison .is-two),
  :global(.placement-demo-progressive .is-two) {
    width: 176px !important;
  }

  :global(.placement-demo-euclidean.placement-demo-comparison .is-three),
  :global(.placement-demo-progressive .is-three) {
    width: 84px !important;
  }

  :global(.placement-demo-euclidean.placement-demo-comparison .is-four),
  :global(.placement-demo-progressive .is-four) {
    width: 144px !important;
  }

  :global(.placement-demo-euclidean.placement-demo-comparison .is-five),
  :global(.placement-demo-progressive .is-five) {
    width: 76px !important;
  }

  :global(.placement-demo-euclidean.placement-demo-comparison .is-six),
  :global(.placement-demo-progressive .is-six) {
    width: 104px !important;
  }

  :global(.placement-demo-insertion .placement-demo-item),
  :global(.placement-demo-euclidean:not(.placement-demo-comparison) .placement-demo-item) {
    width: 100% !important;
  }

  :global(.placement-demo-insertion .is-one),
  :global(.placement-demo-euclidean:not(.placement-demo-comparison) .is-one) {
    height: 38px !important;
  }

  :global(.placement-demo-insertion .is-two),
  :global(.placement-demo-euclidean:not(.placement-demo-comparison) .is-two) {
    height: 48px !important;
  }

  :global(.placement-demo-insertion .is-three),
  :global(.placement-demo-euclidean:not(.placement-demo-comparison) .is-three) {
    height: 42px !important;
  }

  :global(.placement-demo-insertion .is-four),
  :global(.placement-demo-euclidean:not(.placement-demo-comparison) .is-four) {
    height: 54px !important;
  }

  :global(.placement-demo-swap .placement-demo-item) {
    width: calc(50% - var(--size-4)) !important;
    height: 64px !important;
  }

  :global(.placement-demo-item span) {
    font-family: "Bitcount Grid Single", monospace;
    font-size: 0.8rem;
    font-weight: 350;
  }

  :global(.placement-demo-ghost) {
    padding: 0;
    border: 2px dashed color-mix(in srgb, var(--color-primary) 62%, transparent) !important;
    border-radius: var(--size-4);
    background: color-mix(in srgb, var(--color-primary) 14%, var(--color-background)) !important;
    box-sizing: border-box;
    opacity: 1;
  }

  :global(.placement-demo [data-snapsort-ghost="insertion"]) {
    height: 0 !important;
    min-height: 0;
    padding: 0;
    border: 0 !important;
    border-top: 3px solid var(--color-primary) !important;
    border-radius: 999px !important;
    background: transparent !important;
    color: var(--color-primary) !important;
  }

  :global(.placement-demo [data-snapsort-ghost="pointer"]) {
    border-radius: var(--size-8) !important;
  }

  @media (max-width: 720px) {
    .placement-demo {
      padding: var(--size-16);
    }
  }

  .placement-demo.compact {
    width: 100%;
    margin: var(--size-12) 0 0;
    padding: var(--size-16);
  }
</style>
