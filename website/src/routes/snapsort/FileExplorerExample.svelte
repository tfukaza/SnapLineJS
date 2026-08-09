<script lang="ts">
  import { Container } from "@snap-engine/snapsort/svelte";
  import type {
    CanDropEvent,
    ContainerCallbacks,
    ItemMoveEvent,
  } from "@snap-engine/snapsort";
  import FileExplorerNode from "./FileExplorerNode.svelte";
  import type { FileExplorerNodeData } from "./FileExplorerNode.svelte";

  const initialTree: FileExplorerNodeData[] = [
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

  let tree = $state<FileExplorerNodeData[]>(structuredClone(initialTree));
  let selectedIds = $state<Set<string>>(new Set());
  let lastClickedId: string | null = null;

  function cloneNode(node: FileExplorerNodeData): FileExplorerNodeData {
    return {
      ...node,
      children: node.children?.map(cloneNode),
    };
  }

  function extractNode(
    nodes: FileExplorerNodeData[],
    nodeId: string,
  ): { nodes: FileExplorerNodeData[]; node: FileExplorerNodeData | null } {
    let removed: FileExplorerNodeData | null = null;
    const nextNodes: FileExplorerNodeData[] = [];

    for (const node of nodes) {
      if (node.id === nodeId) {
        removed = cloneNode(node);
        continue;
      }

      if (node.children) {
        const result = extractNode(node.children, nodeId);
        if (result.node) {
          removed = result.node;
          nextNodes.push({ ...node, children: result.nodes });
          continue;
        }
      }

      nextNodes.push(cloneNode(node));
    }

    return { nodes: nextNodes, node: removed };
  }

  function containsNode(node: FileExplorerNodeData, nodeId: string): boolean {
    if (node.id === nodeId) return true;
    return node.children?.some((child) => containsNode(child, nodeId)) ?? false;
  }

  function findNode(
    nodes: FileExplorerNodeData[],
    nodeId: string,
  ): FileExplorerNodeData | null {
    for (const node of nodes) {
      if (node.id === nodeId) return node;
      const found = node.children ? findNode(node.children, nodeId) : null;
      if (found) return found;
    }
    return null;
  }

  function insertNode(
    nodes: FileExplorerNodeData[],
    containerId: string,
    index: number,
    nodeToInsert: FileExplorerNodeData,
  ): FileExplorerNodeData[] {
    if (containerId === "root") {
      const nextNodes = nodes.map(cloneNode);
      nextNodes.splice(Math.max(0, Math.min(index, nextNodes.length)), 0, nodeToInsert);
      return nextNodes;
    }

    return nodes.map((node) => {
      if (node.id === containerId) {
        const children = node.children?.map(cloneNode) ?? [];
        children.splice(Math.max(0, Math.min(index, children.length)), 0, nodeToInsert);
        return { ...node, open: true, children };
      }

      return {
        ...node,
        children: node.children
          ? insertNode(node.children, containerId, index, nodeToInsert)
          : undefined,
      };
    });
  }

  function toggleNodeOpen(
    nodes: FileExplorerNodeData[],
    nodeId: string,
  ): FileExplorerNodeData[] {
    return nodes.map((node) => {
      if (node.id === nodeId && node.kind === "folder") {
        return { ...node, open: node.open === false };
      }

      return {
        ...node,
        children: node.children ? toggleNodeOpen(node.children, nodeId) : undefined,
      };
    });
  }

  function toggleFolderOpen(nodeId: string) {
    tree = toggleNodeOpen(tree, nodeId);
  }

  /** Visible node ids in on-screen order (collapsed folders' children excluded), for shift-click range selection. */
  function flattenVisibleIds(nodes: FileExplorerNodeData[]): string[] {
    const ids: string[] = [];
    for (const node of nodes) {
      ids.push(node.id);
      if (node.kind === "folder" && node.open !== false && node.children) {
        ids.push(...flattenVisibleIds(node.children));
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

  /**
   * Multi-item move: `event.items`/`event.itemsMetadata` carry the whole
   * dragged run (ordered, length 1 for a single-item drag). Extract every
   * dragged node from wherever it currently lives first, then insert the
   * whole run as one contiguous block at `event.to.index` — matching how
   * SnapSort computes that index (post-removal of the moved items).
   */
  function handleMove(event: ItemMoveEvent) {
    const containerId = event.to.containerMetadata.containerId;
    if (typeof containerId !== "string") return;

    let nextTree = tree;
    const extractedNodes: FileExplorerNodeData[] = [];
    for (const itemId of event.itemIds) {
      const extracted = extractNode(nextTree, itemId);
      if (!extracted.node) continue;
      nextTree = extracted.nodes;
      extractedNodes.push(extracted.node);
    }
    if (extractedNodes.length === 0) return;
    if (extractedNodes.some((node) => containsNode(node, containerId))) return;

    extractedNodes.forEach((node, i) => {
      nextTree = insertNode(nextTree, containerId, event.to.index + i, node);
    });
    tree = nextTree;
  }

  /** Block dropping a folder into its own descendant (or itself), for every dragged item. */
  function canDropInFolder(event: CanDropEvent): boolean {
    const containerId = event.containerMetadata.containerId;
    if (typeof containerId !== "string") return true;

    for (const itemId of event.itemIds) {
      const draggedNode = findNode(tree, itemId);
      if (draggedNode && containsNode(draggedNode, containerId)) return false;
    }
    return true;
  }

  const callbacks: ContainerCallbacks = {
    onItemMove: handleMove,
    canDrop: canDropInFolder,
    getInsertionMarkerRect: ({ containerMetadata, defaultRect }) => {
      const depth = Number(containerMetadata.insertionDepth ?? 0);
      const left = 8 + depth * 14;
      const right = 8;
      return {
        ...defaultRect,
        x: defaultRect.x + left,
        width: Math.max(0, defaultRect.width - left - right),
      };
    },
  };
</script>

<div class="file-explorer-card">
  <div class="file-window">
    <div class="file-window-bar">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <Container
      className="code-tree"
      config={{
        mode: "insertion",
        direction: "column",
        name: "website-file-explorer-root",
        callbacks,
        animation: {
          reorder: fileTreeAnimation,
          drop: fileTreeAnimation,
        },
      }}
      locked={true}
      metadata={{
        containerId: "root",
        insertionDepth: 0,
      }}
      items={tree}
      getItemId={(node) => node.id}
    >
      {#snippet entry(node)}
        <FileExplorerNode
          {node}
          {callbacks}
          onToggleFolder={toggleFolderOpen}
          {selectedIds}
          onSelectNode={handleSelectNode}
        />
      {/snippet}
    </Container>
  </div>
</div>

<style>
  .file-explorer-card {
    min-width: 0;
    height: 100%;
  }

  .file-window {
    display: flex;
    flex-direction: column;
    min-height: 300px;
    height: 100%;
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
    min-height: 560px;
    padding: 8px 0 12px;
    box-sizing: border-box;
    overflow: hidden;
  }

  :global(.snapsort-container.tree-folder) {
    width: 100%;
    margin: 0 !important;
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
