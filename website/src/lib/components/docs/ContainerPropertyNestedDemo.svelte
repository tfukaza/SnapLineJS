<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import {
    createRenderEntry,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
    type ContainerCallbacks,
    type GhostLifecycleEvent,
    type ItemMoveEvent,
  } from "@snap-engine/snapsort";
  import { rejectDrop } from "@snap-engine/snapsort/callbacks";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";

  type Group = { id: string; label: string };
  let groups = $state.raw(
    createRenderTree(
      [
        { id: "design", label: "Design" },
        { id: "build", label: "Build" },
        { id: "ship", label: "Ship" },
      ].map((group) =>
        createRenderEntry<Group>(group, group.id, createRenderTree()),
      ),
    ),
  );
  let allowDrag = $state(true);
  let selectedIds = $state(new Set<string>(["design", "build"]));

  function toggleSelected(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds = next;
  }

  function onItemMove(event: ItemMoveEvent) {
    groups = reduceRenderTree(groups, event);
  }

  function onGhostMove(event: GhostLifecycleEvent) {
    groups = reduceRenderTree(groups, event);
  }

  const callbacks = {
    onItemMove,
    onGhostInsert: onGhostMove,
    onGhostMove,
    onGhostRemove: onGhostMove,
  } satisfies ContainerCallbacks;
</script>

<div class="nested-demo">
  <label>
    <input type="checkbox" bind:checked={allowDrag} />
    Allow nested containers to drag
  </label>

  <Engine id="container-property-nested">
    <Container
      itemId="container-property-nested-root"
      className="nested-root"
      config={{ animation: defaultAnimations, callbacks }}
    >
      {#each groups.entries as entry (entry.itemId)}
        {#if entry.isGhost}
          <Ghost ghost={entry.ghost} />
        {:else if entry.childTree}
        <Container
          itemId={entry.itemId}
          locked={!allowDrag}
          selected={selectedIds.has(entry.itemId)}
          className={`nested-card${selectedIds.has(entry.itemId) ? " is-selected" : ""}`}
          config={{ animation: defaultAnimations, callbacks: { getDropPriority: rejectDrop } }}
        >
          <div class="nested-card-content">
            <strong>{entry.value.label}</strong>
            <button
              type="button"
              aria-pressed={selectedIds.has(entry.itemId)}
              onclick={() => toggleSelected(entry.itemId)}
            >
              {selectedIds.has(entry.itemId) ? "Selected" : "Select"}
            </button>
          </div>

          {#each entry.childTree.entries as child (child.itemId)}
            {#if child.isGhost}
              <Ghost ghost={child.ghost} />
            {:else if child.childTree}
              <Container itemId={child.itemId} />
            {:else}
              <Item itemId={child.itemId}>{child.value.label}</Item>
            {/if}
          {/each}
        </Container>
        {:else}
          <Item itemId={entry.itemId}>{entry.value.label}</Item>
        {/if}
      {/each}
    </Container>
  </Engine>
</div>

<style>
  .nested-demo {
    display: grid;
    gap: 0.85rem;
  }

  label {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    font-size: 0.84rem;
  }

  :global(.nested-root) {
    gap: 0.55rem;
    width: min(100%, 24rem);
    margin: 0 auto;
  }

  :global(.nested-card) {
    width: 100%;
    padding: 0.7rem;
    border: 1px solid rgb(58 42 34 / 18%);
    border-radius: 9px;
    background: white;
    box-shadow: 0 1px 4px rgb(31 30 41 / 8%);
    cursor: grab;
    box-sizing: border-box;
  }

  :global(.nested-card.is-selected) {
    border-color: var(--color-action);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-action) 18%, transparent);
  }

  .nested-card-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  button {
    padding: 0.3rem 0.6rem;
    border: 1px solid rgb(58 42 34 / 18%);
    border-radius: 999px;
    background: transparent;
    color: var(--color-action);
    font: inherit;
    font-size: 0.76rem;
    cursor: pointer;
  }
</style>
