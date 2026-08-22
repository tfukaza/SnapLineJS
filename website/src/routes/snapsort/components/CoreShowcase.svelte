<script lang="ts">
  import ClientDemoFrame from "$lib/components/ClientDemoFrame.svelte";
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type { Engine as SnapEngine } from "@snap-engine/core";
  import { Container, Ghost, Handle, Item } from "@snap-engine/snapsort/svelte";
  import {
    createRenderEntries,
    createRenderEntry,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
    type ContainerCallbacks,
    Container as ContainerType,
    type RenderTree,
    type RenderTreeEvent,
  } from "@snap-engine/snapsort";
  import { rejectDrop } from "@snap-engine/snapsort/callbacks";
  import CustomizableShowcase from "./CustomizableShowcase.svelte";

  type MultiContainerItem = {
    kind: "item";
    id: string;
    label: string;
  };

  type MultiContainerColumn = {
    kind: "column";
    id: string;
    title: string;
    direction: "left" | "right";
    container?: ContainerType;
  };
  type MultiContainerValue = MultiContainerItem | MultiContainerColumn;

  let {
    debugLayout,
    engine = $bindable<SnapEngine | null>(null),
  }: {
    debugLayout: boolean;
    engine?: SnapEngine | null;
  } = $props();

  let sidewaysSolved = $state(false);

  let sortableItems = $state.raw(
    createRenderTree(
      createRenderEntries(
        ["Drag any", "item up", "or down", "and drop", "them in", "place"],
        (label) => label,
      ),
    ),
  );
  const skeletonDemoTitles = [
    "Sortable list",
    "Sideways list",
    "Nested list",
    "Insert mode",
    "Multiple rows",
    "Multiple containers",
  ];
  const logoSliceCount = 6;
  const logoSliceWidth = 30;
  let sidewaysItems = $state.raw(
    createRenderTree(
      createRenderEntries(
        [3, 0, 5, 1, 4, 2].map((slice) => ({
          id: `typescript-slice-${slice}`,
          slice,
          x: `${slice * -logoSliceWidth}px`,
        })),
        (item) => item.id,
      ),
    ),
  );

  function ordinaryValues<T>(tree: RenderTree<T>): T[] {
    return tree.entries.flatMap((entry) =>
      entry.isGhost ? [] : [entry.value],
    );
  }

  function entryOrder<T>(tree: RenderTree<T>): string {
    return tree.entries
      .filter((entry) => !entry.isGhost)
      .map((entry) => entry.itemId)
      .join(",");
  }

  function handleSortableEvent(event: RenderTreeEvent) {
    sortableItems = reduceRenderTree(sortableItems, event);
  }

  function handleSidewaysEvent(event: RenderTreeEvent) {
    sidewaysItems = reduceRenderTree(sidewaysItems, event);
    const items = ordinaryValues(sidewaysItems);
    sidewaysSolved =
      items.length === logoSliceCount &&
      items.every((item, index) => item.slice === index);
  }
  const nestedItems = ["Item 1", "Item 2", "Item 3"];
  const nestedChildren = ["Item 4", "Item 5", "Item 6"];
  const insertItems = ["Item 1", "Item 4", "Item 5"];
  const insertNestedItems = ["Item 2", "Item 3"];

  // Heterogeneous: a nested Container sits as a sibling among plain Items,
  // which `item` (content-only, wrapped in an adapter Item) can't express --
  // `entry` renders the Item/Container itself per position.
  type NestedEntry =
    | { kind: "item"; id: string; label: string }
    | { kind: "group"; id: "nested-group" };
  const nestedEntries: NestedEntry[] = [
    ...nestedItems.map((label): NestedEntry => ({ kind: "item", id: label, label })),
    { kind: "group", id: "nested-group" },
  ];
  let nestedLists = $state.raw(
    createRenderTree(
      nestedEntries.map((entry) =>
        createRenderEntry(
          entry,
          entry.id,
          entry.kind === "group"
            ? createRenderTree(
                createRenderEntries<NestedEntry>(
                  nestedChildren.map((label) => ({
                    kind: "item",
                    id: label,
                    label,
                  })),
                  (child) => child.id,
                ),
              )
            : null,
        ),
      ),
    ),
  );

  type InsertEntry =
    | { kind: "item"; id: string; label: string }
    | { kind: "group"; id: "insert-group" };
  const insertEntries: InsertEntry[] = [
    { kind: "item", id: insertItems[0], label: insertItems[0] },
    { kind: "group", id: "insert-group" },
    ...insertItems.slice(1).map((label): InsertEntry => ({ kind: "item", id: label, label })),
  ];
  let insertLists = $state.raw(
    createRenderTree(
      insertEntries.map((entry) =>
        createRenderEntry(
          entry,
          entry.id,
          entry.kind === "group"
            ? createRenderTree(
                createRenderEntries<InsertEntry>(
                  insertNestedItems.map((label) => ({
                    kind: "item",
                    id: label,
                    label,
                  })),
                  (child) => child.id,
                ),
              )
            : null,
        ),
      ),
    ),
  );
  let multiRowItems = $state.raw(
    createRenderTree(
      createRenderEntries(
        [
          "This", "demo", "has", "a", "slightly", "different", "algorithm",
          "optimized", "for", "reordering", "words", "in", "a", "sentence",
        ].map((label, index) => ({ id: `multi-row-${index}`, label })),
        (item) => item.id,
      ),
    ),
  );

  const multiContainerItemEntry = (id: string, label: string) =>
    createRenderEntry<MultiContainerValue>({ kind: "item", id, label }, id);
  let multiContainers = $state.raw(
    createRenderTree<MultiContainerValue>([
      createRenderEntry(
        { kind: "column", id: "left", title: "Left", direction: "right" },
        "left",
        createRenderTree([
          multiContainerItemEntry("mc-spec", "Spec"),
          multiContainerItemEntry("mc-mockup", "Mockup"),
          multiContainerItemEntry("mc-build", "Build"),
        ]),
      ),
      createRenderEntry(
        { kind: "column", id: "right", title: "Right", direction: "left" },
        "right",
        createRenderTree([
          multiContainerItemEntry("mc-review", "Review"),
          multiContainerItemEntry("mc-ship", "Ship"),
        ]),
      ),
    ]),
  );

  function handleNestedEvent(event: RenderTreeEvent) {
    nestedLists = reduceRenderTree(nestedLists, event);
  }

  function handleInsertEvent(event: RenderTreeEvent) {
    insertLists = reduceRenderTree(insertLists, event);
  }

  function handleMultiRowEvent(event: RenderTreeEvent) {
    multiRowItems = reduceRenderTree(multiRowItems, event);
  }

  function handleMultiContainerEvent(event: RenderTreeEvent) {
    multiContainers = reduceRenderTree(multiContainers, event);
  }

  function moveItemToOppositeColumn(itemId: string) {
    const columns = multiContainers.entries.filter(
      (entry) =>
        !entry.isGhost &&
        entry.value.kind === "column" &&
        entry.childTree !== null,
    );
    const sourceColumnIndex = columns.findIndex((column) =>
      !column.isGhost &&
      column.childTree?.entries.some(
        (entry) => !entry.isGhost && entry.itemId === itemId,
      ),
    );
    if (sourceColumnIndex === -1) return;

    const targetColumnIndex = sourceColumnIndex === 0 ? 1 : 0;
    const sourceColumn = columns[sourceColumnIndex];
    const targetColumn = columns[targetColumnIndex];
    if (
      !sourceColumn ||
      sourceColumn.isGhost ||
      sourceColumn.value.kind !== "column" ||
      !sourceColumn.childTree ||
      !targetColumn ||
      targetColumn.isGhost ||
      targetColumn.value.kind !== "column" ||
      !targetColumn.childTree
    ) {
      return;
    }
    const sourceItemIndex = sourceColumn.childTree.entries.findIndex(
      (entry) => !entry.isGhost && entry.itemId === itemId,
    );
    const targetLength = targetColumn.childTree.entries.filter(
      (entry) => !entry.isGhost,
    ).length;
    const destinationIndex = Math.min(sourceItemIndex, targetLength);
    const sourceContainer = sourceColumn.value.container;
    const targetContainer = targetColumn.value.container;
    if (!sourceContainer || !targetContainer) return;

    sourceContainer.moveItem(
      itemId,
      targetContainer,
      destinationIndex,
    );
  }

  function structuralCallbacks(
    handler: (event: RenderTreeEvent) => void,
  ): ContainerCallbacks {
    return {
      onItemMove: handler,
      onGhostInsert: handler,
      onGhostMove: handler,
      onGhostRemove: handler,
    };
  }

  const sortableCallbacks = structuralCallbacks(handleSortableEvent);
  const sidewaysCallbacks = structuralCallbacks(handleSidewaysEvent);
  const nestedCallbacks = structuralCallbacks(handleNestedEvent);
  const insertCallbacks = structuralCallbacks(handleInsertEvent);
  const multiRowCallbacks = structuralCallbacks(handleMultiRowEvent);
  const multiContainerCallbacks = {
    ...structuralCallbacks(handleMultiContainerEvent),
    canDrop: rejectDrop,
  } satisfies ContainerCallbacks;

</script>

<section class="core-showcase col-12">
  <div class="core-showcase-header">
    <h2>Versatile and Extensible</h2>
    <p class="large">
      A wide variety of core components are available out of the box to provide
      building blocks for any type of drag and drop UI.
    </p>
  </div>

  <ClientDemoFrame>
    {#snippet fallback()}
      <div class="core-demo-grid core-demo-skeleton-grid" aria-hidden="true">
        {#each skeletonDemoTitles as title, index}
          <article class="core-demo-card">
            <h3>{title}</h3>
            <div class="core-demo-surface card core-demo-skeleton">
              {#if index === 0}
                <div class="basic-list sortable-list">
                  {#each ordinaryValues(sortableItems) as label}
                    <div class="basic-row card-content">
                      <span>{label}</span>
                    </div>
                  {/each}
                </div>
              {:else if index === 1}
                <div class="sideways-list solved">
                  {#each ordinaryValues(sidewaysItems) as item}
                    <div class="snapsort-item">
                      <div
                        class="logo-slice"
                        data-slice={item.slice}
                        style={`--slice-x: ${item.x};`}
                      ></div>
                    </div>
                  {/each}
                </div>
              {:else if index === 2 || index === 3}
                <div class="basic-list bounded-demo-list">
                  {#each (index === 2 ? nestedItems : insertItems) as label}
                    <div class="basic-row handle-row">
                      <span>{label}</span>
                    </div>
                  {/each}
                  <div class="nested-list bounded-demo-list card shallow">
                    {#each (index === 2 ? nestedChildren : insertNestedItems) as label}
                      <div class="basic-row nested-row handle-row">
                        <span>{label}</span>
                      </div>
                    {/each}
                  </div>
                </div>
              {:else if index === 4}
                <div class="multi-row-list">
                  {#each ordinaryValues(multiRowItems) as item}
                    <div class="basic-token">
                      <span>{item.label}</span>
                    </div>
                  {/each}
                </div>
              {:else if index === 5}
                <div class="multi-container-board">
                  {#each multiContainers.entries as columnEntry}
                    {#if !columnEntry.isGhost && columnEntry.childTree && columnEntry.value.kind === "column"}
                      <div class="basic-column card">
                        <h4>{columnEntry.value.title}</h4>
                        {#each columnEntry.childTree.entries as itemEntry}
                          {#if !itemEntry.isGhost && itemEntry.value.kind === "item"}
                            <div class="basic-row compact-row multi-container-row">
                              <span>{itemEntry.value.label}</span>
                            </div>
                          {/if}
                        {/each}
                      </div>
                    {/if}
                  {/each}
                </div>
              {/if}
            </div>
          </article>
        {/each}
        <section class="feature-card-section static-customizable-section">
          <div class="feature-card-grid">
            <div class="customizable-scroll-scene">
              <article class="customizable-feature-card" style="--customizable-progress: 0;">
                <div class="feature-card-copy">
                  <div class="feature-card-copy-text">
                    <h2>Customizable</h2>
                    <p class="large">
                      SnapSort components are styleless by default. Use our default theme or
                      apply your own, including Tailwind. Configuration parameters allow
                      adjustment of animation and drag behavior.
                    </p>
                  </div>
                </div>

                <div class="customizable-demo shallow static-customizable-preview" style="--customizable-progress: 0;">
                  <div class="customizable-demo-scale">
                    <div class="customizable-theme-rail">
                      <div class="customizable-surface" data-theme="default">
                        <div class="customizable-motion-frame" style="--theme-offset: 0px;">
                          <div class="customizable-mockup-shell">
                            <div class="customizable-mockup-title">Default</div>
                            <div class="customizable-mockup-card shallow">
                              <div class="customizable-mini-list">
                                {#each ordinaryValues(sortableItems).slice(0, 4) as label}
                                  <div class="snapsort-item">
                                    <div class="customizable-mini-row">
                                      <span class="customizable-mini-handle" aria-hidden="true">
                                        <span class="customizable-mini-grip"><i></i><i></i><i></i></span>
                                      </span>
                                      <span class="customizable-mini-row-main">
                                        <span class="customizable-mini-row-text">{label}</span>
                                      </span>
                                    </div>
                                  </div>
                                {/each}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </div>

            <section class="closing-grid" aria-label="Explore SnapSort examples">
              <div class="closing-card gallery-card">
                <div class="gallery-kanban" aria-hidden="true">
                  <div class="gallery-preview-board">
                    <div class="gallery-preview-column card">
                      <div class="gallery-preview-item card shallow"></div>
                      <div class="gallery-preview-item card shallow"></div>
                      <div class="gallery-preview-item card shallow"></div>
                    </div>
                    <div class="gallery-preview-column card">
                      <div class="gallery-preview-item card shallow"></div>
                      <div class="gallery-preview-item card shallow"></div>
                      <div class="gallery-preview-drop-target"></div>
                    </div>
                  </div>
                  <div class="gallery-preview-drag-card card"></div>
                  <img
                    class="gallery-preview-cursor"
                    src="/icon/noun-cursor-740125.svg"
                    alt=""
                  />
                </div>
                <div class="gallery-copy-panel">
                  <div class="closing-copy">
                    <h3>Explore examples</h3>
                    <p>
                      File trees, form builders, sentence puzzles, and more —
                      complete interactive demos built with SnapSort.
                    </p>
                  </div>
                  <a class="button closing-button" href="/docs/snapsort/examples">
                    Browse examples
                  </a>
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    {/snippet}
    <Engine id="snapsort-core-demos" bind:engine debug={debugLayout}>
    <div class="core-demo-grid">
      <article class="core-demo-card">
        <h3>Sortable list</h3>
        <div class="core-demo-surface card">
          <Container
            itemId="core-sortable-root"
            className="basic-list sortable-list"
            config={{
              animation: defaultAnimations,
              direction: "column",
              callbacks: sortableCallbacks,
            }}
            data-snapsort-demo="sortable"
            data-list-id="core-sortable"
            data-order={entryOrder(sortableItems)}
          >
            {#each sortableItems.entries as entry (entry.itemId)}
              {#if entry.isGhost}
                <Ghost ghost={entry.ghost} />
              {:else}
              <Item itemId={entry.itemId}>
                <div class="basic-row card-content">
                  <span>{entry.value}</span>
                </div>
              </Item>
              {/if}
            {/each}
          </Container>
        </div>
      </article>

      <article class="core-demo-card sideways-demo-card">
        <h3>Sideways list</h3>
        <div class="core-demo-surface sideways-demo-surface card">
          <Container
            itemId="core-sideways-root"
            className={`sideways-list ${sidewaysSolved ? "solved" : ""}`}
            config={{
              animation: defaultAnimations,
              direction: "row",
              mainAxisAlign: "center",
              callbacks: sidewaysCallbacks,
            }}
            data-snapsort-demo="sideways"
            data-list-id="core-sideways"
            data-order={entryOrder(sidewaysItems)}
          >
            {#each sidewaysItems.entries as entry (entry.itemId)}
              {#if entry.isGhost}
                <Ghost ghost={entry.ghost} />
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

      <article class="core-demo-card">
        <h3>Nested list</h3>
        <div class="core-demo-surface card">
          <Container
            itemId="core-nested-root"
            className="basic-list bounded-demo-list"
            metadata={{ listId: "root" }}
            config={{
              animation: defaultAnimations,
              direction: "column",
              callbacks: nestedCallbacks,
            }}
            data-snapsort-demo="nested"
            data-list-id="core-nested-root"
            data-order={entryOrder(nestedLists)}
          >
            {#each nestedLists.entries as entry (entry.itemId)}
              {#if entry.isGhost}
                <Ghost ghost={entry.ghost} />
              {:else if entry.childTree && entry.value.kind === "group"}
                <Container
                  className="nested-list bounded-demo-list card shallow"
                  metadata={{ listId: "child" }}
                  config={{
                    animation: defaultAnimations,
                    direction: "column",
                  }}
                  locked={false}
                  itemId={entry.itemId}
                  data-snapsort-demo="nested"
                  data-list-id="core-nested-child"
                  data-order={entryOrder(entry.childTree)}
                >
                  <Handle className="demo-container-handle">
                    <span class="demo-grip" aria-hidden="true">
                      <i></i><i></i><i></i><i></i>
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
                              <i></i><i></i><i></i><i></i>
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
                        <i></i><i></i><i></i><i></i>
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

      <article class="core-demo-card">
        <h3>Insert mode</h3>
        <div class="core-demo-surface card">
          <Container
            itemId="core-insert-root"
            className="basic-list insertion-list bounded-demo-list"
            metadata={{ listId: "root" }}
            config={{
              animation: defaultAnimations,
              direction: "column",
              mode: "insertion",
              callbacks: insertCallbacks,
            }}
            data-snapsort-demo="insert"
            data-list-id="core-insert-root"
            data-order={entryOrder(insertLists)}
          >
            {#each insertLists.entries as entry (entry.itemId)}
              {#if entry.isGhost}
                <Ghost ghost={entry.ghost} />
              {:else if entry.childTree && entry.value.kind === "group"}
                <Container
                  className="nested-list nested-insertion-list insertion-list bounded-demo-list card shallow"
                  metadata={{ listId: "child" }}
                  config={{
                    animation: defaultAnimations,
                    direction: "column",
                    mode: "insertion",
                  }}
                  locked={false}
                  itemId={entry.itemId}
                  data-snapsort-demo="insert"
                  data-list-id="core-insert-child"
                  data-order={entryOrder(entry.childTree)}
                >
                  <Handle className="demo-container-handle">
                    <span class="demo-grip" aria-hidden="true">
                      <i></i><i></i><i></i><i></i>
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
                              <i></i><i></i><i></i><i></i>
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
                        <i></i><i></i><i></i><i></i>
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

      <article class="core-demo-card">
        <h3>Multiple rows</h3>
        <div class="core-demo-surface card">
          <Container
            itemId="core-multi-row-root"
            className="multi-row-list"
            config={{
              animation: defaultAnimations,
              direction: "row",
              mode: "progressive",
              callbacks: multiRowCallbacks,
            }}
            data-snapsort-demo="multi-row"
            data-list-id="core-multi-row"
            data-order={entryOrder(multiRowItems)}
          >
            {#each multiRowItems.entries as entry (entry.itemId)}
              {#if entry.isGhost}
                <Ghost ghost={entry.ghost} />
              {:else}
              <Item itemId={entry.itemId}>
                <div class="basic-token">
                  <span>{entry.value.label}</span>
                </div>
              </Item>
              {/if}
            {/each}
          </Container>
        </div>
      </article>

      <article class="core-demo-card">
        <h3>Multiple containers</h3>
        <div class="core-demo-surface multi-container-surface">
          <Container
            itemId="core-multi-container-root"
            className="multi-container-board"
            config={{
              animation: defaultAnimations,
              direction: "row",
              name: "core-multi-root",
              callbacks: multiContainerCallbacks,
            }}
            locked={true}
            data-snapsort-demo="multi-container"
            data-list-id="core-multi-root"
            data-order={entryOrder(multiContainers)}
          >
            {#each multiContainers.entries as entry (entry.itemId)}
              {#if entry.isGhost}
                <Ghost ghost={entry.ghost} />
              {:else if entry.childTree && entry.value.kind === "column"}
              <Container
                className="basic-column card"
                bind:container={entry.value.container}
                itemId={entry.itemId}
                metadata={{ columnId: entry.itemId }}
                config={{
                  animation: defaultAnimations,
                  direction: "column",
                  name: entry.itemId,
                }}
                locked={true}
                data-snapsort-demo="multi-container"
                data-list-id={`core-multi-${entry.itemId}`}
                data-order={entryOrder(entry.childTree)}
              >
                <h4>{entry.value.title}</h4>
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
                          moveItemToOppositeColumn(child.itemId);
                        }}
                      >
                        {#if entry.value.direction === "right"}
                          &rarr;
                        {:else}
                          &larr;
                        {/if}
                      </button>
                    </div>
                  </Item>
                  {/if}
                {/each}
              </Container>
              {:else}
                <Item itemId={entry.itemId}>{entry.value.kind}</Item>
              {/if}
            {/each}
          </Container>
        </div>
      </article>

      <CustomizableShowcase />

    </div>
    </Engine>
  </ClientDemoFrame>
</section>
