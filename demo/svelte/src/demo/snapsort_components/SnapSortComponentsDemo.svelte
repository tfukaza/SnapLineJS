<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import SnapSortDuolingoDemo from "../snapsort_duolingo/SnapSortDuolingoDemo.svelte";
  import ItemApiFixture from "./ItemApiFixture.svelte";
  import { Container, Ghost, Handle, Item } from "@snap-engine/snapsort/svelte";
  import {
    createRenderEntry,
    createRenderTree,
    reduceRenderTree,
  } from "@snap-engine/snapsort";
  import {
    prioritizeIntersectingContainer,
    rejectDrop,
  } from "@snap-engine/snapsort/callbacks";
  import type {
    Container as SortContainer,
    ContainerCallbacks,
    DropPriorityEvent,
    GhostState,
    RenderEntry,
    RenderTree,
    RenderTreeEvent,
  } from "@snap-engine/snapsort";
  import { renderTreeCallbacks } from "../snapsort-render-tree";

  type DemoItem = {
    id: string;
    label: string;
    detail: string;
  };

  type DemoColumn = {
    id: string;
    title: string;
    items: DemoItem[];
  };

  type ProgressiveTile = {
    id: string;
    text: string;
  };

  type ProgressiveExample = {
    id: string;
    prompt: string;
    answerTiles: ProgressiveTile[];
    bankTiles: ProgressiveTile[];
  };
  type ProgressiveZone = "answer" | "bank";

  type BoardValue =
    | ({ kind: "item" } & DemoItem)
    | {
        kind: "column";
        id: string;
        title: string;
        container: SortContainer | null;
      };
  type ProgressiveValue =
    | { kind: "example"; id: string; prompt: string }
    | { kind: "zone"; id: string; exampleId: string; zone: ProgressiveZone }
    | ({ kind: "tile" } & ProgressiveTile);
  type OrdinaryBoardEntry = Exclude<RenderEntry<BoardValue>, { isGhost: true }>;

  function isBoardColumn(entry: RenderEntry<BoardValue>): entry is OrdinaryBoardEntry {
    return (
      !entry.isGhost &&
      entry.value.kind === "column" &&
      entry.childTree !== null
    );
  }

  function prioritizeMatchingDropGroup(
    event: DropPriorityEvent,
  ): number | undefined {
    const sourceGroup = event.source?.containerMetadata.dropGroup;
    return sourceGroup !== undefined &&
      sourceGroup === event.containerMetadata.dropGroup
      ? prioritizeIntersectingContainer(event)
      : rejectDrop(event);
  }

  const initialColumns: DemoColumn[] = [
    {
      id: "backlog",
      title: "Backlog",
      items: [
        { id: "item-1", label: "Profile fields", detail: "Account settings" },
        { id: "item-2", label: "Invite flow", detail: "Workspace setup" },
        { id: "item-3", label: "Audit log", detail: "Admin tools" },
        { id: "item-4", label: "Search filters", detail: "Results page" },
      ],
    },
    {
      id: "active",
      title: "Active",
      items: [
        { id: "item-5", label: "Board polish", detail: "Column controls" },
      ],
    },
    {
      id: "done",
      title: "Done",
      items: [{ id: "item-6", label: "Audit export", detail: "CSV polish" }],
    },
  ];
  const snapSortCubicAnimation = new URLSearchParams(window.location.search).has(
    "slowFlip",
  )
    ? { duration: 800, timing_function: "linear" }
    : {
        duration: 180,
        timing_function: "cubic-bezier(0.2, 0, 0, 1)",
      };
  const showItemApiFixture = new URLSearchParams(window.location.search).get("itemApi") === "1";

  const initialProgressiveExamples: ProgressiveExample[] = [
    {
      id: "morning-brief",
      prompt: "Build the sentence: The product designer rewrote the onboarding checklist.",
      answerTiles: [
        { id: "morning-brief-answer-the", text: "The" },
        { id: "morning-brief-answer-product-designer", text: "product designer" },
        { id: "morning-brief-answer-rewrote", text: "rewrote" },
      ],
      bankTiles: [
        { id: "morning-brief-bank-checklist", text: "the onboarding checklist" },
        { id: "morning-brief-bank-quietly", text: "quietly" },
        { id: "morning-brief-bank-before-lunch", text: "before lunch" },
      ],
    },
    {
      id: "support-reply",
      prompt: "Build the sentence: After the update, Maya carefully tested every keyboard shortcut.",
      answerTiles: [
        { id: "support-reply-answer-after", text: "After" },
        { id: "support-reply-answer-update", text: "the update," },
        { id: "support-reply-answer-maya", text: "Maya" },
        { id: "support-reply-answer-carefully-tested", text: "carefully tested" },
      ],
      bankTiles: [
        { id: "support-reply-bank-every", text: "every" },
        { id: "support-reply-bank-keyboard-shortcut", text: "keyboard shortcut" },
        { id: "support-reply-bank-again", text: "again" },
        { id: "support-reply-bank-on-a-small-laptop", text: "on a small laptop" },
      ],
    },
    {
      id: "wide-tiles",
      prompt: "Build the sentence: The analytics panel should stay readable on narrow screens.",
      answerTiles: [
        { id: "wide-tiles-answer-the-analytics-panel", text: "The analytics panel" },
        { id: "wide-tiles-answer-should", text: "should" },
      ],
      bankTiles: [
        { id: "wide-tiles-bank-stay-readable", text: "stay readable" },
        { id: "wide-tiles-bank-on", text: "on" },
        { id: "wide-tiles-bank-narrow-screens", text: "narrow screens" },
        { id: "wide-tiles-bank-without-overflowing", text: "without overflowing" },
      ],
    },
  ];

  function createBoardTree(): RenderTree<BoardValue> {
    return createRenderTree(
      initialColumns.map((column) =>
        createRenderEntry<BoardValue>(
          {
            kind: "column",
            id: column.id,
            title: column.title,
            container: null,
          },
          column.id,
          createRenderTree(
            column.items.map((item) =>
              createRenderEntry<BoardValue>({ kind: "item", ...item }, item.id),
            ),
          ),
        ),
      ),
    );
  }

  function createProgressiveTree(): RenderTree<ProgressiveValue> {
    return createRenderTree(
      initialProgressiveExamples.map((example) =>
        createRenderEntry<ProgressiveValue>(
          { kind: "example", id: example.id, prompt: example.prompt },
          example.id,
          createRenderTree(
            (["answer", "bank"] as const).map((zone) =>
              createRenderEntry<ProgressiveValue>(
                {
                  kind: "zone",
                  id: `${example.id}-${zone}`,
                  exampleId: example.id,
                  zone,
                },
                `${example.id}-${zone}`,
                createRenderTree(
                  example[zone === "answer" ? "answerTiles" : "bankTiles"].map(
                    (tile) =>
                      createRenderEntry<ProgressiveValue>(
                        { kind: "tile", ...tile },
                        tile.id,
                      ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  let nextItemNumber = $state(7);
  let board = $state.raw(createBoardTree());
  let progressiveTree = $state.raw(createProgressiveTree());
  let boardVersion = $state(0);
  let itemCount = $derived(
    board.entries.reduce(
      (total, entry) =>
        total + (!entry.isGhost && entry.childTree
          ? entry.childTree.entries.filter((child) => !child.isGhost).length
          : 0),
      0,
    ),
  );

  function createItem(): DemoItem {
    const itemNumber = nextItemNumber++;
    return {
      id: `item-${itemNumber}`,
      label: `Task ${itemNumber}`,
      detail: "Added from array state",
    };
  }

  function addItem() {
    const item = createItem();
    board = {
      ...board,
      entries: board.entries.map((entry, index) =>
        index === 0 && !entry.isGhost && entry.childTree
          ? {
              ...entry,
              childTree: {
                ...entry.childTree,
                entries: [
                  ...entry.childTree.entries,
                  createRenderEntry<BoardValue>(
                    { kind: "item", ...item },
                    item.id,
                  ),
                ],
              },
            }
          : entry,
      ),
    };
  }

  function deleteItem(itemId: string) {
    board = {
      ...board,
      entries: board.entries.map((entry) =>
        !entry.isGhost && entry.childTree
          ? {
              ...entry,
              childTree: {
                ...entry.childTree,
                entries: entry.childTree.entries.filter(
                  (item) => item.itemId !== itemId,
                ),
              },
            }
          : entry,
      ),
    };
  }

  function moveItemAcrossColumns(itemId: string, direction: -1 | 1) {
    const columns = board.entries.filter(isBoardColumn);
    const sourceColumnIndex = columns.findIndex((column) =>
      column.childTree?.entries.some(
        (item) => !item.isGhost && item.itemId === itemId,
      ),
    );
    const targetColumnIndex = sourceColumnIndex + direction;
    if (
      sourceColumnIndex === -1 ||
      targetColumnIndex < 0 ||
      targetColumnIndex >= columns.length
    ) return;

    const sourceColumn = columns[sourceColumnIndex];
    const targetColumn = columns[targetColumnIndex];
    if (!sourceColumn.childTree || !targetColumn.childTree) return;
    const sourceItemIndex = sourceColumn.childTree.entries.findIndex(
      (item) => !item.isGhost && item.itemId === itemId,
    );
    if (sourceItemIndex === -1) return;
    const destinationIndex = Math.min(
      sourceItemIndex,
      targetColumn.childTree.entries.length,
    );
    const sourceContainer = sourceColumn.value.container;
    const targetContainer = targetColumn.value.container;
    if (!sourceContainer || !targetContainer) return;
    sourceContainer.moveItem(itemId, targetContainer, destinationIndex);
  }

  $effect(() => {
    const demoWindow = window as typeof window & {
      __snapsortMoveComponentItem?: typeof moveItemAcrossColumns;
    };
    demoWindow.__snapsortMoveComponentItem = moveItemAcrossColumns;
    return () => {
      delete demoWindow.__snapsortMoveComponentItem;
    };
  });

  function resetItems() {
    nextItemNumber = 7;
    board = createBoardTree();
    boardVersion += 1;
  }

  function findDemoItem(itemId: string | undefined) {
    if (!itemId) return null;
    for (const column of board.entries) {
      if (column.isGhost || !column.childTree) continue;
      const entry = column.childTree.entries.find(
        (candidate) => !candidate.isGhost && candidate.itemId === itemId,
      );
      if (entry && !entry.isGhost && entry.value.kind === "item") {
        const { id, label, detail } = entry.value;
        return { id, label, detail };
      }
    }
    return null;
  }

  function ghostItemContent(ghost: GhostState): DemoItem | null {
    return findDemoItem(ghost.originalItemId);
  }

  function columnIndex(itemId: string): number {
    return board.entries
      .filter(
        (entry) =>
          !entry.isGhost &&
          entry.value.kind === "column" &&
          entry.childTree !== null,
      )
      .findIndex((entry) => entry.itemId === itemId);
  }

  function columnCount(): number {
    return board.entries.filter(
      (entry) => !entry.isGhost && entry.value.kind === "column",
    ).length;
  }

  function applyBoardEvent(event: RenderTreeEvent) {
    board = reduceRenderTree(board, event);
  }

  const boardCallbacks = {
    ...renderTreeCallbacks(applyBoardEvent),
    getDropPriority: rejectDrop,
  } satisfies ContainerCallbacks;
  const progressiveCallbacks = {
    ...renderTreeCallbacks(
      (event) => (progressiveTree = reduceRenderTree(progressiveTree, event)),
    ),
    getDropPriority: rejectDrop,
  } satisfies ContainerCallbacks;

  function stopControlEvent(event: Event) {
    event.stopPropagation();
  }

  function runControl(event: Event, action: () => void) {
    event.preventDefault();
    event.stopPropagation();
    action();
  }

  function controlButton(node: HTMLButtonElement, action: () => void) {
    let currentAction = action;
    const stop = (event: Event) => stopControlEvent(event);
    const run = (event: Event) => runControl(event, currentAction);

    node.addEventListener("pointerdown", stop);
    node.addEventListener("mousedown", stop);
    node.addEventListener("mouseup", run);

    return {
      update(nextAction: () => void) {
        currentAction = nextAction;
      },
      destroy() {
        node.removeEventListener("pointerdown", stop);
        node.removeEventListener("mousedown", stop);
        node.removeEventListener("mouseup", run);
      },
    };
  }
</script>

<svelte:head>
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined&icon_names=arrow_left_alt,arrow_right_alt,delete,drag_indicator&display=block"
  />
</svelte:head>

<div class="components-demo">
  {#if showItemApiFixture}
    <ItemApiFixture />
  {/if}

  <header class="demo-header">
    <div>
      <h1>SnapSort Components</h1>
      <p>{itemCount} Euclidean cards plus Progressive sentence demos</p>
    </div>
  </header>

  <section class="algorithm-panel kanban-panel">
    <div class="section-heading">
      <h2>Euclidean drag and drop</h2>
      <p>Array-backed board with column and item reordering.</p>
    </div>

    <div class="kanban-demo-shell">
      <div class="toolbar">
        <button onclick={addItem}>Add Item</button>
        <button onclick={resetItems}>Reset</button>
      </div>

      <div class="engine-area">
        {#key boardVersion}
          <Engine id="snapsort-components-demo-canvas">
            <div class="board-frame">
              <Container
                itemId="component-kanban-root"
                className="board"
                config={{
                  direction: "row",
                  name: "component-kanban-root",
                  callbacks: boardCallbacks,
                }}
                locked={true}
                metadata={{ boardId: "component-kanban" }}
              >
                {#each board.entries as entry (entry.itemId)}
                  {#if entry.isGhost}
                    <Ghost ghost={entry.ghost} />
                  {:else if entry.childTree && entry.value.kind === "column"}
                    {@const column = entry.value}
                  <Container
                    itemId={entry.itemId}
                    bind:container={column.container}
                    className={column.id === "backlog" ? "list-panel array-list" : "list-panel"}
                    config={{
                      direction: "column",
                      name: `component-${column.id}`,
                      animation: {
                        reorder: snapSortCubicAnimation,
                        drop: snapSortCubicAnimation,
                        move: snapSortCubicAnimation,
                      },
                    }}
                    locked={true}
                    metadata={{ columnId: column.id }}
                  >
                    <div class="list-header">
                      <h2>{column.title}</h2>
                      <span>{entry.childTree.entries.filter((child) => !child.isGhost).length}</span>
                    </div>
                    {#each entry.childTree.entries as child (child.itemId)}
                      {#if child.isGhost}
                        <Ghost ghost={child.ghost}>
                          <div class="task-content">
                            <div class="task-main">
                              <strong>{ghostItemContent(child.ghost)?.label ?? ""}</strong>
                              <span>{ghostItemContent(child.ghost)?.detail ?? ""}</span>
                            </div>
                          </div>
                        </Ghost>
                      {:else if child.childTree}
                        <Container itemId={child.itemId} />
                      {:else if child.value.kind === "item"}
                        {@const item = child.value}
                      <Item itemId={child.itemId} className="task-card" metadata={{ label: item.label, detail: item.detail }}>
                        <div class="task-content">
                          <Handle className="task-drag-handle">
                            <span class="material-symbols-outlined" aria-hidden="true">drag_indicator</span>
                          </Handle>
                          <div class="task-main">
                            <strong>{item.label}</strong>
                            <span>{item.detail}</span>
                          </div>
                          <div class="card-actions">
                            <button
                              class="icon-button"
                              aria-label={`Delete ${item.label}`}
                              use:controlButton={() => deleteItem(item.id)}
                            ><span class="material-symbols-outlined" aria-hidden="true">delete</span></button>
                            <button
                              class="icon-button"
                              aria-label={`Move ${item.label} left`}
                              disabled={columnIndex(column.id) === 0}
                              use:controlButton={() => moveItemAcrossColumns(item.id, -1)}
                            ><span class="material-symbols-outlined" aria-hidden="true">arrow_left_alt</span></button>
                            <button
                              class="icon-button"
                              aria-label={`Move ${item.label} right`}
                              disabled={columnIndex(column.id) === columnCount() - 1}
                              use:controlButton={() => moveItemAcrossColumns(item.id, 1)}
                            ><span class="material-symbols-outlined" aria-hidden="true">arrow_right_alt</span></button>
                          </div>
                        </div>
                      </Item>
                      {/if}
                    {/each}
                  </Container>
                  {:else}
                    <Item itemId={entry.itemId}><span></span></Item>
                  {/if}
                {/each}
              </Container>
            </div>
          </Engine>
        {/key}
      </div>
    </div>
  </section>

  <div class="advanced-demo-grid">
    <section class="algorithm-panel">
      <div class="section-heading">
        <h2>Progressive drag and drop</h2>
        <p>Sentence-builder layouts using varied tile widths and wrapping rows.</p>
      </div>

      <Engine id="snapsort-progressive-components-demo-canvas">
        <Container
          itemId="progressive-components-root"
          className="progressive-root"
          config={{
            mode: "progressive",
            direction: "column",
            name: "progressive-components-root",
            callbacks: progressiveCallbacks,
          }}
          locked={true}
          metadata={{ boardId: "progressive-components" }}
        >
          {#each progressiveTree.entries as entry (entry.itemId)}
            {#if entry.isGhost}
              <Ghost ghost={entry.ghost} />
            {:else if entry.childTree && entry.value.kind === "example"}
              {@const example = entry.value}
              <Container
                itemId={entry.itemId}
                className="progressive-example"
                config={{
                  mode: "progressive",
                  direction: "column",
                  name: `progressive-example-${example.id}`,
                  callbacks: { getDropPriority: rejectDrop },
                }}
                locked={true}
                metadata={{ exampleId: example.id }}
              >
                <div class="progressive-prompt">
                  <span>{example.prompt}</span>
                </div>
                {#each entry.childTree.entries as zoneEntry (zoneEntry.itemId)}
                  {#if zoneEntry.isGhost}
                    <Ghost ghost={zoneEntry.ghost} />
                  {:else if zoneEntry.childTree && zoneEntry.value.kind === "zone"}
                    {@const zone = zoneEntry.value}
                  <Container
                    itemId={zoneEntry.itemId}
                    className={zone.zone === "answer"
                      ? "sentence-answer-line"
                      : "sentence-bank-line"}
                    config={{
                      mode: "progressive",
                      direction: "row",
                      name: `progressive-${zone.zone}-${example.id}`,
                      animation: {
                        reorder: snapSortCubicAnimation,
                        drop: snapSortCubicAnimation,
                      },
                      callbacks: {
                        getDropPriority: prioritizeMatchingDropGroup,
                      },
                    }}
                    locked={true}
                    metadata={{
                      zone: zone.zone,
                      exampleId: example.id,
                      dropGroup: `progressive-${example.id}`,
                    }}
                  >
                    {#each zoneEntry.childTree.entries as tileEntry (tileEntry.itemId)}
                      {#if tileEntry.isGhost}
                        <Ghost ghost={tileEntry.ghost} />
                      {:else if tileEntry.childTree}
                        <Container itemId={tileEntry.itemId} />
                      {:else if tileEntry.value.kind === "tile"}
                        <Item itemId={tileEntry.itemId} className="sentence-tile-wrapper">
                          <button
                            type="button"
                            class:muted={zone.zone === "bank"}
                            class="sentence-tile"
                          >{tileEntry.value.text}</button>
                        </Item>
                      {/if}
                    {/each}
                  </Container>
                  {:else}
                    <Item itemId={zoneEntry.itemId}><span></span></Item>
                  {/if}
                {/each}
              </Container>
            {:else}
              <Item itemId={entry.itemId}><span></span></Item>
            {/if}
          {/each}
        </Container>
      </Engine>
    </section>

    <section class="algorithm-panel">
      <div class="section-heading">
        <h2>Progressive sentence builder</h2>
        <p>Interactive Duolingo-style component demo with click moves and validation.</p>
      </div>

      <SnapSortDuolingoDemo embedded={true} />
    </section>
  </div>
</div>

<style lang="scss">
  .components-demo {
    width: 100%;
    height: 100%;
    overflow: auto;
    background: #fff;
    box-sizing: border-box;
    padding: var(--size-24);
    display: flex;
    flex-direction: column;
    gap: var(--size-24);
  }

  .demo-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: var(--size-16);
    border-bottom: 2px solid #000;
    padding-bottom: var(--size-16);
  }

  h1 {
    margin: 0;
    font-family: "Geist", sans-serif;
    font-size: 56px;
    line-height: 1;
  }

  h2 {
    margin: 0;
    font-family: "Geist", sans-serif;
    font-size: 20px;
  }

  p,
  span,
  strong {
    font-family: "Geist", sans-serif;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--size-8);
  }

  .algorithm-panel {
    display: flex;
    flex-direction: column;
    gap: var(--size-16);
    min-width: 0;
  }

  .kanban-panel {
    width: 100%;
  }

  .kanban-demo-shell {
    width: min(1080px, 100%);
    display: flex;
    flex-direction: column;
    gap: var(--size-12);
  }

  .advanced-demo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(460px, 100%), 1fr));
    gap: var(--size-24);
    align-items: start;
  }

  .section-heading {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: var(--size-16);
    border-bottom: 1px solid #000;
    padding-bottom: var(--size-8);
  }

  .section-heading p {
    margin: 0;
    color: #555;
    font-size: 14px;
    text-align: right;
  }

  button {
    cursor: pointer;
    font-family: "Geist", sans-serif;
    font-size: 14px;
  }

  .icon-button {
    width: 24px !important;
    min-width: 24px;
    height: 24px !important;
    border: 0 !important;
    background: transparent !important;
    color: #000;
    padding: 0 !important;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    box-shadow: none !important;
    position: static;
  }

  :global(.dev-style) .icon-button {
    width: 24px !important;
    min-width: 24px;
    height: 24px !important;
    border: 0 !important;
    background: transparent !important;
    padding: 0 !important;
    box-shadow: none !important;
  }

  .icon-button:hover:not(:disabled) {
    background: transparent !important;
    color: #666;
  }

  .material-symbols-outlined {
    font-family: "Material Symbols Outlined" !important;
    width: 24px !important;
    min-width: 24px;
    inline-size: 24px !important;
    height: 24px !important;
    overflow: hidden;
    pointer-events: none;
    font-size: 24px;
    line-height: 1;
    font-weight: normal;
    font-style: normal;
    letter-spacing: 0;
    text-transform: none;
    display: inline-block;
    white-space: nowrap;
    word-wrap: normal;
    direction: ltr;
    flex: 0 0 24px;
    text-align: center;
    font-feature-settings: "liga";
    -webkit-font-feature-settings: "liga";
    -webkit-font-smoothing: antialiased;
    font-variation-settings:
      "FILL" 0,
      "wght" 400,
      "GRAD" 0,
      "opsz" 24;
  }

  .engine-area {
    flex: 1;
    min-height: 420px;
  }

  :global(.progressive-root) {
    width: 100%;
    gap: var(--size-16);
    pointer-events: auto;
  }

  :global(.progressive-example) {
    width: 100%;
    border: 2px solid #000;
    padding: var(--size-12);
    background: #fff;
    box-sizing: border-box;
    /* No flex gap here: the answer/bank drop containers below must sit flush
       against each other with zero dead space between them, otherwise the
       pointer crosses a "no valid target" strip while dragging between them
       and the ghost gets destroyed/recreated instead of animating smoothly. */
    gap: 0;
    pointer-events: auto;
  }

  .progressive-prompt {
    width: 100%;
    border-bottom: 1px solid #000;
    padding-bottom: var(--size-8);
    margin-bottom: var(--size-12);
    box-sizing: border-box;
  }

  .progressive-prompt span {
    display: block;
    font-size: 14px;
    line-height: 1.35;
  }

  :global(.sentence-answer-line),
  :global(.sentence-bank-line) {
    width: min(520px, 100%);
    min-height: 62px;
    border: 1px dashed #777;
    padding: var(--size-8);
    background: #fafafa;
    box-sizing: border-box;
    gap: var(--size-8);
    align-items: flex-start;
    align-content: flex-start;
    pointer-events: auto;
  }

  :global(.sentence-bank-line) {
    width: min(640px, 100%);
    background: #f2f2f2;
  }

  :global(.sentence-tile-wrapper) {
    padding: 0;
    align-items: stretch;
    justify-content: flex-start;
    cursor: grab;
  }

  :global(.sentence-tile-wrapper:active) {
    cursor: grabbing;
  }

  .sentence-tile {
    border: 2px solid #000;
    background: #fff;
    color: #000;
    min-height: 36px;
    max-width: 240px;
    padding: 0 var(--size-12);
    box-sizing: border-box;
    font-size: 15px;
    line-height: 1.2;
    white-space: normal;
    overflow-wrap: anywhere;
    box-shadow: 0 2px 0 #000;
  }

  .sentence-tile.muted {
    background: #eeeeee;
  }

  :global(.list-panel) {
    min-width: 260px;
    flex: 1 1 0;
    border: 2px solid #000;
    padding: var(--size-12);
    background: #fff;
    box-sizing: border-box;
    pointer-events: auto;
    align-items: stretch;
    gap: var(--size-8);
  }

  .board-frame {
    display: flex;
    width: 100%;
    min-height: 420px;
    pointer-events: auto;
  }

  :global(.board) {
    width: 100%;
    gap: var(--size-12);
    flex-wrap: nowrap;
    align-items: stretch;
    box-sizing: border-box;
    pointer-events: auto;
  }

  .list-header {
    width: 100%;
    border-bottom: 2px solid #000;
    padding-bottom: var(--size-12);
    margin-bottom: var(--size-12);
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-8);
  }

  :global(.task-card) {
    width: 100%;
    align-items: stretch;
    border: 2px solid #000;
    background: #fff;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .task-content {
    display: flex;
    justify-content: space-between;
    align-items: stretch;
    gap: var(--size-10);
    width: 100%;
    padding: var(--size-10) var(--size-12) var(--size-10) var(--size-8);
    box-sizing: border-box;
  }

  :global(.task-drag-handle) {
    width: 28px;
    min-width: 28px;
    margin-right: var(--size-2);
    align-self: stretch;
    border: 1px solid #000;
    background: #f2f2f2;
    color: #111;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    box-sizing: border-box;
    touch-action: none;
    user-select: none;
  }

  :global(.task-drag-handle:active) {
    cursor: grabbing;
    background: #e4e4e4;
  }

  .task-main {
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--size-4);
  }

  .task-main strong,
  .task-main span {
    overflow-wrap: anywhere;
  }

  .task-main span {
    font-size: 13px;
  }

  .card-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: var(--size-4);
    margin-left: auto;
    flex: 0 0 auto;
  }

  .card-actions button:disabled {
    cursor: default;
    opacity: 0.45;
  }

  :global(.ghost) {
    background: #e9e9e9;
    border: 2px solid #777;
    opacity: 1;
  }

  @media (max-width: 700px) {
    .demo-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .section-heading {
      flex-direction: column;
      align-items: flex-start;
    }

    .section-heading p {
      text-align: left;
    }

    h1 {
      font-size: 40px;
    }

    :global(.board) {
      flex-direction: column;
    }
  }
</style>
