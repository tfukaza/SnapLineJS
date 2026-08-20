<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type {
    Container as SnapSortContainer,
    ContainerCallbacks,
    GhostLifecycleEvent,
    ItemMoveEvent,
  } from "@snap-engine/snapsort";
  import {
    createRenderEntry,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
  } from "@snap-engine/snapsort";
  import { rejectDrop } from "@snap-engine/snapsort/callbacks";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";

  type Card = { kind: "card"; id: string; label: string };
  type Column = {
    kind: "column";
    id: "backlog" | "done";
    label: string;
    container?: SnapSortContainer;
  };
  type BoardValue = Card | Column;

  const backlogColumn: Column = {
    kind: "column",
    id: "backlog",
    label: "Backlog",
  };
  const doneColumn: Column = { kind: "column", id: "done", label: "Done" };
  const cardEntry = (id: string, label: string) =>
    createRenderEntry<BoardValue>({ kind: "card", id, label }, id);
  let board = $state.raw(
    createRenderTree<BoardValue>([
      createRenderEntry(
        backlogColumn,
        backlogColumn.id,
        createRenderTree([
          cardEntry("draft", "Draft copy"),
          cardEntry("review", "Review changes"),
        ]),
      ),
      createRenderEntry(doneColumn, doneColumn.id, createRenderTree()),
    ]),
  );
  let lastMove = $state("No moves yet");

  function onItemMove(event: ItemMoveEvent) {
    const card = board.entries
      .filter((entry) => !entry.isGhost && entry.childTree)
      .flatMap((entry) =>
        entry.isGhost || !entry.childTree ? [] : entry.childTree.entries,
      )
      .find((entry) => !entry.isGhost && entry.itemId === event.itemId);
    const destinationColumn = board.entries.find(
      (entry) =>
        !entry.isGhost && entry.itemId === event.to.container.itemId,
    );
    board = reduceRenderTree(board, event);
    if (
      card &&
      !card.isGhost &&
      destinationColumn &&
      !destinationColumn.isGhost
    ) {
      lastMove = `${card.value.label} moved to ${destinationColumn.value.label}`;
    }
  }

  function onGhostMove(event: GhostLifecycleEvent) {
    board = reduceRenderTree(board, event);
  }

  function moveCard(id: string, source: BoardValue) {
    if (source.kind !== "column") return;
    const destination = board.entries.find(
      (entry) =>
        !entry.isGhost &&
        entry.value.kind === "column" &&
        entry.value !== source,
    );
    if (
      !source.container ||
      !destination ||
      destination.isGhost ||
      destination.value.kind !== "column" ||
      !destination.value.container
    ) {
      return;
    }
    source.container.moveItem(
      id,
      destination.value.container,
      destination.value.container.numberOfItems,
    );
  }

  const callbacks = {
    onItemMove,
    onGhostInsert: onGhostMove,
    onGhostMove,
    onGhostRemove: onGhostMove,
    canDrop: rejectDrop,
  } satisfies ContainerCallbacks;
</script>

<Engine id="container-property-metadata">
  <Container
    itemId="container-property-metadata-root"
    className="metadata-board"
    config={{ animation: defaultAnimations, direction: "row", callbacks }}
    locked={true}
    aria-label="Task board"
  >
    {#each board.entries as entry (entry.itemId)}
      {#if entry.isGhost}
        <Ghost ghost={entry.ghost} />
      {:else if entry.childTree && entry.value.kind === "column"}
      <Container
        bind:container={entry.value.container}
        itemId={entry.itemId}
        className="metadata-list"
        locked={true}
        metadata={{ label: entry.value.label }}
        config={{ animation: defaultAnimations }}
      >
        <h4>{entry.value.label}</h4>
        {#each entry.childTree.entries as child (child.itemId)}
          {#if child.isGhost}
            <Ghost ghost={child.ghost} />
          {:else if child.childTree}
            <Container itemId={child.itemId} />
          {:else if child.value.kind === "card"}
            <Item itemId={child.itemId} className="metadata-item">
              <span>{child.value.label}</span>
              <button
                type="button"
                aria-label={`Move ${child.value.label} to ${entry.value.id === "backlog" ? "Done" : "Backlog"}`}
                onpointerdown={(event) => event.stopPropagation()}
                onclick={() => moveCard(child.itemId, entry.value)}
              >
                {entry.value.id === "backlog" ? "Move →" : "← Move"}
              </button>
            </Item>
          {/if}
        {/each}
      </Container>
      {:else}
        <Item itemId={entry.itemId}>{entry.value.label}</Item>
      {/if}
    {/each}
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
