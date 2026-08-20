<script lang="ts">
  import SeoHead from "$lib/components/SeoHead.svelte";
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";
  import {
    createRenderEntries,
    createRenderEntry,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
    stockInsertionMarkerRectOptions,
  } from "@snap-engine/snapsort";
  import type {
    ContainerCallbacks,
    GhostState,
    RenderTreeEvent,
  } from "@snap-engine/snapsort";

  type Todo = { id: string; label: string; done: boolean };
  type SidewaysCard = { id: string; label: string; number: string };
  type SwapTile = { id: string; label: string; color: string };
  type NestedEntry =
    | { kind: "item"; id: string; label: string }
    | { kind: "group"; id: "planning" };

  type ReducerCallbacks = Pick<
    ContainerCallbacks,
    | "onItemMove"
    | "onItemRemove"
    | "onItemSwap"
    | "onGhostInsert"
    | "onGhostMove"
    | "onGhostRemove"
  >;

  function renderTreeCallbacks(
    apply: (event: RenderTreeEvent) => void,
  ): ReducerCallbacks {
    return {
      onItemMove: apply,
      onItemRemove: apply,
      onItemSwap: apply,
      onGhostInsert: apply,
      onGhostMove: apply,
      onGhostRemove: apply,
    };
  }

  function createList<T>(
    values: readonly T[],
    getId: (value: T) => string,
  ) {
    return createRenderTree(createRenderEntries(values, getId));
  }

  let todo = $state.raw(
    createList(
      [
        { id: "todo-brief", label: "Write the brief", done: true },
        { id: "todo-wireframe", label: "Sketch the flow", done: false },
        { id: "todo-prototype", label: "Build prototype", done: false },
        { id: "todo-share", label: "Share with the team", done: false },
      ] satisfies Todo[],
      (item) => item.id,
    ),
  );

  let sideways = $state.raw(
    createList(
      [
        { id: "side-discover", label: "Discover", number: "01" },
        { id: "side-design", label: "Design", number: "02" },
        { id: "side-build", label: "Build", number: "03" },
        { id: "side-ship", label: "Ship", number: "04" },
      ] satisfies SidewaysCard[],
      (item) => item.id,
    ),
  );

  let nested = $state.raw(
    createRenderTree<NestedEntry>([
      createRenderEntry({ kind: "item", id: "inbox", label: "Inbox" }, "inbox"),
      createRenderEntry(
        { kind: "group", id: "planning" },
        "planning",
        createList<NestedEntry>(
          [
            { kind: "item", id: "research", label: "Research" },
            { kind: "item", id: "wireframes", label: "Wireframes" },
            { kind: "item", id: "review", label: "Review" },
          ],
          (item) => item.id,
        ),
      ),
      createRenderEntry(
        { kind: "item", id: "archive", label: "Archive" },
        "archive",
      ),
    ]),
  );

  let swap = $state.raw(
    createList(
      [
        { id: "swap-a", label: "A", color: "orange" },
        { id: "swap-b", label: "B", color: "pink" },
        { id: "swap-c", label: "C", color: "yellow" },
        { id: "swap-d", label: "D", color: "blue" },
        { id: "swap-e", label: "E", color: "green" },
        { id: "swap-f", label: "F", color: "purple" },
      ] satisfies SwapTile[],
      (item) => item.id,
    ),
  );

  const todoCallbacks = renderTreeCallbacks((event) => {
    todo = reduceRenderTree(todo, event);
  });
  const sidewaysCallbacks = renderTreeCallbacks((event) => {
    sideways = reduceRenderTree(sideways, event);
  });
  const nestedCallbacks = renderTreeCallbacks((event) => {
    nested = reduceRenderTree(nested, event);
  });
  const swapCallbacks = renderTreeCallbacks((event) => {
    swap = reduceRenderTree(swap, event);
  });

  function swapTileForGhost(ghost: GhostState) {
    const entry = swap.entries.find(
      (candidate) => candidate.itemId === ghost.originalItemId,
    );
    return entry && !entry.isGhost ? entry.value : undefined;
  }
</script>

<SeoHead
  title="SnapSort Photo Op"
  description="Square-format interactive SnapSort demos."
  path="/snapsort/photo-op"
  imageAlt="Four square SnapSort drag-and-drop demos"
/>

<svelte:head>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="photo-op-page">
  <header class="page-heading">
    <p class="eyebrow">SnapSort / Photo op</p>
    <h1>Drag. Drop. Done.</h1>
    <p>Four square interaction demos, ready to capture.</p>
  </header>

  <Engine id="snapsort-photo-op" className="photo-engine">
    <section class="demo-list" aria-label="SnapSort square demos">
      <article class="demo-square" data-photo-op="todo-list">
        <header class="demo-heading">
          <div>
            <span>01</span>
            <h2>To-do list</h2>
          </div>
          <p>Drag to reorder</p>
        </header>
        <div class="demo-stage todo-stage">
          <Container
            itemId="photo-op-todo-root"
            className="todo-list"
            config={{
              animation: defaultAnimations,
              direction: "column",
              callbacks: todoCallbacks,
            }}
            data-demo="todo-list"
          >
            {#each todo.entries as entry (entry.itemId)}
              {#if entry.isGhost}
                <Ghost ghost={entry.ghost} />
              {:else}
                <Item itemId={entry.itemId}>
                  <div class="todo-row">
                    <span
                      class:checked={entry.value.done}
                      class="check"
                      aria-hidden="true"
                    >
                      {entry.value.done ? "✓" : ""}
                    </span>
                    <span>{entry.value.label}</span>
                    <span class="grip" aria-hidden="true"
                      ><i></i><i></i><i></i><i></i><i></i><i></i></span
                    >
                  </div>
                </Item>
              {/if}
            {/each}
          </Container>
        </div>
        <footer><span>SNAPSORT</span><span>EUCLIDEAN</span></footer>
      </article>

      <article class="demo-square" data-photo-op="nested-containers">
        <header class="demo-heading">
          <div>
            <span>02</span>
            <h2>Nested containers</h2>
          </div>
          <p>Move between levels</p>
        </header>
        <div class="demo-stage nested-stage">
          <Container
            itemId="photo-op-nested-root"
            className="nested-root"
            metadata={{ listId: "root" }}
            config={{
              animation: defaultAnimations,
              direction: "column",
              callbacks: nestedCallbacks,
            }}
            data-demo="nested-containers"
          >
            {#each nested.entries as entry (entry.itemId)}
              {#if entry.isGhost}
                <Ghost ghost={entry.ghost} />
              {:else if !entry.childTree && entry.value.kind === "item"}
                <Item itemId={entry.itemId}>
                  <div class="file-row">
                    <span class="file-icon">•</span>
                    <span>{entry.value.label}</span>
                    <span class="grip" aria-hidden="true"
                      ><i></i><i></i><i></i><i></i><i></i><i></i></span
                    >
                  </div>
                </Item>
              {:else if entry.childTree}
                <Container
                  itemId={entry.itemId}
                  locked={true}
                  className="nested-child"
                  metadata={{ listId: "planning" }}
                  config={{ animation: defaultAnimations, direction: "column" }}
                >
                  <div class="folder-heading">
                    <span>⌄</span><strong>Planning</strong>
                  </div>
                  {#each entry.childTree.entries as childEntry (childEntry.itemId)}
                    {#if childEntry.isGhost}
                      <Ghost ghost={childEntry.ghost} />
                    {:else if childEntry.value.kind === "item"}
                      <Item itemId={childEntry.itemId}>
                        <div class="file-row child-row">
                          <span class="file-icon">•</span>
                          <span>{childEntry.value.label}</span>
                          <span class="grip" aria-hidden="true"
                            ><i></i><i></i><i></i><i></i><i></i><i></i></span
                          >
                        </div>
                      </Item>
                    {/if}
                  {/each}
                </Container>
              {/if}
            {/each}
          </Container>
        </div>
        <footer><span>SNAPSORT</span><span>NESTED</span></footer>
      </article>

      <article class="demo-square" data-photo-op="sideways-insert">
        <header class="demo-heading">
          <div>
            <span>03</span>
            <h2>Sideways insert</h2>
          </div>
          <p>Place between cards</p>
        </header>
        <div class="demo-stage sideways-stage">
          <Container
            itemId="photo-op-sideways-root"
            className="sideways-list"
            config={{
              animation: defaultAnimations,
              mode: "insertion",
              direction: "row",
              callbacks: sidewaysCallbacks,
            }}
            data-demo="sideways-insert"
          >
            {#each sideways.entries as entry (entry.itemId)}
              {#if entry.isGhost}
                <Ghost
                  ghost={entry.ghost}
                  insertionMarker={stockInsertionMarkerRectOptions}
                  style="color:var(--color-primary);"
                />
              {:else}
                <Item itemId={entry.itemId}>
                  <div class="side-card">
                    <span>{entry.value.number}</span>
                    <strong>{entry.value.label}</strong>
                    <span class="side-arrow">→</span>
                  </div>
                </Item>
              {/if}
            {/each}
          </Container>
        </div>
        <footer><span>SNAPSORT</span><span>INSERTION / ROW</span></footer>
      </article>

      <article class="demo-square" data-photo-op="swap-mode">
        <header class="demo-heading">
          <div>
            <span>04</span>
            <h2>Swap mode</h2>
          </div>
          <p>Drop onto a tile</p>
        </header>
        <div class="demo-stage swap-stage">
          <Container
            itemId="photo-op-swap-root"
            className="swap-grid"
            config={{
              animation: defaultAnimations,
              mode: "swap",
              direction: "row",
              callbacks: swapCallbacks,
            }}
            data-demo="swap-mode"
          >
            {#each swap.entries as entry (entry.itemId)}
              {#if entry.isGhost}
                {@const ghostTile = swapTileForGhost(entry.ghost)}
                <Ghost ghost={entry.ghost} className="swap-ghost">
                  {#if entry.ghost.type === "pointer-preview" && ghostTile}
                    <div class="swap-tile {ghostTile.color}">
                      {ghostTile.label}
                    </div>
                  {/if}
                </Ghost>
              {:else}
                <Item itemId={entry.itemId} metadata={{ label: entry.value.label }}>
                  <div class="swap-tile {entry.value.color}">
                    {entry.value.label}
                  </div>
                </Item>
              {/if}
            {/each}
          </Container>
        </div>
        <footer><span>SNAPSORT</span><span>SWAP</span></footer>
      </article>
    </section>
  </Engine>
</main>

<style>
  .photo-op-page {
    min-height: 100vh;
    padding: clamp(6rem, 10vw, 9rem) var(--size-24) var(--size-96);
    box-sizing: border-box;
  }

  .page-heading {
    width: min(100%, 760px);
    margin: 0 auto clamp(3rem, 7vw, 5rem);
  }

  .page-heading h1,
  .page-heading p {
    margin: 0;
  }

  .page-heading h1 {
    margin: var(--size-8) 0 var(--size-16);
    font-size: clamp(3rem, 8vw, 5.5rem);
  }

  .page-heading > p:last-child {
    color: var(--color-text-muted);
  }

  .eyebrow,
  .demo-heading > p,
  .demo-square footer {
    font-family: var(--font-code);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .eyebrow {
    color: var(--color-primary);
  }

  :global(.photo-engine) {
    height: auto !important;
  }

  .demo-list {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: clamp(3rem, 8vw, 6rem);
    justify-items: center;
    width: 100%;
  }

  .demo-square {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    width: min(100%, 760px);
    aspect-ratio: 1;
    overflow: hidden;
    box-sizing: border-box;
    border: 1px solid
      color-mix(in srgb, var(--color-background-dark) 25%, transparent);
    background: var(--color-background);
  }

  .demo-heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--size-16);
    padding: 7% 7% 4%;
  }

  .demo-heading > div {
    display: flex;
    align-items: baseline;
    gap: var(--size-16);
  }
  .demo-heading span {
    color: var(--color-primary);
    font-family: var(--font-code);
    font-size: 0.78rem;
  }
  .demo-heading h2 {
    margin: 0;
    font-family: var(--font-body);
    font-size: clamp(1.55rem, 4vw, 2.5rem);
  }
  .demo-heading > p {
    margin: 0 0 0.25rem;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .demo-stage {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    margin: 0 7%;
    padding: 6%;
    box-sizing: border-box;
    border-radius: var(--size-8);
    background: var(--color-background-tint);
  }

  .demo-square footer {
    display: flex;
    justify-content: space-between;
    padding: 3.5% 7% 4.5%;
    color: var(--color-text-subtle);
  }

  .demo-square footer span:first-child {
    color: var(--color-primary);
  }

  :global(.photo-engine .snapsort-item) {
    padding: var(--size-4);
    user-select: none;
    touch-action: none;
  }
  :global(
      .photo-engine
        .snapsort-ghost:not([data-snapsort-ghost="pointer"]):not(
          [data-snapsort-ghost="insertion"]
        )
    ) {
    border-radius: var(--size-8);
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    outline: 1px dashed
      color-mix(in srgb, var(--color-primary) 55%, transparent);
  }

  :global(.todo-list),
  :global(.nested-root) {
    width: min(100%, 430px);
  }

  .todo-row,
  .file-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--size-16);
    width: 100%;
    min-height: 58px;
    padding: 0 var(--size-20);
    box-sizing: border-box;
    border: 1px solid
      color-mix(in srgb, var(--color-background-dark) 24%, transparent);
    border-radius: var(--size-8);
    background: var(--color-background);
    box-shadow: 0 3px 10px rgb(36 38 39 / 5%);
    color: var(--color-text);
  }

  :global(.todo-list > .snapsort-item),
  :global(.nested-root > .snapsort-item),
  :global(.nested-child > .snapsort-item) {
    width: 100%;
    align-items: stretch;
  }

  .check {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border: 1.5px solid var(--color-background-dark);
    border-radius: 50%;
    color: var(--color-background);
    font-size: 0.72rem;
  }

  .check.checked {
    border-color: var(--color-primary);
    background: var(--color-primary);
  }

  .grip {
    display: grid;
    grid-template-columns: repeat(2, 3px);
    gap: 3px;
    opacity: 0.42;
  }
  .grip i {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: currentColor;
  }

  .nested-stage {
    padding-block: 4%;
  }
  :global(.nested-root) {
    align-content: center;
  }
  :global(.nested-child) {
    width: calc(100% - 8px);
    margin: var(--size-4);
    padding: var(--size-8) var(--size-8) var(--size-12);
    box-sizing: border-box;
    border: 1px solid color-mix(in srgb, var(--color-primary) 32%, transparent);
    border-radius: var(--size-8);
    background: color-mix(
      in srgb,
      var(--color-primary) 4%,
      var(--color-background)
    );
  }

  .folder-heading {
    display: flex;
    gap: var(--size-8);
    padding: var(--size-8) var(--size-12);
    color: var(--color-action);
  }
  .file-row {
    min-height: 48px;
  }
  .child-row {
    background: var(--color-background);
  }
  .file-icon {
    color: var(--color-primary);
    font-size: 1.3rem;
    line-height: 0;
  }

  .sideways-stage {
    padding-inline: 3%;
  }
  :global(.sideways-list) {
    flex-wrap: nowrap !important;
    align-items: stretch;
    justify-content: center !important;
    width: 100%;
  }
  :global(.sideways-list > .snapsort-item) {
    flex: 0 1 126px;
    min-width: 0;
  }
  .side-card {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    height: 190px;
    padding: var(--size-16);
    box-sizing: border-box;
    border: 1px solid
      color-mix(in srgb, var(--color-background-dark) 24%, transparent);
    border-radius: var(--size-8);
    background: var(--color-background);
    box-shadow: 0 4px 14px rgb(36 38 39 / 6%);
  }

  .side-card > span:first-child {
    color: var(--color-primary);
    font-family: var(--font-code);
    font-size: 0.78rem;
  }
  .side-card strong {
    margin-top: auto;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    font-size: clamp(0.8rem, 2vw, 1rem);
  }
  .side-arrow {
    align-self: flex-end;
    margin-top: auto;
    color: var(--color-text-muted);
  }

  :global(.swap-grid) {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--size-8);
    width: min(100%, 430px);
  }
  :global(.swap-grid > .snapsort-item) {
    min-width: 0;
    padding: 0;
  }
  .swap-tile {
    display: grid;
    place-items: center;
    width: 100%;
    aspect-ratio: 1;
    box-sizing: border-box;
    border: 1px solid rgb(51 54 55 / 16%);
    border-radius: var(--size-8);
    background: var(--tile-color);
    color: #252728;
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 4vw, 2.7rem);
    box-shadow: 0 4px 14px rgb(36 38 39 / 8%);
  }

  .swap-tile.orange {
    --tile-color: #ff8a52;
  }
  .swap-tile.pink {
    --tile-color: #ff8fb1;
  }
  .swap-tile.yellow {
    --tile-color: #ffd66b;
  }
  .swap-tile.blue {
    --tile-color: #8dc9ff;
  }
  .swap-tile.green {
    --tile-color: #a8df8d;
  }
  .swap-tile.purple {
    --tile-color: #c5adff;
  }
  :global(.swap-ghost) {
    border: 0 !important;
    outline: 0 !important;
    background: transparent !important;
    opacity: 0.92;
  }

  @media (max-width: 620px) {
    .photo-op-page {
      padding-inline: var(--size-12);
    }
    .demo-heading {
      align-items: flex-start;
    }
    .demo-heading > p {
      display: none;
    }
    .demo-heading > div {
      gap: var(--size-8);
    }
    .demo-stage {
      margin-inline: 5%;
      padding: 4%;
    }
    .demo-square footer {
      padding-inline: 5%;
    }
    .todo-row,
    .file-row {
      min-height: 42px;
      padding-inline: var(--size-12);
      gap: var(--size-8);
      font-size: 0.78rem;
    }
    .side-card {
      height: 122px;
      padding: var(--size-8);
    }
    .swap-tile {
      border-radius: var(--size-4);
    }
  }
</style>
