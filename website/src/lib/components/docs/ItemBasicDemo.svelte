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

  type Task = { id: string; label: string };

  let tasks = $state.raw(
    createRenderTree(
      createRenderEntries<Task>(
        [
          { id: "outline", label: "Outline the article" },
          { id: "draft", label: "Write the first draft" },
          { id: "review", label: "Review the copy" },
        ],
        (task) => task.id,
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

<div class="item-basic-demo">
  <p>Drag an item to reorder the list.</p>

  <Engine id="item-example-basic">
    <Container
      itemId="item-example-basic-root"
      className="item-demo-list"
      config={{ animation: defaultAnimations, callbacks }}
    >
      {#each tasks.entries as entry (entry.itemId)}
        {#if entry.isGhost}
          <Ghost ghost={entry.ghost} />
        {:else}
          <Item itemId={entry.itemId} className="item-demo-card">
            {entry.value.label}
          </Item>
        {/if}
      {/each}
    </Container>
  </Engine>
</div>

<style>
  .item-basic-demo {
    display: grid;
    gap: 0.75rem;
  }

  p {
    margin: 0;
    color: color-mix(in srgb, var(--color-text) 72%, transparent);
    font-size: 0.82rem;
    text-align: center;
  }

  :global(.item-basic-demo .item-demo-list) {
    gap: 0.5rem;
    width: min(100%, 24rem);
    margin: 0 auto;
  }

  :global(.item-basic-demo .item-demo-card) {
    align-items: flex-start !important;
    width: 100%;
    padding: 0.75rem 0.9rem !important;
    border: 1px solid rgb(58 42 34 / 18%);
    border-radius: 9px;
    background: white;
    box-shadow: 0 1px 3px rgb(31 30 41 / 7%);
    cursor: grab;
  }
</style>
