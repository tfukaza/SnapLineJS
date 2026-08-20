<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";
  import {
    createRenderEntry,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
    type ContainerCallbacks,
    type ItemMoveEvent,
    type RenderEntry,
    type RenderTree,
    type RenderTreeEvent,
  } from "@snap-engine/snapsort";
  import { rejectDrop } from "@snap-engine/snapsort/callbacks";
  import type { DragStartEvent } from "@snap-engine/snapsort";
  import { renderTreeCallbacks } from "../snapsort-render-tree";

  type DemoItem = {
    id: string;
    kind: "file" | "folder";
    title: string;
    detail: string;
  };

  type DemoColumn = {
    id: string;
    title: string;
    items: DemoItem[];
  };

  type BoardValue =
    | DemoItem
    | { id: string; kind: "column"; title: string };

  const initialColumns: DemoColumn[] = [
    {
      id: "today",
      title: "Project",
      items: [
        { id: "task-1", kind: "folder", title: "src", detail: "Folder" },
        { id: "task-2", kind: "folder", title: "assets", detail: "Folder" },
        { id: "task-3", kind: "file", title: "package.json", detail: "3 KB" },
        { id: "task-4", kind: "file", title: "README.md", detail: "8 KB" },
      ],
    },
    {
      id: "next",
      title: "Source",
      items: [
        { id: "task-5", kind: "file", title: "Container.svelte", detail: "6 KB" },
        { id: "task-6", kind: "file", title: "Item.svelte", detail: "4 KB" },
        { id: "task-7", kind: "file", title: "Handle.svelte", detail: "1 KB" },
      ],
    },
    {
      id: "empty",
      title: "Archive",
      items: [],
    },
  ];

  let nextId = $state(8);
  function createBoard(): RenderTree<BoardValue> {
    return createRenderTree(
      initialColumns.map((column) =>
        createRenderEntry<BoardValue>(
          { id: column.id, kind: "column", title: column.title },
          column.id,
          createRenderTree(
            column.items.map((item) =>
              createRenderEntry<BoardValue>({ ...item }, item.id),
            ),
          ),
        ),
      ),
    );
  }

  let board = $state.raw(createBoard());
  // Duplicate mode stays entirely in application state: the ordinary move
  // sends the original stable ID to the destination and backfills its source
  // with a fresh ID in the same synchronous callback.
  let duplicateMode = $state(false);
  const itemCount = $derived(
    board.entries.reduce(
      (total, entry) =>
        total + (!entry.isGhost && entry.childTree
          ? entry.childTree.entries.filter((child) => !child.isGhost).length
          : 0),
      0,
    ),
  );

  function reset() {
    nextId = 8;
    board = createBoard();
  }

  function addItem() {
    const id = `task-${nextId++}`;
    board = updateColumn(board, "today", (entries) => [
      ...entries,
      createRenderEntry<BoardValue>(
        {
          id,
          kind: "file",
          title: `new-file-${id.replace("task-", "")}.md`,
          detail: "1 KB",
        },
        id,
      ),
    ]);
  }

  function updateColumn(
    tree: RenderTree<BoardValue>,
    columnId: string,
    update: (
      entries: readonly RenderEntry<BoardValue>[],
    ) => readonly RenderEntry<BoardValue>[],
  ): RenderTree<BoardValue> {
    return {
      ...tree,
      entries: tree.entries.map((entry) =>
        !entry.isGhost && entry.itemId === columnId && entry.childTree
          ? {
              ...entry,
              childTree: {
                ...entry.childTree,
                entries: update(entry.childTree.entries),
              },
            }
          : entry,
      ),
    };
  }

  function findEntry(
    tree: RenderTree<BoardValue>,
    itemId: string,
  ): Exclude<RenderEntry<BoardValue>, { isGhost: true }> | null {
    for (const column of tree.entries) {
      if (column.isGhost || !column.childTree) continue;
      const item = column.childTree.entries.find(
        (candidate) => !candidate.isGhost && candidate.itemId === itemId,
      );
      if (item && !item.isGhost) return item;
    }
    return null;
  }

  function handleDragStart(event: DragStartEvent) {
    if (duplicateMode) {
      event.session.dragVisual = "preview";
    }
  }

  function handleMove(event: ItemMoveEvent) {
    const before = board;
    const original = findEntry(before, event.itemId);
    board = reduceRenderTree(board, event);
    if (!duplicateMode || !original || original.value.kind === "column") return;

    const sourceColumnId = event.from.container.itemId;
    const targetColumnId = event.to.container.itemId;
    const replacementId = `task-${nextId++}`;
    const replacement = createRenderEntry<BoardValue>(
      { ...original.value, id: replacementId },
      replacementId,
    );

    if (sourceColumnId !== targetColumnId) {
      board = updateColumn(board, sourceColumnId, (entries) => {
        const next = [...entries];
        next.splice(Math.min(event.from.index, next.length), 0, replacement);
        return next;
      });
      return;
    }

    const sourceBefore = before.entries.find(
      (entry) =>
        !entry.isGhost &&
        entry.itemId === sourceColumnId &&
        entry.childTree,
    );
    if (!sourceBefore || sourceBefore.isGhost || !sourceBefore.childTree) return;
    const base = sourceBefore.childTree.entries.filter(
      (entry) => entry.isGhost || entry.itemId !== event.itemId,
    );
    const combined: RenderEntry<BoardValue>[] = [];
    for (let index = 0; index <= base.length; index += 1) {
      if (index === event.from.index) combined.push(replacement);
      if (index === event.to.index) combined.push(original);
      if (index < base.length) combined.push(base[index]);
    }
    board = updateColumn(board, sourceColumnId, () => combined);
  }

  function applyBoardEvent(event: RenderTreeEvent) {
    if ("froms" in event) handleMove(event);
    else board = reduceRenderTree(board, event);
  }

  const callbacks = {
    ...renderTreeCallbacks(applyBoardEvent),
    canDrop: rejectDrop,
    onDragStart: handleDragStart,
  } satisfies ContainerCallbacks;
</script>

<svelte:head>
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&icon_names=add,description,folder,restart_alt&display=block"
  />
</svelte:head>

<div class="insertion-demo">
  <header class="demo-header">
    <div>
      <h1>SnapSort Insertion</h1>
      <p>{itemCount} files and folders · original row stays still until drop</p>
    </div>
    <div class="toolbar">
      <label class="duplicate-toggle">
        <input type="checkbox" bind:checked={duplicateMode} />
        <span></span>
        Duplicate on drop
      </label>
      <button onclick={addItem}>
        <span class="material-symbols-outlined" aria-hidden="true">add</span>
        Add
      </button>
      <button onclick={reset}>
        <span class="material-symbols-outlined" aria-hidden="true">restart_alt</span>
        Reset
      </button>
    </div>
  </header>

  <Engine id="snapsort-insertion-demo-canvas">
    <Container
      itemId="insertion-board-root"
      className="insertion-board"
      config={{
        animation: defaultAnimations,
        mode: "insertion",
        direction: "row",
        name: "insertion-board-root",
        callbacks,
      }}
      locked={true}
      metadata={{ boardId: "insertion-demo" }}
    >
      {#each board.entries as entry (entry.itemId)}
        {#if entry.isGhost}
        <Ghost ghost={entry.ghost} className="insertion-pointer-ghost">
          {#if entry.ghost.type === "pointer-preview"}
            <span
              class="material-symbols-outlined file-icon"
              class:folder-icon={entry.ghost.originalMetadata.kind === "folder"}
              aria-hidden="true"
            >{entry.ghost.originalMetadata.kind === "folder"
                ? "folder"
                : "description"}</span
            >
            <div class="card-copy">
              <strong>{String(entry.ghost.originalMetadata.title ?? "Dragging")}</strong>
              <span>{String(entry.ghost.originalMetadata.detail ?? "")}</span>
            </div>
          {/if}
        </Ghost>
        {:else if entry.childTree && entry.value.kind === "column"}
        <Container
          itemId={entry.itemId}
          className="insertion-list"
          config={{
            animation: defaultAnimations,
            mode: "insertion",
            direction: "column",
            name: `insertion-${entry.itemId}`,
          }}
          locked={true}
          metadata={{ columnId: entry.itemId }}
        >
          <div class="list-header">
            <h2>{entry.value.title}</h2>
            <span>{entry.childTree.entries.filter((child) => !child.isGhost).length}</span>
          </div>

          {#each entry.childTree.entries as child (child.itemId)}
            {#if child.isGhost}
              <Ghost
                ghost={child.ghost}
                className={child.ghost.type === "pointer-preview"
                  ? "insertion-pointer-ghost"
                  : ""}
              />
            {:else if child.childTree}
              <Container itemId={child.itemId} />
            {:else if child.value.kind !== "column"}
            <Item
              itemId={child.itemId}
              className="insertion-card"
              metadata={{
                kind: child.value.kind,
                title: child.value.title,
                detail: child.value.detail,
              }}
            >
              <span
                class="material-symbols-outlined file-icon"
                class:folder-icon={child.value.kind === "folder"}
                aria-hidden="true"
              >{child.value.kind === "folder" ? "folder" : "description"}</span>
              <div class="card-copy">
                <strong>{child.value.title}</strong>
                <span>{child.value.detail}</span>
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
  </Engine>
</div>

<style>
  .insertion-demo {
    width: 100%;
    min-height: 100%;
    box-sizing: border-box;
    padding: 0 24px 32px;
    color: #172033;
  }

  .demo-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 12px;
  }

  .demo-header h1 {
    margin: 0;
    font-size: 22px;
    line-height: 1.15;
  }

  .demo-header p {
    margin: 4px 0 0;
    color: #657084;
    font-size: 13px;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .duplicate-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #172033;
    user-select: none;
    cursor: pointer;
  }

  .toolbar button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 1px solid #cfd6e3;
    background: #ffffff;
    color: #172033;
    border-radius: 6px;
    padding: 6px 10px;
    font: inherit;
    cursor: pointer;
  }

  .toolbar button:hover {
    background: #f5f7fb;
  }

  :global(.insertion-board) {
    align-items: stretch;
    gap: 12px;
    width: 100%;
  }

  :global(.insertion-list) {
    width: min(360px, calc((100vw - 96px) / 3));
    min-width: 250px;
    min-height: 300px;
    align-items: stretch;
    gap: 2px;
    padding: 8px;
    border: 1px solid #d7dde8;
    border-radius: 8px;
    background: #ffffff;
    box-sizing: border-box;
  }

  .list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 30px;
    padding: 0 6px;
    margin-bottom: 4px;
    border-bottom: 1px solid #edf0f5;
  }

  .list-header h2 {
    margin: 0;
    font-size: 13px;
    line-height: 1.2;
  }

  .list-header span {
    min-width: 22px;
    height: 20px;
    display: inline-grid;
    place-items: center;
    border-radius: 999px;
    background: #eef2f7;
    color: #536072;
    font-size: 12px;
  }

  :global(.insertion-card) {
    width: 100%;
    min-height: 34px;
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border: 1px solid transparent;
    border-radius: 5px;
    background: #ffffff;
    box-shadow: none;
    user-select: none;
    -webkit-user-select: none;
    cursor: grab;
  }

  :global(.insertion-card:hover) {
    border-color: #dbe2ee;
    background: #f7f9fc;
  }

  :global(.insertion-card[data-snapsort-dragging="true"]) {
    opacity: 0.62;
    outline: 1px solid #93c5fd;
    outline-offset: -1px;
    background: #eff6ff;
    cursor: grabbing;
  }

  :global(.insertion-pointer-ghost) {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr);
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border: 1px solid #93c5fd;
    border-radius: 5px;
    background: #ffffff;
    box-shadow: 0 10px 24px rgba(23, 32, 51, 0.16);
  }

  .card-copy {
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: baseline;
    gap: 12px;
  }

  .card-copy strong,
  .card-copy span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-copy strong {
    font-size: 13px;
    font-weight: 500;
  }

  .card-copy span {
    color: #6b7280;
    font-size: 12px;
  }

  .file-icon {
    color: #64748b;
    font-size: 20px;
  }

  .folder-icon {
    color: #d89b22;
  }

  :global([data-snapsort-ghost="insertion"]) {
    color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.16);
  }

  @media (max-width: 860px) {
    .insertion-demo {
      padding: 0 16px 32px;
    }

    .demo-header {
      align-items: flex-start;
      flex-direction: column;
    }

    :global(.insertion-board) {
      flex-direction: column !important;
    }

    :global(.insertion-list) {
      width: 100%;
    }
  }
</style>
