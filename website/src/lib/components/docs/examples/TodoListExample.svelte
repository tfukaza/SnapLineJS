<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type { Engine as SnapEngine } from "@snap-engine/core";
  import {
    createRenderEntries,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
    type ContainerCallbacks,
    type RenderTreeEvent,
  } from "@snap-engine/snapsort";
  import {
    Container,
    Ghost,
    Handle,
    Item,
  } from "@snap-engine/snapsort/svelte";

  type TodoItem = {
    id: string;
    text: string;
    due: string;
    checked: boolean;
  };

  const initialItems: TodoItem[] = [
    { id: "t-1", text: "Plan the grocery run", due: "Due in 2h", checked: false },
    { id: "t-2", text: "Take an evening walk", due: "Done", checked: true },
    { id: "t-3", text: "Clear the client inbox", due: "Due today", checked: false },
    { id: "t-4", text: "Fit in a strength session", due: "6:30 PM", checked: false },
    { id: "t-5", text: "Read the next chapter", due: "Done", checked: true },
    { id: "t-6", text: "Review autopay dates", due: "Tomorrow", checked: false },
    { id: "t-7", text: "Call mom back", due: "Tonight", checked: false },
    { id: "t-8", text: "Water balcony plants", due: "Due in 4h", checked: false },
  ];

  let engine: SnapEngine | null = $state(null);
  let items = $state.raw(
    createRenderTree(createRenderEntries(initialItems, (item) => item.id)),
  );

  $effect(() => {
    if (engine) engine.input.config.maxSimultaneousDrags = 1;
  });

  function handleRenderEvent(event: RenderTreeEvent) {
    items = reduceRenderTree(items, event);
  }

  function setChecked(itemId: string, checked: boolean) {
    items = {
      ...items,
      entries: items.entries.map((entry) =>
        !entry.isGhost && entry.itemId === itemId
          ? { ...entry, value: { ...entry.value, checked } }
          : entry,
      ),
    };
  }

  const callbacks = {
    onItemMove: handleRenderEvent,
    onGhostInsert: handleRenderEvent,
    onGhostMove: handleRenderEvent,
    onGhostRemove: handleRenderEvent,
  } satisfies ContainerCallbacks;
</script>

<div class="todo-example" data-snapsort-example="todo-list">
  <Engine id="snapsort-todo-example" bind:engine>
    <div class="project-list">
      <Container
        itemId="example-todo-root"
        config={{
          animation: defaultAnimations,
          direction: "column",
          callbacks,
        }}
      >
        {#each items.entries as entry (entry.itemId)}
          {#if entry.isGhost}
            <Ghost ghost={entry.ghost} />
          {:else}
            <Item itemId={entry.itemId}>
              <div class="project-card" class:checked={entry.value.checked}>
                <Handle className="project-drag-handle">
                  <i class="material-symbols-rounded" aria-hidden="true">drag_indicator</i>
                </Handle>
                <label>
                  <input
                    type="checkbox"
                    aria-label={entry.value.text}
                    checked={entry.value.checked}
                    onchange={(event) =>
                      setChecked(entry.itemId, event.currentTarget.checked)}
                  />
                  <span></span>
                </label>
                <span class="project-text">{entry.value.text}</span>
                <span class="project-meta">
                  <i class="material-symbols-rounded" aria-hidden="true">schedule</i>
                  {entry.value.due}
                </span>
              </div>
            </Item>
          {/if}
        {/each}
      </Container>
    </div>
  </Engine>
</div>

<style>
  .todo-example {
    width: min(100%, 42rem);
    margin-inline: auto;
    user-select: none;
  }

  .todo-example :global(.snap-engine-canvas) {
    overflow: visible !important;
  }

  .project-list {
    padding: 1rem;
  }

  .project-list :global(.snapsort-container),
  .project-list :global(.snapsort-item) {
    align-items: stretch;
    width: 100%;
  }

  .project-list :global(.snapsort-item) {
    padding: 0;
    cursor: auto !important;
  }

  .project-card {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr) 5.6rem;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.75rem 1rem;
    border: 0;
    background: white;
    box-shadow: 0 1px 0 rgb(35 37 38 / 4%);
    box-sizing: border-box;
    font-size: 0.82rem;
  }

  :global(.project-drag-handle) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.2rem;
    height: 1.2rem;
    color: #8f9497;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }

  :global(.project-drag-handle:active) {
    cursor: grabbing;
  }

  :global(.project-drag-handle .material-symbols-rounded),
  .project-meta :global(.material-symbols-rounded) {
    font-family: "Material Symbols Rounded";
    font-size: 1rem;
    font-style: normal;
    line-height: 1;
  }

  .project-text {
    min-width: 0;
    overflow: hidden;
    color: #232526;
    font-weight: 500;
    line-height: 1.15;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .checked .project-text {
    color: #747a7d;
    text-decoration: line-through;
    text-decoration-thickness: 1.5px;
  }

  .project-meta {
    display: inline-flex;
    align-items: center;
    justify-self: end;
    gap: 0.28rem;
    overflow: hidden;
    color: #8f9497;
    font-size: 0.72rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .project-meta :global(.material-symbols-rounded) {
    color: #4f8fc7;
    font-size: 0.72rem;
  }

  .project-list :global(label) {
    margin: 0;
  }

  @media (max-width: 520px) {
    .project-list {
      padding: 0;
    }

    .project-card {
      grid-template-columns: auto auto minmax(0, 1fr);
      gap: 0.45rem 0.65rem;
      padding: 0.75rem;
    }

    .project-text {
      overflow-wrap: anywhere;
      white-space: normal;
    }

    .project-meta {
      grid-column: 3;
      justify-self: stretch;
    }
  }
</style>
