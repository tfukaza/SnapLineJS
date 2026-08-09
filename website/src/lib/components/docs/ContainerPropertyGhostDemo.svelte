<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { defaultAnimations, type ItemMoveEvent } from "@snap-engine/snapsort";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";

  let notes = $state([
    { id: "first", label: "First note" },
    { id: "second", label: "Second note" },
    { id: "third", label: "Third note" },
  ]);

  function onItemMove(event: ItemMoveEvent) {
    const note = notes.find((entry) => entry.id === event.itemId);
    if (!note) return;
    const next = notes.filter((entry) => entry.id !== event.itemId);
    next.splice(Math.min(event.to.index, next.length), 0, note);
    notes = next;
  }
</script>

<Engine id="container-property-ghost">
  <Container
    className="ghost-list"
    items={notes}
    config={{ animation: defaultAnimations, callbacks: { onItemMove } }}
  >
    {#snippet entry(note)}
      <Item itemId={note.id} className="ghost-item">{note.label}</Item>
    {/snippet}

    {#snippet ghost(event)}
      <Ghost {event} className="custom-ghost">
        {#if event.kind === "marker"}
          {event.role === "pointer" ? "Dragging" : "Insert here"}
        {:else}
          Drop {String(event.originalItemId)} here
        {/if}
      </Ghost>
    {/snippet}
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
