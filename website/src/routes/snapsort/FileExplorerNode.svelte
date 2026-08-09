<script lang="ts" module>
  export type FileExplorerNodeData = {
    id: string;
    name: string;
    kind: "folder" | "file";
    open?: boolean;
    active?: boolean;
    children?: FileExplorerNodeData[];
  };
</script>

<script lang="ts">
  import {
    Container,
    Item,
  } from "@snap-engine/snapsort/svelte";
  import type { ContainerCallbacks } from "@snap-engine/snapsort";
  import { rejectDrop } from "@snap-engine/snapsort/callbacks";
  import FileExplorerNode from "./FileExplorerNode.svelte";

  let {
    node,
    depth = 0,
    callbacks,
    onToggleFolder,
    selectedIds,
    onSelectNode,
  }: {
    node: FileExplorerNodeData;
    depth?: number;
    callbacks: ContainerCallbacks;
    onToggleFolder: (nodeId: string) => void;
    selectedIds: Set<string>;
    onSelectNode: (nodeId: string, event: MouseEvent | KeyboardEvent) => void;
  } = $props();

  const fileTreeAnimation = {
    duration: 260,
    timing_function: "cubic-bezier(0.2, 0, 0, 1)",
  };

  const isSelected = $derived(selectedIds.has(node.id));

  function handleChevronPointerDown(event: PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleChevronClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onToggleFolder(node.id);
  }

  function handleRowClick(event: MouseEvent) {
    onSelectNode(node.id, event);
  }

  function handleRowKeydown(event: KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelectNode(node.id, event);
  }
</script>

{#if node.kind === "folder"}
  <Container
    className={`tree-node tree-folder depth-${depth}${node.active ? " active" : ""}`}
    config={{
      mode: "insertion",
      direction: "column",
      name: `website-file-explorer-${node.id}`,
      callbacks: {
        ...callbacks,
        canDrop: node.open === false ? rejectDrop : callbacks.canDrop,
      },
      animation: {
        reorder: fileTreeAnimation,
        drop: fileTreeAnimation,
      },
    }}
    locked={false}
    selected={isSelected}
    itemId={node.id}
    metadata={{
      containerId: node.id,
      insertionDepth: depth + 1,
    }}
    items={node.open !== false ? (node.children ?? []) : []}
    getItemId={(child) => child.id}
  >
    {#snippet before()}
      <div
        class="tree-row folder-row"
        class:selected={isSelected}
        style={`--depth: ${depth}`}
        onclick={handleRowClick}
        onkeydown={handleRowKeydown}
        role="button"
        tabindex="0"
      >
        <span class="indent" aria-hidden="true"></span>
        <button
          type="button"
          class:open={node.open !== false}
          class="chevron"
          aria-label={node.open !== false ? `Collapse ${node.name}` : `Expand ${node.name}`}
          onpointerdown={handleChevronPointerDown}
          onclick={handleChevronClick}
        ></button>
        <span class="folder-icon" aria-hidden="true"></span>
        <span class="row-name">{node.name}</span>
      </div>
    {/snippet}

    {#snippet entry(child)}
      <FileExplorerNode node={child} depth={depth + 1} {callbacks} {onToggleFolder} {selectedIds} {onSelectNode} />
    {/snippet}
  </Container>
{:else}
  <Item
    itemId={node.id}
    className={`tree-row file-row depth-${depth}${node.active ? " active" : ""}${isSelected ? " selected" : ""}`}
    selected={isSelected}
    onclick={handleRowClick}
    style={`--depth: ${depth}`}
  >
    <span class="indent" aria-hidden="true"></span>
    <span class="chevron-spacer" aria-hidden="true"></span>
    <span class="file-icon" aria-hidden="true"></span>
    <span class="row-name">{node.name}</span>
  </Item>
{/if}
