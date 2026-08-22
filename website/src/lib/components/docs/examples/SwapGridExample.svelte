<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type { Engine as SnapEngine } from "@snap-engine/core";
  import {
    createRenderEntries,
    createRenderTree,
    reduceRenderTree,
    type ContainerCallbacks,
    type DragItemHoverEvent,
    type ItemSwapEvent,
    type RenderTreeEvent,
  } from "@snap-engine/snapsort";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";

  type SwapTile = {
    id: string;
    label: string;
    color: string;
  };

  let engine: SnapEngine | null = $state(null);
  let hoveredId: string | null = $state(null);
  let tiles = $state.raw(
    createRenderTree(
      createRenderEntries<SwapTile>(
        [
          { id: "swap-1", label: "A1", color: "#ff7a59" },
          { id: "swap-2", label: "A2", color: "#ffb703" },
          { id: "swap-3", label: "A3", color: "#06d6a0" },
          { id: "swap-4", label: "B1", color: "#4cc9f0" },
          { id: "swap-5", label: "B2", color: "#4361ee" },
          { id: "swap-6", label: "B3", color: "#7209b7" },
          { id: "swap-7", label: "C1", color: "#f72585" },
          { id: "swap-8", label: "C2", color: "#3a86ff" },
          { id: "swap-9", label: "C3", color: "#8ecae6" },
        ],
        (tile) => tile.id,
      ),
    ),
  );

  $effect(() => {
    if (engine) engine.input.config.maxSimultaneousDrags = 1;
  });

  function handleSwap(event: ItemSwapEvent) {
    tiles = reduceRenderTree(tiles, event);
  }

  function handleHoverEnter(event: DragItemHoverEvent) {
    hoveredId = event.overItemId;
  }

  function handleHoverLeave(event: DragItemHoverEvent) {
    if (hoveredId === event.overItemId) hoveredId = null;
  }

  function handleGhost(event: RenderTreeEvent) {
    tiles = reduceRenderTree(tiles, event);
  }

  function ghostTile(itemId: string): SwapTile | null {
    const entry = tiles.entries.find(
      (candidate) => !candidate.isGhost && candidate.itemId === itemId,
    );
    return entry && !entry.isGhost ? entry.value : null;
  }

  const callbacks = {
    onItemSwap: handleSwap,
    onGhostInsert: handleGhost,
    onGhostMove: handleGhost,
    onGhostRemove: handleGhost,
    onDragItemEnter: handleHoverEnter,
    onDragItemLeave: handleHoverLeave,
  } satisfies ContainerCallbacks;
</script>

{#snippet tileContent(tile: SwapTile)}
  <span class="swap-tile-grip" aria-hidden="true">
    <i></i><i></i><i></i><i></i><i></i><i></i>
  </span>
  <span class="swap-tile-label">{tile.label}</span>
{/snippet}

<div class="swap-example" data-snapsort-example="swap-grid">
  <Engine id="snapsort-swap-example" bind:engine>
    <div class="swap-workspace">
      <Container
        itemId="example-swap-root"
        className="swap-grid"
        config={{
          mode: "swap",
          direction: "row",
          name: "swap-grid",
          animation: {
            reorder: { duration: 240, timing_function: "cubic-bezier(0.22, 1, 0.36, 1)" },
            drop: { duration: 240, timing_function: "cubic-bezier(0.22, 1, 0.36, 1)" },
          },
          callbacks,
        }}
        locked={true}
      >
        {#each tiles.entries as entry (entry.itemId)}
          {#if entry.isGhost}
            {@const tile = ghostTile(entry.ghost.original.itemId)}
            {#if tile}
              <Ghost
                ghost={entry.ghost}
                className="swap-tile card swap-tile-ghost"
                style={`--tile-color: ${tile.color}`}
              >{@render tileContent(tile)}</Ghost>
            {/if}
          {:else}
            <Item itemId={entry.itemId} metadata={{ color: entry.value.color, label: entry.value.label }}>
              <div
                class="swap-tile card"
                class:swap-tile-hovered={hoveredId === entry.itemId}
                style={`--tile-color: ${entry.value.color}`}
              >{@render tileContent(entry.value)}</div>
            </Item>
          {/if}
        {/each}
      </Container>
    </div>
  </Engine>
</div>

<style>
  .swap-example {
    width: min(100%, 36rem);
    margin-inline: auto;
    user-select: none;
  }

  .swap-example :global(.snap-engine-canvas) {
    overflow: visible !important;
  }

  .swap-workspace :global(.swap-grid) {
    width: 100%;
    gap: var(--size-4);
    flex-wrap: wrap;
    padding: var(--size-4);
    overflow: hidden;
    border-radius: calc(var(--size-16) + var(--size-4));
    background: color-mix(in srgb, var(--color-background-tint) 88%, #000);
    box-sizing: border-box;
  }

  .swap-workspace :global(.swap-grid .snapsort-item) {
    width: calc((100% - (var(--size-4) * 2)) / 3);
    padding: 0;
  }

  .swap-workspace :global(.swap-tile) {
    --tile-color: #999;
    --card-color: var(--color-background-tint);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    width: 100%;
    padding: clamp(0.85rem, 1.8vw, 1.25rem) clamp(2.75rem, 5vw, 3.75rem);
    border-radius: var(--size-16);
    background: var(--card-color);
    color: #20262b;
    cursor: grab;
    font-family: "Bitcount Grid Single", monospace;
    font-size: clamp(1.35rem, 3vw, 2rem);
    font-weight: 300;
    touch-action: none;
    box-sizing: border-box;
  }

  .swap-workspace :global(.swap-tile:active) {
    cursor: grabbing;
  }

  .swap-workspace :global(.swap-tile-grip) {
    position: absolute;
    top: 50%;
    left: clamp(1rem, 2vw, 1.45rem);
    display: grid;
    grid-template-columns: repeat(2, 0.28rem);
    grid-template-rows: repeat(3, 0.28rem);
    gap: 0.28rem;
    transform: translateY(-50%);
  }

  .swap-workspace :global(.swap-tile-grip i) {
    display: block;
    width: 0.28rem;
    height: 0.28rem;
    border-radius: 50%;
    background: #9ca3a8;
  }

  .swap-workspace :global(.swap-tile-label) {
    position: relative;
    z-index: 1;
    color: inherit;
    font: inherit;
    line-height: 1;
  }

  .swap-workspace :global(.swap-tile-hovered) {
    outline: 3px solid color-mix(in srgb, var(--tile-color) 68%, #232526);
    outline-offset: 2px;
  }

  .swap-workspace :global(.snapsort-item[data-snapsort-dragging="true"] .swap-tile) {
    opacity: 0.35;
  }

  .swap-workspace :global(.swap-tile-ghost) {
    pointer-events: none;
  }

  @media (max-width: 440px) {
    .swap-workspace :global(.swap-tile) {
      padding-inline: 2rem;
    }

    .swap-workspace :global(.swap-tile-grip) {
      left: 0.75rem;
    }
  }
</style>
