<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import {
    createRenderEntries,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
    type ContainerCallbacks,
    type GhostLifecycleEvent,
    type Item as SnapSortItem,
    type ItemMoveEvent,
  } from "@snap-engine/snapsort";
  import { Container, Ghost } from "@snap-engine/snapsort/svelte";
  import AdoptedItemRow from "./AdoptedItemRow.svelte";

  type Task = { id: string; label: string };

  let tasks = $state.raw(
    createRenderTree(
      createRenderEntries<Task>(
        [
          { id: "adopt-one", label: "Application-owned item" },
          { id: "adopt-two", label: "Another adopted item" },
        ],
        (task) => task.id,
      ),
    ),
  );
  let report = $state("Choose an item to inspect its adopted core Item.");

  function inspect(item: SnapSortItem) {
    const { index } = item.getIndexAndContainer();
    report = `ID: ${item.itemId} · index: ${index} · origin: ${String(item.metadata.origin)}`;
  }

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

<div class="item-instance-demo">
  <p class="instance-report" aria-live="polite">{report}</p>

  <Engine id="item-example-instance">
    <Container
      itemId="item-example-instance-root"
      className="adopted-list"
      config={{ animation: defaultAnimations, callbacks }}
    >
      {#each tasks.entries as entry (entry.itemId)}
        {#if entry.isGhost}
          <Ghost ghost={entry.ghost} />
        {:else}
          <AdoptedItemRow
            id={entry.itemId}
            label={entry.value.label}
            onInspect={inspect}
          />
        {/if}
      {/each}
    </Container>
  </Engine>
</div>

<style>
  .item-instance-demo {
    display: grid;
    gap: 0.75rem;
  }

  .instance-report {
    min-height: 1.25rem;
    margin: 0;
    color: color-mix(in srgb, var(--color-text) 72%, transparent);
    font-size: 0.8rem;
    text-align: center;
  }

  :global(.item-instance-demo .adopted-list) {
    gap: 0.5rem;
    width: min(100%, 24rem);
    margin: 0 auto;
  }

  :global(.item-instance-demo .adopted-card) {
    align-items: center !important;
    flex-direction: row !important;
    justify-content: space-between !important;
    gap: 0.75rem;
    width: 100%;
    padding: 0.7rem 0.85rem !important;
    border: 1px solid rgb(58 42 34 / 18%);
    border-radius: 9px;
    background: white;
    cursor: grab;
  }

  :global(.item-instance-demo button) {
    flex: 0 0 auto;
    padding: 0.3rem 0.55rem;
    border: 1px solid rgb(58 42 34 / 18%);
    border-radius: 999px;
    background: transparent;
    color: var(--color-action);
    font: inherit;
    font-size: 0.72rem;
    cursor: pointer;
  }
</style>
