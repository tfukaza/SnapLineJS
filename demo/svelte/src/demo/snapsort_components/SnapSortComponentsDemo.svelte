<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import SnapSortDuolingoDemo from "../snapsort_duolingo/SnapSortDuolingoDemo.svelte";
  import ItemApiFixture from "./ItemApiFixture.svelte";
  import { Container, Ghost, Handle, Item } from "@snap-engine/snapsort/svelte";
  import {
    prioritizeIntersectingContainer,
    rejectDrop,
  } from "@snap-engine/snapsort/callbacks";
  import type {
    CanDropEvent,
    Container as SortContainer,
    GhostInsertEvent,
    ItemMoveEvent,
    ItemRemoveEvent,
  } from "@snap-engine/snapsort";

  type DemoItem = {
    id: string;
    label: string;
    detail: string;
  };

  type DemoColumn = {
    id: string;
    title: string;
    items: DemoItem[];
    container?: SortContainer;
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
  const progressiveZones: ProgressiveZone[] = ["answer", "bank"];

  function hasMatchingDropGroup(event: CanDropEvent): boolean {
    const sourceGroup = event.source?.containerMetadata.dropGroup;
    return sourceGroup !== undefined && sourceGroup === event.containerMetadata.dropGroup;
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

  let progressiveExamples: ProgressiveExample[] = $state([
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
  ]);

  let nextItemNumber = $state(7);
  let columns = $state<DemoColumn[]>(structuredClone(initialColumns));
  let boardVersion = $state(0);
  let itemCount = $derived(
    columns.reduce((total, column) => total + column.items.length, 0),
  );

  function cloneInitialColumns() {
    return structuredClone(initialColumns);
  }

  function handleProgressiveMove(event: ItemMoveEvent) {
    const exampleId = event.to.containerMetadata.exampleId;
    const targetZone = event.to.containerMetadata.zone;
    if (
      typeof exampleId !== "string" ||
      (targetZone !== "answer" && targetZone !== "bank")
    ) return;

    progressiveExamples = progressiveExamples.map((example) => {
      if (example.id !== exampleId) return example;
      const moved = [...example.answerTiles, ...example.bankTiles].find(
        (tile) => tile.id === event.itemId,
      );
      if (!moved) return example;
      const answerTiles = example.answerTiles.filter((tile) => tile.id !== event.itemId);
      const bankTiles = example.bankTiles.filter((tile) => tile.id !== event.itemId);
      const target = targetZone === "answer" ? answerTiles : bankTiles;
      target.splice(Math.max(0, Math.min(event.to.index, target.length)), 0, moved);
      return { ...example, answerTiles, bankTiles };
    });
  }

  function createItem(): DemoItem {
    const itemNumber = nextItemNumber++;
    return {
      id: `item-${itemNumber}`,
      label: `Task ${itemNumber}`,
      detail: "Added from array state",
    };
  }

  function addItem() {
    columns = columns.map((column, index) =>
      index === 0
        ? { ...column, items: [...column.items, createItem()] }
        : column,
    );
  }

  function deleteItem(itemId: string) {
    columns = columns.map((column) => ({
      ...column,
      items: column.items.filter((item) => item.id !== itemId),
    }));
  }

  function moveItemAcrossColumns(itemId: string, direction: -1 | 1) {
    const sourceColumnIndex = columns.findIndex((column) =>
      column.items.some((item) => item.id === itemId),
    );
    if (sourceColumnIndex === -1) return;

    const targetColumnIndex = sourceColumnIndex + direction;
    if (targetColumnIndex < 0 || targetColumnIndex >= columns.length) return;

    const sourceItemIndex = columns[sourceColumnIndex].items.findIndex(
      (item) => item.id === itemId,
    );
    if (sourceItemIndex === -1) return;

    const sourceContainer = columns[sourceColumnIndex].container;
    const targetContainer = columns[targetColumnIndex].container;
    if (!sourceContainer || !targetContainer) return;

    const destinationIndex = Math.min(
      sourceItemIndex,
      columns[targetColumnIndex].items.length,
    );
    const movedBySnapSort = sourceContainer.moveItem(
      itemId,
      targetContainer,
      destinationIndex,
    );
    if (movedBySnapSort) return;

    const movedItem = columns[sourceColumnIndex].items[sourceItemIndex];
    columns = columns.map((column, columnIndex) => {
      if (columnIndex === sourceColumnIndex) {
        return {
          ...column,
          items: column.items.filter((item) => item.id !== itemId),
        };
      }

      if (columnIndex === targetColumnIndex) {
        const nextItems = column.items.slice();
        nextItems.splice(destinationIndex, 0, movedItem);
        return { ...column, items: nextItems };
      }

      return column;
    });
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
    columns = cloneInitialColumns();
    boardVersion += 1;
  }

  function findDemoItem(itemId: string | undefined) {
    if (!itemId) return null;
    for (const column of columns) {
      const item = column.items.find((candidate) => candidate.id === itemId);
      if (item) return item;
    }
    return null;
  }

  /** Ghost snippet content: looks up the dragged item's label/detail via its itemId. */
  function ghostItemContent(event: GhostInsertEvent): DemoItem | null {
    const itemId = event.originalItemId;
    return typeof itemId === "string" ? findDemoItem(itemId) : null;
  }

  function handleSnapSortDomMove(event: ItemMoveEvent) {
    const itemId = event.itemId;
    if (typeof itemId !== "string") return;
    const targetColumnId = event.to.containerMetadata.columnId;
    if (typeof targetColumnId !== "string") return;

    let movedItem: DemoItem | null = null;
    const withoutMovedItem = columns.map((column) => {
      const sourceIndex = column.items.findIndex((item) => item.id === itemId);
      if (sourceIndex === -1) return column;

      const nextItems = column.items.slice();
      const [item] = nextItems.splice(sourceIndex, 1);
      movedItem = item;
      return { ...column, items: nextItems };
    });

    if (!movedItem) {
      const label = event.itemMetadata.label;
      const detail = event.itemMetadata.detail;
      if (typeof label !== "string" || typeof detail !== "string") return;
      movedItem = { id: itemId, label, detail };
    }

    columns = withoutMovedItem.map((column) => {
      if (column.id !== targetColumnId) return column;

      const nextItems = column.items.slice();
      const destinationIndex = Math.max(
        0,
        Math.min(event.to.index, nextItems.length),
      );
      nextItems.splice(destinationIndex, 0, movedItem);
      return { ...column, items: nextItems };
    });
  }

  function handleSnapSortDomRemove(event: ItemRemoveEvent) {
    const itemId = event.itemId;
    if (typeof itemId !== "string") return;

    deleteItem(itemId);
  }

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
                className="board"
                config={{
                  direction: "row",
                  name: "component-kanban-root",
                  callbacks: { canDrop: rejectDrop },
                }}
                locked={true}
                metadata={{ boardId: "component-kanban" }}
                items={columns}
                getItemId={(column) => column.id}
              >
                {#snippet entry(column)}
                  <Container
                    itemId={column.id}
                    className={column.id === "backlog" ? "list-panel array-list" : "list-panel"}
                    bind:container={column.container}
                    config={{
                      direction: "column",
                      name: `component-${column.id}`,
                      animation: {
                        reorder: snapSortCubicAnimation,
                        drop: snapSortCubicAnimation,
                        move: snapSortCubicAnimation,
                      },
                      callbacks: {
                        onItemMove: handleSnapSortDomMove,
                        onItemRemove: handleSnapSortDomRemove,
                      },
                    }}
                    locked={true}
                    metadata={{ columnId: column.id }}
                    items={column.items}
                    getItemId={(item) => item.id}
                  >
                    {#snippet before()}
                      <div class="list-header">
                        <h2>{column.title}</h2>
                        <span>{column.items.length}</span>
                      </div>
                    {/snippet}
                    {#snippet entry(entry)}
                      <Item itemId={entry.id} className="task-card" metadata={{ label: entry.label, detail: entry.detail }}>
                        <div class="task-content">
                          <Handle className="task-drag-handle">
                            <span class="material-symbols-outlined" aria-hidden="true">drag_indicator</span>
                          </Handle>
                          <div class="task-main">
                            <strong>{entry.label}</strong>
                            <span>{entry.detail}</span>
                          </div>
                          <div class="card-actions">
                            <button
                              class="icon-button"
                              aria-label={`Delete ${entry.label}`}
                              use:controlButton={() => deleteItem(entry.id)}
                            ><span class="material-symbols-outlined" aria-hidden="true">delete</span></button>
                            <button
                              class="icon-button"
                              aria-label={`Move ${entry.label} left`}
                              disabled={columns.findIndex((candidate) => candidate.id === column.id) === 0}
                              use:controlButton={() => moveItemAcrossColumns(entry.id, -1)}
                            ><span class="material-symbols-outlined" aria-hidden="true">arrow_left_alt</span></button>
                            <button
                              class="icon-button"
                              aria-label={`Move ${entry.label} right`}
                              disabled={columns.findIndex((candidate) => candidate.id === column.id) === columns.length - 1}
                              use:controlButton={() => moveItemAcrossColumns(entry.id, 1)}
                            ><span class="material-symbols-outlined" aria-hidden="true">arrow_right_alt</span></button>
                          </div>
                        </div>
                      </Item>
                    {/snippet}
                    {#snippet ghost(event)}
                      <Ghost {event}>
                        <div class="task-content">
                          <div class="task-main">
                            <strong>{ghostItemContent(event)?.label ?? ""}</strong>
                            <span>{ghostItemContent(event)?.detail ?? ""}</span>
                          </div>
                        </div>
                      </Ghost>
                    {/snippet}
                  </Container>
                {/snippet}
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
          className="progressive-root"
          config={{
            mode: "progressive",
            direction: "column",
            name: "progressive-components-root",
            callbacks: { canDrop: rejectDrop },
          }}
          locked={true}
          metadata={{ boardId: "progressive-components" }}
          items={progressiveExamples}
          getItemId={(example) => example.id}
        >
          {#snippet entry(example)}
            <Container
              itemId={example.id}
              className="progressive-example"
              config={{
                mode: "progressive",
                direction: "column",
                name: `progressive-example-${example.id}`,
                callbacks: { canDrop: rejectDrop },
              }}
              locked={true}
              metadata={{ exampleId: example.id }}
              items={progressiveZones}
              getItemId={(zone) => `${example.id}-${zone}`}
            >
              {#snippet before()}
                <div class="progressive-prompt">
                  <span>{example.prompt}</span>
                </div>
              {/snippet}

              {#snippet entry(zone)}
                {#if zone === "answer"}
                  <Container
                    itemId={`${example.id}-answer`}
                    className="sentence-answer-line"
                    config={{
                      mode: "progressive",
                      direction: "row",
                      name: `progressive-answer-${example.id}`,
                      gap: 8,
                      animation: {
                        reorder: snapSortCubicAnimation,
                        drop: snapSortCubicAnimation,
                      },
                      callbacks: {
                        canDrop: hasMatchingDropGroup,
                        getDropPriority: prioritizeIntersectingContainer,
                        onItemMove: handleProgressiveMove,
                      },
                    }}
                    locked={true}
                    metadata={{
                      zone: "answer",
                      exampleId: example.id,
                      dropGroup: `progressive-${example.id}`,
                    }}
                    items={example.answerTiles}
                    getItemId={(tile) => tile.id}
                  >
                    {#snippet entry(tile)}
                      <Item itemId={tile.id} className="sentence-tile-wrapper">
                        <button type="button" class="sentence-tile">{tile.text}</button>
                      </Item>
                    {/snippet}
                  </Container>
                {:else}
                  <Container
                    itemId={`${example.id}-bank`}
                    className="sentence-bank-line"
                    config={{
                      mode: "progressive",
                      direction: "row",
                      name: `progressive-bank-${example.id}`,
                      gap: 8,
                      animation: {
                        reorder: snapSortCubicAnimation,
                        drop: snapSortCubicAnimation,
                      },
                      callbacks: {
                        canDrop: hasMatchingDropGroup,
                        getDropPriority: prioritizeIntersectingContainer,
                        onItemMove: handleProgressiveMove,
                      },
                    }}
                    locked={true}
                    metadata={{
                      zone: "bank",
                      exampleId: example.id,
                      dropGroup: `progressive-${example.id}`,
                    }}
                    items={example.bankTiles}
                    getItemId={(tile) => tile.id}
                  >
                    {#snippet entry(tile)}
                      <Item itemId={tile.id} className="sentence-tile-wrapper">
                        <button type="button" class="sentence-tile muted">{tile.text}</button>
                      </Item>
                    {/snippet}
                  </Container>
                {/if}
              {/snippet}
            </Container>
          {/snippet}
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
