<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";
  import { rejectDrop } from "@snap-engine/snapsort/callbacks";
  import type { Engine as EngineClass } from "@snap-engine/core";
  import {
    createRenderEntry,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
    type ContainerCallbacks,
    type RenderTree,
  } from "@snap-engine/snapsort";
  import { renderTreeCallbacks } from "../snapsort-render-tree";

  let engineInstance: EngineClass | null = $state(null);
  let debugMode = $state(false);
  const disableNestedFlip =
    new URLSearchParams(window.location.search).get("disableNestedFlip") === "1";
  const slowNestedFlip =
    new URLSearchParams(window.location.search).get("slowNestedFlip") === "1";
  const lockNestedChild =
    new URLSearchParams(window.location.search).get("lockNestedChild") === "1";
  const showCompactNested =
    new URLSearchParams(window.location.search).get("compactNested") === "1";
  const nestedAnimationConfig = disableNestedFlip
    ? { animation: { reorder: null, drop: null } }
    : slowNestedFlip
    ? {
        animation: {
          reorder: { duration: 800, timing_function: "linear" },
          drop: { duration: 800, timing_function: "linear" },
        },
      }
    : { animation: defaultAnimations };

  const DEBUG_TAGS = [
    { id: "grid", label: "Grid" },
    { id: "hitboxes", label: "Hitboxes" },
    { id: "dom-read-1", label: "DOM Read 1" },
    { id: "dom-read-2", label: "DOM Read 2" },
    { id: "dom-read-3", label: "DOM Read 3" },
    { id: "rows", label: "Rows" },
    { id: "item-positions", label: "Item Positions" },
    { id: "containers", label: "Containers" },
    { id: "drop-index", label: "Drop Index" },
    { id: "drop-layout", label: "Drop Layout" },
    { id: "drop-snapshot", label: "Drop Snapshot" },
    { id: "drop-collisions", label: "Drop Collisions" },
    { id: "drop-candidates", label: "Drop Candidates" },
    { id: "drop-neighbors", label: "Drop Neighbors" },
    { id: "drop-tiebreak", label: "Drop Tie-break" },
    { id: "drop-zones", label: "Drop Zones" },
    { id: "collisions", label: "Collisions" },
    { id: "animations", label: "Animations" },
  ] as const;

  let enabledTags = $state<Record<string, boolean>>(
    Object.fromEntries(DEBUG_TAGS.map((tag) => [tag.id, tag.id.startsWith("drop-")])),
  );

  function applyTagFilter() {
    const renderer = engineInstance?.debugRenderer;
    if (!renderer) return;

    const allEnabled = DEBUG_TAGS.every((tag) => enabledTags[tag.id]);
    renderer.enabledTags = allEnabled
      ? null
      : new Set(DEBUG_TAGS.filter((tag) => enabledTags[tag.id]).map((tag) => tag.id));
  }

  function onTagChange(id: string) {
    enabledTags[id] = !enabledTags[id];
    applyTagFilter();
  }

  function toggleAll(on: boolean) {
    for (const tag of DEBUG_TAGS) {
      enabledTags[tag.id] = on;
    }
    applyTagFilter();
  }

  export function setDebug(enabled: boolean) {
    debugMode = enabled;
  }

  $effect(() => {
    if (engineInstance) {
      applyTagFilter();
    }
  });

  // Multi-item drag proof: cmd/ctrl-click toggles selection within a list;
  // dragging any selected item drags the whole selected set together.
  let selectedVertical = $state<Set<number>>(new Set());
  function numberTree(values: readonly number[], prefix: string): RenderTree<number> {
    return createRenderTree(
      values.map((value) => createRenderEntry(value, `${prefix}-${value}`)),
    );
  }

  type SizedValue = { label: string; width: number; minHeight: number };
  type NestedValue = { kind: "item"; label: string } | { kind: "group" };
  type DragNestedValue =
    | { kind: "group"; id: string }
    | { kind: "item"; label: string };
  type MultiArea = "area1" | "area2";
  type MultiAreaValue =
    | { kind: "area"; area: MultiArea; label: string }
    | { kind: "item"; id: string; label: string };
  type LayerValue =
    | { kind: "leaf"; id: string; icon: string; name: string }
    | { kind: "group"; id: string; label: string };

  function nestedItemEntries(labels: readonly string[]) {
    return labels.map((label) =>
      createRenderEntry<NestedValue>({ kind: "item", label }, label),
    );
  }

  function dragItemEntries(labels: readonly string[]) {
    return labels.map((label) =>
      createRenderEntry<DragNestedValue>({ kind: "item", label }, label),
    );
  }

  function createMultiArea(
    area: MultiArea,
    label: string,
    items: readonly { id: string; label: string }[],
  ) {
    return createRenderEntry<MultiAreaValue>(
      { kind: "area", area, label },
      `multi-root-${area}`,
      createRenderTree(
        items.map((item) =>
          createRenderEntry<MultiAreaValue>({ kind: "item", ...item }, item.id),
        ),
      ),
    );
  }

  let verticalTree = $state.raw(numberTree([1, 2, 3, 4], "vertical"));
  let horizontalTree = $state.raw(
    numberTree(Array.from({ length: 12 }, (_, index) => index + 1), "wrap-row"),
  );
  let doubleRowTree = $state.raw(
    numberTree(Array.from({ length: 28 }, (_, index) => index + 1), "double-row"),
  );
  let sizedTree = $state.raw(
    createRenderTree<SizedValue>(
      [
        { label: "Small", width: 72, minHeight: 48 },
        { label: "Medium", width: 128, minHeight: 72 },
        { label: "Wide", width: 220, minHeight: 96 },
        { label: "Tall", width: 92, minHeight: 156 },
        { label: "Large", width: 168, minHeight: 120 },
        { label: "Narrow", width: 56, minHeight: 64 },
        { label: "Extra Wide", width: 260, minHeight: 72 },
      ].map((value) => createRenderEntry(value, value.label)),
    ),
  );
  let multiAreaTree = $state.raw(
    createRenderTree<MultiAreaValue>([
      createMultiArea("area1", "Area 1", [
        { id: "multi-a", label: "Item A" },
        { id: "multi-b", label: "Item B" },
        { id: "multi-c", label: "Item C" },
      ]),
      createMultiArea("area2", "Area 2", [
        { id: "multi-x", label: "Item X" },
        { id: "multi-y", label: "Item Y" },
        { id: "multi-z", label: "Item Z" },
      ]),
    ]),
  );
  let nestedGroupTree = $state.raw(
    createRenderTree<NestedValue>([
      createRenderEntry({ kind: "item", label: "Item 1" }, "Item 1"),
      createRenderEntry({ kind: "item", label: "Item 1.5" }, "Item 1.5"),
      createRenderEntry(
        { kind: "group" },
        "nested-sub-group",
        createRenderTree(nestedItemEntries(["Sub A1", "Sub A2", "Sub A3"])),
      ),
      createRenderEntry({ kind: "item", label: "Item 2" }, "Item 2"),
      createRenderEntry({ kind: "item", label: "Item 3" }, "Item 3"),
    ]),
  );

  // Stretch demo: items are genuinely 100% width (align-self: stretch), so
  // the containers declare `stretchItems` and the layout engine re-sizes
  // drop entries to each destination — the nested sub-list is markedly
  // narrower than its parent.
  let stretchTree = $state.raw(
    createRenderTree<NestedValue>([
      createRenderEntry({ kind: "item", label: "Task 1" }, "Task 1"),
      createRenderEntry({ kind: "item", label: "Task 2" }, "Task 2"),
      createRenderEntry(
        { kind: "group" },
        "stretch-sub-group",
        createRenderTree(
          nestedItemEntries(["Sub task 1", "Sub task 2", "Sub task 3"]),
        ),
      ),
      createRenderEntry({ kind: "item", label: "Task 3" }, "Task 3"),
    ]),
  );
  let compactTree = $state.raw(
    createRenderTree<NestedValue>([
      createRenderEntry({ kind: "item", label: "Overview" }, "Overview"),
      createRenderEntry({ kind: "item", label: "Components" }, "Components"),
      createRenderEntry({ kind: "item", label: "Usage" }, "Usage"),
      createRenderEntry(
        { kind: "group" },
        "compact-sub-group",
        createRenderTree(nestedItemEntries(["Container", "Item", "Handle"])),
      ),
    ]),
  );
  let dragNestedTree = $state.raw(
    createRenderTree<DragNestedValue>([
      createRenderEntry(
        { kind: "group", id: "group-1" },
        "group-1",
        createRenderTree(dragItemEntries(["Group 1 - A", "Group 1 - B"])),
      ),
      createRenderEntry(
        { kind: "group", id: "group-2" },
        "group-2",
        createRenderTree(
          dragItemEntries(["Group 2 - A", "Group 2 - B", "Group 2 - C"]),
        ),
      ),
      createRenderEntry({ kind: "item", label: "Loose Item" }, "Loose Item"),
    ]),
  );
  let nestedRowTree = $state.raw(
    createRenderTree<NestedValue>([
      createRenderEntry({ kind: "item", label: "R1" }, "R1"),
      createRenderEntry(
        { kind: "group" },
        "nested-row-sub-group",
        createRenderTree(nestedItemEntries(["S1", "S2", "S3"])),
      ),
      createRenderEntry({ kind: "item", label: "R2" }, "R2"),
      createRenderEntry({ kind: "item", label: "R3" }, "R3"),
    ]),
  );
  let layerTree = $state.raw(
    createRenderTree<LayerValue>([
      createRenderEntry(
        { kind: "leaf", id: "header", icon: "◻", name: "Header" },
        "header",
      ),
      createRenderEntry(
        { kind: "group", id: "hero-section", label: "Hero Section" },
        "hero-section",
        createRenderTree(
          [
            { id: "Avatar", icon: "○", name: "Avatar" },
            { id: "Title", icon: "T", name: "Title" },
            { id: "Subtitle", icon: "T", name: "Subtitle" },
          ].map((value) =>
            createRenderEntry<LayerValue>({ kind: "leaf", ...value }, value.id),
          ),
        ),
      ),
      createRenderEntry(
        { kind: "leaf", id: "card-grid", icon: "◻", name: "Card Grid" },
        "card-grid",
      ),
      createRenderEntry(
        { kind: "leaf", id: "footer", icon: "◻", name: "Footer" },
        "footer",
      ),
    ]),
  );

  const verticalCallbacks = renderTreeCallbacks(
    (event) => (verticalTree = reduceRenderTree(verticalTree, event)),
  );
  const horizontalCallbacks = renderTreeCallbacks(
    (event) => (horizontalTree = reduceRenderTree(horizontalTree, event)),
  );
  const doubleRowCallbacks = renderTreeCallbacks(
    (event) => (doubleRowTree = reduceRenderTree(doubleRowTree, event)),
  );
  const sizedCallbacks = renderTreeCallbacks(
    (event) => (sizedTree = reduceRenderTree(sizedTree, event)),
  );
  const multiAreaCallbacks = {
    ...renderTreeCallbacks(
      (event) => (multiAreaTree = reduceRenderTree(multiAreaTree, event)),
    ),
    canDrop: rejectDrop,
  } satisfies ContainerCallbacks;
  const nestedGroupCallbacks = renderTreeCallbacks(
    (event) => (nestedGroupTree = reduceRenderTree(nestedGroupTree, event)),
  );
  const stretchCallbacks = renderTreeCallbacks(
    (event) => (stretchTree = reduceRenderTree(stretchTree, event)),
  );
  const compactCallbacks = renderTreeCallbacks(
    (event) => (compactTree = reduceRenderTree(compactTree, event)),
  );
  const dragNestedCallbacks = renderTreeCallbacks(
    (event) => (dragNestedTree = reduceRenderTree(dragNestedTree, event)),
  );
  const nestedRowCallbacks = renderTreeCallbacks(
    (event) => (nestedRowTree = reduceRenderTree(nestedRowTree, event)),
  );
  const layerCallbacks = renderTreeCallbacks(
    (event) => (layerTree = reduceRenderTree(layerTree, event)),
  );

  function toggleVerticalSelection(n: number, event: MouseEvent) {
    if (event.metaKey || event.ctrlKey) {
      const next = new Set(selectedVertical);
      if (next.has(n)) {
        next.delete(n);
      } else {
        next.add(n);
      }
      selectedVertical = next;
    } else {
      selectedVertical = new Set([n]);
    }
  }
</script>

<div class="snapsort-demo dev-style">
  <h1>SnapSort</h1>

  <div class="snapsort-shell">
    <div class="engine-area">
      <Engine id="snapsort-combined-demo-canvas" debug={debugMode} bind:engine={engineInstance}>
        <div class="demo-grid">
          <article class="demo-cell wide horizontal-row-demo">
            <h2>Vertical Column</h2>
            <p class="demo-hint">Cmd/ctrl-click to multi-select, then drag any selected item.</p>
            <Container
              itemId="drop-snap-vertical-root"
              config={{ animation: defaultAnimations, callbacks: verticalCallbacks }}
              metadata={{ frameworkList: "vertical" }}
            >
              {#each verticalTree.entries as entry (entry.itemId)}
                {#if entry.isGhost}
                  <Ghost ghost={entry.ghost} />
                {:else if entry.childTree}
                  <Container itemId={entry.itemId} />
                {:else}
                <Item
                    itemId={entry.itemId}
                    className={selectedVertical.has(entry.value) ? "demo-item selected" : "demo-item"}
                    selected={selectedVertical.has(entry.value)}
                    onclick={(event) => toggleVerticalSelection(entry.value, event)}
                >
                    <p>Item {entry.value}</p>
                </Item>
                {/if}
              {/each}
            </Container>
          </article>

          <article class="demo-cell">
            <h2>Horizontal Row</h2>
            <Container
              itemId="drop-snap-horizontal-root"
              config={{ animation: defaultAnimations, direction: "row", callbacks: horizontalCallbacks }}
              metadata={{ frameworkList: "horizontal" }}
              locked={true}
            >
              {#each horizontalTree.entries as entry (entry.itemId)}
                {#if entry.isGhost}<Ghost ghost={entry.ghost} />
                {:else if entry.childTree}<Container itemId={entry.itemId} />
                {:else}<Item itemId={entry.itemId} className="demo-item row-item"><p>Item {entry.value}</p></Item>
                {/if}
              {/each}
            </Container>
          </article>

          <article class="demo-cell wide">
            <h2>Horizontal Double Row</h2>
            <Container
              itemId="drop-snap-double-row-root"
              config={{ animation: defaultAnimations, direction: "row", callbacks: doubleRowCallbacks }}
              metadata={{ frameworkList: "double" }}
            >
              {#each doubleRowTree.entries as entry (entry.itemId)}
                {#if entry.isGhost}
                  <Ghost ghost={entry.ghost}>
                  <span class="double-row-ghost-label">Drop</span>
                  </Ghost>
                {:else if entry.childTree}
                  <Container itemId={entry.itemId} />
                {:else}
                  <Item itemId={entry.itemId} className="demo-item row-item"><p>Item {entry.value}</p></Item>
                {/if}
              {/each}
            </Container>
          </article>

          <article class="demo-cell wide size-demo">
            <h2>Different Sizes</h2>
            <Container
              itemId="drop-snap-sizes-root"
              config={{ animation: defaultAnimations, direction: "row", callbacks: sizedCallbacks }}
              metadata={{ frameworkList: "sizes" }}
            >
              {#each sizedTree.entries as entry (entry.itemId)}
                {#if entry.isGhost}<Ghost ghost={entry.ghost} />
                {:else if entry.childTree}<Container itemId={entry.itemId} />
                {:else}<Item itemId={entry.itemId} className="demo-item size-item">
                  <p style="width: {entry.value.width}px; min-height: {entry.value.minHeight}px;">{entry.value.label}</p>
                </Item>{/if}
              {/each}
            </Container>
          </article>

          <article class="demo-cell">
            <h2>Multiple Drop Areas</h2>
            <Container
              itemId="drop-snap-multi-root"
              config={{
                animation: defaultAnimations,
                direction: "row",
                name: "multi-root",
                callbacks: multiAreaCallbacks,
              }}
              locked={true}
            >
              {#each multiAreaTree.entries as entry (entry.itemId)}
                {#if entry.isGhost}
                  <Ghost ghost={entry.ghost} />
                {:else if entry.childTree && entry.value.kind === "area"}
                <Container
                    itemId={entry.itemId}
                    config={{ animation: defaultAnimations, direction: "column", name: `multi-${entry.value.area}` }}
                    metadata={{ area: entry.value.area }}
                  locked={true}
                >
                    <h3>{entry.value.label}</h3>
                    {#each entry.childTree.entries as child (child.itemId)}
                      {#if child.isGhost}<Ghost ghost={child.ghost} />
                      {:else if child.childTree}<Container itemId={child.itemId} />
                      {:else if child.value.kind === "item"}<Item itemId={child.itemId} className="demo-item"><p>{child.value.label}</p></Item>
                      {/if}
                    {/each}
                </Container>
                {:else if entry.value.kind === "item"}
                  <Item itemId={entry.itemId} className="demo-item"><p>{entry.value.label}</p></Item>
                {/if}
              {/each}
            </Container>
          </article>

          <article class="demo-cell">
            <h2>Nested Container</h2>
            <Container
              itemId="drop-snap-nested-root"
              config={{ direction: "column", callbacks: nestedGroupCallbacks, ...nestedAnimationConfig }}
              metadata={{ frameworkList: "nested-outer" }}
              locked={true}
            >
              {#each nestedGroupTree.entries as entry (entry.itemId)}
                {#if entry.isGhost}
                  <Ghost ghost={entry.ghost} />
                {:else if entry.childTree}
                  <Container
                    itemId={entry.itemId}
                    config={{ direction: "column", ...nestedAnimationConfig }}
                    metadata={{ frameworkList: "nested-inner" }}
                    locked={lockNestedChild}
                  >
                    {#each entry.childTree.entries as child (child.itemId)}
                      {#if child.isGhost}<Ghost ghost={child.ghost} />
                      {:else if child.childTree}<Container itemId={child.itemId} />
                      {:else if child.value.kind === "item"}<Item itemId={child.itemId} className="demo-item sub-item"><p>{child.value.label}</p></Item>
                      {/if}
                    {/each}
                  </Container>
                {:else if entry.value.kind === "item"}
                  <Item itemId={entry.itemId} className="demo-item"><p>{entry.value.label}</p></Item>
                {/if}
              {/each}
            </Container>
          </article>

          <article class="demo-cell stretch-nested-demo">
            <h2>Stretch Nested</h2>
            <p class="demo-hint">Items fill their container (100% width); the nested list is narrower.</p>
            <Container
              itemId="drop-snap-stretch-root"
              className="stretch-list"
              config={{ direction: "column", wrap: "nowrap", stretchItems: true, callbacks: stretchCallbacks, ...nestedAnimationConfig }}
              metadata={{ frameworkList: "stretch-outer" }}
              locked={true}
            >
              {#each stretchTree.entries as entry (entry.itemId)}
                {#if entry.isGhost}
                  <Ghost ghost={entry.ghost} />
                {:else if entry.childTree}
                  <Container
                    itemId={entry.itemId}
                    className="stretch-sublist"
                    config={{ direction: "column", wrap: "nowrap", stretchItems: true, ...nestedAnimationConfig }}
                    metadata={{ frameworkList: "stretch-inner" }}
                  >
                    {#each entry.childTree.entries as child (child.itemId)}
                      {#if child.isGhost}<Ghost ghost={child.ghost} />
                      {:else if child.childTree}<Container itemId={child.itemId} />
                      {:else if child.value.kind === "item"}<Item itemId={child.itemId} className="demo-item stretch-item"><p>{child.value.label}</p></Item>
                      {/if}
                    {/each}
                  </Container>
                {:else if entry.value.kind === "item"}
                  <Item itemId={entry.itemId} className="demo-item stretch-item"><p>{entry.value.label}</p></Item>
                {/if}
              {/each}
            </Container>
          </article>

          {#if showCompactNested}
            <article class="demo-cell compact-nested-demo">
              <h2>Compact Nested List</h2>
              <Container
                itemId="drop-snap-compact-root"
                className="compact-basic-list"
                config={{ direction: "column", callbacks: compactCallbacks, ...nestedAnimationConfig }}
                metadata={{ frameworkList: "compact-outer" }}
              >
                {#each compactTree.entries as entry (entry.itemId)}
                  {#if entry.isGhost}
                    <Ghost ghost={entry.ghost} />
                  {:else if entry.childTree}
                    <Container
                      itemId={entry.itemId}
                      className="compact-nested-list"
                      config={{ direction: "column", ...nestedAnimationConfig }}
                      metadata={{ frameworkList: "compact-inner" }}
                    >
                      {#each entry.childTree.entries as child (child.itemId)}
                        {#if child.isGhost}<Ghost ghost={child.ghost} />
                        {:else if child.childTree}<Container itemId={child.itemId} />
                        {:else if child.value.kind === "item"}<Item itemId={child.itemId} className="compact-item"><p>{child.value.label}</p></Item>
                        {/if}
                      {/each}
                    </Container>
                  {:else if entry.value.kind === "item"}
                    <Item itemId={entry.itemId} className="compact-item"><p>{entry.value.label}</p></Item>
                  {/if}
                {/each}
              </Container>
            </article>
          {/if}

          <article class="demo-cell">
            <h2>Draggable Sub-Containers</h2>
            <Container
              itemId="drop-snap-draggable-nested-root"
              config={{ animation: defaultAnimations, direction: "column", callbacks: dragNestedCallbacks }}
              metadata={{ frameworkList: "drag-outer" }}
              locked={true}
            >
              {#each dragNestedTree.entries as entry (entry.itemId)}
                {#if entry.isGhost}
                  <Ghost ghost={entry.ghost} />
                {:else if entry.childTree && entry.value.kind === "group"}
                  <Container
                    itemId={entry.itemId}
                    config={{ animation: defaultAnimations, direction: "column" }}
                    metadata={{ frameworkList: `drag-${entry.value.id}` }}
                    locked={false}
                  >
                    {#each entry.childTree.entries as child (child.itemId)}
                      {#if child.isGhost}<Ghost ghost={child.ghost} />
                      {:else if child.childTree}<Container itemId={child.itemId} />
                      {:else if child.value.kind === "item"}<Item itemId={child.itemId} className="demo-item sub-item"><p>{child.value.label}</p></Item>
                      {/if}
                    {/each}
                  </Container>
                {:else if entry.value.kind === "item"}
                  <Item itemId={entry.itemId} className="demo-item"><p>{entry.value.label}</p></Item>
                {/if}
              {/each}
            </Container>
          </article>

          <article class="demo-cell">
            <h2>Nested Row Groups</h2>
            <Container
              itemId="drop-snap-nested-row-root"
              config={{ animation: defaultAnimations, direction: "row", callbacks: nestedRowCallbacks }}
              metadata={{ frameworkList: "row-outer" }}
              locked={true}
            >
              {#each nestedRowTree.entries as entry (entry.itemId)}
                {#if entry.isGhost}
                  <Ghost ghost={entry.ghost} />
                {:else if entry.childTree}
                  <Container
                    itemId={entry.itemId}
                    config={{ animation: defaultAnimations, direction: "row" }}
                    metadata={{ frameworkList: "row-inner" }}
                    locked={false}
                  >
                    {#each entry.childTree.entries as child (child.itemId)}
                      {#if child.isGhost}<Ghost ghost={child.ghost} />
                      {:else if child.childTree}<Container itemId={child.itemId} />
                      {:else if child.value.kind === "item"}<Item itemId={child.itemId} className="demo-item row-item sub-item"><p>{child.value.label}</p></Item>
                      {/if}
                    {/each}
                  </Container>
                {:else if entry.value.kind === "item"}
                  <Item itemId={entry.itemId} className="demo-item row-item"><p>{entry.value.label}</p></Item>
                {/if}
              {/each}
            </Container>
          </article>

          <article class="demo-cell">
            <h2>Layers Panel</h2>
            <Container
              itemId="drop-snap-layers-root"
              config={{ animation: defaultAnimations, direction: "column", callbacks: layerCallbacks }}
              metadata={{ frameworkList: "layers-outer" }}
              locked={true}
            >
              {#each layerTree.entries as entry (entry.itemId)}
                {#if entry.isGhost}
                  <Ghost ghost={entry.ghost} />
                {:else if entry.childTree && entry.value.kind === "group"}
                  <Container
                    itemId={entry.itemId}
                    config={{ animation: defaultAnimations, direction: "column" }}
                    metadata={{ frameworkList: `layers-${entry.value.id}` }}
                    locked={false}
                  >
                    <div class="group-label">{entry.value.label}</div>
                    {#each entry.childTree.entries as child (child.itemId)}
                      {#if child.isGhost}
                        <Ghost ghost={child.ghost} />
                      {:else if child.childTree}
                        <Container itemId={child.itemId} />
                      {:else if child.value.kind === "leaf"}
                        <Item itemId={child.itemId} className="layer-item">
                          <div class="layer-row">
                            <span class="layer-icon">{child.value.icon}</span>
                            <span>{child.value.name}</span>
                          </div>
                        </Item>
                      {/if}
                    {/each}
                  </Container>
                {:else if entry.value.kind === "leaf"}
                  <Item itemId={entry.itemId} className="layer-item">
                    <div class="layer-row">
                      <span class="layer-icon">{entry.value.icon}</span>
                      <span>{entry.value.name}</span>
                    </div>
                  </Item>
                {/if}
              {/each}
            </Container>
          </article>
        </div>
      </Engine>
    </div>

    {#if debugMode}
      <aside class="debug-sidebar">
        <div class="debug-sidebar-header">
          <h2>Debug Tags</h2>
          <div class="debug-sidebar-actions">
            <button onclick={() => toggleAll(true)}>All</button>
            <button onclick={() => toggleAll(false)}>None</button>
          </div>
        </div>
        {#each DEBUG_TAGS as tag}
          <label class="debug-tag-item">
            <input type="checkbox" checked={enabledTags[tag.id]} onchange={() => onTagChange(tag.id)} />
            <span></span>
            {tag.label}
          </label>
        {/each}
      </aside>
    {/if}
  </div>
</div>

<style lang="scss">
  .snapsort-demo {
    width: 100%;
    min-height: 100%;
    overflow: visible;
    background: #fff;
    box-sizing: border-box;
    padding: var(--size-24);
    display: flex;
    flex-direction: column;
    gap: var(--size-24);
  }

  h1 {
    margin: 0;
    font-family: "Geist", sans-serif;
    font-size: 72px;
    line-height: 1;
    color: #000;
  }

  .snapsort-shell {
    display: flex;
    align-items: stretch;
    gap: var(--size-24);
  }

  .engine-area {
    flex: 1;
    min-width: 0;
  }

  .demo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--size-24);
    align-items: start;
    pointer-events: auto;
  }

  .demo-cell {
    min-height: 240px;
    border: 2px solid #000;
    background: #fff;
    box-sizing: border-box;
    padding: var(--size-16);
  }

  .demo-cell.wide {
    grid-column: span 2;
  }

  .demo-cell.size-demo {
    min-height: 360px;
  }

  .horizontal-row-demo :global(.snapsort-container) {
    max-width: 300px;
  }

  h2 {
    margin: 0 0 var(--size-16);
    font-family: "Geist", sans-serif;
    font-size: 24px;
    font-weight: 500;
    color: #000;
  }

  h3 {
    margin: var(--size-8) 0;
    font-family: "Geist", sans-serif;
    font-size: 16px;
    font-weight: 500;
    color: #000;
  }

  :global(.snapsort-container) {
    gap: var(--size-8);
    min-height: 40px;
  }

  :global(.snapsort-container .snapsort-container) {
    border: 2px solid #000;
    padding: var(--size-8);
  }

  :global(.demo-item),
  :global(.layer-item),
  :global(.snapsort-item) {
    margin: var(--size-4);
    border: 2px solid #000;
    background: #fff;
    cursor: grab;
    box-sizing: border-box;
  }

  :global(.demo-item:active),
  :global(.layer-item:active),
  :global(.snapsort-item:active) {
    cursor: grabbing;
  }

  :global(.demo-item p) {
    margin: 0;
    padding: var(--size-8) var(--size-12);
    font-size: 1rem;
    user-select: none;
  }

  .size-demo :global(.snapsort-container) {
    align-items: flex-start;
    min-height: 240px;
  }

  :global(.demo-item.size-item p) {
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    text-align: center;
  }

  :global(.demo-item.row-item) {
    min-width: 50px;
    text-align: center;
  }

  :global(.demo-item.selected) {
    border-color: #6366f1;
    box-shadow: inset 0 0 0 2px #6366f1;
    background: #eef2ff;
  }

  .demo-hint {
    margin: 0 0 var(--size-8);
    font-size: 0.75rem;
    color: #888;
  }

  :global(.demo-item.sub-item) {
    opacity: 0.6;
  }

  .stretch-nested-demo :global(.stretch-list) {
    width: 300px;
  }

  .stretch-nested-demo :global(.snapsort-container .stretch-sublist) {
    width: 55%;
    align-self: flex-start;
  }

  .stretch-nested-demo :global(.demo-item.stretch-item) {
    width: auto;
    align-self: stretch;
  }

  .compact-nested-demo :global(.compact-basic-list) {
    width: 336px;
    gap: 0.35rem;
    min-height: 0;
    align-items: flex-start;
  }

  .compact-nested-demo :global(.snapsort-container .compact-nested-list) {
    width: calc(100% - 2rem);
    margin-left: 2rem;
    padding: 0 0 0 12px;
    border: 0;
    border-left: 1px solid #cfd4d7;
    gap: 0.35rem;
    min-height: 0;
    align-items: flex-start;
  }

  .compact-nested-demo :global(.compact-item.snapsort-item) {
    margin: 0;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #fff;
  }

  .compact-nested-demo :global(.compact-item p) {
    margin: 0;
    padding: 4px 10px 5px;
    font-size: 14px;
    line-height: 20px;
    user-select: none;
  }

  :global(.ghost) {
    background: #e5e5e5;
    border: 2px solid #9a9a9a;
    box-sizing: border-box;
    opacity: 1;
  }

  :global(.double-row-ghost-label) {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    background: #eef2ff;
    border: 2px dashed #6366f1;
    box-sizing: border-box;
    font-size: 0.7rem;
    color: #6366f1;
    user-select: none;
  }

  .layer-row {
    display: flex;
    align-items: center;
    gap: var(--size-8);
    padding: var(--size-8) var(--size-12);
    user-select: none;
    font-size: 1rem;
  }

  .layer-icon {
    width: var(--size-16);
    text-align: center;
  }

  .group-label {
    padding: var(--size-8) var(--size-12);
    font-size: 1rem;
    font-weight: 500;
    border-bottom: 2px solid #000;
  }

  .debug-sidebar {
    width: 260px;
    flex-shrink: 0;
    background: #fff;
    border: 2px solid #000;
    padding: var(--size-16);
    box-sizing: border-box;
    pointer-events: auto;
  }

  .debug-sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-12);
    margin-bottom: var(--size-16);
  }

  .debug-sidebar-actions {
    display: flex;
    gap: var(--size-8);
  }

  .debug-tag-item {
    display: flex;
    align-items: center;
    gap: var(--size-8);
    padding: var(--size-4) 0;
    cursor: pointer;
    user-select: none;
  }

  @media (max-width: 900px) {
    .snapsort-shell {
      flex-direction: column;
    }

    .demo-cell.wide {
      grid-column: auto;
    }

    .debug-sidebar {
      width: 100%;
    }
  }
</style>
