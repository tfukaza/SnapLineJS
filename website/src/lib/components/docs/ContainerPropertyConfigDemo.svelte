<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { defaultAnimations, type ItemMoveEvent } from "@snap-engine/snapsort";
  import { Container, Item } from "@snap-engine/snapsort/svelte";

  type Direction = "column" | "row";
  let direction: Direction = $state("column");
  let tasks = $state([
    { id: "one", label: "One" },
    { id: "two", label: "Two" },
    { id: "three", label: "Three" },
  ]);

  function onItemMove(event: ItemMoveEvent) {
    const task = tasks.find((entry) => entry.id === event.itemId);
    if (!task) return;
    const next = tasks.filter((entry) => entry.id !== event.itemId);
    next.splice(Math.min(event.to.index, next.length), 0, task);
    tasks = next;
  }
</script>

<div class="property-config-demo">
  <div class="property-controls" role="group" aria-label="Container direction">
    <button type="button" class:active={direction === "column"} aria-pressed={direction === "column"} onclick={() => direction = "column"}>Column</button>
    <button type="button" class:active={direction === "row"} aria-pressed={direction === "row"} onclick={() => direction = "row"}>Row</button>
  </div>

  <Engine id="container-property-config">
    <Container
      className="config-list"
      items={tasks}
      config={{ animation: defaultAnimations, direction, callbacks: { onItemMove } }}
    >
      {#snippet entry(task)}
        <Item itemId={task.id} className="config-item">{task.label}</Item>
      {/snippet}
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
