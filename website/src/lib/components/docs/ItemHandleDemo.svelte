<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import {
    createRenderEntries,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
    type ContainerCallbacks,
    type DragStartEvent,
    type GhostLifecycleEvent,
    type ItemMoveEvent,
  } from "@snap-engine/snapsort";
  import { Container, Ghost, Handle, Item } from "@snap-engine/snapsort/svelte";

  type Task = { id: string; label: string; complete: boolean };

  let tasks = $state.raw(
    createRenderTree(
      createRenderEntries<Task>(
        [
          { id: "plan", label: "Plan release", complete: false },
          { id: "test", label: "Run checks", complete: false },
          { id: "ship", label: "Ship update", complete: true },
        ],
        (task) => task.id,
      ),
    ),
  );
  let status = $state("Drag with the grip; the Done buttons remain interactive.");

  function onDragStart(event: DragStartEvent) {
    const task = tasks.entries.find(
      (entry) => !entry.isGhost && entry.itemId === event.itemId,
    );
    const label = task && !task.isGhost ? task.value.label : event.itemId;
    status = `Dragging ${label} from its handle`;
  }

  function onItemMove(event: ItemMoveEvent) {
    const task = tasks.entries.find(
      (entry) => !entry.isGhost && entry.itemId === event.itemId,
    );
    tasks = reduceRenderTree(tasks, event);
    if (task && !task.isGhost) status = `Moved ${task.value.label}`;
  }

  function onGhostMove(event: GhostLifecycleEvent) {
    tasks = reduceRenderTree(tasks, event);
  }

  function toggleComplete(id: string) {
    let updated: Task | undefined;
    tasks = {
      ...tasks,
      entries: tasks.entries.map((entry) => {
        if (entry.isGhost || entry.itemId !== id) return entry;
        updated = { ...entry.value, complete: !entry.value.complete };
        return { ...entry, value: updated };
      }),
    };
    if (updated) {
      status = `${updated.label} marked ${updated.complete ? "done" : "not done"}`;
    }
  }

  const callbacks = {
    onDragStart,
    onItemMove,
    onGhostInsert: onGhostMove,
    onGhostMove,
    onGhostRemove: onGhostMove,
  } satisfies ContainerCallbacks;
</script>

<div class="item-handle-demo">
  <p class="handle-status" aria-live="polite">{status}</p>

  <Engine id="item-example-handle">
    <Container
      itemId="item-example-handle-root"
      className="handle-list"
      config={{ animation: defaultAnimations, callbacks }}
    >
      {#each tasks.entries as entry (entry.itemId)}
        {#if entry.isGhost}
          <Ghost ghost={entry.ghost} />
        {:else}
          <Item
            itemId={entry.itemId}
            className={`handle-card${entry.value.complete ? " is-complete" : ""}`}
          >
            <Handle className="drag-grip" aria-label={`Drag ${entry.value.label}`}>
              <span aria-hidden="true">⋮⋮</span>
            </Handle>
            <span class="task-label">{entry.value.label}</span>
            <button type="button" onclick={() => toggleComplete(entry.itemId)}>
              {entry.value.complete ? "Undo" : "Done"}
            </button>
          </Item>
        {/if}
      {/each}
    </Container>
  </Engine>
</div>

<style>
  .item-handle-demo {
    display: grid;
    gap: 0.75rem;
  }

  .handle-status {
    min-height: 1.25rem;
    margin: 0;
    color: color-mix(in srgb, var(--color-text) 72%, transparent);
    font-size: 0.8rem;
    text-align: center;
  }

  :global(.item-handle-demo .handle-list) {
    gap: 0.5rem;
    width: min(100%, 24rem);
    margin: 0 auto;
  }

  :global(.item-handle-demo .handle-card) {
    display: grid !important;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center !important;
    gap: 0.65rem;
    width: 100%;
    padding: 0.55rem 0.65rem !important;
    border: 1px solid rgb(58 42 34 / 18%);
    border-radius: 9px;
    background: white;
  }

  :global(.item-handle-demo .handle-card.is-complete .task-label) {
    color: color-mix(in srgb, var(--color-text) 48%, transparent);
    text-decoration: line-through;
  }

  :global(.item-handle-demo .drag-grip) {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border-radius: 7px;
    background: var(--color-background-tint);
    color: color-mix(in srgb, var(--color-text) 62%, transparent);
    cursor: grab;
    touch-action: none;
  }

  :global(.item-handle-demo button) {
    padding: 0.3rem 0.6rem;
    border: 1px solid rgb(58 42 34 / 18%);
    border-radius: 999px;
    background: transparent;
    color: var(--color-action);
    font: inherit;
    font-size: 0.72rem;
    cursor: pointer;
  }
</style>
