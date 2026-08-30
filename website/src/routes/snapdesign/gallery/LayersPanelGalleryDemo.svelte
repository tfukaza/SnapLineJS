<script lang="ts">
  import {
    createRenderEntry,
    createRenderTree,
    reduceRenderTree,
    type ContainerCallbacks,
    type DragEndEvent,
    type DragItemHoverEvent,
    type DropPriorityEvent,
    type DropTargetChangeEvent,
    type GhostLifecycleEvent,
    type ItemHitboxEvent,
    type ItemMoveEvent,
    type RenderEntry,
    type RenderTree,
  } from "@snap-engine/snapsort";
  import { rejectDrop } from "@snap-engine/snapsort/callbacks";
  import { Container, Ghost } from "@snap-engine/snapsort/svelte";
  import MaterialSurface from "$lib/components/MaterialSurface.svelte";
  import {
    defaultRaisedCardMaterialSettings,
    type MaterialSettings,
  } from "$lib/components/materialSurface";
  import InsertionTreeMarker from "$lib/components/docs/placement-modes/InsertionTreeMarker.svelte";
  import LayersPanelGalleryNode, {
    layersPanelRowHeight,
    type LayersPanelNodeData,
  } from "./LayersPanelGalleryNode.svelte";

  type LayersPanelNodeInput = LayersPanelNodeData & {
    children?: LayersPanelNodeInput[];
  };

  const initialTree = [
    {
      id: "desktop-home",
      label: "Desktop / Home",
      kind: "frame",
      open: true,
      children: [
        {
          id: "header",
          label: "Header",
          kind: "frame",
          open: true,
          children: [
            { id: "brand-mark", label: "Brand mark", kind: "vector" },
            {
              id: "navigation",
              label: "Navigation",
              kind: "group",
              open: true,
              children: [
                { id: "features", label: "Features", kind: "text" },
                { id: "pricing", label: "Pricing", kind: "text" },
              ],
            },
          ],
        },
        {
          id: "feature-cards",
          label: "Feature cards",
          kind: "group",
          open: true,
          children: [
            {
              id: "analytics-card",
              label: "Analytics card",
              kind: "component",
            },
            {
              id: "automation-card",
              label: "Automation card",
              kind: "component",
            },
          ],
        },
        {
          id: "hero-artwork",
          label: "Hero artwork",
          kind: "image",
        },
      ],
    },
    { id: "prototype-notes", label: "Prototype notes", kind: "text" },
  ] satisfies LayersPanelNodeInput[];

  const layersAnimation = {
    duration: 260,
    timing_function: "cubic-bezier(0.2, 0, 0, 1)",
  };
  const layersCardMaterial = {
    ...defaultRaisedCardMaterialSettings,
    shadowDistance: 7,
    shadowBlur: 9,
  } satisfies MaterialSettings;

  function createLayersTree(
    nodes: readonly LayersPanelNodeInput[],
  ): RenderTree<LayersPanelNodeData> {
    return createRenderTree(
      nodes.map(({ children, ...node }) =>
        createRenderEntry(
          node,
          node.id,
          children ? createLayersTree(children) : null,
        ),
      ),
    );
  }

  let tree = $state.raw(createLayersTree(initialTree));
  let selectedIds = $state<Set<string>>(new Set());
  let hoveredGroupId = $state<string | null>(null);
  let targetContainerId = $state<string | null>(null);
  const highlightedGroupId = $derived(
    hoveredGroupId === targetContainerId ? hoveredGroupId : null,
  );
  let lastClickedId: string | null = null;

  function findEntry(
    current: RenderTree<LayersPanelNodeData>,
    nodeId: string,
  ): Extract<RenderEntry<LayersPanelNodeData>, { isGhost: false }> | null {
    for (const entry of current.entries) {
      if (entry.isGhost) continue;
      if (entry.itemId === nodeId) return entry;
      const found = entry.childTree ? findEntry(entry.childTree, nodeId) : null;
      if (found) return found;
    }
    return null;
  }

  function containsEntry(
    entry: Extract<RenderEntry<LayersPanelNodeData>, { isGhost: false }>,
    nodeId: string,
  ): boolean {
    return (
      entry.itemId === nodeId ||
      (entry.childTree ? findEntry(entry.childTree, nodeId) !== null : false)
    );
  }

  function updateGroup(
    current: RenderTree<LayersPanelNodeData>,
    nodeId: string,
  ): RenderTree<LayersPanelNodeData> {
    let changed = false;
    const entries = current.entries.map((entry) => {
      if (entry.isGhost) return entry;
      const childTree = entry.childTree
        ? updateGroup(entry.childTree, nodeId)
        : null;
      const value =
        entry.itemId === nodeId && entry.childTree
          ? { ...entry.value, open: entry.value.open === false }
          : entry.value;
      if (childTree === entry.childTree && value === entry.value) return entry;
      changed = true;
      return { ...entry, childTree, value };
    });
    return changed ? { entries } : current;
  }

  function toggleGroup(nodeId: string) {
    tree = updateGroup(tree, nodeId);
  }

  function flattenVisibleIds(
    current: RenderTree<LayersPanelNodeData>,
  ): string[] {
    const ids: string[] = [];
    for (const entry of current.entries) {
      if (entry.isGhost) continue;
      ids.push(entry.itemId);
      if (entry.value.open !== false && entry.childTree) {
        ids.push(...flattenVisibleIds(entry.childTree));
      }
    }
    return ids;
  }

  function selectNode(nodeId: string, event: MouseEvent | KeyboardEvent) {
    if (event.shiftKey && lastClickedId) {
      const order = flattenVisibleIds(tree);
      const anchorIndex = order.indexOf(lastClickedId);
      const targetIndex = order.indexOf(nodeId);
      if (anchorIndex !== -1 && targetIndex !== -1) {
        const [start, end] =
          anchorIndex < targetIndex
            ? [anchorIndex, targetIndex]
            : [targetIndex, anchorIndex];
        selectedIds = new Set(order.slice(start, end + 1));
      }
      return;
    }

    if (event.metaKey || event.ctrlKey) {
      const next = new Set(selectedIds);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      selectedIds = next;
      lastClickedId = nodeId;
      return;
    }

    selectedIds = new Set([nodeId]);
    lastClickedId = nodeId;
  }

  function reduce(event: ItemMoveEvent | GhostLifecycleEvent) {
    tree = reduceRenderTree(tree, event);
  }

  function wouldCreateTreeCycle(event: DropPriorityEvent): boolean {
    const containerId = event.containerMetadata.containerId;
    if (typeof containerId !== "string") return false;

    return event.itemIds.some((itemId) => {
      const draggedNode = findEntry(tree, String(itemId));
      return draggedNode ? containsEntry(draggedNode, containerId) : false;
    });
  }

  function rejectTreeCycles(event: DropPriorityEvent): number | undefined {
    return wouldCreateTreeCycle(event) ? rejectDrop(event) : undefined;
  }

  function layersItemHitbox(event: ItemHitboxEvent) {
    if (event.overItemMetadata.kind !== "group") {
      return { shape: "rect" as const, rect: event.defaultRect };
    }
    return {
      shape: "rect" as const,
      rect: { ...event.defaultRect, height: layersPanelRowHeight },
    };
  }

  function trackHoveredItem(event: DragItemHoverEvent) {
    hoveredGroupId =
      event.overItemMetadata.kind === "group"
        ? String(event.overItemId)
        : null;
  }

  function clearHoveredItem(event: DragItemHoverEvent) {
    if (hoveredGroupId === String(event.overItemId)) hoveredGroupId = null;
  }

  function trackDropTarget(event: DropTargetChangeEvent) {
    const containerId = event.current?.containerMetadata.containerId;
    targetContainerId =
      typeof containerId === "string" ? containerId : null;
    if (hoveredGroupId !== targetContainerId) hoveredGroupId = null;
  }

  function clearInteractionState(_event: DragEndEvent) {
    hoveredGroupId = null;
    targetContainerId = null;
  }

  const nestedCallbacks = {
    getDropPriority: rejectTreeCycles,
    getItemHitbox: layersItemHitbox,
    onDragItemEnter: trackHoveredItem,
    onDragItemMove: trackHoveredItem,
    onDragItemLeave: clearHoveredItem,
  } satisfies ContainerCallbacks;

  const rootCallbacks = {
    onItemMove: reduce,
    onGhostInsert: reduce,
    onGhostMove: reduce,
    onGhostRemove: reduce,
    onDropTargetChange: trackDropTarget,
    onDragEnd: clearInteractionState,
    ...nestedCallbacks,
  } satisfies ContainerCallbacks;
</script>

<div class="layers-panel-demo" data-demo="layers-panel">
  <div class="figma-shell">
    <MaterialSurface
      depth="raised"
      shape="rounded"
      radius={16}
      color="#fff"
      material={layersCardMaterial}
      className="layers-card"
    >
      <aside class="layers-sidebar" aria-label="Design layers">
        <header class="layers-sidebar-header">Layers</header>
        <Container
          itemId="gallery-layers-root"
          className="layers-tree-root"
          config={{
            mode: "insertion",
            direction: "column",
            name: "gallery-layers-root",
            callbacks: rootCallbacks,
            animation: {
              reorder: layersAnimation,
              drop: layersAnimation,
            },
          }}
          locked={true}
          metadata={{ containerId: "root", kind: "root" }}
        >
          {#each tree.entries as entry (entry.itemId)}
            {#if entry.isGhost}
              {#if entry.ghost.type === "insertion-marker"}
                <InsertionTreeMarker
                  ghost={entry.ghost}
                  hidden={highlightedGroupId !== null}
                />
              {:else}
                <Ghost ghost={entry.ghost} className="layers-tree-ghost" />
              {/if}
            {:else}
              <LayersPanelGalleryNode
                {entry}
                callbacks={nestedCallbacks}
                {selectedIds}
                {highlightedGroupId}
                onToggleGroup={toggleGroup}
                onSelectNode={selectNode}
              />
            {/if}
          {/each}
        </Container>
      </aside>
    </MaterialSurface>
  </div>
</div>

<style>
  .layers-panel-demo {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    user-select: none;
  }

  .figma-shell {
    display: grid;
    width: 100%;
    height: 100%;
    place-items: center;
    overflow: hidden;
    background: transparent;
  }

  .layers-sidebar {
    --layers-indent-step: 20px;
    --layers-row-height: 36px;

    display: grid;
    width: 100%;
    height: auto;
    min-width: 0;
    min-height: 0;
    grid-template-rows: 56px auto;
    overflow: hidden;
    padding-bottom: 12px;
    box-sizing: border-box;
    background: transparent;
    color: #2c2c2c;
    font-family: Inter, var(--font-body), sans-serif;
  }

  :global(.layers-card) {
    --material-content-padding: 0;

    width: min(46%, 420px);
    height: auto;
    align-items: stretch !important;
    justify-content: stretch !important;
  }

  .layers-sidebar-header {
    display: flex;
    align-items: center;
    padding: 0 20px;
    box-sizing: border-box;
    color: #2c2c2c;
    font-family: "Bitcount Grid Single", var(--font-code), monospace;
    font-size: 16px;
    font-weight: 500;
    line-height: 1;
  }

  :global(.layers-tree-root),
  :global(.layers-tree-group) {
    display: flex;
    width: 100%;
    flex-direction: column;
    align-items: stretch;
    gap: 0 !important;
    margin: 0 !important;
    padding: 0;
    border: 0 !important;
    outline: 0 !important;
    background: transparent;
  }

  :global(.layers-tree-root) {
    position: relative;
    min-height: 0;
  }

  :global(.layers-tree-group) {
    width: calc(100% - var(--layers-node-indent)) !important;
    margin-left: var(--layers-node-indent) !important;
  }

  :global(.gallery-engine .snapsort-item.layers-tree-row),
  :global(.layers-tree-row) {
    position: relative;
    display: grid !important;
    width: 100%;
    height: var(--layers-row-height);
    min-height: var(--layers-row-height);
    grid-template-columns: 16px 20px minmax(0, 1fr);
    align-items: center !important;
    gap: 4px;
    margin: 0 !important;
    padding: 0 10px 0 14px !important;
    border: 0;
    border-radius: 0;
    box-sizing: border-box;
    background: transparent;
    color: #2c2c2c;
    cursor: grab;
    font-family: inherit;
    font-size: 15px;
    font-weight: 400;
    line-height: 1;
    touch-action: none;
  }

  :global(.gallery-engine .snapsort-item.layers-tree-row.leaf-row),
  :global(.layers-tree-row.leaf-row) {
    width: calc(100% - var(--layers-node-indent)) !important;
    margin-left: var(--layers-node-indent) !important;
  }

  :global(.layers-tree-row:hover) {
    background: #f5f5f5;
  }

  :global(.layers-tree-row.selected),
  :global(.layers-tree-group.selected > .group-row) {
    background: color-mix(in srgb, var(--color-primary) 12%, white);
  }

  :global(.layers-tree-group.is-highlighted > .group-row) {
    background: color-mix(in srgb, var(--color-primary) 16%, white);
    box-shadow: inset 0 0 0 1px
      color-mix(in srgb, var(--color-primary) 42%, transparent);
  }

  :global(.layers-tree-row[data-snapsort-dragging="true"]),
  :global(
      .layers-tree-group[data-snapsort-dragging="true"] > .group-row
    ) {
    background: color-mix(in srgb, var(--color-primary) 12%, white);
    opacity: 0.72;
    cursor: grabbing;
  }

  :global(.layers-chevron),
  :global(.layers-chevron-spacer) {
    display: grid;
    width: 16px;
    height: 20px;
    place-items: center;
  }

  :global(button.layers-chevron) {
    appearance: none;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
    color: #8a8a8a;
    cursor: pointer;
  }

  :global(.layers-chevron .material-symbols-rounded) {
    font-size: 17px;
    font-variation-settings: "FILL" 0, "wght" 500, "GRAD" 0, "opsz" 20;
    transition: transform 140ms ease;
  }

  :global(.layers-chevron.open .material-symbols-rounded) {
    transform: rotate(90deg);
  }

  :global(.layers-node-icon.material-symbols-rounded) {
    display: inline-grid;
    width: 20px;
    height: 20px;
    place-items: center;
    color: #8b8b8b;
    font-size: 18px;
    font-variation-settings: "FILL" 0, "wght" 400, "GRAD" 0, "opsz" 20;
  }

  :global(.layers-tree-ghost) {
    border: 0 !important;
    outline: 0 !important;
    background: rgb(0 0 0 / 8%) !important;
    box-shadow: none !important;
  }

  :global(.insertion-tree-marker) {
    box-shadow: none !important;
  }

  @media (max-width: 700px) {
    :global(.layers-card) {
      width: min(68%, 280px);
    }

    .layers-sidebar {
      --layers-indent-step: 16px;

      height: auto;
      grid-template-rows: 40px auto;
    }

    :global(.gallery-engine .snapsort-item.layers-tree-row),
    :global(.layers-tree-row) {
      grid-template-columns: 14px 18px minmax(0, 1fr);
      gap: 3px;
      padding: 0 6px 0 10px !important;
      font-size: 14px;
    }

    .layers-sidebar-header {
      padding-inline: 14px;
      font-size: 15px;
    }

    :global(.layers-node-icon.material-symbols-rounded) {
      width: 18px;
      font-size: 16px;
    }
  }
</style>
