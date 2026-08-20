<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { Container, Ghost, Handle, Item } from "@snap-engine/snapsort/svelte";
  import {
    createRenderEntry,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
    type Container as SortContainer,
    type ContainerCallbacks,
    type ItemMoveEvent,
    type RenderEntry,
    type RenderTree,
    type RenderTreeEvent,
  } from "@snap-engine/snapsort";
  import { rejectDrop } from "@snap-engine/snapsort/callbacks";
  import { renderTreeCallbacks } from "../snapsort-render-tree";

  type SidewaysValue = { id: string; slice: number; x: string };
  type NestedValue =
    | { kind: "item"; label: string }
    | { kind: "group" };
  type MultiValue =
    | {
        kind: "column";
        id: string;
        title: string;
        direction: "left" | "right";
        container: SortContainer | null;
      }
    | { kind: "item"; id: string; label: string };
  type MultiColumnEntry = Extract<
    RenderEntry<MultiValue>,
    { isGhost: false }
  > & {
    value: Extract<MultiValue, { kind: "column" }>;
    childTree: RenderTree<MultiValue>;
  };

  const logoSliceCount = 6;
  const logoSliceWidth = 30;
  let sidewaysTree = $state.raw(
    createRenderTree(
      [3, 0, 5, 1, 4, 2].map((slice) => {
        const value: SidewaysValue = {
          id: `typescript-slice-${slice}`,
          slice,
          x: `${slice * -logoSliceWidth}px`,
        };
        return createRenderEntry(value, value.id);
      }),
    ),
  );
  const parentItems = ["Item 1", "Item 2", "Item 3"];
  const gripDots = Array.from({ length: 6 }, (_, index) => index);

  let nestedTree = $state.raw(
    createRenderTree<NestedValue>([
      ...parentItems.map((label) =>
        createRenderEntry<NestedValue>({ kind: "item", label }, label),
      ),
      createRenderEntry<NestedValue>(
        { kind: "group" },
        "nested-group",
        createRenderTree(
          ["Item 4", "Item 5", "Item 6"].map((label) =>
            createRenderEntry<NestedValue>({ kind: "item", label }, label),
          ),
        ),
      ),
    ]),
  );

  let sidewaysSolved = $state(false);
  function createColumn(
    id: string,
    title: string,
    direction: "left" | "right",
    items: readonly { id: string; label: string }[],
  ) {
    return createRenderEntry<MultiValue>(
      { kind: "column", id, title, direction, container: null },
      id,
      createRenderTree(
        items.map((item) =>
          createRenderEntry<MultiValue>({ kind: "item", ...item }, item.id),
        ),
      ),
    );
  }

  let multiTree = $state.raw(
    createRenderTree<MultiValue>([
      createColumn("left", "Left", "right", [
        { id: "mc-spec", label: "Spec" },
        { id: "mc-mockup", label: "Mockup" },
        { id: "mc-build", label: "Build" },
      ]),
      createColumn("right", "Right", "left", [
        { id: "mc-review", label: "Review" },
        { id: "mc-ship", label: "Ship" },
      ]),
    ]),
  );

  function updateSidewaysSolved(element: HTMLElement | null | undefined) {
    const order = Array.from(element?.querySelectorAll(".logo-slice") ?? []).map(
      (slice) => Number((slice as HTMLElement).dataset.slice),
    );
    sidewaysSolved =
      order.length === logoSliceCount &&
      order.every((slice, index) => slice === index);
  }

  function applySidewaysEvent(event: RenderTreeEvent) {
    sidewaysTree = reduceRenderTree(sidewaysTree, event);
  }

  function handleSidewaysMove(event: ItemMoveEvent) {
    applySidewaysEvent(event);
    const containerElement = event.to.container.element;
    requestAnimationFrame(() => updateSidewaysSolved(containerElement));
  }

  function moveItemToOppositeColumn(itemId: string) {
    const columns = multiTree.entries.filter(
      (entry): entry is MultiColumnEntry =>
        !entry.isGhost &&
        entry.value.kind === "column" &&
        entry.childTree !== null,
    );
    const sourceColumnIndex = columns.findIndex((column) =>
      column.childTree?.entries.some(
        (item) => !item.isGhost && item.itemId === itemId,
      ),
    );
    if (sourceColumnIndex === -1) return;

    const targetColumnIndex = sourceColumnIndex === 0 ? 1 : 0;
    const sourceColumn = columns[sourceColumnIndex];
    const targetColumn = columns[targetColumnIndex];
    if (!sourceColumn.childTree || !targetColumn.childTree) return;
    const sourceItemIndex = sourceColumn.childTree.entries.findIndex(
      (item) => !item.isGhost && item.itemId === itemId,
    );
    if (sourceItemIndex === -1) return;
    const sourceContainer = sourceColumn.value.container;
    const targetContainer = targetColumn.value.container;
    if (!sourceContainer || !targetContainer) return;
    const destinationIndex = Math.min(
      sourceItemIndex,
      targetContainer.numberOfItems,
    );
    sourceContainer.moveItem(itemId, targetContainer, destinationIndex);
  }

  const sidewaysCallbacks = {
    ...renderTreeCallbacks(applySidewaysEvent),
    onItemMove: handleSidewaysMove,
  } satisfies ContainerCallbacks;
  const nestedCallbacks = renderTreeCallbacks(
    (event) => (nestedTree = reduceRenderTree(nestedTree, event)),
  );
  const multiCallbacks = {
    ...renderTreeCallbacks(
      (event) => (multiTree = reduceRenderTree(multiTree, event)),
    ),
    canDrop: rejectDrop,
  } satisfies ContainerCallbacks;
</script>

<div class="snapsort-fixture website-core-demo dev-style">
  <div class="website-core-shell">
    <header class="website-core-intro">
      <h1>Versatile and Extensible</h1>
      <p>
        A wide variety of core components are available out of the box to
        provide building blocks for any type of drag and drop UI.
      </p>
    </header>

    <Engine id="snapsort-website-core-demo-canvas">
      <section class="core-demo-grid" aria-label="SnapSort website core demos">
        <article class="core-demo-card" data-demo="sideways-list">
          <h2>Sideways list</h2>
          <div class="core-demo-surface sideways-demo-surface card">
            <Container
              itemId="website-sideways-root"
              className={`sideways-list ${sidewaysSolved ? "solved" : ""}`}
              config={{
                animation: defaultAnimations,
                direction: "row",
                mainAxisAlign: "center",
                callbacks: sidewaysCallbacks,
              }}
            >
              {#each sidewaysTree.entries as entry (entry.itemId)}
                {#if entry.isGhost}
                  <Ghost ghost={entry.ghost} />
                {:else if entry.childTree}
                  <Container itemId={entry.itemId} />
                {:else}
                  <Item itemId={entry.itemId}>
                  <div
                    class="logo-slice"
                    data-slice={entry.value.slice}
                    aria-label="TypeScript logo slice {entry.value.slice + 1} of {logoSliceCount}"
                    style={`--slice-x: ${entry.value.x};`}
                  ></div>
                </Item>
                {/if}
              {/each}
            </Container>
          </div>
        </article>

        <article class="core-demo-card" data-demo="nested-list">
          <h2>Nested list</h2>
          <div class="core-demo-surface card">
            <Container
              itemId="website-nested-root"
              className="basic-list bounded-demo-list"
              config={{
                animation: defaultAnimations,
                direction: "column",
                callbacks: nestedCallbacks,
              }}
              metadata={{ list: "outer" }}
            >
              {#each nestedTree.entries as entry (entry.itemId)}
                {#if entry.isGhost}
                  <Ghost ghost={entry.ghost} />
                {:else if entry.childTree}
                  <Container
                    itemId={entry.itemId}
                    className="nested-list bounded-demo-list card shallow"
                    config={{ animation: defaultAnimations, direction: "column" }}
                    metadata={{ list: "inner" }}
                    locked={false}
                  >
                    <Handle className="demo-container-handle">
                      <span class="demo-grip" aria-hidden="true">
                        {#each gripDots as dot}
                          <span data-dot={dot}></span>
                        {/each}
                      </span>
                    </Handle>
                    {#each entry.childTree.entries as child (child.itemId)}
                      {#if child.isGhost}
                        <Ghost ghost={child.ghost} />
                      {:else if child.childTree}
                        <Container itemId={child.itemId} />
                      {:else if child.value.kind === "item"}
                        <Item itemId={child.itemId}>
                          <div class="basic-row nested-row handle-row">
                            <Handle className="demo-row-handle">
                              <span class="demo-grip" aria-hidden="true">
                                {#each gripDots as dot}
                                  <span data-dot={dot}></span>
                                {/each}
                              </span>
                            </Handle>
                            <span>{child.value.label}</span>
                          </div>
                        </Item>
                      {/if}
                    {/each}
                  </Container>
                {:else if entry.value.kind === "item"}
                  <Item itemId={entry.itemId}>
                    <div class="basic-row handle-row">
                      <Handle className="demo-row-handle">
                        <span class="demo-grip" aria-hidden="true">
                          {#each gripDots as dot}
                            <span data-dot={dot}></span>
                          {/each}
                        </span>
                      </Handle>
                      <span>{entry.value.label}</span>
                    </div>
                  </Item>
                {/if}
              {/each}
            </Container>
          </div>
        </article>

        <article class="core-demo-card" data-demo="multiple-containers">
          <h2>Multiple containers</h2>
          <div class="core-demo-surface multi-container-surface">
            <Container
              itemId="website-multi-root"
              className="multi-container-board"
              config={{
                animation: defaultAnimations,
                direction: "row",
                name: "core-multi-root",
                callbacks: multiCallbacks,
              }}
              locked={true}
            >
              {#each multiTree.entries as entry (entry.itemId)}
                {#if entry.isGhost}
                  <Ghost ghost={entry.ghost} />
                {:else if entry.childTree && entry.value.kind === "column"}
                  {@const column = entry.value}
                <Container
                  itemId={entry.itemId}
                  bind:container={column.container}
                  className="basic-column card"
                  metadata={{ columnId: column.id }}
                  config={{
                    animation: defaultAnimations,
                    direction: "column",
                    name: column.id,
                  }}
                  locked={true}
                >
                  <h3>{column.title}</h3>
                  {#each entry.childTree.entries as child (child.itemId)}
                    {#if child.isGhost}
                      <Ghost ghost={child.ghost} />
                    {:else if child.childTree}
                      <Container itemId={child.itemId} />
                    {:else if child.value.kind === "item"}
                      <Item itemId={child.itemId}>
                      <div class="basic-row compact-row multi-container-row">
                        <span>{child.value.label}</span>
                        <button
                          class="column-move-button"
                          type="button"
                          aria-label="Move {child.value.label} to the other column"
                          onpointerdown={(event) => event.stopPropagation()}
                          onclick={(event) => {
                            event.stopPropagation();
                            moveItemToOppositeColumn(child.value.id);
                          }}
                        >
                          {column.direction === "right" ? ">" : "<"}
                        </button>
                      </div>
                    </Item>
                    {/if}
                  {/each}
                </Container>
                {:else if entry.value.kind === "item"}
                  <Item itemId={entry.itemId}>
                    <div class="basic-row compact-row multi-container-row">
                      <span>{entry.value.label}</span>
                    </div>
                  </Item>
                {/if}
              {/each}
            </Container>
          </div>
        </article>
      </section>
    </Engine>
  </div>
</div>

<style>
  .website-core-demo {
    width: 100%;
    min-height: 100vh;
    overflow: auto;
    background: #ffffff;
    padding: 48px;
    color: #24272d;
    user-select: none;
  }

  .website-core-demo * {
    box-sizing: border-box;
    user-select: none;
  }

  .website-core-shell {
    width: min(980px, 100%);
    margin: 0 auto;
  }

  .website-core-intro {
    width: min(720px, 100%);
    margin: 0 auto 32px;
    text-align: center;
  }

  .website-core-intro h1 {
    margin: 0 0 12px;
    color: #15171b;
    font-family: "Geist", "Inter", sans-serif;
    font-size: 40px;
    font-weight: 650;
    line-height: 1.05;
  }

  .website-core-intro p {
    margin: 0;
    color: #5c636d;
    font-family: "Geist", "Inter", sans-serif;
    font-size: 17px;
    line-height: 1.45;
  }

  .core-demo-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(300px, 1fr));
    gap: 24px;
    align-items: start;
    pointer-events: auto;
  }

  .core-demo-card {
    min-height: 420px;
    border-radius: 24px;
    background: #f4f6f6;
    padding: 32px;
  }

  .core-demo-card h2 {
    margin: 0 0 28px;
    color: rgba(38, 42, 48, 0.7);
    font-family: "Bitcount Grid Single", "IBM Plex Mono", monospace;
    font-size: 28px;
    font-weight: 420;
    line-height: 1.1;
  }

  .card {
    border: 1px solid rgba(18, 20, 23, 0.08);
    border-radius: 12px;
    background: #ffffff;
    box-shadow: 0 2px 8px rgba(18, 20, 23, 0.06);
  }

  .shallow {
    box-shadow: 0 1px 4px rgba(18, 20, 23, 0.04);
  }

  .core-demo-surface {
    min-height: 280px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 28px;
  }

  .multi-container-surface {
    /* Sized so each flex: 1 1 0 column renders at ~321px, matching the
       website geometry where the engine/DOM wrap mismatch occurs. The 321px
       is the COLUMN width, not the board width. */
    width: 648px;
    min-width: 648px;
    max-width: 648px;
    min-height: 260px;
    align-items: stretch;
    padding: 0;
  }

  .sideways-demo-surface {
    min-height: 260px;
    overflow: hidden;
  }

  :global(.website-core-demo .snapsort-container) {
    gap: 0.35rem;
  }

  :global(.website-core-demo .snapsort-item) {
    align-items: stretch;
    padding: 0;
  }

  :global(.website-core-demo .ghost) {
    border: 1px dashed rgba(255, 138, 0, 0.58);
    border-radius: 6px;
    background: rgba(255, 138, 0, 0.14);
    box-sizing: border-box;
    opacity: 1;
  }

  :global(.website-core-demo .basic-list),
  :global(.website-core-demo .sideways-list),
  :global(.website-core-demo .multi-container-board) {
    flex: 1;
    min-height: 0;
  }

  :global(.website-core-demo .basic-list > .snapsort-item),
  :global(.website-core-demo .nested-list > .snapsort-item) {
    align-items: stretch;
    width: 100%;
    max-width: 100%;
    min-width: 0;
  }

  :global(.website-core-demo .bounded-demo-list) {
    align-items: stretch;
    width: 100%;
    max-width: 100%;
    min-width: 0;
  }

  .basic-row {
    width: 100%;
    min-height: 36px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    justify-content: flex-start;
    gap: 10px;
    border: 1px solid rgba(18, 20, 23, 0.1);
    border-radius: 8px;
    background: #ffffff;
    padding: 5px 10px 6px;
    color: #2e333a;
    font-family: "Bitcount Grid Single", "IBM Plex Mono", monospace;
    font-size: 16px;
    font-weight: 440;
    line-height: 1.1;
  }

  .nested-row {
    background: #fbfbfb;
  }

  .compact-row {
    min-height: 26px;
    padding: 5px 8px 4px;
    font-size: 13px;
  }

  .multi-container-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 7px;
  }

  .multi-container-row span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .column-move-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    min-width: 22px;
    height: 22px;
    min-height: 22px;
    padding: 0;
    border: 1px solid rgba(18, 20, 23, 0.08);
    border-radius: 4px;
    background: #f5f6f6;
    color: #333637;
    box-shadow: none;
    font-family: "Geist Mono", "IBM Plex Mono", monospace;
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    pointer-events: auto;
    touch-action: manipulation;
  }

  .demo-row-handle,
  .demo-container-handle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 22px;
    cursor: grab;
  }

  .demo-container-handle {
    position: absolute;
    top: 13px;
    left: 10px;
  }

  .demo-grip {
    display: grid;
    grid-template-columns: repeat(2, 3px);
    gap: 3px;
  }

  .demo-grip span {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: rgba(46, 51, 58, 0.32);
  }

  :global(.website-core-demo .nested-list) {
    position: relative;
    width: calc(100% - 0.75rem);
    margin-left: 0.75rem;
    padding: 12px 12px 12px 36px;
  }

  :global(.website-core-demo .sideways-list) {
    align-items: center !important;
    justify-content: center;
    align-content: center;
    width: 100%;
    gap: 0.35rem;
  }

  :global(.website-core-demo .sideways-list > .snapsort-item) {
    margin-inline: 0.04rem;
  }

  :global(.website-core-demo .sideways-list.solved > .snapsort-item) {
    pointer-events: none;
  }

  :global(.website-core-demo .multi-container-board) {
    align-items: stretch;
    flex-wrap: wrap;
    width: 100%;
    /* Fractional rem padding (5.6px, not 1/64px-representable) mirrors the
       website's rem-based spacing. Chromium snaps layout to 1/64px but
       reports the specified value via getComputedStyle, which is the
       engine/DOM wrap-parity trap this fixture reproduces. */
    padding: 0.35rem;
  }

  :global(.website-core-demo .basic-column) {
    flex: 1 1 0;
    min-width: 0;
    padding: 12px;
    align-items: stretch;
  }

  :global(
    .website-core-demo
      .multi-container-board
      > .basic-column:has(> .snapsort-item[data-snapsort-dragging="true"])
  ) {
    z-index: 2;
  }

  :global(.website-core-demo .basic-column) h3 {
    margin: 0 0 8px;
    color: #697074;
    font-family: "Geist", "Inter", sans-serif;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .logo-slice {
    width: 30px;
    height: 180px;
    border-radius: 4px;
    background-image: url("/typescript.svg");
    background-position: var(--slice-x) 0;
    background-repeat: no-repeat;
    background-size: 180px 180px;
    cursor: grab;
  }

  @media (max-width: 760px) {
    .website-core-demo {
      padding: 28px 18px;
    }

    .core-demo-grid {
      grid-template-columns: 1fr;
    }

    .core-demo-card {
      padding: 24px;
    }
  }
</style>
