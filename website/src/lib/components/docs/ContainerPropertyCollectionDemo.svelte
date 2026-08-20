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

  type Task = { key: string; label: string };
  let tasks = $state.raw(
    createRenderTree(
      createRenderEntries<Task>(
        [
          { key: "write", label: "Write outline" },
          { key: "review", label: "Review draft" },
          { key: "publish", label: "Publish" },
        ],
        (task) => task.key,
      ),
    ),
  );

  function onItemMove(event: ItemMoveEvent) {
    tasks = reduceRenderTree(tasks, event);
  }

  function onGhostMove(event: GhostLifecycleEvent) {
    tasks = reduceRenderTree(tasks, event);
  }

  const callbacks = {
    onItemMove,
    onGhostInsert: onGhostMove,
    onGhostMove,
    onGhostRemove: onGhostMove,
  } satisfies ContainerCallbacks;
</script>

<Engine id="container-property-collection">
  <Container
    itemId="container-property-collection-root"
    className="property-list"
    config={{ animation: defaultAnimations, callbacks }}
  >
    {#each tasks.entries as entry (entry.itemId)}
      {#if entry.isGhost}
        <Ghost ghost={entry.ghost} />
      {:else}
        <Item itemId={entry.itemId} className="property-item">
          {entry.value.label}
        </Item>
      {/if}
    {/each}
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
