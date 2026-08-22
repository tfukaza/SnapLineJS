<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type { Engine as SnapEngine } from "@snap-engine/core";
  import {
    createRenderEntries,
    createRenderEntry,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
    type ContainerCallbacks,
    type RenderTreeEvent,
  } from "@snap-engine/snapsort";
  import { rejectDrop } from "@snap-engine/snapsort/callbacks";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";

  type KanbanCard = {
    id: string;
    text: string;
    description: string;
    assignee: string;
    avatar: string;
    avatarColor: string;
    due: string;
    tag: string;
    activity: string;
  };

  type KanbanColumn = {
    id: string;
    title: string;
  };

  type KanbanValue = KanbanCard | KanbanColumn;

  const todoCards: KanbanCard[] = [
    { id: "k-1", text: "Fix Bug #12", description: "Fix the login issue on Safari browser.", assignee: "Maya Chen", avatar: "MC", avatarColor: "#0088ff", due: "Today", tag: "Bug", activity: "3" },
    { id: "k-2", text: "Write Tests", description: "Add unit tests for the new payment module.", assignee: "Noah Kim", avatar: "NK", avatarColor: "#8f3dff", due: "Jun 30", tag: "QA", activity: "1" },
  ];

  const reviewCards: KanbanCard[] = [
    { id: "k-3", text: "Code Review", description: "Review the PR for the new feature.", assignee: "Ari Patel", avatar: "AP", avatarColor: "#ff7a00", due: "Jul 1", tag: "Dev", activity: "5" },
    { id: "k-4", text: "Design QA", description: "Check spacing, empty states, and mobile behavior.", assignee: "Lina Park", avatar: "LP", avatarColor: "#ff3d7f", due: "Jul 2", tag: "UI", activity: "2" },
  ];

  const doneCards: KanbanCard[] = [
    { id: "k-5", text: "Publish Docs", description: "Update the release notes and component examples.", assignee: "Eli Stone", avatar: "ES", avatarColor: "#14a44d", due: "Done", tag: "Docs", activity: "4" },
    { id: "k-6", text: "Deploy to Prod", description: "Deploy the latest build to production.", assignee: "Tara Ito", avatar: "TI", avatarColor: "#00a9a5", due: "Done", tag: "Ops", activity: "6" },
  ];

  function columnEntry(column: KanbanColumn, cards: readonly KanbanCard[]) {
    return createRenderEntry<KanbanValue>(
      column,
      column.id,
      createRenderTree(createRenderEntries<KanbanValue>(cards, (card) => card.id)),
    );
  }

  let engine: SnapEngine | null = $state(null);
  let columns = $state.raw(
    createRenderTree<KanbanValue>([
      columnEntry({ id: "kanban-todo", title: "To Do" }, todoCards),
      columnEntry({ id: "kanban-review", title: "Review" }, reviewCards),
      columnEntry({ id: "kanban-done", title: "Done" }, doneCards),
    ]),
  );

  $effect(() => {
    if (engine) engine.input.config.maxSimultaneousDrags = 1;
  });

  function handleRenderEvent(event: RenderTreeEvent) {
    columns = reduceRenderTree(columns, event);
  }

  const callbacks = {
    onItemMove: handleRenderEvent,
    onGhostInsert: handleRenderEvent,
    onGhostMove: handleRenderEvent,
    onGhostRemove: handleRenderEvent,
    canDrop: rejectDrop,
  } satisfies ContainerCallbacks;
</script>

<div class="kanban-example" data-snapsort-example="kanban-board">
  <Engine id="snapsort-kanban-example" bind:engine>
    <div class="kanban-scroll">
      <Container
        itemId="example-kanban-root"
        config={{
          animation: defaultAnimations,
          direction: "row",
          name: "kanban-root",
          callbacks,
        }}
        locked={true}
      >
        {#each columns.entries as entry (entry.itemId)}
          {#if entry.isGhost}
            <Ghost ghost={entry.ghost} />
          {:else if entry.childTree && "title" in entry.value}
            <Container
              className="kanban-column"
              itemId={entry.itemId}
              config={{
                animation: defaultAnimations,
                direction: "column",
                name: entry.itemId,
              }}
              locked={true}
              metadata={{ columnId: entry.itemId }}
            >
              <h4>{entry.value.title}</h4>
              {#each entry.childTree.entries as child (child.itemId)}
                {#if child.isGhost}
                  <Ghost ghost={child.ghost} />
                {:else if child.childTree}
                  <Container itemId={child.itemId} />
                {:else if "text" in child.value}
                  <Item itemId={child.itemId}>
                    <div class="kanban-card">
                      <div class="kanban-header">
                        <span class="kanban-title">{child.value.text}</span>
                        <span class="kanban-tag">{child.value.tag}</span>
                      </div>
                      <p class="kanban-desc">{child.value.description}</p>
                      <div class="kanban-footer">
                        <span
                          class="kanban-avatar"
                          style={`--avatar-color: ${child.value.avatarColor}`}
                          title={child.value.assignee}
                          aria-label={child.value.assignee}
                        >{child.value.avatar}</span>
                        <span class="kanban-meta">
                          <span><i class="material-symbols-rounded" aria-hidden="true">event</i>{child.value.due}</span>
                          <span><i class="material-symbols-rounded" aria-hidden="true">forum</i>{child.value.activity}</span>
                        </span>
                      </div>
                    </div>
                  </Item>
                {/if}
              {/each}
            </Container>
          {:else}
            <Item itemId={entry.itemId}>{entry.itemId}</Item>
          {/if}
        {/each}
      </Container>
    </div>
  </Engine>
</div>

<style>
  .kanban-example {
    width: 100%;
    min-width: 0;
    user-select: none;
  }

  .kanban-example :global(.snap-engine-canvas) {
    overflow: visible !important;
  }

  .kanban-scroll {
    width: 100%;
    overflow-x: auto;
    padding-bottom: 0.35rem;
  }

  .kanban-scroll > :global(.snapsort-container) {
    align-items: stretch;
    width: 100%;
    min-width: 43rem;
    gap: 1rem;
    flex-wrap: nowrap;
  }

  .kanban-scroll :global(.kanban-column) {
    flex: 1 0 13rem;
    align-items: stretch;
    min-height: 28rem;
    padding: 0.75rem;
    border-radius: 12px;
    background: rgb(31 30 41 / 4%);
  }

  .kanban-scroll :global(.kanban-column .snapsort-item) {
    align-items: stretch;
    width: 100%;
    padding-inline: 0;
  }

  .kanban-scroll :global(.kanban-column h4) {
    margin: 0 0 1rem;
    color: #8f9497;
    font-family: "Bitcount Grid Single", monospace;
    font-size: 0.9rem;
    font-weight: 300;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .kanban-card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
    margin-bottom: 0.5rem;
    padding: 0.85rem 0.95rem;
    border: 1px solid rgb(31 30 41 / 8%);
    border-radius: 10px;
    background: var(--color-background);
    box-shadow: 0 1px 2px rgb(31 30 41 / 5%), 0 4px 12px -6px rgb(31 30 41 / 8%);
    box-sizing: border-box;
    cursor: grab;
    touch-action: none;
  }

  .kanban-card:active {
    cursor: grabbing;
  }

  .kanban-header,
  .kanban-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .kanban-title {
    overflow: hidden;
    color: #232526;
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kanban-tag {
    flex: 0 0 auto;
    padding: 0.16rem 0.5rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-primary) 10%, #fff);
    color: color-mix(in srgb, var(--color-primary) 72%, #222);
    font-size: 0.7rem;
    font-weight: 600;
  }

  .kanban-desc {
    display: -webkit-box;
    margin: 0;
    overflow: hidden;
    color: #5f6569;
    font-size: 0.85rem;
    line-height: 1.35;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }

  .kanban-footer {
    padding-top: 0.45rem;
  }

  .kanban-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 50%;
    background: var(--avatar-color);
    color: white;
    font-family: "Bitcount Grid Single", monospace;
    font-size: 0.67rem;
  }

  .kanban-meta,
  .kanban-meta span {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: #8f9497;
    font-size: 0.78rem;
  }

  .kanban-meta {
    gap: 0.65rem;
  }

  .kanban-meta :global(.material-symbols-rounded) {
    font-family: "Material Symbols Rounded";
    font-size: inherit;
    font-style: normal;
  }

  @media (max-width: 720px) {
    .kanban-scroll > :global(.snapsort-container) {
      min-width: 0;
      flex-direction: column !important;
    }

    .kanban-scroll :global(.kanban-column) {
      flex-basis: auto;
      width: 100%;
      min-height: 12rem;
      box-sizing: border-box;
    }
  }
</style>
