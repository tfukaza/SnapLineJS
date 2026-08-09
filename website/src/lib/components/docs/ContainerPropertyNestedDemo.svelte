<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { defaultAnimations, type ItemMoveEvent } from "@snap-engine/snapsort";
  import { rejectDrop } from "@snap-engine/snapsort/callbacks";
  import { Container, Item } from "@snap-engine/snapsort/svelte";

  type Group = { id: string; label: string };
  let groups = $state<Group[]>([
    { id: "design", label: "Design" },
    { id: "build", label: "Build" },
    { id: "ship", label: "Ship" },
  ]);
  let allowDrag = $state(true);
  let selectedIds = $state(new Set<string>(["design", "build"]));

  function toggleSelected(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds = next;
  }

  function onItemMove(event: ItemMoveEvent) {
    const movedIds = new Set(event.itemIds.map(String));
    const moving = groups.filter((group) => movedIds.has(group.id));
    if (moving.length === 0) return;

    const next = groups.filter((group) => !movedIds.has(group.id));
    next.splice(Math.min(event.to.index, next.length), 0, ...moving);
    groups = next;
  }
</script>

<div class="nested-demo">
  <label>
    <input type="checkbox" bind:checked={allowDrag} />
    Allow nested containers to drag
  </label>

  <Engine id="container-property-nested">
    <Container
      className="nested-root"
      items={groups}
      config={{ animation: defaultAnimations, callbacks: { onItemMove } }}
    >
      {#snippet entry(group)}
        <Container
          itemId={group.id}
          locked={!allowDrag}
          selected={selectedIds.has(group.id)}
          className={`nested-card${selectedIds.has(group.id) ? " is-selected" : ""}`}
          items={[]}
          config={{ animation: defaultAnimations, callbacks: { canDrop: rejectDrop } }}
        >
          {#snippet before()}
            <div class="nested-card-content">
              <strong>{group.label}</strong>
              <button
                type="button"
                aria-pressed={selectedIds.has(group.id)}
                onclick={() => toggleSelected(group.id)}
              >
                {selectedIds.has(group.id) ? "Selected" : "Select"}
              </button>
            </div>
          {/snippet}

          {#snippet entry(_entry)}
            <Item itemId="unused">Unused</Item>
          {/snippet}
        </Container>
      {/snippet}
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
