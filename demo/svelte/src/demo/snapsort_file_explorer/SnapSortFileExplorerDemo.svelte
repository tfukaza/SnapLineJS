<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { Container } from "@snap-engine/snapsort/svelte";
  import type {
    ContainerCallbacks,
    ItemMoveEvent,
  } from "@snap-engine/snapsort";
  import FileTreeNode from "./FileTreeNode.svelte";
  import type { TreeNodeData } from "./FileTreeNode.svelte";

  const initialTree: TreeNodeData[] = [
    {
      id: "tree-src",
      name: "src",
      kind: "folder",
      open: true,
      children: [
        {
          id: "tree-components",
          name: "components",
          kind: "folder",
          open: true,
          children: [
            { id: "tree-container", name: "Container.svelte", kind: "file" },
            { id: "tree-item", name: "Item.svelte", kind: "file" },
            { id: "tree-handle", name: "Handle.svelte", kind: "file" },
          ],
        },
        {
          id: "tree-core",
          name: "core",
          kind: "folder",
          open: true,
          children: [
            { id: "tree-algorithm", name: "algorithm.ts", kind: "file" },
            { id: "tree-item-ts", name: "item.ts", kind: "file", active: true },
            { id: "tree-container-ts", name: "container.ts", kind: "file" },
          ],
        },
      ],
    },
    {
      id: "tree-demo",
      name: "demo",
      kind: "folder",
      open: true,
      children: [
        {
          id: "tree-svelte",
          name: "svelte",
          kind: "folder",
          open: true,
          children: [
            { id: "tree-router", name: "DemoRouter.svelte", kind: "file" },
            {
              id: "tree-explorer",
              name: "SnapSortFileExplorerDemo.svelte",
              kind: "file",
            },
          ],
        },
      ],
    },
    { id: "tree-package", name: "package.json", kind: "file" },
    { id: "tree-readme", name: "README.md", kind: "file" },
  ];

  let nextId = $state(1);
  let tree = $state<TreeNodeData[]>(structuredClone(initialTree));
  const treeAnimation = {
    duration: 260,
    timing_function: "cubic-bezier(0.2, 0, 0, 1)",
  };

  function cloneNode(node: TreeNodeData): TreeNodeData {
    return {
      ...node,
      children: node.children?.map(cloneNode),
    };
  }

  function extractNode(
    nodes: TreeNodeData[],
    nodeId: string,
  ): { nodes: TreeNodeData[]; node: TreeNodeData | null } {
    let removed: TreeNodeData | null = null;
    const nextNodes: TreeNodeData[] = [];

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

  function containsNode(node: TreeNodeData, nodeId: string): boolean {
    if (node.id === nodeId) return true;
    return node.children?.some((child) => containsNode(child, nodeId)) ?? false;
  }

  function insertNode(
    nodes: TreeNodeData[],
    containerId: string,
    index: number,
    nodeToInsert: TreeNodeData,
  ): TreeNodeData[] {
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

  function toggleNodeOpen(nodes: TreeNodeData[], nodeId: string): TreeNodeData[] {
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

  function handleMove(event: ItemMoveEvent) {
    const nodeId = event.itemId;
    const containerId = event.to.containerMetadata.containerId;
    if (typeof nodeId !== "string" || typeof containerId !== "string") return;

    const extracted = extractNode(tree, nodeId);
    if (!extracted.node) return;
    if (containsNode(extracted.node, containerId)) return;

    tree = insertNode(extracted.nodes, containerId, event.to.index, extracted.node);
  }

  function reset() {
    nextId = 1;
    tree = structuredClone(initialTree);
  }

  function addFile() {
    const id = `tree-new-${nextId++}`;
    tree = [
      ...tree.map(cloneNode),
      {
        id,
        name: `new-file-${id.replace("tree-new-", "")}.ts`,
        kind: "file",
      },
    ];
  }

  const callbacks: ContainerCallbacks = {
    onItemMove: handleMove,
  };
</script>

<div class="file-tree-demo">
  <aside class="file-tree-panel" aria-label="Explorer file tree">
    <div class="explorer-title">
      <span>Explorer</span>
      <div class="title-actions">
        <button onclick={addFile} aria-label="New file">+</button>
        <button onclick={reset} aria-label="Reset tree">Reset</button>
      </div>
    </div>

    <div class="workspace-row">
      <span class="chevron open" aria-hidden="true"></span>
      <strong>SNAPENGINEJS</strong>
    </div>

    <Engine id="snapsort-file-tree-demo-canvas">
      <Container
        className="code-tree"
        config={{
          mode: "insertion",
          direction: "column",
          groupID: "code-file-tree-demo",
            name: "code-file-tree-root",
            callbacks,
            animation: {
              reorder: treeAnimation,
              drop: treeAnimation,
            },
          }}
        locked={true}
        metadata={{
          containerId: "root",
          treeId: "snapenginejs",
          insertionDepth: 0,
          insertionMarkerInsetLeft: 8,
          insertionMarkerInsetRight: 8,
        }}
        items={tree}
        getItemId={(node) => node.id}
      >
        {#snippet entry(node)}
          <FileTreeNode {node} depth={0} {callbacks} onToggleFolder={toggleFolderOpen} />
        {/snippet}
      </Container>
    </Engine>
  </aside>
</div>

<style>
  .file-tree-demo {
    width: 100%;
    min-height: 100%;
    box-sizing: border-box;
    padding: 0 18px 28px;
    color: #1f2937;
    font-family:
      -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  }

  .file-tree-panel {
    width: min(420px, 100%);
    min-height: 640px;
    overflow: hidden;
    border: 1px solid #d4dbe7;
    border-radius: 7px;
    background: #f8fafc;
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.1);
  }

  .explorer-title {
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px 0 18px;
    border-bottom: 1px solid #e2e8f0;
    color: #475569;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.04em;
  }

  .title-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .title-actions button {
    appearance: none;
    height: 22px;
    border: 0 !important;
    border-radius: 4px;
    background: transparent !important;
    color: #475569 !important;
    padding: 0 6px;
    font: inherit;
    font-size: 12px;
    letter-spacing: 0;
    text-transform: none;
    cursor: pointer;
  }

  .title-actions button:hover {
    background: #e2e8f0 !important;
  }

  .workspace-row {
    height: 24px;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 10px;
    color: #334155;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    user-select: none;
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
    min-height: 560px;
    padding: 8px 0 12px;
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
    display: grid;
    grid-template-columns: 18px 18px minmax(0, 1fr);
    align-items: center;
    border: 1px solid transparent;
    border-radius: 0;
    box-sizing: border-box;
    background: transparent;
    color: #1f2937;
    cursor: grab;
    user-select: none;
    -webkit-user-select: none;
    justify-content: initial;
    justify-items: stretch;
    font-size: 14px;
    font-weight: 500;
    position: relative;
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

  @media (max-width: 860px) {
    .file-tree-demo {
      padding: 0 12px 24px;
    }

    .file-tree-panel {
      width: 100%;
    }
  }
</style>
