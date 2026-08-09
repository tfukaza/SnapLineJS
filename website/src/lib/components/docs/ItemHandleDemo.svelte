<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import {
    defaultAnimations,
    type DragStartEvent,
    type ItemMoveEvent,
  } from "@snap-engine/snapsort";
  import { Container, Handle, Item } from "@snap-engine/snapsort/svelte";

  type Task = { id: string; label: string; complete: boolean };

  let tasks = $state<Task[]>([
    { id: "plan", label: "Plan release", complete: false },
    { id: "test", label: "Run checks", complete: false },
    { id: "ship", label: "Ship update", complete: true },
  ]);
  let status = $state("Drag with the grip; the Done buttons remain interactive.");

  function onDragStart(event: DragStartEvent) {
    const task = tasks.find((entry) => entry.id === String(event.itemId));
    status = `Dragging ${task?.label ?? String(event.itemId)} from its handle`;
  }

  function onItemMove(event: ItemMoveEvent) {
    const itemId = String(event.itemId);
    const task = tasks.find((entry) => entry.id === itemId);
    if (!task) return;

    const next = tasks.filter((entry) => entry.id !== itemId);
    next.splice(Math.min(event.to.index, next.length), 0, task);
    tasks = next;
    status = `Moved ${task.label}`;
  }

  function toggleComplete(id: string) {
    tasks = tasks.map((task) =>
      task.id === id ? { ...task, complete: !task.complete } : task,
    );
    const task = tasks.find((entry) => entry.id === id);
    if (task) status = `${task.label} marked ${task.complete ? "done" : "not done"}`;
  }
</script>

<div class="item-handle-demo">
  <p class="handle-status" aria-live="polite">{status}</p>

  <Engine id="item-example-handle">
    <Container
      className="handle-list"
      items={tasks}
      config={{
        animation: defaultAnimations,
        callbacks: { onDragStart, onItemMove },
      }}
    >
      {#snippet entry(task)}
        <Item
          itemId={task.id}
          className={`handle-card${task.complete ? " is-complete" : ""}`}
        >
          <Handle className="drag-grip" aria-label={`Drag ${task.label}`}>
            <span aria-hidden="true">⋮⋮</span>
          </Handle>
          <span class="task-label">{task.label}</span>
          <button type="button" onclick={() => toggleComplete(task.id)}>
            {task.complete ? "Undo" : "Done"}
          </button>
        </Item>
      {/snippet}
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
