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
          { id: "alpha", label: "Alpha" },
          { id: "beta", label: "Beta" },
          { id: "gamma", label: "Gamma" },
          { id: "delta", label: "Delta" },
        ],
        (task) => task.id,
      ),
    ),
  );
  let selectedIds = $state(new Set<string>(["alpha", "beta"]));
  let status = $state("Alpha and Beta are selected. Drag either to move both.");

  function toggleSelected(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds = next;
    status = `${next.size} item${next.size === 1 ? "" : "s"} selected`;
  }

  function handleKeydown(event: KeyboardEvent, id: string) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleSelected(id);
  }

  function onItemMove(event: ItemMoveEvent) {
    const movedIds = new Set(event.itemIds);
    const moving = tasks.entries.filter(
      (entry) => !entry.isGhost && movedIds.has(entry.itemId),
    );
    tasks = reduceRenderTree(tasks, event);
    status = `Moved ${moving.map((entry) => !entry.isGhost && entry.value.label).filter(Boolean).join(" and ")}`;
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

<div class="item-selection-demo">
  <p class="selection-status" aria-live="polite">{status}</p>

  <Engine id="item-example-selection">
    <Container
      itemId="item-example-selection-root"
      className="selection-list"
      config={{ animation: defaultAnimations, callbacks }}
    >
      {#each tasks.entries as entry (entry.itemId)}
        {#if entry.isGhost}
          <Ghost ghost={entry.ghost} />
        {:else}
          <Item
            itemId={entry.itemId}
            selected={selectedIds.has(entry.itemId)}
            className={`selection-card${selectedIds.has(entry.itemId) ? " is-selected" : ""}`}
            role="button"
            tabindex={0}
            aria-pressed={selectedIds.has(entry.itemId)}
            onclick={() => toggleSelected(entry.itemId)}
            onkeydown={(event) => handleKeydown(event, entry.itemId)}
          >
            <span>{entry.value.label}</span>
            <span>{selectedIds.has(entry.itemId) ? "Selected" : "Click to select"}</span>
          </Item>
        {/if}
      {/each}
    </Container>
  </Engine>
</div>

<style>
  .item-selection-demo {
    display: grid;
    gap: 0.75rem;
  }

  .selection-status {
    min-height: 1.25rem;
    margin: 0;
    color: color-mix(in srgb, var(--color-text) 72%, transparent);
    font-size: 0.8rem;
    text-align: center;
  }

  :global(.item-selection-demo .selection-list) {
    gap: 0.5rem;
    width: min(100%, 24rem);
    margin: 0 auto;
  }

  :global(.item-selection-demo .selection-card) {
    align-items: center !important;
    flex-direction: row !important;
    justify-content: space-between !important;
    width: 100%;
    padding: 0.7rem 0.85rem !important;
    border: 1px solid rgb(58 42 34 / 18%);
    border-radius: 9px;
    background: white;
    cursor: grab;
  }

  :global(.item-selection-demo .selection-card span:last-child) {
    color: color-mix(in srgb, var(--color-text) 62%, transparent);
    font-size: 0.72rem;
  }

  :global(.item-selection-demo .selection-card.is-selected) {
    border-color: var(--color-action);
    background: color-mix(in srgb, var(--color-action) 7%, white);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-action) 14%, transparent);
  }

  :global(.item-selection-demo .selection-card:focus-visible) {
    outline: 2px solid var(--color-action);
    outline-offset: 2px;
  }
</style>
