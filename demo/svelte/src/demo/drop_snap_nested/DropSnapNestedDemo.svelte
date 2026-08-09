<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";
  import type { Engine as EngineClass } from "@snap-engine/core";
  import type { ItemMoveEvent } from "@snap-engine/snapsort";

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
    : {};

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
  let verticalItems = $state([1, 2, 3, 4]);

  // Migrated to the items+snippet Container API (with a custom `ghost`
  // snippet) as the Stage 2 adapter-ergonomics proof of concept.
  let doubleRowItems = $state(Array.from({ length: 28 }, (_, index) => index + 1));

  // Cross-container items-mode surface: proves the adapter's per-container
  // ghostEntries state doesn't leak a stale ghost into the area a run
  // anchor left (the fix in flow-ghost.ts's moveGhost/doMove).
  type MultiAreaItem = { id: string; label: string };
  type MultiArea = "area1" | "area2";
  let multiArea1Items = $state<MultiAreaItem[]>([
    { id: "multi-a", label: "Item A" },
    { id: "multi-b", label: "Item B" },
    { id: "multi-c", label: "Item C" },
  ]);
  let multiArea2Items = $state<MultiAreaItem[]>([
    { id: "multi-x", label: "Item X" },
    { id: "multi-y", label: "Item Y" },
    { id: "multi-z", label: "Item Z" },
  ]);
  const multiAreaZones: MultiArea[] = ["area1", "area2"];

  function multiAreaList(area: MultiArea): MultiAreaItem[] {
    return area === "area1" ? multiArea1Items : multiArea2Items;
  }

  function setMultiAreaList(area: MultiArea, next: MultiAreaItem[]) {
    if (area === "area1") multiArea1Items = next;
    else multiArea2Items = next;
  }

  function handleMultiAreaMove(event: ItemMoveEvent) {
    const itemId = event.itemId;
    if (typeof itemId !== "string") return;
    const targetArea = event.to.containerMetadata.area as MultiArea | undefined;
    if (targetArea !== "area1" && targetArea !== "area2") return;

    const sourceArea: MultiArea = multiArea1Items.some((i) => i.id === itemId)
      ? "area1"
      : "area2";
    const moved = multiAreaList(sourceArea).find((i) => i.id === itemId);
    if (!moved) return;

    if (sourceArea !== targetArea) {
      setMultiAreaList(sourceArea, multiAreaList(sourceArea).filter((i) => i.id !== itemId));
    }
    const targetList = multiAreaList(targetArea).filter((i) => i.id !== itemId);
    const index = Math.max(0, Math.min(event.to.index, targetList.length));
    targetList.splice(index, 0, moved);
    setMultiAreaList(targetArea, targetList);
  }

  let horizontalRowItems = $state(Array.from({ length: 12 }, (_, index) => index + 1));

  let sizedItems = $state([
    { label: "Small", width: 72, minHeight: 48 },
    { label: "Medium", width: 128, minHeight: 72 },
    { label: "Wide", width: 220, minHeight: 96 },
    { label: "Tall", width: 92, minHeight: 156 },
    { label: "Large", width: 168, minHeight: 120 },
    { label: "Narrow", width: 56, minHeight: 64 },
    { label: "Extra Wide", width: 260, minHeight: 72 },
  ]);

  type NestedGroupEntry = { kind: "item"; label: string } | { kind: "group" };
  let nestedGroupEntries: NestedGroupEntry[] = $state([
    { kind: "item", label: "Item 1" },
    { kind: "item", label: "Item 1.5" },
    { kind: "group" },
    { kind: "item", label: "Item 2" },
    { kind: "item", label: "Item 3" },
  ]);
  let nestedGroupChildren = $state(["Sub A1", "Sub A2", "Sub A3"]);

  // Stretch demo: items are genuinely 100% width (align-self: stretch), so
  // the containers declare `stretchItems` and the layout engine re-sizes
  // drop entries to each destination — the nested sub-list is markedly
  // narrower than its parent.
  type StretchEntry = { kind: "item"; label: string } | { kind: "group" };
  let stretchEntries: StretchEntry[] = $state([
    { kind: "item", label: "Task 1" },
    { kind: "item", label: "Task 2" },
    { kind: "group" },
    { kind: "item", label: "Task 3" },
  ]);
  let stretchGroupChildren = $state(["Sub task 1", "Sub task 2", "Sub task 3"]);

  type CompactEntry = { kind: "item"; label: string } | { kind: "group" };
  let compactEntries: CompactEntry[] = $state([
    { kind: "item", label: "Overview" },
    { kind: "item", label: "Components" },
    { kind: "item", label: "Usage" },
    { kind: "group" },
  ]);
  let compactGroupChildren = $state(["Container", "Item", "Handle"]);

  type DragNestedEntry = { kind: "group"; id: string; labels: string[] } | { kind: "item"; label: string };
  let dragNestedEntries: DragNestedEntry[] = $state([
    { kind: "group", id: "group-1", labels: ["Group 1 - A", "Group 1 - B"] },
    { kind: "group", id: "group-2", labels: ["Group 2 - A", "Group 2 - B", "Group 2 - C"] },
    { kind: "item", label: "Loose Item" },
  ]);

  type NestedRowEntry = { kind: "item"; label: string } | { kind: "group" };
  let nestedRowEntries: NestedRowEntry[] = $state([
    { kind: "item", label: "R1" },
    { kind: "group" },
    { kind: "item", label: "R2" },
    { kind: "item", label: "R3" },
  ]);
  let nestedRowChildren = $state(["S1", "S2", "S3"]);

  type LayerEntry =
    | { kind: "leaf"; id: string; icon: string; name: string }
    | { kind: "group"; id: string; label: string; children: { icon: string; name: string }[] };
  let layerEntries: LayerEntry[] = $state([
    { kind: "leaf", id: "header", icon: "◻", name: "Header" },
    {
      kind: "group",
      id: "hero-section",
      label: "Hero Section",
      children: [
        { icon: "○", name: "Avatar" },
        { icon: "T", name: "Title" },
        { icon: "T", name: "Subtitle" },
      ],
    },
    { kind: "leaf", id: "card-grid", icon: "◻", name: "Card Grid" },
    { kind: "leaf", id: "footer", icon: "◻", name: "Footer" },
  ]);

  type FrameworkList = {
    id: string;
    getItems: () => unknown[];
    setItems: (items: unknown[]) => void;
    getItemId: (item: unknown) => string;
    prepareItem?: (item: unknown, itemId: string) => unknown | undefined;
  };

  function moveFrameworkItem(event: ItemMoveEvent, lists: FrameworkList[]) {
    const targetListId = event.to.containerMetadata.frameworkList;
    const target = lists.find((list) => list.id === targetListId) ??
      (lists.length === 1 ? lists[0] : undefined);
    if (!target) return;

    const movedIds = event.itemIds.map(String);
    const movedSet = new Set(movedIds);
    const preparedItems: unknown[] = [];
    for (const itemId of movedIds) {
      let moved: unknown;
      for (const list of lists) {
        moved = list.getItems().find((item) => list.getItemId(item) === itemId);
        if (moved !== undefined) break;
      }
      if (moved === undefined) continue;
      const prepared = target.prepareItem ? target.prepareItem(moved, itemId) : moved;
      if (prepared === undefined) return;
      preparedItems.push(prepared);
    }
    if (preparedItems.length === 0) return;

    for (const list of lists) {
      const current = list.getItems();
      if (!current.some((item) => movedSet.has(list.getItemId(item)))) continue;
      list.setItems(current.filter((item) => !movedSet.has(list.getItemId(item))));
    }
    const next = target.getItems().filter((item) => !movedSet.has(target.getItemId(item)));
    const index = Math.max(0, Math.min(event.to.index, next.length));
    next.splice(index, 0, ...preparedItems);
    target.setItems(next);
  }

  function flatList<T>(
    id: string,
    getItems: () => T[],
    setItems: (items: T[]) => void,
    getItemId: (item: T) => string,
    prepareItem?: (item: unknown, itemId: string) => T | undefined,
  ): FrameworkList {
    return {
      id,
      getItems: () => getItems(),
      setItems: (items) => setItems(items as T[]),
      getItemId: (item) => getItemId(item as T),
      prepareItem,
    };
  }

  function handleVerticalMove(event: ItemMoveEvent) {
    moveFrameworkItem(event, [flatList("vertical", () => verticalItems, (items) => verticalItems = items, (item) => `vertical-${item}`)]);
  }

  function handleHorizontalMove(event: ItemMoveEvent) {
    moveFrameworkItem(event, [flatList("horizontal", () => horizontalRowItems, (items) => horizontalRowItems = items, (item) => `wrap-row-${item}`)]);
  }

  function handleDoubleRowMove(event: ItemMoveEvent) {
    moveFrameworkItem(event, [flatList("double", () => doubleRowItems, (items) => doubleRowItems = items, (item) => `double-row-${item}`)]);
  }

  function handleSizedMove(event: ItemMoveEvent) {
    moveFrameworkItem(event, [flatList("sizes", () => sizedItems, (items) => sizedItems = items, (item) => item.label)]);
  }

  function handleNestedGroupMove(event: ItemMoveEvent) {
    moveFrameworkItem(event, [
      flatList("nested-outer", () => nestedGroupEntries, (items) => nestedGroupEntries = items, (item) => item.kind === "item" ? item.label : "nested-sub-group", (item) => typeof item === "string" ? { kind: "item", label: item } : item as NestedGroupEntry),
      flatList("nested-inner", () => nestedGroupChildren, (items) => nestedGroupChildren = items, String, (item) => typeof item === "string" ? item : (item as NestedGroupEntry).kind === "item" ? (item as { kind: "item"; label: string }).label : undefined),
    ]);
  }

  function handleStretchMove(event: ItemMoveEvent) {
    moveFrameworkItem(event, [
      flatList("stretch-outer", () => stretchEntries, (items) => stretchEntries = items, (item) => item.kind === "item" ? item.label : "stretch-sub-group", (item) => typeof item === "string" ? { kind: "item", label: item } : item as StretchEntry),
      flatList("stretch-inner", () => stretchGroupChildren, (items) => stretchGroupChildren = items, String, (item) => typeof item === "string" ? item : (item as StretchEntry).kind === "item" ? (item as { kind: "item"; label: string }).label : undefined),
    ]);
  }

  function handleCompactMove(event: ItemMoveEvent) {
    moveFrameworkItem(event, [
      flatList("compact-outer", () => compactEntries, (items) => compactEntries = items, (item) => item.kind === "item" ? item.label : "compact-sub-group", (item) => typeof item === "string" ? { kind: "item", label: item } : item as CompactEntry),
      flatList("compact-inner", () => compactGroupChildren, (items) => compactGroupChildren = items, String, (item) => typeof item === "string" ? item : (item as CompactEntry).kind === "item" ? (item as { kind: "item"; label: string }).label : undefined),
    ]);
  }

  function setDragNestedChildren(groupId: string, labels: string[]) {
    dragNestedEntries = dragNestedEntries.map((entry) =>
      entry.kind === "group" && entry.id === groupId ? { ...entry, labels } : entry,
    );
  }

  function handleDragNestedMove(event: ItemMoveEvent) {
    moveFrameworkItem(event, [
      flatList("drag-outer", () => dragNestedEntries, (items) => dragNestedEntries = items, (item) => item.kind === "group" ? item.id : item.label, (item) => typeof item === "string" ? { kind: "item", label: item } : item as DragNestedEntry),
      ...dragNestedEntries.filter((entry) => entry.kind === "group").map((entry) =>
        flatList(`drag-${entry.id}`, () => entry.labels, (items) => setDragNestedChildren(entry.id, items), String, (item) => typeof item === "string" ? item : (item as DragNestedEntry).kind === "item" ? (item as { kind: "item"; label: string }).label : undefined),
      ),
    ]);
  }

  function handleNestedRowMove(event: ItemMoveEvent) {
    moveFrameworkItem(event, [
      flatList("row-outer", () => nestedRowEntries, (items) => nestedRowEntries = items, (item) => item.kind === "item" ? item.label : "nested-row-sub-group", (item) => typeof item === "string" ? { kind: "item", label: item } : item as NestedRowEntry),
      flatList("row-inner", () => nestedRowChildren, (items) => nestedRowChildren = items, String, (item) => typeof item === "string" ? item : (item as NestedRowEntry).kind === "item" ? (item as { kind: "item"; label: string }).label : undefined),
    ]);
  }

  function setLayerChildren(groupId: string, children: { icon: string; name: string }[]) {
    layerEntries = layerEntries.map((entry) =>
      entry.kind === "group" && entry.id === groupId ? { ...entry, children } : entry,
    );
  }

  function handleLayerMove(event: ItemMoveEvent) {
    moveFrameworkItem(event, [
      flatList("layers-outer", () => layerEntries, (items) => layerEntries = items, (item) => item.id, (item, itemId) => "kind" in (item as object) ? item as LayerEntry : { kind: "leaf", id: itemId, ...(item as { icon: string; name: string }) }),
      ...layerEntries.filter((entry) => entry.kind === "group").map((entry) =>
        flatList(`layers-${entry.id}`, () => entry.children, (items) => setLayerChildren(entry.id, items), (item) => item.name, (item) => "kind" in (item as object) ? (item as LayerEntry).kind === "leaf" ? { icon: (item as Extract<LayerEntry, { kind: "leaf" }>).icon, name: (item as Extract<LayerEntry, { kind: "leaf" }>).name } : undefined : item as { icon: string; name: string }),
      ),
    ]);
  }

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
              config={{ groupID: "vertical-group", callbacks: { onItemMove: handleVerticalMove } }}
              metadata={{ frameworkList: "vertical" }}
              items={verticalItems}
              getItemId={(n) => `vertical-${n}`}
            >
              {#snippet entry(n)}
                <Item
                  itemId={`vertical-${n}`}
                  className={selectedVertical.has(n) ? "demo-item selected" : "demo-item"}
                  selected={selectedVertical.has(n)}
                  onclick={(event) => toggleVerticalSelection(n, event)}
                >
                  <p>Item {n}</p>
                </Item>
              {/snippet}
            </Container>
          </article>

          <article class="demo-cell">
            <h2>Horizontal Row</h2>
            <Container
              config={{ direction: "row", groupID: "wrap-row", callbacks: { onItemMove: handleHorizontalMove } }}
              metadata={{ frameworkList: "horizontal" }}
              locked={true}
              items={horizontalRowItems}
              getItemId={(n) => `wrap-row-${n}`}
            >
              {#snippet entry(n)}
                <Item itemId={`wrap-row-${n}`} className="demo-item row-item"><p>Item {n}</p></Item>
              {/snippet}
            </Container>
          </article>

          <article class="demo-cell wide">
            <h2>Horizontal Double Row</h2>
            <Container
              config={{ direction: "row", groupID: "double-row-group", callbacks: { onItemMove: handleDoubleRowMove } }}
              metadata={{ frameworkList: "double" }}
              items={doubleRowItems}
              getItemId={(n) => `double-row-${n}`}
            >
              {#snippet entry(n)}
                <Item itemId={`double-row-${n}`} className="demo-item row-item"><p>Item {n}</p></Item>
              {/snippet}
              {#snippet ghost(event)}
                <Ghost {event}>
                  <span class="double-row-ghost-label">Drop</span>
                </Ghost>
              {/snippet}
            </Container>
          </article>

          <article class="demo-cell wide size-demo">
            <h2>Different Sizes</h2>
            <Container
              config={{ direction: "row", groupID: "sizes-group", callbacks: { onItemMove: handleSizedMove } }}
              metadata={{ frameworkList: "sizes" }}
              items={sizedItems}
              getItemId={(entry) => entry.label}
            >
              {#snippet entry(entry)}
                <Item itemId={entry.label} className="demo-item size-item">
                  <p style="width: {entry.width}px; min-height: {entry.minHeight}px;">{entry.label}</p>
                </Item>
              {/snippet}
            </Container>
          </article>

          <article class="demo-cell">
            <h2>Multiple Drop Areas</h2>
            <Container
              config={{ direction: "row", name: "multi-root", noDrop: true }}
              locked={true}
              items={multiAreaZones}
              getItemId={(area) => `multi-root-${area}`}
            >
              {#snippet entry(area)}
                <Container
                  itemId={`multi-root-${area}`}
                  config={{ direction: "column", name: `multi-${area}`, callbacks: { onItemMove: handleMultiAreaMove } }}
                  metadata={{ area }}
                  locked={true}
                  items={multiAreaList(area)}
                  getItemId={(entry) => entry.id}
                >
                  {#snippet before()}<h3>{area === "area1" ? "Area 1" : "Area 2"}</h3>{/snippet}
                  {#snippet entry(entry)}
                    <Item itemId={entry.id} className="demo-item"><p>{entry.label}</p></Item>
                  {/snippet}
                </Container>
              {/snippet}
            </Container>
          </article>

          <article class="demo-cell">
            <h2>Nested Container</h2>
            <Container
              config={{ direction: "column", groupID: "nested-group", callbacks: { onItemMove: handleNestedGroupMove }, ...nestedAnimationConfig }}
              metadata={{ frameworkList: "nested-outer" }}
              locked={true}
              items={nestedGroupEntries}
              getItemId={(e) => (e.kind === "item" ? e.label : "nested-sub-group")}
            >
              {#snippet entry(e)}
                {#if e.kind === "item"}
                  <Item itemId={e.label} className="demo-item"><p>{e.label}</p></Item>
                {:else}
                  <Container
                    itemId="nested-sub-group"
                    config={{ direction: "column", groupID: "nested-group", callbacks: { onItemMove: handleNestedGroupMove }, ...nestedAnimationConfig }}
                    metadata={{ frameworkList: "nested-inner" }}
                    locked={lockNestedChild}
                    items={nestedGroupChildren}
                    getItemId={(label) => label}
                  >
                    {#snippet entry(label)}
                      <Item itemId={label} className="demo-item sub-item"><p>{label}</p></Item>
                    {/snippet}
                  </Container>
                {/if}
              {/snippet}
            </Container>
          </article>

          <article class="demo-cell stretch-nested-demo">
            <h2>Stretch Nested</h2>
            <p class="demo-hint">Items fill their container (100% width); the nested list is narrower.</p>
            <Container
              className="stretch-list"
              config={{ direction: "column", wrap: "nowrap", stretchItems: true, groupID: "stretch-nested", callbacks: { onItemMove: handleStretchMove }, ...nestedAnimationConfig }}
              metadata={{ frameworkList: "stretch-outer" }}
              locked={true}
              items={stretchEntries}
              getItemId={(e) => (e.kind === "item" ? e.label : "stretch-sub-group")}
            >
              {#snippet entry(e)}
                {#if e.kind === "item"}
                  <Item itemId={e.label} className="demo-item stretch-item"><p>{e.label}</p></Item>
                {:else}
                  <Container
                    itemId="stretch-sub-group"
                    className="stretch-sublist"
                    config={{ direction: "column", wrap: "nowrap", stretchItems: true, groupID: "stretch-nested", callbacks: { onItemMove: handleStretchMove }, ...nestedAnimationConfig }}
                    metadata={{ frameworkList: "stretch-inner" }}
                    items={stretchGroupChildren}
                    getItemId={(label) => label}
                  >
                    {#snippet entry(label)}
                      <Item itemId={label} className="demo-item stretch-item"><p>{label}</p></Item>
                    {/snippet}
                  </Container>
                {/if}
              {/snippet}
            </Container>
          </article>

          {#if showCompactNested}
            <article class="demo-cell compact-nested-demo">
              <h2>Compact Nested List</h2>
              <Container
                className="compact-basic-list"
                config={{ direction: "column", groupID: "compact-nested", callbacks: { onItemMove: handleCompactMove }, ...nestedAnimationConfig }}
                metadata={{ frameworkList: "compact-outer" }}
                items={compactEntries}
                getItemId={(e) => (e.kind === "item" ? e.label : "compact-sub-group")}
              >
                {#snippet entry(e)}
                  {#if e.kind === "item"}
                    <Item itemId={e.label} className="compact-item"><p>{e.label}</p></Item>
                  {:else}
                    <Container
                      itemId="compact-sub-group"
                      className="compact-nested-list"
                      config={{ direction: "column", groupID: "compact-nested", callbacks: { onItemMove: handleCompactMove }, ...nestedAnimationConfig }}
                      metadata={{ frameworkList: "compact-inner" }}
                      items={compactGroupChildren}
                      getItemId={(label) => label}
                    >
                      {#snippet entry(label)}
                        <Item itemId={label} className="compact-item"><p>{label}</p></Item>
                      {/snippet}
                    </Container>
                  {/if}
                {/snippet}
              </Container>
            </article>
          {/if}

          <article class="demo-cell">
            <h2>Draggable Sub-Containers</h2>
            <Container
              config={{ direction: "column", groupID: "drag-nested-group", callbacks: { onItemMove: handleDragNestedMove } }}
              metadata={{ frameworkList: "drag-outer" }}
              locked={true}
              items={dragNestedEntries}
              getItemId={(e) => (e.kind === "group" ? e.id : e.label)}
            >
              {#snippet entry(e)}
                {#if e.kind === "group"}
                  <Container
                    itemId={e.id}
                    config={{ direction: "column", groupID: "drag-nested-group", callbacks: { onItemMove: handleDragNestedMove } }}
                    metadata={{ frameworkList: `drag-${e.id}` }}
                    locked={false}
                    items={e.labels}
                    getItemId={(label) => label}
                  >
                    {#snippet entry(label)}
                      <Item itemId={label} className="demo-item sub-item"><p>{label}</p></Item>
                    {/snippet}
                  </Container>
                {:else}
                  <Item itemId={e.label} className="demo-item"><p>{e.label}</p></Item>
                {/if}
              {/snippet}
            </Container>
          </article>

          <article class="demo-cell">
            <h2>Nested Row Groups</h2>
            <Container
              config={{ direction: "row", groupID: "nested-row-group", callbacks: { onItemMove: handleNestedRowMove } }}
              metadata={{ frameworkList: "row-outer" }}
              locked={true}
              items={nestedRowEntries}
              getItemId={(e) => (e.kind === "item" ? e.label : "nested-row-sub-group")}
            >
              {#snippet entry(e)}
                {#if e.kind === "item"}
                  <Item itemId={e.label} className="demo-item row-item"><p>{e.label}</p></Item>
                {:else}
                  <Container
                    itemId="nested-row-sub-group"
                    config={{ direction: "row", groupID: "nested-row-group", callbacks: { onItemMove: handleNestedRowMove } }}
                    metadata={{ frameworkList: "row-inner" }}
                    locked={false}
                    items={nestedRowChildren}
                    getItemId={(label) => label}
                  >
                    {#snippet entry(label)}
                      <Item itemId={label} className="demo-item row-item sub-item"><p>{label}</p></Item>
                    {/snippet}
                  </Container>
                {/if}
              {/snippet}
            </Container>
          </article>

          <article class="demo-cell">
            <h2>Layers Panel</h2>
            <Container
              config={{ direction: "column", groupID: "layers", callbacks: { onItemMove: handleLayerMove } }}
              metadata={{ frameworkList: "layers-outer" }}
              locked={true}
              items={layerEntries}
              getItemId={(e) => e.id}
            >
              {#snippet entry(e)}
                {#if e.kind === "leaf"}
                  <Item itemId={e.id} className="layer-item">
                    <div class="layer-row">
                      <span class="layer-icon">{e.icon}</span>
                      <span>{e.name}</span>
                    </div>
                  </Item>
                {:else}
                  <Container
                    itemId={e.id}
                    config={{ direction: "column", groupID: "layers", callbacks: { onItemMove: handleLayerMove } }}
                    metadata={{ frameworkList: `layers-${e.id}` }}
                    locked={false}
                    items={e.children}
                    getItemId={(child) => child.name}
                  >
                    {#snippet before()}<div class="group-label">{e.label}</div>{/snippet}
                    {#snippet entry(child)}
                      <Item itemId={child.name} className="layer-item">
                        <div class="layer-row">
                          <span class="layer-icon">{child.icon}</span>
                          <span>{child.name}</span>
                        </div>
                      </Item>
                    {/snippet}
                  </Container>
                {/if}
              {/snippet}
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
