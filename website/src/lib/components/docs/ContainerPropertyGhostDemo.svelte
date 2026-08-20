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

  type Note = { id: string; label: string };

  let notes = $state.raw(
    createRenderTree(
      createRenderEntries<Note>(
        [
          { id: "first", label: "First note" },
          { id: "second", label: "Second note" },
          { id: "third", label: "Third note" },
        ],
        (note) => note.id,
      ),
    ),
  );

  function onItemMove(event: ItemMoveEvent) {
    notes = reduceRenderTree(notes, event);
  }

  function onGhostMove(event: GhostLifecycleEvent) {
    notes = reduceRenderTree(notes, event);
  }

  const callbacks = {
    onItemMove,
    onGhostInsert: onGhostMove,
    onGhostMove,
    onGhostRemove: onGhostMove,
  } satisfies ContainerCallbacks;
</script>

<Engine id="container-property-ghost">
  <Container
    itemId="container-property-ghost-root"
    className="ghost-list"
    config={{ animation: defaultAnimations, callbacks }}
  >
    {#each notes.entries as entry (entry.itemId)}
      {#if entry.isGhost}
        <Ghost ghost={entry.ghost} className="custom-ghost">
          {#if entry.ghost.type === "pointer-preview"}
            Dragging
          {:else if entry.ghost.type === "insertion-marker"}
            Insert here
          {:else}
            Drop {entry.ghost.original.itemId} here
          {/if}
        </Ghost>
      {:else}
        <Item itemId={entry.itemId} className="ghost-item">
          {entry.value.label}
        </Item>
      {/if}
    {/each}
  </Container>
</Engine>

<style>
  :global(.ghost-list) {
    gap: 0.5rem;
    width: min(100%, 22rem);
    margin: 0 auto;
  }

  :global(.ghost-item) {
    align-items: flex-start !important;
    padding: 0.7rem 0.85rem !important;
    border-radius: 8px;
    background: white;
    box-shadow: 0 1px 4px rgb(31 30 41 / 10%);
    cursor: grab;
  }

  :global(.custom-ghost) {
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 2px dashed var(--color-action);
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-action) 8%, transparent);
    color: var(--color-action);
    font-size: 0.78rem;
    white-space: nowrap;
  }
</style>
