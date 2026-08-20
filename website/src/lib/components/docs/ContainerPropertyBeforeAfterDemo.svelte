<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import {
    createRenderEntries,
    createRenderEntry,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
    type ContainerCallbacks,
    type GhostLifecycleEvent,
    type ItemMoveEvent,
  } from "@snap-engine/snapsort";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";

  let nextId = 3;
  let tasks = $state.raw(
    createRenderTree(
      createRenderEntries(
        [
          { id: "task-1", label: "Plan" },
          { id: "task-2", label: "Build" },
        ],
        (task) => task.id,
      ),
    ),
  );
  const taskCount = $derived(
    tasks.entries.filter((entry) => !entry.isGhost).length,
  );

  function onItemMove(event: ItemMoveEvent) {
    tasks = reduceRenderTree(tasks, event);
  }

  function onGhostMove(event: GhostLifecycleEvent) {
    tasks = reduceRenderTree(tasks, event);
  }

  function addTask() {
    const task = { id: `task-${nextId}`, label: `Task ${nextId}` };
    tasks = {
      ...tasks,
      entries: [...tasks.entries, createRenderEntry(task, task.id)],
    };
    nextId += 1;
  }

  const callbacks = {
    onItemMove,
    onGhostInsert: onGhostMove,
    onGhostMove,
    onGhostRemove: onGhostMove,
  } satisfies ContainerCallbacks;
</script>

<Engine id="container-property-before-after">
  <Container
    itemId="container-property-before-after-root"
    className="before-after-list"
    config={{ animation: defaultAnimations, callbacks }}
  >
    <header class="fixed-content before-content">
      <strong>Today</strong>
      <span>{taskCount} tasks</span>
    </header>

    {#each tasks.entries as entry (entry.itemId)}
      {#if entry.isGhost}
        <Ghost ghost={entry.ghost} />
      {:else}
        <Item itemId={entry.itemId} className="before-after-item">{entry.value.label}</Item>
      {/if}
    {/each}

    <footer class="fixed-content after-content">
      <button type="button" onclick={addTask}>Add task</button>
    </footer>
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
