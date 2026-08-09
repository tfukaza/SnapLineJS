<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type {
    Container as SnapSortContainer,
    ItemMoveEvent,
  } from "@snap-engine/snapsort";
  import { rejectDrop } from "@snap-engine/snapsort/callbacks";
  import { Container, Item } from "@snap-engine/snapsort/svelte";

  type Card = { id: string; label: string };
  type Column = {
    id: "backlog" | "done";
    label: string;
    container?: SnapSortContainer;
  };

  let columns = $state<Column[]>([
    { id: "backlog", label: "Backlog" },
    { id: "done", label: "Done" },
  ]);
  let backlog = $state<Card[]>([
    { id: "draft", label: "Draft copy" },
    { id: "review", label: "Review changes" },
  ]);
  let done = $state<Card[]>([]);
  let lastMove = $state("No moves yet");

  function onItemMove(event: ItemMoveEvent) {
    const card = [...backlog, ...done].find((entry) => entry.id === event.itemId);
    const destinationColumn = columns.find(
      (column) => column.container === event.to.container,
    );
    if (!card || !destinationColumn) return;

    backlog = backlog.filter((entry) => entry.id !== event.itemId);
    done = done.filter((entry) => entry.id !== event.itemId);
    const destination = destinationColumn.id === "done" ? done : backlog;
    destination.splice(Math.min(event.to.index, destination.length), 0, card);
    if (destinationColumn.id === "done") done = destination;
    else backlog = destination;
    lastMove = `${card.label} moved to ${destinationColumn.label}`;
  }

  function moveCard(id: string, source: Column) {
    const destination = columns.find((column) => column !== source);
    if (!source.container || !destination?.container) return;
    source.container.moveItem(
      id,
      destination.container,
      destination.container.numberOfItems,
    );
  }
</script>

<Engine id="container-property-metadata">
  <Container
    className="metadata-board"
    config={{ direction: "row", callbacks: { canDrop: rejectDrop } }}
    locked={true}
    items={columns}
    getItemId={(column) => column.id}
    aria-label="Task board"
  >
    {#snippet entry(column)}
      <Container
        bind:container={column.container}
        itemId={column.id}
        className="metadata-list"
        locked={true}
        items={column.id === "backlog" ? backlog : done}
        metadata={{ label: column.label }}
        config={{ callbacks: { onItemMove } }}
      >
        {#snippet before()}
          <h4>{column.label}</h4>
        {/snippet}
        {#snippet entry(card)}
          <Item itemId={card.id} className="metadata-item">
            <span>{card.label}</span>
            <button
              type="button"
              aria-label={`Move ${card.label} to ${column.id === "backlog" ? "Done" : "Backlog"}`}
              onpointerdown={(event) => event.stopPropagation()}
              onclick={() => moveCard(card.id, column)}
            >
              {column.id === "backlog" ? "Move →" : "← Move"}
            </button>
          </Item>
        {/snippet}
      </Container>
    {/snippet}
  </Container>
  <p class="move-status" aria-live="polite">{lastMove}</p>
</Engine>

<style>
  :global(.metadata-board) {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
    width: 100%;
  }

  h4 {
    margin: 0 0 0.45rem;
    font-size: 0.9rem;
  }

  :global(.metadata-list) {
    align-content: flex-start;
    gap: 0.45rem;
    width: 100%;
    min-height: 8.5rem;
    padding: 0.6rem;
    border: 1px dashed rgb(58 42 34 / 24%);
    border-radius: 9px;
    background: rgb(255 255 255 / 45%);
    box-sizing: border-box;
  }

  :global(.metadata-item) {
    align-items: stretch !important;
    gap: 0.4rem;
    width: 100%;
    padding: 0.65rem !important;
    border-radius: 7px;
    background: white;
    box-shadow: 0 1px 4px rgb(31 30 41 / 10%);
    box-sizing: border-box;
    cursor: grab;
  }

  button {
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-action);
    font: inherit;
    font-size: 0.78rem;
    text-align: left;
    cursor: pointer;
  }

  .move-status {
    margin: 0.75rem 0 0;
    color: rgb(58 42 34 / 70%);
    font-size: 0.82rem;
    text-align: center;
  }

  @media (max-width: 520px) {
    :global(.metadata-board) {
      grid-template-columns: 1fr;
    }
  }
</style>
