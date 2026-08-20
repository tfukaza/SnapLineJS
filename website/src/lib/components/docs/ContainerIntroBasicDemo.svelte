<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import {
    createRenderEntries,
    createRenderTree,
    reduceRenderTree,
    type ContainerCallbacks,
    type GhostLifecycleEvent,
    type ItemMoveEvent,
  } from "@snap-engine/snapsort";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";

  type Task = { id: string; label: string };

  let todos = $state.raw(
    createRenderTree(
      createRenderEntries<Task>(
        [
          { id: "buy-milk", label: "Buy milk" },
          { id: "walk-dog", label: "Walk the dog" },
        ],
        (todo) => todo.id,
      ),
    ),
  );

  function onItemMove(event: ItemMoveEvent) {
    todos = reduceRenderTree(todos, event);
  }

  function onGhostMove(event: GhostLifecycleEvent) {
    todos = reduceRenderTree(todos, event);
  }

  const callbacks = {
    onItemMove,
    onGhostInsert: onGhostMove,
    onGhostMove,
    onGhostRemove: onGhostMove,
  } satisfies ContainerCallbacks;
</script>

<Engine id="container-intro-basic">
  <Container itemId="container-intro-basic-root" config={{ callbacks }}>
    {#each todos.entries as entry (entry.itemId)}
      {#if entry.isGhost}
        <Ghost ghost={entry.ghost} />
      {:else}
        <Item itemId={entry.itemId}>{entry.value.label}</Item>
      {/if}
    {/each}
  </Container>
</Engine>
