<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { defaultAnimations, type ItemMoveEvent } from "@snap-engine/snapsort";
  import { Container, Item } from "@snap-engine/snapsort/svelte";

  let nextId = 3;
  let tasks = $state([
    { id: "task-1", label: "Plan" },
    { id: "task-2", label: "Build" },
  ]);

  function onItemMove(event: ItemMoveEvent) {
    const task = tasks.find((entry) => entry.id === event.itemId);
    if (!task) return;
    const next = tasks.filter((entry) => entry.id !== event.itemId);
    next.splice(Math.min(event.to.index, next.length), 0, task);
    tasks = next;
  }

  function addTask() {
    tasks = [...tasks, { id: `task-${nextId}`, label: `Task ${nextId}` }];
    nextId += 1;
  }
</script>

<Engine id="container-property-before-after">
  <Container
    className="before-after-list"
    items={tasks}
    config={{ animation: defaultAnimations, callbacks: { onItemMove } }}
  >
    {#snippet before()}
      <header class="fixed-content before-content">
        <strong>Today</strong>
        <span>{tasks.length} tasks</span>
      </header>
    {/snippet}

    {#snippet entry(task)}
      <Item itemId={task.id} className="before-after-item">{task.label}</Item>
    {/snippet}

    {#snippet after()}
      <footer class="fixed-content after-content">
        <button type="button" onclick={addTask}>Add task</button>
      </footer>
    {/snippet}
  </Container>
</Engine>

<style>
  :global(.before-after-list) {
    gap: 0.5rem;
    width: min(100%, 23rem);
    margin: 0 auto;
    padding: 0.75rem;
    border-radius: 10px;
    background: white;
    box-shadow: 0 2px 12px rgb(31 30 41 / 8%);
    box-sizing: border-box;
  }

  .fixed-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    box-sizing: border-box;
  }

  .before-content {
    padding-bottom: 0.45rem;
    border-bottom: 1px solid rgb(58 42 34 / 12%);
  }

  .before-content span {
    color: rgb(58 42 34 / 65%);
    font-size: 0.82rem;
  }

  .after-content {
    padding-top: 0.25rem;
  }

  button {
    width: 100%;
    padding: 0.55rem;
    border: 1px dashed rgb(58 42 34 / 25%);
    border-radius: 7px;
    background: transparent;
    color: var(--color-action);
    cursor: pointer;
  }

  :global(.before-after-item) {
    align-items: flex-start !important;
    padding: 0.65rem 0.8rem !important;
    border-radius: 7px;
    background: var(--color-background-tint);
    cursor: grab;
  }
</style>
