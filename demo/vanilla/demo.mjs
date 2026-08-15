import { Engine } from "@snap-engine/core";
import { CollisionEngine } from "@snap-engine/core/collision";
import { Container, Item } from "@snap-engine/snapsort";
import { rejectDrop } from "@snap-engine/snapsort/callbacks";

const snapSortAnimation = {
  duration: 180,
  timing_function: "cubic-bezier(0.2, 0, 0, 1)",
};

const fileTreeAnimation = {
  duration: 260,
  timing_function: "cubic-bezier(0.2, 0, 0, 1)",
};

const initialColumns = [
  {
    id: "backlog",
    title: "Backlog",
    items: [
      { id: "item-1", label: "Profile fields", detail: "Account settings" },
      { id: "item-2", label: "Invite flow", detail: "Workspace setup" },
      { id: "item-3", label: "Audit log", detail: "Admin tools" },
      { id: "item-4", label: "Search filters", detail: "Results page" },
    ],
  },
  {
    id: "active",
    title: "Active",
    items: [
      { id: "item-5", label: "Board polish", detail: "Column controls" },
    ],
  },
  {
    id: "done",
    title: "Done",
    items: [{ id: "item-6", label: "Audit export", detail: "CSV polish" }],
  },
];

const engine = new Engine();
engine.setCollisionEngine(new CollisionEngine());
const fileTreeEngine = new Engine();
fileTreeEngine.setCollisionEngine(new CollisionEngine());

let boardElement;
let canvasElement;
let itemCountElement;
let rootContainer = null;
let fileTreeElement;
let fileTreeCanvasElement;
let fileTreeRootContainer = null;
let nextItemNumber = 7;
let columns = cloneColumns(initialColumns);

const columnObjects = new Map();
const itemObjects = new Map();
const itemData = new Map();
const itemIdByElement = new WeakMap();

document.addEventListener("DOMContentLoaded", () => {
  boardElement = document.getElementById("vanilla-board");
  canvasElement = document.getElementById("vanilla-snapsort-canvas");
  itemCountElement = document.getElementById("item-count");
  fileTreeElement = document.getElementById("vanilla-file-tree");
  fileTreeCanvasElement = document.getElementById("vanilla-file-tree-canvas");

  engine.assignDom(canvasElement);
  engine.camera?.setCameraPosition(0, 0);
  fileTreeEngine.assignDom(fileTreeCanvasElement);
  fileTreeEngine.camera?.setCameraPosition(0, 0);

  document
    .getElementById("add-item-button")
    .addEventListener("click", addItem);
  document
    .getElementById("reset-button")
    .addEventListener("click", resetBoard);
  document
    .getElementById("reset-tree-button")
    .addEventListener("click", resetFileTree);
  canvasElement.addEventListener("pointerup", scheduleStateSync);
  canvasElement.addEventListener("pointercancel", scheduleStateSync);

  buildBoard();
  buildFileTree();
});

const initialTree = [
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
        id: "tree-vanilla",
        name: "vanilla",
        kind: "folder",
        open: true,
        children: [
          { id: "tree-demo-mjs", name: "demo.mjs", kind: "file" },
          { id: "tree-demo-css", name: "demo.css", kind: "file" },
        ],
      },
    ],
  },
  { id: "tree-package", name: "package.json", kind: "file" },
  { id: "tree-readme", name: "README.md", kind: "file" },
];

function cloneColumns(source) {
  return source.map((column) => ({
    ...column,
    items: column.items.map((item) => ({ ...item })),
  }));
}

function buildBoard() {
  boardElement.textContent = "";
  columnObjects.clear();
  itemObjects.clear();
  itemData.clear();

  rootContainer = createContainer(
    boardElement,
    null,
    {
      direction: "row",
      name: "vanilla-kanban-root",
      callbacks: { canDrop: rejectDrop },
    },
    { boardId: "vanilla-kanban" },
  );

  for (const column of columns) {
    createColumn(column);
  }

  updateBoardMeta();
}

function createColumn(column) {
  const columnElement = document.createElement("section");
  columnElement.className =
    column.id === "backlog"
      ? "snapsort-container snapsort-mode-euclidean list-panel array-list"
      : "snapsort-container snapsort-mode-euclidean list-panel";
  columnElement.dataset.columnId = column.id;
  columnElement.style.flexDirection = "column";
  columnElement.style.justifyContent = "flex-start";

  const header = document.createElement("div");
  header.className = "list-header";

  const title = document.createElement("h2");
  title.textContent = column.title;

  const count = document.createElement("span");
  count.dataset.columnCount = column.id;
  count.textContent = String(column.items.length);

  header.append(title, count);
  columnElement.append(header);
  boardElement.append(columnElement);

  const columnObject = createContainer(
    columnElement,
    rootContainer,
    {
      direction: "column",
      name: `vanilla-${column.id}`,
      animation: {
        reorder: snapSortAnimation,
        drop: snapSortAnimation,
        move: snapSortAnimation,
      },
    },
    { columnId: column.id },
  );

  columnObjects.set(column.id, columnObject);

  for (const item of column.items) {
    createItem(item, columnObject);
  }
}

function createContainer(element, parent, config, metadata) {
  const container = new Container(engine, null, config);
  container.locked = true;
  container.metadata = metadata;
  container.element = element;
  if (parent) {
    parent.attachItem(container);
  }
  return container;
}

function buildFileTree() {
  fileTreeElement.textContent = "";
  fileTreeRootContainer?.destroy();

  fileTreeRootContainer = createInsertionContainer(
    fileTreeElement,
    null,
    {
      direction: "column",
      name: "vanilla-file-tree-root",
      animation: {
        reorder: fileTreeAnimation,
        drop: fileTreeAnimation,
      },
    },
    { containerId: "root", treeId: "vanilla-file-tree" },
    true,
  );

  for (const node of initialTree) {
    createFileTreeNode(node, 0, fileTreeRootContainer);
  }
}

function createInsertionContainer(element, parent, config, metadata, locked) {
  const container = new Container(fileTreeEngine, null, {
    ...config,
    mode: "insertion",
  });
  container.locked = locked;
  container.metadata = metadata;
  container.element = element;
  if (parent) {
    parent.attachItem(container);
  }
  return container;
}

function createFileTreeNode(node, depth, parentContainer) {
  if (node.kind === "folder") {
    createFileTreeFolder(node, depth, parentContainer);
    return;
  }

  createFileTreeFile(node, depth, parentContainer);
}

function createFileTreeFolder(node, depth, parentContainer) {
  const folderElement = document.createElement("div");
  folderElement.className = `snapsort-container snapsort-mode-insertion tree-node tree-folder depth-${depth}${node.active ? " active" : ""}`;
  folderElement.style.flexDirection = "column";
  folderElement.style.justifyContent = "flex-start";

  const row = createTreeRow(node, depth, true);
  folderElement.append(row);
  parentContainer.element.append(folderElement);

  const folderContainer = createInsertionContainer(
    folderElement,
    parentContainer,
    {
      direction: "column",
      name: `vanilla-file-tree-${node.id}`,
      callbacks: node.open === false ? { canDrop: rejectDrop } : undefined,
      animation: {
        reorder: fileTreeAnimation,
        drop: fileTreeAnimation,
      },
    },
    { itemId: node.id, containerId: node.id },
    false,
  );

  if (node.open !== false) {
    for (const child of node.children ?? []) {
      createFileTreeNode(child, depth + 1, folderContainer);
    }
  }
}

function createFileTreeFile(node, depth, parentContainer) {
  const itemElement = createTreeRow(node, depth, false);
  itemElement.classList.add("snapsort-item");
  parentContainer.element.append(itemElement);

  const itemObject = new Item(fileTreeEngine, null);
  itemObject.metadata = { itemId: node.id };
  itemObject.element = itemElement;
  parentContainer.attachItem(itemObject);
}

function createTreeRow(node, depth, isFolder) {
  const row = document.createElement(isFolder ? "div" : "article");
  row.className = `tree-row ${isFolder ? "folder-row" : "file-row"} depth-${depth}${node.active ? " active" : ""}`;
  row.style.setProperty("--depth", String(depth));

  const indent = document.createElement("span");
  indent.className = "indent";
  indent.ariaHidden = "true";

  const chevron = document.createElement("span");
  chevron.className = isFolder
    ? `chevron${node.open === false ? "" : " open"}`
    : "chevron-spacer";
  chevron.ariaHidden = "true";

  const icon = document.createElement("span");
  icon.className = isFolder ? "folder-icon" : "file-icon";
  icon.ariaHidden = "true";

  const name = document.createElement("span");
  name.className = "row-name";
  name.textContent = node.name;

  row.append(indent, chevron, icon, name);
  return row;
}

function resetFileTree() {
  buildFileTree();
}

function createItem(item, container) {
  itemData.set(item.id, item);

  const itemElement = document.createElement("article");
  itemElement.className = "snapsort-item task-card";
  itemIdByElement.set(itemElement, item.id);

  const content = document.createElement("div");
  content.className = "task-content";

  const main = document.createElement("div");
  main.className = "task-main";

  const label = document.createElement("strong");
  label.textContent = item.label;

  const detail = document.createElement("span");
  detail.textContent = item.detail;

  const actions = document.createElement("div");
  actions.className = "card-actions";

  actions.append(
    createIconButton("delete", `Delete ${item.label}`, () =>
      deleteItem(item.id),
    ),
    createIconButton("arrow_left_alt", `Move ${item.label} left`, () =>
      moveItemAcrossColumns(item.id, -1),
    ),
    createIconButton("arrow_right_alt", `Move ${item.label} right`, () =>
      moveItemAcrossColumns(item.id, 1),
    ),
  );

  main.append(label, detail);
  content.append(main, actions);
  itemElement.append(content);
  container.element.append(itemElement);

  const itemObject = new Item(engine, null);
  itemObject.metadata = { itemId: item.id };
  itemObject.element = itemElement;
  container.attachItem(itemObject);
  itemObjects.set(item.id, itemObject);

  return itemObject;
}

function createIconButton(iconName, label, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-button";
  button.ariaLabel = label;

  const icon = document.createElement("span");
  icon.className = "material-symbols-outlined";
  icon.ariaHidden = "true";
  icon.textContent = iconName;
  button.append(icon);

  const stop = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const run = (event) => {
    stop(event);
    action();
  };
  button.addEventListener("pointerdown", stop);
  button.addEventListener("pointerup", run);
  button.addEventListener("mousedown", stop);
  button.addEventListener("mouseup", stop);
  button.addEventListener("click", (event) => {
    stop(event);
    if (event.detail === 0) {
      action();
    }
  });

  return button;
}

function createItemData() {
  const itemNumber = nextItemNumber++;
  return {
    id: `item-${itemNumber}`,
    label: `Task ${itemNumber}`,
    detail: "Added from plain JS state",
  };
}

function addItem() {
  const item = createItemData();
  const firstColumn = columns[0];
  const firstColumnObject = columnObjects.get(firstColumn.id);
  if (!firstColumnObject) return;

  firstColumn.items.push(item);
  createItem(item, firstColumnObject);
  updateBoardMeta();
}

function deleteItem(itemId) {
  const itemObject = itemObjects.get(itemId);
  if (!itemObject) return;

  itemObject.destroy();
  itemObjects.delete(itemId);
  itemData.delete(itemId);
  syncColumnsFromDom();
}

function moveItemAcrossColumns(itemId, direction) {
  syncColumnsFromDom();

  const sourceColumnIndex = columns.findIndex((column) =>
    column.items.some((item) => item.id === itemId),
  );
  if (sourceColumnIndex === -1) return;

  const targetColumnIndex = sourceColumnIndex + direction;
  if (targetColumnIndex < 0 || targetColumnIndex >= columns.length) return;

  const sourceColumn = columns[sourceColumnIndex];
  const targetColumn = columns[targetColumnIndex];
  const sourceIndex = sourceColumn.items.findIndex(
    (item) => item.id === itemId,
  );
  const sourceContainer = columnObjects.get(sourceColumn.id);
  const targetContainer = columnObjects.get(targetColumn.id);
  if (!sourceContainer || !targetContainer || sourceIndex === -1) return;

  const destinationIndex = Math.min(sourceIndex, targetColumn.items.length);
  const movedBySnapSort = sourceContainer.moveItem(
    itemId,
    targetContainer,
    destinationIndex,
  );
  if (movedBySnapSort) {
    scheduleStateSync();
    return;
  }

  const itemObject = itemObjects.get(itemId);
  if (itemObject) {
    targetContainer.element.append(itemObject.element);
    sourceContainer.detachItemFromContainer(sourceContainer, itemObject);
    targetContainer.attachItem(itemObject);
  }
  scheduleStateSync();
}

function resetBoard() {
  for (const itemObject of itemObjects.values()) {
    itemObject.destroy();
  }
  for (const columnObject of columnObjects.values()) {
    columnObject.destroy();
  }
  rootContainer?.destroy();

  nextItemNumber = 7;
  columns = cloneColumns(initialColumns);
  boardElement = createBoardElement();
  buildBoard();
}

function createBoardElement() {
  const boardFrame = canvasElement.querySelector(".board-frame");
  const nextBoardElement = document.createElement("div");
  nextBoardElement.id = "vanilla-board";
  nextBoardElement.className = "snapsort-container snapsort-mode-euclidean board";
  nextBoardElement.ariaLabel = "SnapSort vanilla Kanban board";
  boardFrame.append(nextBoardElement);
  return nextBoardElement;
}

function scheduleStateSync() {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(syncColumnsFromDom);
  });
}

function syncColumnsFromDom() {
  columns = columns.map((column) => {
    const columnElement = boardElement.querySelector(
      `[data-column-id="${column.id}"]`,
    );
    if (!columnElement) return column;

    const ids = [...columnElement.querySelectorAll(".task-card")]
      .map((element) => itemIdByElement.get(element))
      .filter(Boolean);
    const items = ids
      .map((id) => itemData.get(id))
      .filter((item) => item != null);

    return { ...column, items };
  });
  updateBoardMeta();
}

function updateBoardMeta() {
  const itemCount = columns.reduce(
    (total, column) => total + column.items.length,
    0,
  );
  itemCountElement.textContent = String(itemCount);

  for (const column of columns) {
    const countElement = boardElement.querySelector(
      `[data-column-count="${column.id}"]`,
    );
    if (countElement) {
      countElement.textContent = String(column.items.length);
    }
  }

  updateActionButtons();
}

function updateActionButtons() {
  const columnIndexByItem = new Map();
  columns.forEach((column, columnIndex) => {
    column.items.forEach((item) => {
      columnIndexByItem.set(item.id, columnIndex);
    });
  });

  for (const [itemId, itemObject] of itemObjects) {
    const itemElement = itemObject.element;
    if (!itemElement) continue;

    const columnIndex = columnIndexByItem.get(itemId);
    const [deleteButton, leftButton, rightButton] =
      itemElement.querySelectorAll(".icon-button");

    if (deleteButton) {
      deleteButton.disabled = false;
    }
    if (leftButton) {
      leftButton.disabled = columnIndex === 0;
    }
    if (rightButton) {
      rightButton.disabled = columnIndex === columns.length - 1;
    }
  }
}
