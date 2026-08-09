<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { defaultAnimations, type ItemMoveEvent } from "@snap-engine/snapsort";
  import { Container, Item } from "@snap-engine/snapsort/svelte";

  type Task = { id: string; label: string };

  let tasks = $state<Task[]>([
    { id: "alpha", label: "Alpha" },
    { id: "beta", label: "Beta" },
    { id: "gamma", label: "Gamma" },
    { id: "delta", label: "Delta" },
  ]);
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
    const movedIds = new Set(event.itemIds.map(String));
    const moving = tasks.filter((task) => movedIds.has(task.id));
    if (moving.length === 0) return;

    const next = tasks.filter((task) => !movedIds.has(task.id));
    next.splice(Math.min(event.to.index, next.length), 0, ...moving);
    tasks = next;
    status = `Moved ${moving.map((task) => task.label).join(" and ")}`;
  }
</script>

<div class="item-selection-demo">
  <p class="selection-status" aria-live="polite">{status}</p>

  <Engine id="item-example-selection">
    <Container
      className="selection-list"
      items={tasks}
      config={{ animation: defaultAnimations, callbacks: { onItemMove } }}
    >
      {#snippet entry(task)}
        <Item
          itemId={task.id}
          selected={selectedIds.has(task.id)}
          className={`selection-card${selectedIds.has(task.id) ? " is-selected" : ""}`}
          role="button"
          tabindex={0}
          aria-pressed={selectedIds.has(task.id)}
          onclick={() => toggleSelected(task.id)}
          onkeydown={(event) => handleKeydown(event, task.id)}
        >
          <span>{task.label}</span>
          <span>{selectedIds.has(task.id) ? "Selected" : "Click to select"}</span>
        </Item>
      {/snippet}
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
