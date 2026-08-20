<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import {
    createRenderEntries,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
    type ContainerCallbacks,
    type GhostLifecycleEvent,
    type ItemMoveEvent,
  } from "@snap-engine/snapsort";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";

  type Direction = "column" | "row";
  let direction: Direction = $state("column");
  let tasks = $state.raw(
    createRenderTree(
      createRenderEntries(
        [
          { id: "one", label: "One" },
          { id: "two", label: "Two" },
          { id: "three", label: "Three" },
        ],
        (task) => task.id,
      ),
    ),
  );

  function onItemMove(event: ItemMoveEvent) {
    tasks = reduceRenderTree(tasks, event);
  }

  function onGhostMove(event: GhostLifecycleEvent) {
    tasks = reduceRenderTree(tasks, event);
  }

  const callbacks = {
    onItemMove,
    onGhostInsert: onGhostMove,
    onGhostMove,
    onGhostRemove: onGhostMove,
  } satisfies ContainerCallbacks;
</script>

<div class="property-config-demo">
  <div class="property-controls" role="group" aria-label="Container direction">
    <button type="button" class:active={direction === "column"} aria-pressed={direction === "column"} onclick={() => direction = "column"}>Column</button>
    <button type="button" class:active={direction === "row"} aria-pressed={direction === "row"} onclick={() => direction = "row"}>Row</button>
  </div>

  <Engine id="container-property-config">
    <Container
      itemId="container-property-config-root"
      className="config-list"
      config={{ animation: defaultAnimations, direction, callbacks }}
    >
      {#each tasks.entries as entry (entry.itemId)}
        {#if entry.isGhost}
          <Ghost ghost={entry.ghost} />
        {:else}
          <Item itemId={entry.itemId} className="config-item">{entry.value.label}</Item>
        {/if}
      {/each}
    </Container>
  </Engine>
</div>

<style>
  .property-config-demo {
    display: grid;
    gap: 1rem;
  }

  .property-controls {
    display: flex;
    justify-content: center;
    gap: 0.35rem;
  }

  button {
    padding: 0.4rem 0.8rem;
    border: 1px solid rgb(58 42 34 / 18%);
    border-radius: 999px;
    background: white;
    color: inherit;
    cursor: pointer;
  }

  button.active {
    border-color: var(--color-action);
    color: var(--color-action);
  }

  :global(.config-list) {
    gap: 0.5rem;
    width: min(100%, 24rem);
    min-height: 5rem;
    margin: 0 auto;
    padding: 0.75rem;
    border: 1px dashed rgb(58 42 34 / 24%);
    border-radius: 10px;
    box-sizing: border-box;
  }

  :global(.config-item) {
    flex: 0 0 auto;
    padding: 0.65rem 0.85rem !important;
    border-radius: 8px;
    background: white;
    box-shadow: 0 1px 4px rgb(31 30 41 / 10%);
    cursor: grab;
  }
</style>
