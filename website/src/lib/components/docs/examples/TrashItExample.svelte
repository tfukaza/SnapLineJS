<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type { Engine as SnapEngine } from "@snap-engine/core";
  import {
    createRenderEntries,
    createRenderEntry,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
    type ContainerCallbacks,
    type DragEndEvent,
    type DropTargetChangeEvent,
    type RenderTree,
    type RenderTreeEvent,
  } from "@snap-engine/snapsort";
  import { prioritizeIntersectingContainer, rejectDrop } from "@snap-engine/snapsort/callbacks";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";

  type TrashTask = {
    id: string;
    text: string;
  };

  type TrashZone = "list" | "bin";
  type TrashValue = TrashTask | { zone: TrashZone };

  let engine: SnapEngine | null = $state(null);
  let hovered = $state(false);
  let tasks = $state.raw(
    createRenderTree<TrashValue>([
      createRenderEntry(
        { zone: "list" },
        "trash-zone-list",
        createRenderTree(
          createRenderEntries<TrashValue>(
            [
              { id: "trash-task-1", text: "Reply to design feedback" },
              { id: "trash-task-2", text: "Archive last sprint's board" },
              { id: "trash-task-3", text: "Renew the SSL certificate" },
              { id: "trash-task-4", text: "Clean up unused feature flags" },
              { id: "trash-task-5", text: "Update the onboarding checklist" },
            ],
            (value) => "id" in value ? value.id : `trash-zone-${value.zone}`,
          ),
        ),
      ),
      createRenderEntry({ zone: "bin" }, "trash-zone-bin", createRenderTree()),
    ]),
  );

  $effect(() => {
    if (engine) engine.input.config.maxSimultaneousDrags = 1;
  });

  function handleDropTargetChange(event: DropTargetChangeEvent) {
    hovered = event.current?.containerMetadata.role === "trash";
    event.session.dropEffect = hovered ? "none" : "move";
  }

  function handleRenderEvent(event: RenderTreeEvent) {
    tasks = reduceRenderTree(tasks, event);
  }

  function removeItems(itemIds: readonly string[]) {
    const removed = new Set(itemIds);
    tasks = {
      ...tasks,
      entries: tasks.entries.map((entry) =>
        !entry.isGhost && entry.childTree
          ? {
              ...entry,
              childTree: {
                ...entry.childTree,
                entries: entry.childTree.entries.filter(
                  (child) => child.isGhost || !removed.has(child.itemId),
                ),
              },
            }
          : entry,
      ),
    };
  }

  function handleDragEnd(event: DragEndEvent) {
    hovered = false;
    if (event.destination?.containerMetadata.role === "trash") {
      removeItems(event.itemIds);
    }
  }

  const callbacks = {
    onItemMove: handleRenderEvent,
    onGhostInsert: handleRenderEvent,
    onGhostMove: handleRenderEvent,
    onGhostRemove: handleRenderEvent,
    getDropPriority: rejectDrop,
    onDropTargetChange: handleDropTargetChange,
    onDragEnd: handleDragEnd,
  } satisfies ContainerCallbacks;
</script>

<div class="trash-example" data-snapsort-example="trash-it">
  <Engine id="snapsort-trash-example" bind:engine>
    <div class="trash-workspace">
      <Container
        itemId="example-trash-root"
        className="trash-root"
        config={{
          animation: defaultAnimations,
          direction: "column",
          name: "trash-root",
          callbacks,
        }}
        locked={true}
      >
        {#each tasks.entries as entry (entry.itemId)}
          {#if entry.isGhost}
            <Ghost ghost={entry.ghost} />
          {:else if entry.childTree && "zone" in entry.value && entry.value.zone === "list"}
            <Container
              className="trash-list"
              itemId={entry.itemId}
              config={{ animation: defaultAnimations, direction: "column", name: "trash-list" }}
              locked={true}
            >
              {#each entry.childTree.entries as child (child.itemId)}
                {#if child.isGhost}
                  <Ghost ghost={child.ghost} />
                {:else if child.childTree}
                  <Container itemId={child.itemId} />
                {:else if "text" in child.value}
                  <Item itemId={child.itemId}>
                    <div class="trash-task">
                      <i class="material-symbols-rounded" aria-hidden="true">drag_indicator</i>
                      <span>{child.value.text}</span>
                    </div>
                  </Item>
                {/if}
              {/each}
            </Container>
          {:else if entry.childTree && "zone" in entry.value}
            <div class="trash-zone" class:trash-zone-active={hovered}>
              <Container
                className="trash-drop-target"
                itemId={entry.itemId}
                config={{
                  animation: defaultAnimations,
                  direction: "column",
                  name: "trash-bin",
                  callbacks: { getDropPriority: prioritizeIntersectingContainer },
                }}
                locked={true}
                metadata={{ role: "trash" }}
              >
                <div class="trash-zone-content">
                  <i class="material-symbols-rounded" aria-hidden="true">delete</i>
                  <span>Drop to delete</span>
                </div>
                {#each entry.childTree.entries as child (child.itemId)}
                  {#if child.isGhost}
                    <Ghost ghost={child.ghost} />
                  {:else if child.childTree}
                    <Container itemId={child.itemId} />
                  {:else if "text" in child.value}
                    <Item itemId={child.itemId}>{child.value.text}</Item>
                  {/if}
                {/each}
              </Container>
            </div>
          {/if}
        {/each}
      </Container>
    </div>
  </Engine>
</div>

<style>
  .trash-example {
    width: min(100%, 30rem);
    margin-inline: auto;
    user-select: none;
  }

  .trash-example :global(.snap-engine-canvas) {
    overflow: visible !important;
  }

  .trash-workspace :global(.trash-root),
  .trash-workspace :global(.trash-list) {
    align-items: stretch;
    width: 100%;
  }

  .trash-workspace :global(.trash-root) {
    gap: 0.75rem;
  }

  .trash-workspace :global(.trash-list) {
    gap: 0.4rem;
  }

  .trash-workspace :global(.trash-list .snapsort-item) {
    align-items: stretch;
    width: 100%;
    padding: 0;
  }

  .trash-task {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.65rem 0.85rem;
    border: 1px solid #d5d8dc;
    border-radius: calc(var(--ui-radius) - 2px);
    background: white;
    color: #232526;
    cursor: grab;
    font-size: 0.85rem;
    touch-action: none;
  }

  .trash-task:active {
    cursor: grabbing;
  }

  .trash-task :global(.material-symbols-rounded),
  .trash-zone-content :global(.material-symbols-rounded) {
    color: inherit;
    font-family: "Material Symbols Rounded";
    font-size: 1.1rem;
    font-style: normal;
  }

  .trash-zone {
    border: 2px dashed #d5d8dc;
    border-radius: var(--ui-radius);
    transition: border-color 120ms ease-out, background-color 120ms ease-out;
  }

  .trash-zone-active {
    border-color: #c7472f;
    background: rgb(199 71 47 / 6%);
  }

  .trash-workspace :global(.trash-drop-target) {
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 64px;
  }

  .trash-zone-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    color: #8f9497;
    font-size: 0.85rem;
  }

  .trash-zone-active .trash-zone-content {
    color: #c7472f;
  }
</style>
