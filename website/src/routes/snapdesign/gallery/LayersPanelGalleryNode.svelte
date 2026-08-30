<script lang="ts" module>
  export type LayersPanelNodeKind =
    | "frame"
    | "group"
    | "component"
    | "text"
    | "vector"
    | "image"
    | "rectangle";

  export type LayersPanelNodeData = {
    id: string;
    label: string;
    kind: LayersPanelNodeKind;
    open?: boolean;
  };

  export const layersPanelRowHeight = 36;
</script>

<script lang="ts">
  import type { ContainerCallbacks, RenderEntry } from "@snap-engine/snapsort";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";
  import InsertionTreeMarker from "$lib/components/docs/placement-modes/InsertionTreeMarker.svelte";
  import LayersPanelGalleryNode from "./LayersPanelGalleryNode.svelte";

  let {
    entry,
    depth = 0,
    callbacks,
    selectedIds,
    highlightedGroupId = null,
    onToggleGroup,
    onSelectNode,
  }: {
    entry: Extract<RenderEntry<LayersPanelNodeData>, { isGhost: false }>;
    depth?: number;
    callbacks: Pick<
      ContainerCallbacks,
      | "getDropPriority"
      | "getItemHitbox"
      | "onDragItemEnter"
      | "onDragItemMove"
      | "onDragItemLeave"
    >;
    selectedIds: Set<string>;
    highlightedGroupId?: string | null;
    onToggleGroup: (nodeId: string) => void;
    onSelectNode: (nodeId: string, event: MouseEvent | KeyboardEvent) => void;
  } = $props();

  const iconByKind: Record<LayersPanelNodeKind, string> = {
    frame: "grid_4x4",
    group: "select_all",
    component: "widgets",
    text: "text_fields",
    vector: "gesture",
    image: "image",
    rectangle: "rectangle",
  };

  const node = $derived(entry.value);
  const isContainer = $derived(
    node.kind === "frame" || node.kind === "group",
  );
  const isSelected = $derived(selectedIds.has(node.id));
  const isHighlighted = $derived(highlightedGroupId === entry.itemId);
  const nodeIndent = $derived(
    depth === 0 ? "0px" : "var(--layers-indent-step)",
  );
  const layersAnimation = {
    duration: 260,
    timing_function: "cubic-bezier(0.2, 0, 0, 1)",
  };

  function handleChevronPointerDown(event: PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleChevronClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onToggleGroup(node.id);
  }

  function handleRowClick(event: MouseEvent) {
    onSelectNode(node.id, event);
  }
</script>

{#if isContainer}
  <Container
    itemId={entry.itemId}
    data-layer-id={entry.itemId}
    data-layer-targeted={isHighlighted ? "true" : "false"}
    className={`layers-tree-group${isSelected ? " selected" : ""}${isHighlighted ? " is-highlighted" : ""}`}
    style={`--layers-node-indent: ${nodeIndent}`}
    config={{
      mode: "insertion",
      direction: "column",
      name: `gallery-layers-${node.id}`,
      callbacks,
      animation: {
        reorder: layersAnimation,
        drop: layersAnimation,
      },
    }}
    locked={false}
    selected={isSelected}
    metadata={{ containerId: node.id, kind: "group", label: node.label }}
  >
    <div class="layers-tree-row group-row" class:selected={isSelected}>
      <button
        type="button"
        class="layers-chevron"
        class:open={node.open !== false}
        aria-label={node.open !== false
          ? `Collapse ${node.label}`
          : `Expand ${node.label}`}
        onpointerdown={handleChevronPointerDown}
        onclick={handleChevronClick}
      >
        <span class="material-symbols-rounded" aria-hidden="true">
          chevron_right
        </span>
      </button>
      <span
        class={`layers-node-icon ${node.kind} material-symbols-rounded`}
        aria-hidden="true"
      >
        {iconByKind[node.kind]}
      </span>
      <button
        type="button"
        class="layers-row-selection"
        aria-label={`Select ${node.label}`}
        aria-pressed={isSelected}
        onclick={handleRowClick}
      >
        {node.label}
      </button>
    </div>

    {#if node.open !== false && entry.childTree}
      {#each entry.childTree.entries as child (child.itemId)}
        {#if child.isGhost}
          {#if child.ghost.type === "insertion-marker"}
            <InsertionTreeMarker
              ghost={child.ghost}
              hidden={highlightedGroupId !== null}
            />
          {:else}
            <Ghost ghost={child.ghost} className="layers-tree-ghost" />
          {/if}
        {:else}
          <LayersPanelGalleryNode
            entry={child}
            depth={depth + 1}
            {callbacks}
            {selectedIds}
            {highlightedGroupId}
            {onToggleGroup}
            {onSelectNode}
          />
        {/if}
      {/each}
    {/if}
  </Container>
{:else}
  <Item
    itemId={entry.itemId}
    data-layer-id={entry.itemId}
    className={`layers-tree-row leaf-row${isSelected ? " selected" : ""}`}
    selected={isSelected}
    metadata={{ kind: "item", label: node.label }}
    style={`--layers-node-indent: ${nodeIndent}`}
  >
    <span class="layers-chevron-spacer" aria-hidden="true"></span>
    <span
      class={`layers-node-icon ${node.kind} material-symbols-rounded`}
      aria-hidden="true"
    >
      {iconByKind[node.kind]}
    </span>
    <button
      type="button"
      class="layers-row-selection"
      aria-label={`Select ${node.label}`}
      aria-pressed={isSelected}
      onclick={handleRowClick}
    >
      {node.label}
    </button>
  </Item>
{/if}

<style>
  .layers-row-selection {
    display: block;
    min-width: 0;
    height: 100%;
    overflow: hidden;
    padding: 0;
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    color: inherit;
    cursor: inherit;
    font: inherit;
    line-height: var(--layers-row-height);
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .layers-row-selection:focus-visible,
  .layers-chevron:focus-visible {
    outline: 2px solid #0d99ff;
    outline-offset: -2px;
  }
</style>
