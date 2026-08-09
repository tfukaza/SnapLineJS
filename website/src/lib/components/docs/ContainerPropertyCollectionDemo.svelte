<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type { ItemMoveEvent } from "@snap-engine/snapsort";
  import { Container, Item } from "@snap-engine/snapsort/svelte";

  type Task = { key: string; label: string };
  let tasks = $state<Task[]>([
    { key: "write", label: "Write outline" },
    { key: "review", label: "Review draft" },
    { key: "publish", label: "Publish" },
  ]);

  function onItemMove(event: ItemMoveEvent) {
    const task = tasks.find((entry) => entry.key === event.itemId);
    if (!task) return;
    const next = tasks.filter((entry) => entry.key !== event.itemId);
    next.splice(Math.min(event.to.index, next.length), 0, task);
    tasks = next;
  }
</script>

<Engine id="container-property-collection">
  <Container
    className="property-list"
    items={tasks}
    getItemId={(task) => task.key}
    config={{ callbacks: { onItemMove } }}
  >
    {#snippet entry(task)}
      <Item itemId={task.key} className="property-item">
        {task.label}
      </Item>
    {/snippet}
  </Container>
</Engine>

<style>
  :global(.property-list) {
    gap: 0.5rem;
    width: min(100%, 22rem);
    margin: 0 auto;
  }

  :global(.property-item) {
    align-items: flex-start !important;
    padding: 0.7rem 0.85rem !important;
    border: 1px solid rgb(58 42 34 / 18%);
    border-radius: 8px;
    background: white;
    cursor: grab;
  }
</style>
