<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type { Engine as SnapEngine } from "@snap-engine/core";
  import { Container, Ghost } from "@snap-engine/snapsort/svelte";
  import {
    createRenderEntry,
    createRenderTree,
    reduceRenderTree,
    type CanDropEvent,
    type ContainerCallbacks,
    type GhostLifecycleEvent,
    type ItemMoveEvent,
    type RenderEntry,
    type RenderTree,
  } from "@snap-engine/snapsort";
  import FileExplorerNode from "./FileExplorerNode.svelte";
  import type { FileExplorerNodeData } from "./FileExplorerNode.svelte";

  type FileExplorerNodeInput = FileExplorerNodeData & {
    children?: FileExplorerNodeInput[];
  };

  const initialTree: FileExplorerNodeInput[] = [
    {
      id: "website-tree-src",
      name: "src",
      kind: "folder",
      open: true,
      children: [
        {
          id: "website-tree-routes",
          name: "routes",
          kind: "folder",
          open: true,
          children: [
            { id: "website-tree-snapsort", name: "snapsort", kind: "folder", open: false },
            { id: "website-tree-layout", name: "+layout.svelte", kind: "file" },
          ],
        },
        { id: "website-tree-engine", name: "engine.svelte.ts", kind: "file", active: true },
      ],
    },
    {
      id: "website-tree-docs",
      name: "docs",
      kind: "folder",
      open: true,
      children: [
        { id: "website-tree-intro", name: "introduction.mdx", kind: "file" },
        { id: "website-tree-reference", name: "reference.mdx", kind: "file" },
      ],
    },
    { id: "website-tree-package", name: "package.json", kind: "file" },
  ];

  const fileTreeAnimation = {
    duration: 260,
    timing_function: "cubic-bezier(0.2, 0, 0, 1)",
  };

  function createFileTree(
    nodes: readonly FileExplorerNodeInput[],
  ): RenderTree<FileExplorerNodeData> {
    return createRenderTree(
      nodes.map(({ children, ...node }) =>
        createRenderEntry(
          node,
          node.id,
          node.kind === "folder" ? createFileTree(children ?? []) : null,
        ),
      ),
    );
  }

  let tree = $state.raw(createFileTree(initialTree));
  let engine: SnapEngine | null = $state(null);
  let selectedIds = $state<Set<string>>(new Set());
  let lastClickedId: string | null = null;

  $effect(() => {
    if (engine) engine.input.config.maxSimultaneousDrags = 1;
  });

  function findEntry(
    current: RenderTree<FileExplorerNodeData>,
    nodeId: string,
  ): Extract<RenderEntry<FileExplorerNodeData>, { isGhost: false }> | null {
    for (const entry of current.entries) {
      if (entry.isGhost) continue;
      if (entry.itemId === nodeId) return entry;
      const found = entry.childTree
        ? findEntry(entry.childTree, nodeId)
        : null;
      if (found) return found;
    }
    return null;
  }

  function containsEntry(
    entry: Extract<RenderEntry<FileExplorerNodeData>, { isGhost: false }>,
    nodeId: string,
  ): boolean {
    return (
      entry.itemId === nodeId ||
      (entry.childTree ? findEntry(entry.childTree, nodeId) !== null : false)
    );
  }

  function updateNode(
    current: RenderTree<FileExplorerNodeData>,
    nodeId: string,
  ): RenderTree<FileExplorerNodeData> {
    let changed = false;
    const entries = current.entries.map((entry) => {
      if (entry.isGhost) return entry;
      const childTree = entry.childTree
        ? updateNode(entry.childTree, nodeId)
        : null;
      const value =
        entry.itemId === nodeId && entry.value.kind === "folder"
          ? { ...entry.value, open: entry.value.open === false }
          : entry.value;
      if (childTree === entry.childTree && value === entry.value) return entry;
      changed = true;
      return { ...entry, childTree, value };
    });
    return changed ? { entries } : current;
  }

  function toggleFolderOpen(nodeId: string) {
    tree = updateNode(tree, nodeId);
  }

  /** Visible node ids in on-screen order (collapsed folders' children excluded), for shift-click range selection. */
  function flattenVisibleIds(
    current: RenderTree<FileExplorerNodeData>,
  ): string[] {
    const ids: string[] = [];
    for (const entry of current.entries) {
      if (entry.isGhost) continue;
      ids.push(entry.itemId);
      if (
        entry.value.kind === "folder" &&
        entry.value.open !== false &&
        entry.childTree
      ) {
        ids.push(...flattenVisibleIds(entry.childTree));
      }
    }
    return ids;
  }

  function handleSelectNode(nodeId: string, event: MouseEvent | KeyboardEvent) {
    if (event.shiftKey && lastClickedId) {
      const order = flattenVisibleIds(tree);
      const anchorIndex = order.indexOf(lastClickedId);
      const targetIndex = order.indexOf(nodeId);
      if (anchorIndex !== -1 && targetIndex !== -1) {
        const [start, end] =
          anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
        selectedIds = new Set(order.slice(start, end + 1));
      }
      return;
    }

    if (event.metaKey || event.ctrlKey) {
      const next = new Set(selectedIds);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      selectedIds = next;
      lastClickedId = nodeId;
      return;
    }

    selectedIds = new Set([nodeId]);
    lastClickedId = nodeId;
  }

  function handleMove(event: ItemMoveEvent) {
    tree = reduceRenderTree(tree, event);
  }

  function handleGhost(event: GhostLifecycleEvent) {
    tree = reduceRenderTree(tree, event);
  }

  /** Block dropping a folder into its own descendant (or itself), for every dragged item. */
  function canDropInFolder(event: CanDropEvent): boolean {
    const containerId = event.containerMetadata.containerId;
    if (typeof containerId !== "string") return true;

    for (const itemId of event.itemIds) {
      const draggedNode = findEntry(tree, itemId);
      if (draggedNode && containsEntry(draggedNode, containerId)) return false;
    }
    return true;
  }

  const nestedCallbacks = {
    canDrop: canDropInFolder,
  } satisfies ContainerCallbacks;

  const rootCallbacks = {
    onItemMove: handleMove,
    onGhostInsert: handleGhost,
    onGhostMove: handleGhost,
    onGhostRemove: handleGhost,
    ...nestedCallbacks,
  } satisfies ContainerCallbacks;
</script>

<div class="file-explorer-card" data-snapsort-example="file-explorer">
  <Engine id="snapsort-file-explorer-example" bind:engine>
    <div class="file-window">
      <div class="file-window-bar">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <Container
        itemId="website-file-explorer-root"
        className="code-tree"
        config={{
          mode: "insertion",
          direction: "column",
          name: "website-file-explorer-root",
          callbacks: rootCallbacks,
          animation: {
            reorder: fileTreeAnimation,
            drop: fileTreeAnimation,
          },
        }}
        locked={true}
        metadata={{
          containerId: "root",
        }}
      >
        {#each tree.entries as entry (entry.itemId)}
          {#if entry.isGhost}
            {#if entry.ghost.type === "insertion-marker"}
              <Ghost
                ghost={entry.ghost}
                insertionMarker={{
                  thickness: 3,
                  startInset: 8,
                  endInset: 8,
                }}
              />
            {:else}
              <Ghost ghost={entry.ghost} />
            {/if}
          {:else}
            <FileExplorerNode
              {entry}
              callbacks={nestedCallbacks}
              onToggleFolder={toggleFolderOpen}
              {selectedIds}
              onSelectNode={handleSelectNode}
            />
          {/if}
        {/each}
      </Container>
    </div>
  </Engine>
</div>

<style>
  .file-explorer-card {
    min-width: 0;
    width: min(100%, 30rem);
    margin-inline: auto;
    user-select: none;
  }

  .file-explorer-card :global(.snap-engine-canvas) {
    overflow: visible !important;
  }

  .file-window {
    display: flex;
    flex-direction: column;
    min-height: 300px;
    overflow: hidden;
    border: 1px solid #d9dde2;
    border-radius: var(--ui-radius);
    background: #ffffff;
    color: #202427;
  }

  .file-window-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 12px;
    border-bottom: 1px solid #e5e7eb;
    background: #f4f6f8;
    flex: 0 0 auto;
  }

  .file-window-bar span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #c5ccd4;
  }

  :global(.code-tree),
  :global(.snapsort-container.tree-folder) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0 !important;
    padding: 0;
  }

  :global(.code-tree) {
    position: relative;
    flex: 1;
    min-height: 0;
    width: 100%;
    min-height: 20rem;
    padding: 8px 0 12px;
    box-sizing: border-box;
    overflow: hidden;
  }

  :global(.snapsort-container.tree-folder) {
    width: calc(100% - 14px);
    margin: 0 0 0 14px !important;
    border: 0 !important;
    outline: 0 !important;
    background: transparent;
  }

  :global(.snapsort-item.tree-row),
  :global(.tree-folder > .tree-row) {
    --indent-size: 14px;
    width: 100%;
    min-height: 24px;
    margin: 0 !important;
    padding: 3px 8px 3px calc(8px + (var(--depth, 0) * var(--indent-size)));
    display: grid !important;
    grid-template-columns: 18px 18px minmax(0, 1fr);
    align-items: center !important;
    border: 1px solid transparent;
    border-radius: 0;
    box-sizing: border-box;
    background: transparent;
    color: #1f2937;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
    justify-content: initial !important;
    justify-items: stretch;
    font-size: 14px;
    font-weight: 500;
    line-height: normal;
    position: relative;
    touch-action: none;
  }

  :global(.tree-folder > .tree-row) {
    width: calc(100% + 14px);
    margin-left: -14px !important;
  }

  :global(.snapsort-item.tree-row:hover),
  :global(.tree-folder > .tree-row:hover) {
    background: #eef4ff;
  }

  :global(.snapsort-item.tree-row.active),
  :global(.tree-folder.active > .tree-row) {
    background: #dbeafe;
    color: #0f172a;
  }

  :global(.snapsort-item.tree-row.selected),
  :global(.tree-row.folder-row.selected) {
    background: #e0e7ff;
    box-shadow: inset 0 0 0 1px #818cf8;
  }

  :global(.snapsort-item.tree-row[data-snapsort-dragging="true"]),
  :global(.tree-folder[data-snapsort-dragging="true"] > .tree-row) {
    background: #bfdbfe;
    border-color: #3b82f6;
    opacity: 0.78;
    cursor: grabbing;
  }

  :global(.indent) {
    position: absolute;
    left: calc(14px + ((var(--depth, 0) - 1) * var(--indent-size)));
    top: 0;
    bottom: 0;
    width: 1px;
    background-image: linear-gradient(#d4dbe7, #d4dbe7);
    background-size: 1px 100%;
    background-repeat: repeat-y;
    background-position: 0 0;
    opacity: min(var(--depth, 0), 1);
    pointer-events: none;
  }

  :global(.chevron),
  :global(.chevron-spacer) {
    width: 16px;
    height: 16px;
    position: relative;
    display: inline-block;
  }

  :global(button.chevron) {
    appearance: none;
    border: 0;
    padding: 0;
    background: transparent;
    box-shadow: none;
    color: inherit;
    cursor: pointer;
  }

  :global(.chevron)::before {
    content: "";
    position: absolute;
    left: 5px;
    top: 4px;
    width: 6px;
    height: 6px;
    border-right: 1.5px solid #64748b;
    border-bottom: 1.5px solid #64748b;
    transform: rotate(-45deg);
  }

  :global(.chevron.open)::before {
    left: 4px;
    top: 3px;
    transform: rotate(45deg);
  }

  :global(.folder-icon),
  :global(.file-icon) {
    width: 16px;
    height: 16px;
    position: relative;
    display: inline-block;
  }

  :global(.folder-icon)::before {
    content: "";
    position: absolute;
    left: 1px;
    top: 6px;
    width: 14px;
    height: 9px;
    border-radius: 1px;
    background: #d99a22;
  }

  :global(.folder-icon)::after {
    content: "";
    position: absolute;
    left: 2px;
    top: 3px;
    width: 7px;
    height: 4px;
    border-radius: 1px 1px 0 0;
    background: #e5b24a;
  }

  :global(.file-icon)::before {
    content: "";
    position: absolute;
    left: 3px;
    top: 1px;
    width: 10px;
    height: 14px;
    border: 1px solid #8aa6c1;
    border-radius: 1px;
    background: #ffffff;
    box-sizing: border-box;
  }

  :global(.file-icon)::after {
    content: "";
    position: absolute;
    left: 5px;
    top: 5px;
    width: 6px;
    height: 1px;
    background: #8aa6c1;
    box-shadow:
      0 3px 0 #8aa6c1,
      0 6px 0 #8aa6c1;
  }

  :global(.row-name) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    font-weight: 500;
  }

  :global([data-snapsort-ghost="insertion"]) {
    color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18);
  }
</style>
