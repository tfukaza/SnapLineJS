<script lang="ts">
  import {
    createRenderEntries,
    createRenderEntry,
    createRenderTree,
    reduceRenderTree,
  } from "@snap-engine/snapsort";
  import type {
    ContainerCallbacks,
    RenderTreeEvent,
  } from "@snap-engine/snapsort";
  import { rejectDrop } from "@snap-engine/snapsort/callbacks";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";
  import { onMount } from "svelte";

  type KanbanCard = {
    kind: "card";
    id: string;
    title: string;
    category: string;
    due: string;
    assignee: string;
    initials: string;
  };

  type KanbanColumn = {
    kind: "column";
    id: string;
    title: string;
  };

  type KanbanValue = KanbanCard | KanbanColumn;

  const KANBAN_ANIMATIONS = {
    reorder: {
      duration: 260,
      timing_function: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
    drop: {
      duration: 260,
      timing_function: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
    move: {
      duration: 260,
      timing_function: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
  };

  const TODO_CARDS = [
    {
      kind: "card",
      id: "kanban-research",
      title: "Research references",
      category: "Research",
      due: "Today",
      assignee: "Maya Chen",
      initials: "MC",
    },
    {
      kind: "card",
      id: "kanban-wireframe",
      title: "Draft wireframes",
      category: "Design",
      due: "Aug 26",
      assignee: "Noah Kim",
      initials: "NK",
    },
    {
      kind: "card",
      id: "kanban-copy",
      title: "Write interface copy",
      category: "Content",
      due: "Aug 28",
      assignee: "Ari Patel",
      initials: "AP",
    },
  ] satisfies KanbanCard[];

  const IN_PROGRESS_CARDS = [
    {
      kind: "card",
      id: "kanban-components",
      title: "Build components",
      category: "Develop",
      due: "Tomorrow",
      assignee: "Lina Park",
      initials: "LP",
    },
    {
      kind: "card",
      id: "kanban-motion",
      title: "Tune interactions",
      category: "Motion",
      due: "Aug 27",
      assignee: "Eli Stone",
      initials: "ES",
    },
  ] satisfies KanbanCard[];

  const DONE_CARDS = [
    {
      kind: "card",
      id: "kanban-tokens",
      title: "Define design tokens",
      category: "System",
      due: "Complete",
      assignee: "Tara Ito",
      initials: "TI",
    },
  ] satisfies KanbanCard[];

  const ALL_DONE_CARDS = [
    ...IN_PROGRESS_CARDS.map((card) => ({ ...card, due: "Complete" })),
    ...DONE_CARDS,
  ] satisfies KanbanCard[];

  function columnEntry(column: KanbanColumn, cards: readonly KanbanCard[]) {
    return createRenderEntry<KanbanValue>(
      column,
      column.id,
      createRenderTree(
        createRenderEntries<KanbanValue>(cards, (card) => card.id),
      ),
    );
  }

  let board = $state.raw(
    createRenderTree<KanbanValue>([
      columnEntry(
        { kind: "column", id: "kanban-todo", title: "To Do" },
        TODO_CARDS,
      ),
      columnEntry(
        { kind: "column", id: "kanban-done", title: "Done" },
        ALL_DONE_CARDS,
      ),
    ]),
  );
  let boardAnchor = $state<HTMLDivElement | null>(null);
  let initialBoardHeight = $state<number | null>(null);

  onMount(() => {
    const frame = requestAnimationFrame(() => {
      initialBoardHeight = boardAnchor?.getBoundingClientRect().height ?? null;
    });
    return () => cancelAnimationFrame(frame);
  });

  function applyBoardEvent(event: RenderTreeEvent) {
    board = reduceRenderTree(board, event);
  }

  const callbacks = {
    onItemMove: applyBoardEvent,
    onItemRemove: applyBoardEvent,
    onItemSwap: applyBoardEvent,
    onGhostInsert: applyBoardEvent,
    onGhostMove: applyBoardEvent,
    onGhostRemove: applyBoardEvent,
    getDropPriority: rejectDrop,
  } satisfies ContainerCallbacks;
</script>

<div class="kanban-viewport" data-demo="kanban-board">
  <div
    bind:this={boardAnchor}
    class:anchored={initialBoardHeight !== null}
    class="kanban-board-anchor"
    style:height={initialBoardHeight === null
      ? undefined
      : `${initialBoardHeight}px`}
  >
    <Container
    itemId="gallery-kanban-root"
    className="kanban-board"
    config={{
      animation: KANBAN_ANIMATIONS,
      mode: "progressive",
      direction: "row",
      callbacks,
    }}
    locked
  >
    {#each board.entries as column (column.itemId)}
      {#if column.isGhost}
        <Ghost ghost={column.ghost} className="kanban-ghost" />
      {:else if column.childTree && column.value.kind === "column"}
        <Container
          itemId={column.itemId}
          className="kanban-column"
          config={{
            animation: KANBAN_ANIMATIONS,
            mode: "progressive",
            direction: "column",
          }}
          locked
          data-kanban-column={column.value.id}
        >
          <h3>{column.value.title}</h3>
          <div class="kanban-column-rule" aria-hidden="true"></div>
          {#each column.childTree.entries as card (card.itemId)}
            {#if card.isGhost}
              <Ghost ghost={card.ghost} className="kanban-ghost" />
            {:else if card.value.kind === "card"}
              <Item itemId={card.itemId} className="kanban-card-item">
                <div
                  class="kanban-card"
                  data-kanban-card={card.itemId}
                  aria-label={`${card.value.title}, ${card.value.category}, due ${card.value.due}, assigned to ${card.value.assignee}`}
                >
                  <span class="kanban-card-category">{card.value.category}</span>
                  <span class="kanban-card-title">{card.value.title}</span>
                  <span class="kanban-card-footer">
                    <span class="kanban-card-due">
                      <i class="material-symbols-rounded" aria-hidden="true"
                        >schedule</i
                      >
                      {card.value.due}
                    </span>
                    <span
                      class="kanban-card-avatar"
                      title={card.value.assignee}
                      aria-hidden="true"
                    >{card.value.initials}</span>
                  </span>
                </div>
              </Item>
            {/if}
          {/each}
        </Container>
      {/if}
    {/each}
    </Container>
  </div>
</div>

<style>
  .kanban-viewport {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .kanban-board-anchor {
    position: relative;
    width: min(88%, 680px);
    min-width: 0;
  }

  .kanban-board-anchor.anchored :global(.kanban-board) {
    position: absolute;
    inset: 0 auto auto 0;
  }

  .kanban-viewport :global(.kanban-board) {
    align-items: stretch;
    width: 100%;
    min-width: 0;
    gap: clamp(12px, 2.2vw, 24px);
    flex-wrap: nowrap !important;
  }

  .kanban-viewport :global(.kanban-column) {
    flex: 1 1 0;
    min-width: 0;
    align-items: stretch;
    align-content: flex-start;
    padding: clamp(14px, 2vw, 22px);
    border: 1px solid
      color-mix(in srgb, var(--color-background-dark) 12%, transparent);
    border-radius: 18px;
    background: color-mix(
      in srgb,
      var(--color-background-dark) 4.5%,
      transparent
    );
    box-sizing: border-box;
  }

  .kanban-viewport :global(.kanban-column h3) {
    margin: 0;
    color: #282a2b;
    font-family: var(--font-label);
    font-size: clamp(0.9rem, 1.5vw, 1.22rem);
    font-weight: 350;
    letter-spacing: 0;
    line-height: 1;
  }

  .kanban-column-rule {
    width: 100%;
    height: 1px;
    margin: 12px 0 10px;
    background: color-mix(
      in srgb,
      var(--color-background-dark) 15%,
      transparent
    );
  }

  .kanban-viewport :global(.kanban-card-item) {
    width: 100%;
    padding: 5px 0;
    box-sizing: border-box;
  }

  .kanban-card {
    display: flex;
    width: 100%;
    min-width: 0;
    flex-direction: column;
    align-items: stretch;
    gap: clamp(7px, 1vw, 10px);
    padding: clamp(12px, 1.7vw, 16px) clamp(12px, 1.8vw, 18px);
    border: 1px solid
      color-mix(in srgb, var(--color-background-dark) 24%, transparent);
    border-radius: var(--size-8);
    box-sizing: border-box;
    background: var(--color-background);
    box-shadow: 0 3px 10px rgb(36 38 39 / 5%);
    color: var(--color-text);
    cursor: grab;
  }

  .kanban-card:active {
    cursor: grabbing;
  }

  .kanban-card-title {
    min-width: 0;
    overflow: hidden;
    font-family: var(--font-body);
    font-size: clamp(0.82rem, 1.3vw, 1rem);
    font-weight: 500;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kanban-card-category {
    align-self: flex-start;
    color: var(--color-primary);
    font-family: var(--font-label);
    font-size: clamp(0.58rem, 0.85vw, 0.7rem);
    font-weight: 350;
    line-height: 1;
  }

  .kanban-card-footer {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding-top: 2px;
  }

  .kanban-card-due {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 4px;
    color: var(--color-text-subtle);
    font-family: var(--font-body);
    font-size: clamp(0.65rem, 0.9vw, 0.75rem);
    line-height: 1;
    white-space: nowrap;
  }

  .kanban-card-due :global(.material-symbols-rounded) {
    font-family: "Material Symbols Rounded";
    font-size: 1.05em;
    font-style: normal;
  }

  .kanban-card-avatar {
    display: inline-grid;
    width: clamp(22px, 2.4vw, 27px);
    height: clamp(22px, 2.4vw, 27px);
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid
      color-mix(in srgb, var(--color-background-dark) 22%, transparent);
    border-radius: 50%;
    background: var(--color-background);
    color: var(--color-text);
    font-family: var(--font-label);
    font-size: clamp(0.52rem, 0.72vw, 0.62rem);
    font-weight: 350;
    line-height: 1;
  }

  .kanban-viewport :global(.kanban-ghost) {
    min-height: clamp(92px, 11vw, 112px);
    margin-block: 5px;
    border: 0 !important;
    border-radius: 12px !important;
    background: #d3d3d2 !important;
    box-shadow: none !important;
    outline: 0 !important;
  }

  @media (max-width: 700px) {
    .kanban-board-anchor {
      width: 94%;
    }

    .kanban-viewport :global(.kanban-board) {
      gap: 10px;
    }

    .kanban-viewport :global(.kanban-column) {
      flex-basis: 0;
      padding: 10px;
      border-radius: 14px;
    }

    .kanban-card {
      gap: 6px;
      padding: 10px;
    }
  }
</style>
