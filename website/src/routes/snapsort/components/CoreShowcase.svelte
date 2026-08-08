<script lang="ts">
  import ClientDemoFrame from "$lib/components/ClientDemoFrame.svelte";
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type { Engine as SnapEngine } from "@snap-engine/core";
  import { Container, Handle, Item } from "@snap-engine/snapsort/svelte";
  import type {
    Container as ContainerType,
    ItemMoveEvent,
  } from "@snap-engine/snapsort";
  import CustomizableShowcase from "./CustomizableShowcase.svelte";
  import { moveEntries, moveEntriesAcrossLists } from "./listState";

  type MultiContainerItem = {
    id: string;
    label: string;
  };

  type MultiContainerColumn = {
    id: string;
    title: string;
    direction: "left" | "right";
    items: MultiContainerItem[];
    container?: ContainerType;
  };


  let {
    debugLayout,
    engine = $bindable<SnapEngine | null>(null),
  }: {
    debugLayout: boolean;
    engine?: SnapEngine | null;
  } = $props();

  let sidewaysSolved = $state(false);

  let sortableItems = $state([
    "Drag any",
    "item up",
    "or down",
    "and drop",
    "them in",
    "place",
  ]);
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
  let sidewaysItems = $state([3, 0, 5, 1, 4, 2].map((slice) => ({
    id: `typescript-slice-${slice}`,
    slice,
    x: `${slice * -logoSliceWidth}px`,
  })));

  function handleSortableMove(event: ItemMoveEvent) {
    sortableItems = moveEntries(sortableItems, event, (label) => label);
  }

  function handleSidewaysMove(event: ItemMoveEvent) {
    sidewaysItems = moveEntries(sidewaysItems, event, (item) => item.id);
    sidewaysSolved =
      sidewaysItems.length === logoSliceCount &&
      sidewaysItems.every((item, index) => item.slice === index);
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
  let nestedLists = $state({
    root: nestedEntries,
    child: nestedChildren.map((label): NestedEntry => ({ kind: "item", id: label, label })),
  });

  type InsertEntry =
    | { kind: "item"; id: string; label: string }
    | { kind: "group"; id: "insert-group" };
  const insertEntries: InsertEntry[] = [
    { kind: "item", id: insertItems[0], label: insertItems[0] },
    { kind: "group", id: "insert-group" },
    ...insertItems.slice(1).map((label): InsertEntry => ({ kind: "item", id: label, label })),
  ];
  let insertLists = $state({
    root: insertEntries,
    child: insertNestedItems.map((label): InsertEntry => ({ kind: "item", id: label, label })),
  });
  let multiRowItems = $state([
    "This",
    "demo",
    "has",
    "a",
    "slightly",
    "different",
    "algorithm",
    "optimized",
    "for",
    "reordering",
    "words",
    "in",
    "a",
    "sentence",
  ].map((label, index) => ({
    id: `multi-row-${index}`,
    label,
  })));
  let multiContainers: MultiContainerColumn[] = $state([
    {
      id: "left",
      title: "Left",
      direction: "right",
      items: [
        { id: "mc-spec", label: "Spec" },
        { id: "mc-mockup", label: "Mockup" },
        { id: "mc-build", label: "Build" },
      ],
    },
    {
      id: "right",
      title: "Right",
      direction: "left",
      items: [
        { id: "mc-review", label: "Review" },
        { id: "mc-ship", label: "Ship" },
      ],
    },
  ]);

  function handleNestedMove(event: ItemMoveEvent) {
    const targetListId = event.to.containerMetadata.listId;
    if (targetListId !== "root" && targetListId !== "child") return;
    nestedLists = moveEntriesAcrossLists(
      nestedLists,
      event,
      targetListId,
      (entry: NestedEntry) => entry.id,
    );
  }

  function handleInsertMove(event: ItemMoveEvent) {
    const targetListId = event.to.containerMetadata.listId;
    if (targetListId !== "root" && targetListId !== "child") return;
    insertLists = moveEntriesAcrossLists(
      insertLists,
      event,
      targetListId,
      (entry: InsertEntry) => entry.id,
    );
  }

  function handleMultiRowMove(event: ItemMoveEvent) {
    multiRowItems = moveEntries(multiRowItems, event, (item) => item.id);
  }

  function moveMultiContainerState(itemId: string, targetColumnId: string, targetIndex: number) {
    let movedItem: MultiContainerItem | null = null;
    const withoutMovedItem = multiContainers.map((column) => {
      const sourceIndex = column.items.findIndex((item) => item.id === itemId);
      if (sourceIndex === -1) return column;

      const nextItems = column.items.slice();
      const [item] = nextItems.splice(sourceIndex, 1);
      movedItem = item;
      return { ...column, items: nextItems };
    });

    if (!movedItem) return;
    const itemToMove = movedItem;

    multiContainers = withoutMovedItem.map((column) => {
      if (column.id !== targetColumnId) return column;

      const nextItems = column.items.slice();
      const destinationIndex = Math.max(0, Math.min(targetIndex, nextItems.length));
      nextItems.splice(destinationIndex, 0, itemToMove);
      return { ...column, items: nextItems };
    });
  }

  function handleMultiContainerMove(event: ItemMoveEvent) {
    const targetColumnId = event.to.containerMetadata.columnId;
    if (typeof targetColumnId !== "string") return;

    const ids = (event.itemIds.length > 0 ? event.itemIds : [event.itemId]).map(String);
    const idsToMove = new Set(ids);
    const itemsById = new Map(
      multiContainers.flatMap((column) => column.items.map((item) => [item.id, item] as const)),
    );
    const movedItems = ids.flatMap((id) => {
      const item = itemsById.get(id);
      return item ? [item] : [];
    });
    if (movedItems.length === 0) return;

    const withoutMovedItems = multiContainers.map((column) => ({
      ...column,
      items: column.items.filter((item) => !idsToMove.has(item.id)),
    }));
    multiContainers = withoutMovedItems.map((column) => {
      if (column.id !== targetColumnId) return column;
      const items = column.items.slice();
      const destinationIndex = Math.max(0, Math.min(event.to.index, items.length));
      items.splice(destinationIndex, 0, ...movedItems);
      return { ...column, items };
    });
  }

  function moveItemToOppositeColumn(itemId: string) {
    const sourceColumnIndex = multiContainers.findIndex((column) =>
      column.items.some((item) => item.id === itemId),
    );
    if (sourceColumnIndex === -1) return;

    const targetColumnIndex = sourceColumnIndex === 0 ? 1 : 0;
    const sourceColumn = multiContainers[sourceColumnIndex];
    const targetColumn = multiContainers[targetColumnIndex];
    const sourceItemIndex = sourceColumn.items.findIndex((item) => item.id === itemId);
    const destinationIndex = Math.min(sourceItemIndex, targetColumn.items.length);

    if (sourceColumn.container && targetColumn.container) {
      const movedBySnapSort = sourceColumn.container.moveItem(
        itemId,
        targetColumn.container,
        destinationIndex,
      );
      if (movedBySnapSort) return;
    }

    moveMultiContainerState(itemId, targetColumn.id, destinationIndex);
  }

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
                  {#each sortableItems as label}
                    <div class="basic-row card-content">
                      <span>{label}</span>
                    </div>
                  {/each}
                </div>
              {:else if index === 1}
                <div class="sideways-list solved">
                  {#each sidewaysItems as item}
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
                  {#each multiRowItems as item}
                    <div class="basic-token">
                      <span>{item.label}</span>
                    </div>
                  {/each}
                </div>
              {:else if index === 5}
                <div class="multi-container-board">
                  {#each multiContainers as column}
                    <div class="basic-column card">
                      <h4>{column.title}</h4>
                      {#each column.items as item}
                        <div class="basic-row compact-row multi-container-row">
                          <span>{item.label}</span>
                        </div>
                      {/each}
                    </div>
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
                                {#each sortableItems.slice(0, 4) as label}
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
                    <h3>Explore the gallery</h3>
                    <p>
                      File trees, form builders, sentence puzzles, and more —
                      complete interactive demos built with SnapSort.
                    </p>
                  </div>
                  <a class="button closing-button" href="/snapsort/gallery">
                    Browse the gallery
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
            className="basic-list sortable-list"
            config={{
              direction: "column",
              groupID: "core-sortable",
              callbacks: { onItemMove: handleSortableMove },
            }}
            items={sortableItems}
            getItemId={(label) => label}
            data-snapsort-demo="sortable"
            data-list-id="core-sortable"
            data-order={sortableItems.join(",")}
          >
            {#snippet entry(label)}
              <Item itemId={label}>
                <div class="basic-row card-content">
                  <span>{label}</span>
                </div>
              </Item>
            {/snippet}
          </Container>
        </div>
      </article>

      <article class="core-demo-card sideways-demo-card">
        <h3>Sideways list</h3>
        <div class="core-demo-surface sideways-demo-surface card">
          <Container
            className={`sideways-list ${sidewaysSolved ? "solved" : ""}`}
            config={{
              direction: "row",
              groupID: "core-sideways",
              mainAxisAlign: "center",
              callbacks: { onItemMove: handleSidewaysMove },
            }}
            items={sidewaysItems}
            getItemId={(item) => item.id}
            data-snapsort-demo="sideways"
            data-list-id="core-sideways"
            data-order={sidewaysItems.map((item) => item.id).join(",")}
          >
            {#snippet entry(item)}
              <Item itemId={item.id}>
                <div
                  class="logo-slice"
                  data-slice={item.slice}
                  aria-label="TypeScript logo slice {item.slice + 1} of {logoSliceCount}"
                  style={`--slice-x: ${item.x};`}
                ></div>
              </Item>
            {/snippet}
          </Container>
        </div>
      </article>

      <article class="core-demo-card">
        <h3>Nested list</h3>
        <div class="core-demo-surface card">
          <Container
            className="basic-list bounded-demo-list"
            metadata={{ listId: "root" }}
            config={{
              direction: "column",
              groupID: "core-nested",
              callbacks: { onItemMove: handleNestedMove },
            }}
            items={nestedLists.root}
            getItemId={(entry) => entry.id}
            data-snapsort-demo="nested"
            data-list-id="core-nested-root"
            data-order={nestedLists.root.map((entry) => entry.id).join(",")}
          >
            {#snippet entry(e)}
              {#if e.kind === "item"}
                <Item itemId={e.id}>
                  <div class="basic-row handle-row">
                    <Handle className="demo-row-handle">
                      <span class="demo-grip" aria-hidden="true">
                        <i></i><i></i><i></i><i></i>
                      </span>
                    </Handle>
                    <span>{e.label}</span>
                  </div>
                </Item>
              {:else}
                <Container
                  className="nested-list bounded-demo-list card shallow"
                  metadata={{ listId: "child" }}
                  config={{
                    direction: "column",
                    groupID: "core-nested",
                    callbacks: { onItemMove: handleNestedMove },
                  }}
                  locked={false}
                  itemId="nested-group"
                  items={nestedLists.child}
                  getItemId={(entry) => entry.id}
                  data-snapsort-demo="nested"
                  data-list-id="core-nested-child"
                  data-order={nestedLists.child.map((entry) => entry.id).join(",")}
                >
                  {#snippet before()}
                    <Handle className="demo-container-handle">
                      <span class="demo-grip" aria-hidden="true">
                        <i></i><i></i><i></i><i></i>
                      </span>
                    </Handle>
                  {/snippet}
                  {#snippet entry(child)}
                    {#if child.kind === "item"}
                      <Item itemId={child.id}>
                        <div class="basic-row nested-row handle-row">
                          <Handle className="demo-row-handle">
                            <span class="demo-grip" aria-hidden="true">
                              <i></i><i></i><i></i><i></i>
                            </span>
                          </Handle>
                          <span>{child.label}</span>
                        </div>
                      </Item>
                    {/if}
                  {/snippet}
                </Container>
              {/if}
            {/snippet}
          </Container>
        </div>
      </article>

      <article class="core-demo-card">
        <h3>Insert mode</h3>
        <div class="core-demo-surface card">
          <Container
            className="basic-list insertion-list bounded-demo-list"
            metadata={{ listId: "root" }}
            config={{
              direction: "column",
              groupID: "core-insert",
              mode: "insertion",
              callbacks: { onItemMove: handleInsertMove },
            }}
            items={insertLists.root}
            getItemId={(entry) => entry.id}
            data-snapsort-demo="insert"
            data-list-id="core-insert-root"
            data-order={insertLists.root.map((entry) => entry.id).join(",")}
          >
            {#snippet entry(e)}
              {#if e.kind === "item"}
                <Item itemId={e.id}>
                  <div class="basic-row handle-row">
                    <Handle className="demo-row-handle">
                      <span class="demo-grip" aria-hidden="true">
                        <i></i><i></i><i></i><i></i>
                      </span>
                    </Handle>
                    <span>{e.label}</span>
                  </div>
                </Item>
              {:else}
                <Container
                  className="nested-list nested-insertion-list insertion-list bounded-demo-list card shallow"
                  metadata={{ listId: "child" }}
                  config={{
                    direction: "column",
                    groupID: "core-insert",
                    mode: "insertion",
                    callbacks: { onItemMove: handleInsertMove },
                  }}
                  locked={false}
                  itemId="insert-group"
                  items={insertLists.child}
                  getItemId={(entry) => entry.id}
                  data-snapsort-demo="insert"
                  data-list-id="core-insert-child"
                  data-order={insertLists.child.map((entry) => entry.id).join(",")}
                >
                  {#snippet before()}
                    <Handle className="demo-container-handle">
                      <span class="demo-grip" aria-hidden="true">
                        <i></i><i></i><i></i><i></i>
                      </span>
                    </Handle>
                  {/snippet}
                  {#snippet entry(child)}
                    {#if child.kind === "item"}
                      <Item itemId={child.id}>
                        <div class="basic-row nested-row handle-row">
                          <Handle className="demo-row-handle">
                            <span class="demo-grip" aria-hidden="true">
                              <i></i><i></i><i></i><i></i>
                            </span>
                          </Handle>
                          <span>{child.label}</span>
                        </div>
                      </Item>
                    {/if}
                  {/snippet}
                </Container>
              {/if}
            {/snippet}
          </Container>
        </div>
      </article>

      <article class="core-demo-card">
        <h3>Multiple rows</h3>
        <div class="core-demo-surface card">
          <Container
            className="multi-row-list"
            config={{
              direction: "row",
              groupID: "core-multi-row",
              mode: "progressive",
              callbacks: { onItemMove: handleMultiRowMove },
            }}
            items={multiRowItems}
            getItemId={(item) => item.id}
            data-snapsort-demo="multi-row"
            data-list-id="core-multi-row"
            data-order={multiRowItems.map((item) => item.id).join(",")}
          >
            {#snippet entry(item)}
              <Item itemId={item.id}>
                <div class="basic-token">
                  <span>{item.label}</span>
                </div>
              </Item>
            {/snippet}
          </Container>
        </div>
      </article>

      <article class="core-demo-card">
        <h3>Multiple containers</h3>
        <div class="core-demo-surface multi-container-surface">
          <Container
            className="multi-container-board"
            config={{ direction: "row", name: "core-multi-root", noDrop: true }}
            locked={true}
            items={multiContainers}
            getItemId={(column) => column.id}
            data-snapsort-demo="multi-container"
            data-list-id="core-multi-root"
            data-order={multiContainers.map((column) => column.id).join(",")}
          >
            {#snippet entry(column)}
              <Container
                className="basic-column card"
                bind:container={column.container}
                itemId={column.id}
                metadata={{ columnId: column.id }}
                config={{
                  direction: "column",
                  groupID: "core-multi-container",
                  name: column.id,
                  callbacks: { onItemMove: handleMultiContainerMove },
                }}
                locked={true}
                items={column.items}
                getItemId={(item) => item.id}
                data-snapsort-demo="multi-container"
                data-list-id={`core-multi-${column.id}`}
                data-order={column.items.map((item) => item.id).join(",")}
              >
                {#snippet before()}
                  <h4>{column.title}</h4>
                {/snippet}
                {#snippet entry(item)}
                  <Item itemId={item.id}>
                    <div class="basic-row compact-row multi-container-row">
                      <span>{item.label}</span>
                      <button
                        class="column-move-button"
                        type="button"
                        aria-label="Move {item.label} to the other column"
                        onpointerdown={(event) => event.stopPropagation()}
                        onclick={(event) => {
                          event.stopPropagation();
                          moveItemToOppositeColumn(item.id);
                        }}
                      >
                        {#if column.direction === "right"}
                          &rarr;
                        {:else}
                          &larr;
                        {/if}
                      </button>
                    </div>
                  </Item>
                {/snippet}
              </Container>
            {/snippet}
          </Container>
        </div>
      </article>

      <CustomizableShowcase />

    </div>
    </Engine>
  </ClientDemoFrame>
</section>
