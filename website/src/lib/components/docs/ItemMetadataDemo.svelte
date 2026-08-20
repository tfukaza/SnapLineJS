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
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";

  type Priority = "High" | "Medium" | "Low";
  type Task = { id: string; label: string; owner: string; priority: Priority };

  let tasks = $state.raw(
    createRenderTree(
      createRenderEntries<Task>(
        [
          { id: "brief", label: "Product brief", owner: "Mina", priority: "High" },
          { id: "notes", label: "Research notes", owner: "Theo", priority: "Medium" },
          { id: "assets", label: "Image assets", owner: "Ari", priority: "Low" },
        ],
        (task) => task.id,
      ),
    ),
  );
  let status = $state("Drag a card to read the metadata SnapSort receives.");

  function describe(event: DragStartEvent | ItemMoveEvent) {
    const owner = String(event.itemMetadata.owner ?? "Unassigned");
    const priority = String(event.itemMetadata.priority ?? "No priority");
    return `${String(event.itemId)}: ${owner} · ${priority}`;
  }

  function onDragStart(event: DragStartEvent) {
    status = `Dragging ${describe(event)}`;
  }

  function onItemMove(event: ItemMoveEvent) {
    tasks = reduceRenderTree(tasks, event);
    status = `Dropped ${describe(event)}`;
  }

  function onGhostMove(event: GhostLifecycleEvent) {
    tasks = reduceRenderTree(tasks, event);
  }

  const callbacks = {
    onDragStart,
    onItemMove,
    onGhostInsert: onGhostMove,
    onGhostMove,
    onGhostRemove: onGhostMove,
  } satisfies ContainerCallbacks;
</script>

<div class="item-metadata-demo">
  <p class="metadata-status" aria-live="polite">{status}</p>

  <Engine id="item-example-metadata">
    <Container
      itemId="item-example-metadata-root"
      className="metadata-list"
      config={{ animation: defaultAnimations, callbacks }}
    >
      {#each tasks.entries as entry (entry.itemId)}
        {#if entry.isGhost}
          <Ghost ghost={entry.ghost} />
        {:else}
          <Item
            itemId={entry.itemId}
            metadata={{ owner: entry.value.owner, priority: entry.value.priority }}
            className="metadata-card"
          >
            <span>{entry.value.label}</span>
            <span class="metadata-details">
              {entry.value.owner} · {entry.value.priority}
            </span>
          </Item>
        {/if}
      {/each}
    </Container>
  </Engine>
</div>

<style>
  .item-metadata-demo {
    display: grid;
    gap: 0.75rem;
  }

  .metadata-status {
    min-height: 1.25rem;
    margin: 0;
    color: color-mix(in srgb, var(--color-text) 72%, transparent);
    font-size: 0.8rem;
    text-align: center;
  }

  :global(.item-metadata-demo .metadata-list) {
    gap: 0.5rem;
    width: min(100%, 24rem);
    margin: 0 auto;
  }

  :global(.item-metadata-demo .metadata-card) {
    align-items: flex-start !important;
    width: 100%;
    padding: 0.7rem 0.85rem !important;
    border: 1px solid rgb(58 42 34 / 18%);
    border-radius: 9px;
    background: white;
    cursor: grab;
  }

  .metadata-details {
    margin-top: 0.2rem;
    color: color-mix(in srgb, var(--color-text) 62%, transparent);
    font-size: 0.74rem;
  }
</style>
