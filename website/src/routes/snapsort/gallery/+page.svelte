<script lang="ts">
  import SeoHead from "$lib/components/SeoHead.svelte";
  import ClientDemoFrame from "$lib/components/ClientDemoFrame.svelte";
  import ExhibitSource from "./ExhibitSource.svelte";
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type { Engine as SnapEngine } from "@snap-engine/core";
  import {
    Container,
    Ghost,
    Handle,
    Item,
  } from "@snap-engine/snapsort/svelte";
  import SnapSortContextBoundary from "../SnapSortContextBoundary.svelte";
  import FileExplorerExample from "../FileExplorerExample.svelte";
  import type {
    Container as SortContainer,
    DragCloneEvent,
    DragEndEvent,
    DragItemHoverEvent,
    DragStartEvent,
    DropTargetChangeEvent,
    GhostInsertEvent,
    Item as SortItem,
    ItemMoveEvent,
    ItemRemoveEvent,
    ItemSwapEvent,
  } from "@snap-engine/snapsort";
  import { defaultAnimations } from "@snap-engine/snapsort";
  import {
    prioritizeIntersectingContainer,
    rejectDrop,
  } from "@snap-engine/snapsort/callbacks";

  type SentenceZone = "answer" | "bank";

  type SentenceTile = {
    id: string;
    text: string;
  };

  type EditorFieldType =
    | "shortText"
    | "longText"
    | "multipleChoice"
    | "checkboxes"
    | "dropdown"
    | "date"
    | "rating";

  type EditorPaletteItem = {
    type: EditorFieldType;
    label: string;
    icon: string;
  };

  type EditorOption = {
    id: string;
    label: string;
  };

  type EditorField = {
    id: string;
    type: EditorFieldType;
    label: string;
    options?: EditorOption[];
  };

  let { data } = $props();

  let examplesEngine: SnapEngine | null = $state(null);

  function configureInput(engine: SnapEngine | null) {
    if (engine) {
      engine.input.config.maxSimultaneousDrags = 1;
    }
  }

  $effect(() => {
    configureInput(examplesEngine);
  });

  let todoItems = $state([
    {
      id: "t-1",
      text: "Plan the grocery run",
      due: "Due in 2h",
      priority: "Home",
      estimate: "20m",
      checked: false,
    },
    {
      id: "t-2",
      text: "Take an evening walk",
      due: "Done",
      priority: "Routine",
      estimate: "15m",
      checked: true,
    },
    {
      id: "t-3",
      text: "Clear the client inbox",
      due: "Due today",
      priority: "Work",
      estimate: "30m",
      checked: false,
    },
    {
      id: "t-4",
      text: "Fit in a strength session",
      due: "6:30 PM",
      priority: "Health",
      estimate: "45m",
      checked: false,
    },
    {
      id: "t-5",
      text: "Read the next chapter",
      due: "Done",
      priority: "Focus",
      estimate: "25m",
      checked: true,
    },
    {
      id: "t-6",
      text: "Review autopay dates",
      due: "Tomorrow",
      priority: "Finance",
      estimate: "10m",
      checked: false,
    },
    {
      id: "t-7",
      text: "Call mom back",
      due: "Tonight",
      priority: "Family",
      estimate: "20m",
      checked: false,
    },
    {
      id: "t-8",
      text: "Water balcony plants",
      due: "Due in 4h",
      priority: "Home",
      estimate: "8m",
      checked: false,
    },
  ]);

  const kanbanTodo = [
    {
      id: "k-1",
      text: "Fix Bug #12",
      desc: "Fix the login issue on Safari browser.",
      assignee: "Maya Chen",
      avatar: "MC",
      avatarColor: "#0088ff",
      due: "Today",
      tag: "Bug",
      activity: "3",
    },
    {
      id: "k-2",
      text: "Write Tests",
      desc: "Add unit tests for the new payment module.",
      assignee: "Noah Kim",
      avatar: "NK",
      avatarColor: "#8f3dff",
      due: "Jun 30",
      tag: "QA",
      activity: "1",
    },
  ];

  const kanbanReview = [
    {
      id: "k-3",
      text: "Code Review",
      desc: "Review the PR for the new feature.",
      assignee: "Ari Patel",
      avatar: "AP",
      avatarColor: "#ff7a00",
      due: "Jul 1",
      tag: "Dev",
      activity: "5",
    },
    {
      id: "k-4",
      text: "Design QA",
      desc: "Check spacing, empty states, and mobile behavior.",
      assignee: "Lina Park",
      avatar: "LP",
      avatarColor: "#ff3d7f",
      due: "Jul 2",
      tag: "UI",
      activity: "2",
    },
  ];

  const kanbanDone = [
    {
      id: "k-5",
      text: "Publish Docs",
      desc: "Update the release notes and component examples.",
      assignee: "Eli Stone",
      avatar: "ES",
      avatarColor: "#14a44d",
      due: "Done",
      tag: "Docs",
      activity: "4",
    },
    {
      id: "k-6",
      text: "Deploy to Prod",
      desc: "Deploy the latest build to production.",
      assignee: "Tara Ito",
      avatar: "TI",
      avatarColor: "#00a9a5",
      due: "Done",
      tag: "Ops",
      activity: "6",
    },
  ];

  type KanbanCard = (typeof kanbanTodo)[number];
  type KanbanColumn = {
    id: string;
    title: string;
    target: string;
    cards: KanbanCard[];
  };

  let kanbanColumns: KanbanColumn[] = $state([
    { id: "kanban-todo", title: "To Do", target: "kanban-review", cards: [...kanbanTodo] },
    { id: "kanban-review", title: "Review", target: "kanban-done", cards: [...kanbanReview] },
    { id: "kanban-done", title: "Done", target: "kanban-todo", cards: [...kanbanDone] },
  ]);

  const sentenceWords: SentenceTile[] = [
    { id: "sw-1", text: "あり" },
    { id: "sw-2", text: "の" },
    { id: "sw-3", text: "ます" },
    { id: "sw-4", text: "多く" },
    { id: "sw-5", text: "が" },
    { id: "sw-6", text: "用途" },
  ];

  const sentenceAnimation = {
    duration: 180,
    timing_function: "cubic-bezier(0.2, 0, 0, 1)",
  };

  const editorPalette: EditorPaletteItem[] = [
    { type: "shortText", label: "Short text", icon: "short_text" },
    { type: "longText", label: "Long text", icon: "notes" },
    { type: "multipleChoice", label: "Multiple choice", icon: "radio_button_checked" },
    { type: "checkboxes", label: "Checkboxes", icon: "checklist" },
    { type: "dropdown", label: "Dropdown", icon: "arrow_drop_down_circle" },
    { type: "date", label: "Date", icon: "event" },
    { type: "rating", label: "Rating", icon: "star" },
  ];

  let editorOptionCount = 7;

  function createEditorOption(label: string): EditorOption {
    editorOptionCount += 1;
    return {
      id: `editor-option-${editorOptionCount}`,
      label,
    };
  }

  function defaultEditorOptions(type: EditorFieldType): EditorOption[] | undefined {
    if (type === "multipleChoice" || type === "checkboxes") {
      return [createEditorOption("Option 1"), createEditorOption("Option 2")];
    }
    if (type === "dropdown") {
      return [
        createEditorOption("Option 1"),
        createEditorOption("Option 2"),
        createEditorOption("Option 3"),
      ];
    }
    return undefined;
  }

  let editorFieldCount = 3;
  let editorFields: EditorField[] = $state([
    { id: "editor-field-1", type: "shortText", label: "Question 1" },
    {
      id: "editor-field-2",
      type: "multipleChoice",
      label: "Question 2",
      options: [
        { id: "editor-option-1", label: "Option 1" },
        { id: "editor-option-2", label: "Option 2" },
      ],
    },
    { id: "editor-field-3", type: "rating", label: "Question 3" },
  ]);

  let sentenceAnswerContainer: SortContainer | undefined = $state();
  let sentenceBankContainer: SortContainer | undefined = $state();
  let sentenceAnswerTiles: SentenceTile[] = $state([]);
  let sentenceBankTiles: SentenceTile[] = $state([...sentenceWords]);
  let sentenceResult = $state("");
  let sentencePointerStart: { x: number; y: number } | null = null;
  let suppressSentenceClick = false;
  const sentenceZones: SentenceZone[] = ["answer", "bank"];
  let debug = $state(false);
  let canvasComponent: Engine | null = null;

  function toggleDebug() {
    debug = !debug;
    if (debug) {
      canvasComponent?.enableDebug();
    } else {
      canvasComponent?.disableDebug();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "d" || e.key === "D") {
      toggleDebug();
    }
  }

  function addEditorField(type: EditorFieldType) {
    editorFieldCount += 1;
    editorFields = [
      ...editorFields,
      {
        id: `editor-field-${editorFieldCount}`,
        type,
        label: `Question ${editorFieldCount}`,
        options: defaultEditorOptions(type),
      },
    ];
  }

  function updateEditorFieldLabel(id: string, label: string) {
    editorFields = editorFields.map((field) =>
      field.id === id ? { ...field, label } : field,
    );
  }

  function updateEditorFieldOptions(
    fieldId: string,
    update: (options: EditorOption[]) => EditorOption[],
  ) {
    editorFields = editorFields.map((field) =>
      field.id === fieldId
        ? { ...field, options: update(field.options ?? []) }
        : field,
    );
  }

  function updateEditorOptionLabel(fieldId: string, optionId: string, label: string) {
    updateEditorFieldOptions(fieldId, (options) =>
      options.map((option) => option.id === optionId ? { ...option, label } : option),
    );
  }

  function addEditorOption(fieldId: string) {
    const field = editorFields.find((candidate) => candidate.id === fieldId);
    const nextLabel = `Option ${(field?.options?.length ?? 0) + 1}`;
    updateEditorFieldOptions(fieldId, (options) => [...options, createEditorOption(nextLabel)]);
  }

  function removeEditorOption(fieldId: string, optionId: string) {
    updateEditorFieldOptions(fieldId, (options) =>
      options.length <= 1 ? options : options.filter((option) => option.id !== optionId),
    );
  }

  function reorderEditorOption(fieldId: string, optionId: string, index: number) {
    updateEditorFieldOptions(fieldId, (options) => {
      const option = options.find((candidate) => candidate.id === optionId);
      if (!option) return options;

      const nextOptions = options.filter((candidate) => candidate.id !== optionId);
      const targetIndex = Math.max(0, Math.min(index, nextOptions.length));
      nextOptions.splice(targetIndex, 0, option);
      return nextOptions;
    });
  }

  function handleEditorOptionMove(event: ItemMoveEvent) {
    const fieldId = event.to.containerMetadata.fieldId;
    const optionId = event.itemId;
    if (typeof fieldId !== "string" || typeof optionId !== "string") return;

    reorderEditorOption(fieldId, optionId, event.to.index);
  }

  function handleEditorFieldMove(event: ItemMoveEvent) {
    const field = editorFields.find((candidate) => candidate.id === event.itemId);
    if (!field) return;
    const next = editorFields.filter((candidate) => candidate.id !== event.itemId);
    next.splice(Math.max(0, Math.min(event.to.index, next.length)), 0, field);
    editorFields = next;
  }

  function handleTodoMove(event: ItemMoveEvent) {
    const todo = todoItems.find((candidate) => candidate.id === event.itemId);
    if (!todo) return;
    const next = todoItems.filter((candidate) => candidate.id !== event.itemId);
    next.splice(Math.max(0, Math.min(event.to.index, next.length)), 0, todo);
    todoItems = next;
  }

  function handleKanbanMove(event: ItemMoveEvent) {
    const targetColumnId = event.to.containerMetadata.columnId;
    if (typeof targetColumnId !== "string") return;
    let moved: KanbanCard | undefined;
    const withoutMoved = kanbanColumns.map((column) => {
      const card = column.cards.find((candidate) => candidate.id === event.itemId);
      if (card) moved = card;
      return {
        ...column,
        cards: column.cards.filter((candidate) => candidate.id !== event.itemId),
      };
    });
    if (!moved) return;
    kanbanColumns = withoutMoved.map((column) => {
      if (column.id !== targetColumnId) return column;
      const cards = column.cards.slice();
      cards.splice(Math.max(0, Math.min(event.to.index, cards.length)), 0, moved!);
      return { ...column, cards };
    });
  }

  function sentenceContainerForZone(zone: SentenceZone) {
    return zone === "answer" ? sentenceAnswerContainer : sentenceBankContainer;
  }

  function findSentenceTile(tileId: string | undefined) {
    if (!tileId) return null;
    return [...sentenceAnswerTiles, ...sentenceBankTiles].find((tile) => tile.id === tileId) ?? null;
  }

  function updateSentenceTileZone(tileId: string, targetZone: SentenceZone, targetIndex: number) {
    const allTiles = [...sentenceAnswerTiles, ...sentenceBankTiles];
    const movedTile = allTiles.find((tile) => tile.id === tileId);
    if (!movedTile) return;

    const nextAnswerTiles = sentenceAnswerTiles.filter((tile) => tile.id !== tileId);
    const nextBankTiles = sentenceBankTiles.filter((tile) => tile.id !== tileId);
    const targetTiles = targetZone === "answer" ? nextAnswerTiles : nextBankTiles;
    const destinationIndex = Math.max(0, Math.min(targetIndex, targetTiles.length));

    targetTiles.splice(destinationIndex, 0, movedTile);
    sentenceAnswerTiles = nextAnswerTiles;
    sentenceBankTiles = nextBankTiles;
    sentenceResult = "";
  }

  function handleSentenceMove(event: ItemMoveEvent) {
    const itemId = event.itemId;

    const targetZone = event.to.containerMetadata.zone;
    if (targetZone !== "answer" && targetZone !== "bank") return;

    updateSentenceTileZone(itemId, targetZone, event.to.index);
  }

  function handleSentenceRemove(event: ItemRemoveEvent) {
    const itemId = event.itemId;

    sentenceAnswerTiles = sentenceAnswerTiles.filter((tile) => tile.id !== itemId);
    sentenceBankTiles = sentenceBankTiles.filter((tile) => tile.id !== itemId);
  }

  /** Ghost snippet content for both sentence zones — looks up the dragged tile's text via its itemId. */
  function sentenceGhostTileText(event: GhostInsertEvent): string {
    return findSentenceTile(event.originalItemId)?.text ?? "";
  }

  function moveSentenceTileToZone(tile: SentenceTile, targetZone: SentenceZone) {
    const sourceZone: SentenceZone = sentenceAnswerTiles.some((candidate) => candidate.id === tile.id)
      ? "answer"
      : "bank";
    const sourceContainer = sentenceContainerForZone(sourceZone);
    const targetContainer = sentenceContainerForZone(targetZone);
    const fallbackIndex = targetZone === "answer" ? sentenceAnswerTiles.length : sentenceBankTiles.length;

    if (sourceContainer && targetContainer) {
      const movedBySnapSort = sourceContainer.moveItem(tile.id, targetContainer, fallbackIndex);
      if (movedBySnapSort) return;
    }

    updateSentenceTileZone(tile.id, targetZone, fallbackIndex);
  }

  function handleSentenceTilePointerDown(event: PointerEvent) {
    sentencePointerStart = { x: event.clientX, y: event.clientY };
    suppressSentenceClick = false;
  }

  function handleSentenceTilePointerMove(event: PointerEvent) {
    if (!sentencePointerStart) return;
    const distance = Math.hypot(
      event.clientX - sentencePointerStart.x,
      event.clientY - sentencePointerStart.y,
    );
    if (distance > 3) {
      suppressSentenceClick = true;
    }
  }

  function handleSentenceTileClick(event: MouseEvent, action: () => void) {
    if (suppressSentenceClick) {
      event.preventDefault();
      event.stopPropagation();
      suppressSentenceClick = false;
      sentencePointerStart = null;
      return;
    }

    action();
  }

  function checkSentence() {
    const words = sentenceAnswerTiles.map((tile) => tile.text);
    const correct = ["多く", "の", "用途", "が", "あり", "ます"];

    if (
      words.length === correct.length &&
      words.every((w, i) => w === correct[i])
    ) {
      sentenceResult = "Correct!";
    } else {
      sentenceResult = "Incorrect, try again.";
    }
  }

  // --- Clone Palette: session.dropEffect = "copy" ---

  type PaletteBlockType = "button" | "image" | "divider" | "spacer";

  type PaletteBlockTemplate = {
    type: PaletteBlockType;
    label: string;
    icon: string;
  };

  type CanvasBlock = {
    id: string;
    type: PaletteBlockType;
  };

  const paletteBlockTemplates: PaletteBlockTemplate[] = [
    { type: "button", label: "Button", icon: "smart_button" },
    { type: "image", label: "Image", icon: "image" },
    { type: "divider", label: "Divider", icon: "horizontal_rule" },
    { type: "spacer", label: "Spacer", icon: "space_bar" },
  ];
  type CloneZone = "palette" | "canvas";
  const cloneZones: CloneZone[] = ["palette", "canvas"];

  const blockIcon: Record<PaletteBlockType, string> = {
    button: "smart_button",
    image: "image",
    divider: "horizontal_rule",
    spacer: "space_bar",
  };

  const blockLabel: Record<PaletteBlockType, string> = {
    button: "Button",
    image: "Image",
    divider: "Divider",
    spacer: "Spacer",
  };

  type DraggingClone = {
    id: string;
    type: PaletteBlockType;
    item: SortItem;
  };

  let canvasBlocks: CanvasBlock[] = $state([]);
  let cloneBlockCount = 0;
  // The in-flight clone during a copy drag: a fresh item handed off from the
  // palette block, rendered inside the canvas and following the pointer. The
  // palette block itself is never touched.
  let draggingClone: DraggingClone | null = $state(null);
  type CanvasEntry =
    | { kind: "clone"; id: string; type: PaletteBlockType; item: SortItem }
    | { kind: "block"; id: string; block: CanvasBlock };
  const canvasEntries = $derived.by((): CanvasEntry[] => [
    ...(draggingClone
      ? [{ kind: "clone" as const, id: draggingClone.id, type: draggingClone.type, item: draggingClone.item }]
      : []),
    ...canvasBlocks.map((block) => ({ kind: "block" as const, id: block.id, block })),
  ]);

  function handleCloneDragStart(event: DragStartEvent) {
    // Only dragging out of the palette should clone — reordering an
    // already-placed canvas block should behave like a normal move.
    if (event.source.container.name === "clone-palette") {
      event.session.dropEffect = "copy";
    }
  }

  function handleDragClone(event: DragCloneEvent) {
    const type = event.itemMetadata.blockType;
    if (typeof type !== "string") return;
    cloneBlockCount += 1;
    // This id is permanent — it's reused as the committed block's id below,
    // since the dragged clone instance and the eventual permanent Item are
    // bridged only by a stable itemId (the clone is destroyed once the
    // {#each canvasBlocks} render below takes over rendering it for real).
    const id = `canvas-block-${cloneBlockCount}`;
    const cloneItem = event.cloneItems[0];
    cloneItem.itemId = id;
    cloneItem.metadata = { blockType: type };
    // Materialize the clone in state; the #if below renders it inside the
    // canvas container, binding its element via `itemObject`. Once its element
    // exists (after the adapter's synchronous flush), core hands the drag off to it.
    draggingClone = { id, type: type as PaletteBlockType, item: cloneItem };
  }

  function handleCanvasMove(event: ItemMoveEvent) {
    const blockId = event.itemId;

    if (event.from === null) {
      // A copy drag committing: this itemId has never been in canvasBlocks
      // before (it's the id assigned in handleDragClone above) — handling
      // from here is identical to a regular cross-container move landing on
      // a container that doesn't have this item yet, it just always happens
      // to be new. Add it, then retire the floating clone.
      const type = event.itemMetadata.blockType;
      if (typeof type !== "string") return;
      const newBlock: CanvasBlock = { id: blockId, type: type as PaletteBlockType };
      const next = canvasBlocks.slice();
      const index = Math.max(0, Math.min(event.to.index, next.length));
      next.splice(index, 0, newBlock);
      canvasBlocks = next;
      draggingClone = null;
      return;
    }

    // Otherwise it's a plain reorder of an already-placed canvas block.
    const block = canvasBlocks.find((candidate) => candidate.id === blockId);
    if (!block) return;
    const next = canvasBlocks.filter((candidate) => candidate.id !== blockId);
    const index = Math.max(0, Math.min(event.to.index, next.length));
    next.splice(index, 0, block);
    canvasBlocks = next;
  }

  function handleCanvasRemove(event: ItemRemoveEvent) {
    // Fired only when a copy drag cancels (dropped outside any drop
    // container): the floating clone was never a real block, so discard it.
    if (draggingClone && event.itemId === draggingClone.id) {
      draggingClone = null;
    }
  }

  function removeCanvasBlock(id: string) {
    canvasBlocks = canvasBlocks.filter((block) => block.id !== id);
  }

  // --- Trash It: session.dropEffect = "none" + onDragEnd cleanup ---

  type TrashTask = {
    id: string;
    text: string;
  };

  let trashTasks: TrashTask[] = $state([
    { id: "trash-task-1", text: "Reply to design feedback" },
    { id: "trash-task-2", text: "Archive last sprint's board" },
    { id: "trash-task-3", text: "Renew the SSL certificate" },
    { id: "trash-task-4", text: "Clean up unused feature flags" },
    { id: "trash-task-5", text: "Update the onboarding checklist" },
  ]);
  type TrashZone = "list" | "bin";
  const trashZones: TrashZone[] = ["list", "bin"];
  const emptyTrashTasks: TrashTask[] = [];
  let trashHovered = $state(false);

  function handleTrashDropTargetChange(event: DropTargetChangeEvent) {
    const overTrash = event.current?.containerMetadata.role === "trash";
    event.session.dropEffect = overTrash ? "none" : "move";
    trashHovered = overTrash;
  }

  function handleTrashListMove(event: ItemMoveEvent) {
    const taskId = event.itemId;
    const task = trashTasks.find((candidate) => candidate.id === taskId);
    if (!task) return;
    const next = trashTasks.filter((candidate) => candidate.id !== taskId);
    const index = Math.max(0, Math.min(event.to.index, next.length));
    next.splice(index, 0, task);
    trashTasks = next;
  }

  function handleTrashBinMove(event: ItemMoveEvent) {
    trashTasks = trashTasks.filter((task) => task.id !== event.itemId);
  }

  function handleTrashDragEnd(event: DragEndEvent) {
    const shouldDelete = trashHovered || event.destination?.containerMetadata.role === "trash";
    trashHovered = false;
    if (!shouldDelete) return;
    const taskId = event.itemId;
    trashTasks = trashTasks.filter((task) => task.id !== taskId);
  }

  // --- Swap Grid: mode: "swap" + onDragItemEnter/Leave hover highlight ---

  type SwapTile = {
    id: string;
    label: string;
    color: string;
  };

  let swapTiles: SwapTile[] = $state([
    { id: "swap-1", label: "A1", color: "#ff7a59" },
    { id: "swap-2", label: "A2", color: "#ffb703" },
    { id: "swap-3", label: "A3", color: "#06d6a0" },
    { id: "swap-4", label: "B1", color: "#4cc9f0" },
    { id: "swap-5", label: "B2", color: "#4361ee" },
    { id: "swap-6", label: "B3", color: "#7209b7" },
    { id: "swap-7", label: "C1", color: "#f72585" },
    { id: "swap-8", label: "C2", color: "#3a86ff" },
    { id: "swap-9", label: "C3", color: "#8ecae6" },
  ]);
  let swapHoveredId: string | null = $state(null);

  function handleSwapCommit(event: ItemSwapEvent) {
    const aId = event.a.itemId;
    const bId = event.b.itemId;
    const aIndex = swapTiles.findIndex((tile) => tile.id === aId);
    const bIndex = swapTiles.findIndex((tile) => tile.id === bId);
    if (aIndex === -1 || bIndex === -1) return;
    const next = swapTiles.slice();
    [next[aIndex], next[bIndex]] = [next[bIndex], next[aIndex]];
    swapTiles = next;
  }

  function handleSwapHoverEnter(event: DragItemHoverEvent) {
    swapHoveredId = event.overItemId;
  }

  function handleSwapHoverLeave(event: DragItemHoverEvent) {
    const id = event.overItemId;
    if (swapHoveredId === id) {
      swapHoveredId = null;
    }
  }

  function swapGhostTile(event: GhostInsertEvent) {
    return swapTiles.find((tile) => tile.id === event.originalItemId);
  }
</script>

<SeoHead
  title="SnapSort Gallery | Interactive drag and drop examples"
  description="Explore complete SnapSort demos for file trees, sentence puzzles, form builders, kanban boards, and more."
  path="/snapsort/gallery"
  imageAlt="SnapSort interactive drag and drop gallery preview"
/>
<svelte:window onkeydown={handleKeydown} />

<section class="gallery-hero">
  <div class="gallery-hero-copy">
    <h1 class="gallery-hero-title">Gallery</h1>
    <p class="large gallery-hero-lede">
      A hands-on exhibition of interfaces built with SnapSort. Every piece is
      live &mdash; drag, sort, and rearrange the exhibits to see the engine at work.
    </p>
  </div>
</section>
<section class="gallery-body">
  <aside class="gallery-sidebar" aria-label="Gallery exhibits">
    <nav class="gallery-sidebar-nav">
      <span class="gallery-sidebar-label">Exhibits</span>
      <ol>
        <li><a href="#todo-list">TODO List</a></li>
        <li><a href="#kanban-board">Kanban Board</a></li>
        <li><a href="#sentence-builder">Sentence Builder</a></li>
        <li><a href="#file-explorer">File Explorer</a></li>
        <li><a href="#clone-palette">Clone Palette</a></li>
        <li><a href="#trash-it">Trash It</a></li>
        <li><a href="#swap-grid">Swap Grid</a></li>
        <li><a href="#editor">Editor</a></li>
      </ol>
    </nav>
  </aside>

  <div class="gallery-exhibits">
    <h2 class="visually-hidden">Interactive exhibits</h2>
    <ClientDemoFrame>
      {#snippet fallback()}
      <div class="examples-grid gallery-skeleton-grid" aria-hidden="true">
        <div id="todo-list" class="example-card pm-example example-side">
          <div class="example-placard">
            <h3>TODO List</h3>
            <p class="example-caption">
              A sortable daily checklist — grab the handle to reorder tasks without
              losing your progress.
            </p>
          </div>
          <div class="project-list">
            {#each todoItems as todo}
              <div class="project-card" class:checked={todo.checked}>
                <i class="material-symbols-rounded project-drag-handle" aria-hidden="true">drag_indicator</i>
                <label>
                  <input type="checkbox" checked={todo.checked} tabindex="-1" />
                  <span></span>
                </label>
                <span class="project-text">{todo.text}</span>
                <div class="project-meta" aria-label="Task metadata">
                  <span class="project-meta-item">
                    <i class="material-symbols-rounded" aria-hidden="true">schedule</i>
                    {todo.due}
                  </span>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <div id="kanban-board" class="example-card kanban-example gallery-demo-skeleton"></div>

        <div id="sentence-builder" class="example-card sentence-example example-side">
          <div class="example-placard">
            <h3>Sentence Builder</h3>
            <p class="example-caption">
              Compose a translation from word tiles. Ghost previews mark where each
              tile will settle.
            </p>
          </div>
          <div class="card ground sentence-builder">
            <div class="display prompt-section">
              <div class="english-sentence">
                <span>It has many uses</span>
              </div>
            </div>
            <div class="sentence-container-area">
              <div class="sentence-workspace-root">
                <div class="sentence-drop-zone"></div>
                <div class="sentence-source-zone">
                  {#each sentenceBankTiles as tile}
                    <button type="button" class="word-card sentence-word" tabindex="-1">
                      {tile.text}
                    </button>
                  {/each}
                </div>
              </div>
            </div>
            <div class="controls">
              <button class="check-btn" tabindex="-1">Check</button>
            </div>
          </div>
        </div>

        <div id="file-explorer" class="example-card file-example example-side">
          <div class="example-placard">
            <h3>File Explorer</h3>
            <p class="example-caption">
              An insertion-mode tree with nested folders — drop markers trace the
              exact depth as you drag.
            </p>
          </div>
          <div class="file-window static-file-window">
            <div class="file-window-bar"><span></span><span></span><span></span></div>
            <div class="tree-row folder-row selected">src</div>
            <div class="tree-row file-row">routes</div>
            <div class="tree-row file-row">components</div>
            <div class="tree-row file-row">package.json</div>
          </div>
        </div>

        <div id="clone-palette" class="example-card clone-example example-side">
          <div class="example-placard">
            <h3>Clone Palette</h3>
            <p class="example-caption">
              Drag a block from the palette onto the canvas to place a copy —
              the palette item never leaves. Built on SnapSort's <code>copy</code>
              drop effect.
            </p>
          </div>
          <div class="clone-workspace">
            <div class="clone-root">
              <div class="clone-palette">
                {#each paletteBlockTemplates as template}
                  <div class="clone-block clone-block-{template.type} clone-palette-block">
                    <i class="material-symbols-rounded" aria-hidden="true">{template.icon}</i>
                    <span>{template.label}</span>
                  </div>
                {/each}
              </div>
              <div class="clone-canvas">
                <p class="clone-canvas-empty">Drop blocks here</p>
              </div>
            </div>
          </div>
        </div>

        <div id="trash-it" class="example-card trash-example example-side">
          <div class="example-placard">
            <h3>Trash It</h3>
            <p class="example-caption">
              Drag a task onto the trash to delete it — everywhere else still
              reorders normally. Built on SnapSort's <code>none</code> drop
              effect.
            </p>
          </div>
          <div class="trash-workspace">
            <div class="trash-root">
              <div class="trash-list">
                {#each trashTasks as task}
                  <div class="trash-task">
                    <i class="material-symbols-rounded trash-task-grip" aria-hidden="true">drag_indicator</i>
                    <span>{task.text}</span>
                  </div>
                {/each}
              </div>
              <div class="trash-zone">
                <div class="trash-drop-target">
                  <div class="trash-zone-content">
                    <i class="material-symbols-rounded" aria-hidden="true">delete</i>
                    <span>Drop to delete</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div id="swap-grid" class="example-card swap-example example-side">
          <div class="example-placard">
            <h3>Swap Grid</h3>
            <p class="example-caption">
              Drag a tile onto another to trade places instantly — everything
              else stays put. Built on SnapSort's <code>swap</code> mode.
            </p>
          </div>
          <div class="swap-workspace">
            <div class="swap-static-grid">
              {#each swapTiles as tile}
                <div class="swap-static-item">
                  <div class="swap-tile card" style={`--tile-color: ${tile.color};`}>
                    <span class="swap-tile-grip" aria-hidden="true">
                      <i></i><i></i><i></i><i></i><i></i><i></i>
                    </span>
                    <span class="swap-tile-label">{tile.label}</span>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>

        <div id="editor" class="example-card editor-example">
          <div class="example-placard">
            <h3 class="editor-title">Editor</h3>
            <p class="example-caption">
              A form builder with a draggable field palette and sortable option
              lists, rendered live as you edit.
            </p>
          </div>
          <div class="editor-builder">
            <div class="editor-palette" aria-label="Field palette">
              {#each editorPalette as item}
                <button type="button" class="editor-tool" tabindex="-1">
                  <i class="material-symbols-rounded" aria-hidden="true">{item.icon}</i>
                  <span>{item.label}</span>
                </button>
              {/each}
            </div>
            <div class="editor-canvas card form-control-group" aria-label="Form canvas">
              <div class="editor-canvas-header">
                <h4 class="editor-canvas-title">My Form</h4>
              </div>
              <div class="editor-field-list">
                {#each editorFields as field}
                  <div class="editor-field">
                    <i class="material-symbols-rounded editor-field-grip" aria-hidden="true">drag_indicator</i>
                    <div class="editor-field-main">
                      <input class="editor-question-input" type="text" value={field.label} tabindex="-1" readonly />
                      {#if field.type === "longText"}
                        <textarea rows="3" readonly tabindex="-1">Long answer response</textarea>
                      {:else if field.options}
                        <div class="editor-option-stack">
                          {#each field.options as option}
                            <div class="editor-option-row">
                              <i class="material-symbols-rounded editor-option-grip" aria-hidden="true">drag_indicator</i>
                              <input class="editor-option-input" type="text" value={option.label} tabindex="-1" readonly />
                            </div>
                          {/each}
                        </div>
                      {:else}
                        <input type="text" value="Short answer" readonly tabindex="-1" />
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        </div>
      </div>
    {/snippet}
    <Engine id="snapsort-examples-canvas" bind:this={canvasComponent} bind:engine={examplesEngine} {debug}>

    <div class="examples-grid">
      <div id="todo-list" class="example-card pm-example example-side">
        <div class="example-placard">
          <h3>TODO List</h3>
          <p class="example-caption">
            A sortable daily checklist — grab the handle to reorder tasks without
            losing your progress.
          </p>
          <ExhibitSource href={data.sourceLinks["todo-list"]} label="TODO List" />
        </div>
        <div class="project-list">
          <Container
            config={{ animation: defaultAnimations, direction: "column", callbacks: { onItemMove: handleTodoMove } }}
            items={todoItems}
            getItemId={(todo) => todo.id}
          >
            {#snippet entry(todo)}
              <Item itemId={todo.id}>
                <div class="project-card" class:checked={todo.checked}>
                  <Handle className="project-drag-handle">
                    <i class="material-symbols-rounded" aria-hidden="true">drag_indicator</i>
                  </Handle>
                  <label>
                    <input type="checkbox" bind:checked={todo.checked} />
                    <span></span>
                  </label>
                  <span class="project-text">{todo.text}</span>
                  <div class="project-meta" aria-label="Task metadata">
                    <span class="project-meta-item">
                      <i class="material-symbols-rounded" aria-hidden="true">schedule</i>
                      {todo.due}
                    </span>
                  </div>
                </div>
              </Item>
            {/snippet}
          </Container>
        </div>
      </div>

      <div id="kanban-board" class="example-card kanban-example">
        <div class="example-placard">
          <h3>Kanban Board</h3>
          <p class="example-caption">
            Three linked columns on one board — drag cards between
            stages, or click one to advance it.
          </p>
          <ExhibitSource href={data.sourceLinks["kanban-board"]} label="Kanban Board" />
        </div>
        <div class="kanban-board">
          <Container
            config={{
              animation: defaultAnimations,
              direction: "row",
              name: "kanban-root",
              callbacks: { canDrop: rejectDrop },
            }}
            locked={true}
            items={kanbanColumns}
            getItemId={(column) => column.id}
          >
            {#snippet entry(column)}
              <Container
                className="kanban-column"
                itemId={column.id}
                config={{
                  animation: defaultAnimations,
                  direction: "column",
                  name: column.id,
                  callbacks: { onItemMove: handleKanbanMove },
                  ...({ onClickAction: { action: "moveTo", target: column.target } } as object),
                }}
                locked={true}
                metadata={{ columnId: column.id }}
                items={column.cards}
                getItemId={(card) => card.id}
              >
                {#snippet before()}
                  <h4>{column.title}</h4>
                {/snippet}
                {#snippet entry(card)}
                  <Item itemId={card.id}>
                    <div class="kanban-card">
                      <div class="kanban-header">
                        <span class="kanban-title">{card.text}</span>
                        <span class="kanban-tag">{card.tag}</span>
                      </div>
                      <p class="kanban-desc">{card.desc}</p>
                      <div class="kanban-footer">
                        <span
                          class="kanban-avatar"
                          style={`--avatar-color: ${card.avatarColor};`}
                          title={card.assignee}
                          aria-label={card.assignee}
                        >
                          {card.avatar}
                        </span>
                        <div class="kanban-meta" aria-label="Task metadata">
                          <span class="kanban-meta-item">
                            <i class="material-symbols-rounded" aria-hidden="true">event</i>
                            {card.due}
                          </span>
                          <span class="kanban-meta-item">
                            <i class="material-symbols-rounded" aria-hidden="true">forum</i>
                            {card.activity}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Item>
                {/snippet}
              </Container>
            {/snippet}
          </Container>
        </div>
      </div>



      <div id="sentence-builder" class="example-card sentence-example example-side">
        <div class="example-placard">
          <h3>Sentence Builder</h3>
          <p class="example-caption">
            Compose a translation from word tiles. Ghost previews mark where each
            tile will settle.
          </p>
          <ExhibitSource href={data.sourceLinks["sentence-builder"]} label="Sentence Builder" />
        </div>
        <div class="card ground sentence-builder">
          <div class="display prompt-section">
            <div class="english-sentence">
              <span>It has many uses</span>
            </div>
          </div>
          <div class="sentence-container-area">
            <Container
              className="sentence-workspace-root"
              config={{
                animation: defaultAnimations,
                mode: "progressive",
                direction: "column",
                name: "sentence-root",
                callbacks: { canDrop: rejectDrop },
              }}
              locked={true}
              items={sentenceZones}
              getItemId={(zone) => `sentence-zone-${zone}`}
            >
              {#snippet entry(zone)}
                {#if zone === "answer"}
                  <Container
                    className="sentence-drop-zone"
                    itemId="sentence-zone-answer"
                    bind:container={sentenceAnswerContainer}
                    config={{
                      mode: "progressive",
                      direction: "row",
                      name: "sentence-target",
                      animation: {
                        reorder: sentenceAnimation,
                        drop: sentenceAnimation,
                        clickMove: sentenceAnimation,
                      },
                      callbacks: {
                        onItemMove: handleSentenceMove,
                        onItemRemove: handleSentenceRemove,
                        getDropPriority: prioritizeIntersectingContainer,
                      },
                    }}
                    locked={true}
                    metadata={{ zone: "answer" }}
                    items={sentenceAnswerTiles}
                    getItemId={(tile) => tile.id}
                  >
                    {#snippet entry(tile)}
                      <Item itemId={tile.id} className="sentence-tile-wrapper">
                        <button
                          type="button"
                          class="word-card sentence-word selected"
                          onpointerdown={handleSentenceTilePointerDown}
                          onpointermove={handleSentenceTilePointerMove}
                          onclick={(event) => handleSentenceTileClick(event, () => moveSentenceTileToZone(tile, "bank"))}
                          aria-label={`Move ${tile.text} to bank`}
                        >
                          {tile.text}
                        </button>
                      </Item>
                    {/snippet}
                    {#snippet ghost(event)}
                      <Ghost {event}>
                        <button type="button" class="word-card sentence-word sentence-tile-ghost selected" tabindex="-1">{sentenceGhostTileText(event)}</button>
                      </Ghost>
                    {/snippet}
                  </Container>
                {:else}
                  <Container
                    className="sentence-source-zone"
                    itemId="sentence-zone-bank"
                    bind:container={sentenceBankContainer}
                    config={{
                      mode: "progressive",
                      direction: "row",
                      mainAxisAlign: "center",
                      name: "sentence-source",
                      animation: {
                        reorder: sentenceAnimation,
                        drop: sentenceAnimation,
                        clickMove: sentenceAnimation,
                      },
                      callbacks: {
                        onItemMove: handleSentenceMove,
                        onItemRemove: handleSentenceRemove,
                        getDropPriority: prioritizeIntersectingContainer,
                      },
                    }}
                    locked={true}
                    metadata={{ zone: "bank" }}
                    items={sentenceBankTiles}
                    getItemId={(tile) => tile.id}
                  >
                    {#snippet entry(tile)}
                      <Item itemId={tile.id} className="sentence-tile-wrapper">
                        <button
                          type="button"
                          class="word-card sentence-word"
                          onpointerdown={handleSentenceTilePointerDown}
                          onpointermove={handleSentenceTilePointerMove}
                          onclick={(event) => handleSentenceTileClick(event, () => moveSentenceTileToZone(tile, "answer"))}
                          aria-label={`Move ${tile.text} to answer`}
                        >
                          {tile.text}
                        </button>
                      </Item>
                    {/snippet}
                    {#snippet ghost(event)}
                      <Ghost {event}>
                        <button type="button" class="word-card sentence-word sentence-tile-ghost" tabindex="-1">{sentenceGhostTileText(event)}</button>
                      </Ghost>
                    {/snippet}
                  </Container>
                {/if}
              {/snippet}
            </Container>
          </div>
          <div class="controls">
            <button
              class="check-btn"
              class:success={sentenceResult === "Correct!"}
              onclick={checkSentence}
            >
              {sentenceResult === "Correct!" ? "Correct" : "Check"}
            </button>
          </div>
        </div>
      </div>

      <div id="file-explorer" class="example-card file-example example-side">
        <div class="example-placard">
          <h3>File Explorer</h3>
          <p class="example-caption">
            An insertion-mode tree with nested folders — drop markers trace the
            exact depth as you drag.
          </p>
          <ExhibitSource href={data.sourceLinks["file-explorer"]} label="File Explorer" />
        </div>
        <FileExplorerExample />
      </div>

      <div id="clone-palette" class="example-card clone-example example-side">
        <div class="example-placard">
          <h3>Clone Palette</h3>
          <p class="example-caption">
            Drag a block from the palette onto the canvas to place a copy —
            the palette item never leaves. Built on SnapSort's <code>copy</code>
            drop effect.
          </p>
          <ExhibitSource href={data.sourceLinks["clone-palette"]} label="Clone Palette" />
        </div>
        <div class="clone-workspace">
          <Container
            className="clone-root"
            config={{
              animation: defaultAnimations,
              direction: "row",
              name: "clone-root",
              callbacks: {
                canDrop: rejectDrop,
                onDragStart: handleCloneDragStart,
                onDragClone: handleDragClone,
              },
            }}
            locked={true}
            items={cloneZones}
            getItemId={(zone) => `clone-${zone}`}
          >
            {#snippet entry(zone)}
              {#if zone === "palette"}
                <Container
                  className="clone-palette"
                  itemId="clone-palette"
                  config={{
                    animation: defaultAnimations,
                    direction: "column",
                    name: "clone-palette",
                    callbacks: {
                      canDrop: rejectDrop,
                    },
                  }}
                  locked={true}
                  items={paletteBlockTemplates}
                  getItemId={(template) => `palette-${template.type}`}
                >
                  {#snippet entry(template)}
                    <Item itemId={`palette-${template.type}`} metadata={{ blockType: template.type }}>
                      <div class="clone-block clone-block-{template.type} clone-palette-block">
                        <i class="material-symbols-rounded" aria-hidden="true">{template.icon}</i>
                        <span>{template.label}</span>
                      </div>
                    </Item>
                  {/snippet}
                </Container>
              {:else}
                <Container
                  className="clone-canvas"
                  itemId="clone-canvas"
                  config={{
                    animation: defaultAnimations,
                    direction: "column",
                    name: "clone-canvas",
                    callbacks: {
                      onItemMove: handleCanvasMove,
                      onItemRemove: handleCanvasRemove,
                      getDropPriority: prioritizeIntersectingContainer,
                    },
                  }}
                  locked={true}
                  items={canvasEntries}
                  getItemId={(entry) => entry.id}
                >
                  {#snippet before()}
                    {#if canvasBlocks.length === 0 && !draggingClone}
                      <p class="clone-canvas-empty">Drop blocks here</p>
                    {/if}
                  {/snippet}
                  {#snippet entry(entry)}
                    {#if entry.kind === "clone"}
                      <Item
                        itemId={entry.id}
                        itemObject={entry.item}
                        metadata={{ blockType: entry.type }}
                      >
                        <div class="clone-block clone-block-{entry.type} clone-canvas-block clone-dragging">
                          <i class="material-symbols-rounded" aria-hidden="true">{blockIcon[entry.type]}</i>
                          <span>{blockLabel[entry.type]}</span>
                        </div>
                      </Item>
                    {:else}
                      <Item itemId={entry.block.id} metadata={{ blockType: entry.block.type }}>
                        <div class="clone-block clone-block-{entry.block.type} clone-canvas-block">
                          <i class="material-symbols-rounded" aria-hidden="true">{blockIcon[entry.block.type]}</i>
                          <span>{blockLabel[entry.block.type]}</span>
                          <button
                            type="button"
                            class="clone-block-remove"
                            aria-label={`Remove ${blockLabel[entry.block.type]}`}
                            onpointerdown={(event) => event.stopPropagation()}
                            onclick={(event) => {
                              event.stopPropagation();
                              removeCanvasBlock(entry.block.id);
                            }}
                          >
                            <i class="material-symbols-rounded" aria-hidden="true">close</i>
                          </button>
                        </div>
                      </Item>
                    {/if}
                  {/snippet}
                </Container>
              {/if}
            {/snippet}
          </Container>
        </div>
      </div>

      <div id="trash-it" class="example-card trash-example example-side">
        <div class="example-placard">
          <h3>Trash It</h3>
          <p class="example-caption">
            Drag a task onto the trash to delete it — everywhere else still
            reorders normally. Built on SnapSort's <code>none</code> drop
            effect.
          </p>
          <ExhibitSource href={data.sourceLinks["trash-it"]} label="Trash It" />
        </div>
        <div class="trash-workspace">
          <Container
            className="trash-root"
            config={{
              animation: defaultAnimations,
              direction: "column",
              name: "trash-root",
              callbacks: {
                canDrop: rejectDrop,
                onDropTargetChange: handleTrashDropTargetChange,
                onDragEnd: handleTrashDragEnd,
              },
            }}
            locked={true}
            items={trashZones}
            getItemId={(zone) => `trash-zone-${zone}`}
          >
            {#snippet entry(zone)}
              {#if zone === "list"}
                <Container
                  className="trash-list"
                  itemId="trash-zone-list"
                  config={{
                    animation: defaultAnimations,
                    direction: "column",
                    name: "trash-list",
                    callbacks: {
                      onItemMove: handleTrashListMove,
                    },
                  }}
                  locked={true}
                  items={trashTasks}
                  getItemId={(task) => task.id}
                >
                  {#snippet entry(task)}
                    <Item itemId={task.id}>
                      <div class="trash-task">
                        <i class="material-symbols-rounded trash-task-grip" aria-hidden="true">drag_indicator</i>
                        <span>{task.text}</span>
                      </div>
                    </Item>
                  {/snippet}
                </Container>
              {:else}
                <div class="trash-zone" class:trash-zone-active={trashHovered}>
                  <Container
                    className="trash-drop-target"
                    itemId="trash-zone-bin"
                    config={{
                      animation: defaultAnimations,
                      direction: "column",
                      name: "trash-bin",
                      callbacks: {
                        onItemMove: handleTrashBinMove,
                        getDropPriority: prioritizeIntersectingContainer,
                      },
                    }}
                    locked={true}
                    metadata={{ role: "trash" }}
                    items={emptyTrashTasks}
                    getItemId={(task) => task.id}
                  >
                    {#snippet before()}
                      <div class="trash-zone-content">
                        <i class="material-symbols-rounded" aria-hidden="true">delete</i>
                        <span>Drop to delete</span>
                      </div>
                    {/snippet}
                    {#snippet entry()}
                      <!-- Trash bin has no rendered child items. -->
                    {/snippet}
                  </Container>
                </div>
              {/if}
            {/snippet}
          </Container>
        </div>
      </div>

      <div id="swap-grid" class="example-card swap-example example-side">
        <div class="example-placard">
          <h3>Swap Grid</h3>
          <p class="example-caption">
            Drag a tile onto another to trade places instantly — everything
            else stays put. Built on SnapSort's <code>swap</code> mode.
          </p>
          <ExhibitSource href={data.sourceLinks["swap-grid"]} label="Swap Grid" />
        </div>
        <div class="swap-workspace">
          <Container
            className="swap-grid"
            config={{
              mode: "swap",
              direction: "row",
              name: "swap-grid",
              animation: {
                reorder: {
                  duration: 240,
                  timing_function: "cubic-bezier(0.22, 1, 0.36, 1)",
                },
                drop: {
                  duration: 240,
                  timing_function: "cubic-bezier(0.22, 1, 0.36, 1)",
                },
              },
              callbacks: {
                onItemSwap: handleSwapCommit,
                onDragItemEnter: handleSwapHoverEnter,
                onDragItemLeave: handleSwapHoverLeave,
              },
            }}
            locked={true}
            items={swapTiles}
            getItemId={(tile) => tile.id}
          >
            {#snippet entry(tile)}
              <Item itemId={tile.id} metadata={{ color: tile.color, label: tile.label }}>
                <div
                  class="swap-tile card"
                  class:swap-tile-hovered={swapHoveredId === tile.id}
                  style={`--tile-color: ${tile.color};`}
                >
                  <span class="swap-tile-grip" aria-hidden="true">
                    <i></i>
                    <i></i>
                    <i></i>
                    <i></i>
                    <i></i>
                    <i></i>
                  </span>
                  <span class="swap-tile-label">{tile.label}</span>
                </div>
              </Item>
            {/snippet}
            {#snippet ghost(event)}
              {@const tile = swapGhostTile(event)}
              {#if tile}
                <Ghost
                  {event}
                  className="swap-tile card swap-tile-ghost"
                  style={`--tile-color: ${tile.color};`}
                >
                    <span class="swap-tile-grip" aria-hidden="true">
                      <i></i><i></i><i></i><i></i><i></i><i></i>
                    </span>
                    <span class="swap-tile-label">{tile.label}</span>
                </Ghost>
              {/if}
            {/snippet}
          </Container>
        </div>
      </div>

      <div id="editor" class="example-card editor-example">
        <div class="example-placard">
          <h3 class="editor-title">Editor</h3>
          <p class="example-caption">
            A form builder with a draggable field palette and sortable option
            lists, rendered live as you edit.
          </p>
          <ExhibitSource href={data.sourceLinks["editor"]} label="Editor" />
        </div>
        <div class="editor-builder">
          <div class="editor-palette" aria-label="Field palette">
            {#each editorPalette as item (item.type)}
              <button
                type="button"
                class="editor-tool"
                onclick={() => addEditorField(item.type)}
              >
                <i class="material-symbols-rounded" aria-hidden="true">{item.icon}</i>
                <span>{item.label}</span>
              </button>
            {/each}
          </div>
          <div class="editor-canvas card form-control-group" aria-label="Form canvas">
            <div class="editor-canvas-header">
              <h4 class="editor-canvas-title">My Form</h4>
            </div>
            <Container
              className="editor-field-list"
              config={{ animation: defaultAnimations, direction: "column", callbacks: { onItemMove: handleEditorFieldMove } }}
              items={editorFields}
              getItemId={(field) => field.id}
            >
              {#snippet entry(field)}
                <Item itemId={field.id}>
                  <div class="editor-field">
                    <Handle className="editor-field-handle">
                      <i class="material-symbols-rounded editor-field-grip" aria-hidden="true">drag_indicator</i>
                    </Handle>
                    <div class="editor-field-main">
                      <input
                        class="editor-question-input"
                        type="text"
                        value={field.label}
                        aria-label="Question text"
                        oninput={(event) =>
                          updateEditorFieldLabel(field.id, event.currentTarget.value)}
                        onpointerdown={(event) => event.stopPropagation()}
                        onclick={(event) => event.stopPropagation()}
                      />
                      {#if field.type === "shortText"}
                        <input id={field.id} type="text" value="Short answer" readonly tabindex="-1" />
                      {:else if field.type === "longText"}
                        <textarea id={field.id} rows="3" readonly tabindex="-1">Long answer response</textarea>
                      {:else if field.type === "multipleChoice"}
                        <SnapSortContextBoundary>
                          <Container
                            className="editor-option-stack"
                            config={{
                              animation: defaultAnimations,
                              mode: "progressive",
                              direction: "column",
                              name: `editor-options-${field.id}`,
                              callbacks: {
                                onItemMove: handleEditorOptionMove,
                              },
                            }}
                            locked={true}
                            metadata={{ fieldId: field.id }}
                            items={field.options ?? []}
                            getItemId={(option) => option.id}
                          >
                            {#snippet entry(option)}
                              <Item itemId={option.id} className="editor-option-item">
                                <div class="editor-option-row">
                                  <Handle className="editor-option-handle">
                                    <i class="material-symbols-rounded editor-option-grip" aria-hidden="true">drag_indicator</i>
                                  </Handle>
                                  <label class="radio-label">
                                    <input type="radio" name={`${field.id}-choice`} checked={option === field.options?.[0]} tabindex="-1" />
                                    <span></span>
                                  </label>
                                  <input
                                    class="editor-option-input"
                                    type="text"
                                    value={option.label}
                                    aria-label="Option text"
                                    oninput={(event) =>
                                      updateEditorOptionLabel(field.id, option.id, event.currentTarget.value)}
                                    onpointerdown={(event) => event.stopPropagation()}
                                    onclick={(event) => event.stopPropagation()}
                                  />
                                  <button
                                    class="editor-option-action"
                                    type="button"
                                    aria-label="Remove option"
                                    disabled={(field.options?.length ?? 0) <= 1}
                                    onpointerdown={(event) => event.stopPropagation()}
                                    onclick={(event) => {
                                      event.stopPropagation();
                                      removeEditorOption(field.id, option.id);
                                    }}
                                  >
                                    <i class="material-symbols-rounded" aria-hidden="true">delete</i>
                                  </button>
                                </div>
                              </Item>
                            {/snippet}
                          </Container>
                        </SnapSortContextBoundary>
                        <button
                          class="editor-add-option"
                          type="button"
                          onpointerdown={(event) => event.stopPropagation()}
                          onclick={(event) => {
                            event.stopPropagation();
                            addEditorOption(field.id);
                          }}
                        >
                          <i class="material-symbols-rounded" aria-hidden="true">add</i>
                          Add option
                        </button>
                      {:else if field.type === "checkboxes"}
                        <SnapSortContextBoundary>
                          <Container
                            className="editor-option-stack"
                            config={{
                              animation: defaultAnimations,
                              mode: "progressive",
                              direction: "column",
                              name: `editor-options-${field.id}`,
                              callbacks: {
                                onItemMove: handleEditorOptionMove,
                              },
                            }}
                            locked={true}
                            metadata={{ fieldId: field.id }}
                            items={field.options ?? []}
                            getItemId={(option) => option.id}
                          >
                            {#snippet entry(option)}
                              <Item itemId={option.id} className="editor-option-item">
                                <div class="editor-option-row">
                                  <Handle className="editor-option-handle">
                                    <i class="material-symbols-rounded editor-option-grip" aria-hidden="true">drag_indicator</i>
                                  </Handle>
                                  <label class="checkbox-label">
                                    <input type="checkbox" checked={option === field.options?.[0]} tabindex="-1" />
                                    <span></span>
                                  </label>
                                  <input
                                    class="editor-option-input"
                                    type="text"
                                    value={option.label}
                                    aria-label="Option text"
                                    oninput={(event) =>
                                      updateEditorOptionLabel(field.id, option.id, event.currentTarget.value)}
                                    onpointerdown={(event) => event.stopPropagation()}
                                    onclick={(event) => event.stopPropagation()}
                                  />
                                  <button
                                    class="editor-option-action"
                                    type="button"
                                    aria-label="Remove option"
                                    disabled={(field.options?.length ?? 0) <= 1}
                                    onpointerdown={(event) => event.stopPropagation()}
                                    onclick={(event) => {
                                      event.stopPropagation();
                                      removeEditorOption(field.id, option.id);
                                    }}
                                  >
                                    <i class="material-symbols-rounded" aria-hidden="true">delete</i>
                                  </button>
                                </div>
                              </Item>
                            {/snippet}
                          </Container>
                        </SnapSortContextBoundary>
                        <button
                          class="editor-add-option"
                          type="button"
                          onpointerdown={(event) => event.stopPropagation()}
                          onclick={(event) => {
                            event.stopPropagation();
                            addEditorOption(field.id);
                          }}
                        >
                          <i class="material-symbols-rounded" aria-hidden="true">add</i>
                          Add option
                        </button>
                      {:else if field.type === "dropdown"}
                        <SnapSortContextBoundary>
                          <Container
                            className="editor-option-stack"
                            config={{
                              animation: defaultAnimations,
                              mode: "progressive",
                              direction: "column",
                              name: `editor-options-${field.id}`,
                              callbacks: {
                                onItemMove: handleEditorOptionMove,
                              },
                            }}
                            locked={true}
                            metadata={{ fieldId: field.id }}
                            items={field.options ?? []}
                            getItemId={(option) => option.id}
                          >
                            {#snippet entry(option)}
                              <Item itemId={option.id} className="editor-option-item">
                                <div class="editor-option-row">
                                  <Handle className="editor-option-handle">
                                    <i class="material-symbols-rounded editor-option-grip" aria-hidden="true">drag_indicator</i>
                                  </Handle>
                                  <i class="material-symbols-rounded editor-option-type-icon" aria-hidden="true">arrow_drop_down</i>
                                  <input
                                    class="editor-option-input"
                                    type="text"
                                    value={option.label}
                                    aria-label="Option text"
                                    oninput={(event) =>
                                      updateEditorOptionLabel(field.id, option.id, event.currentTarget.value)}
                                    onpointerdown={(event) => event.stopPropagation()}
                                    onclick={(event) => event.stopPropagation()}
                                  />
                                  <button
                                    class="editor-option-action"
                                    type="button"
                                    aria-label="Remove option"
                                    disabled={(field.options?.length ?? 0) <= 1}
                                    onpointerdown={(event) => event.stopPropagation()}
                                    onclick={(event) => {
                                      event.stopPropagation();
                                      removeEditorOption(field.id, option.id);
                                    }}
                                  >
                                    <i class="material-symbols-rounded" aria-hidden="true">delete</i>
                                  </button>
                                </div>
                              </Item>
                            {/snippet}
                          </Container>
                        </SnapSortContextBoundary>
                        <button
                          class="editor-add-option"
                          type="button"
                          onpointerdown={(event) => event.stopPropagation()}
                          onclick={(event) => {
                            event.stopPropagation();
                            addEditorOption(field.id);
                          }}
                        >
                          <i class="material-symbols-rounded" aria-hidden="true">add</i>
                          Add option
                        </button>
                      {:else if field.type === "date"}
                        <input id={field.id} type="date" tabindex="-1" />
                      {:else}
                        <div class="editor-rating-preview" aria-label="5 star rating">
                          {#each Array(5) as _, index}
                            <i class="material-symbols-rounded" class:filled={index < 4} aria-hidden="true">star</i>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  </div>
                </Item>
              {/snippet}
            </Container>
          </div>
        </div>
      </div>
    </div>
    </Engine>
  </ClientDemoFrame>
  </div>
</section>

<section class="gallery-outro landing-section-gap">
  <h2 class="landing-section-heading">Build one of these</h2>
  <p class="gallery-outro-copy">
    Every exhibit above is built from the same two primitives, <code>Container</code>
    and <code>Item</code>. The setup guide walks through the first one.
  </p>
  <div class="gallery-outro-actions">
    <a class="button primary gallery-outro-action" href="/docs/snapsort/introduction/01_setup">
      Read the setup guide
    </a>
    <a class="button gallery-outro-action" href="/snapsort">Back to SnapSort</a>
  </div>
</section>

<style lang="scss">
  @use "../../../lib/landing/landing.scss";

  .gallery-outro {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--size-16);
    margin-bottom: clamp(3rem, 6vw, 6rem);
    text-align: center;
  }

  .gallery-outro-copy {
    max-width: 560px;
    margin: 0;
    color: #5d6266;
    font-size: clamp(1rem, 1.3vw, 1.12rem);
    line-height: 1.7;

    code {
      font-family: var(--font-code);
      font-size: 0.92em;
    }
  }

  .gallery-outro-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--size-12);
    margin-top: var(--size-8);
  }

  .gallery-outro-action {
    text-decoration: none;
  }

  :global(.ghost) {
    background: rgba(0, 0, 0, 0.06);
    border-radius: 6px;
    box-sizing: border-box;
  }

  .gallery-hero {
    display: flex;
    align-items: flex-end;
    min-height: clamp(280px, 36vh, 400px);
    padding: clamp(4rem, 9vw, 6.5rem) 0 clamp(4rem, 8vw, 7rem);
    box-sizing: border-box;
  }

  .gallery-hero-copy {
    max-width: 720px;
  }

  .gallery-hero-title {
    margin: 0 0 var(--size-24);
    font-size: clamp(64px, 11vw, 96px);
    line-height: 1;
  }

  .gallery-hero-lede {
    max-width: 560px;
    margin: 0;
    color: #697074;
  }

  :global(.snap-engine-canvas) {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .word-card:active {
    cursor: grabbing;
  }

  /* Examples Section */
  .gallery-body {
    display: grid;
    grid-template-columns: 190px minmax(0, 1fr);
    gap: var(--size-48);
    align-items: start;
    margin-bottom: 4rem;
  }

  .gallery-exhibits {
    min-width: 0;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .gallery-sidebar {
    position: sticky;
    top: 5rem;
    align-self: start;
  }

  .gallery-sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: var(--size-16);
  }

  .gallery-sidebar-label {
    color: var(--color-background-dark);
    font-family: "Bitcount Grid Single", monospace;
    font-size: 0.95rem;
    font-weight: 300;
    letter-spacing: 0.05em;
    text-transform: lowercase;
  }

  .gallery-sidebar-nav ol {
    display: flex;
    flex-direction: column;
    gap: var(--size-8);
    margin: 0;
    padding: 0;
    list-style: none;
    counter-reset: exhibit;
  }

  .gallery-sidebar-nav li {
    counter-increment: exhibit;
  }

  .gallery-sidebar-nav a {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    color: #697074;
    font-size: 0.9rem;
    font-weight: 300;
    line-height: 1.4;
    text-decoration: none;
  }

  .gallery-sidebar-nav a::before {
    content: counter(exhibit, decimal-leading-zero);
    flex: 0 0 auto;
    color: #b3b8bc;
    font-family: "Geist Mono", monospace;
    font-size: 0.7rem;
  }

  .gallery-sidebar-nav a:hover,
  .gallery-sidebar-nav a:focus-visible {
    color: var(--color-text);
    text-decoration: underline;
    text-underline-offset: 0.22em;
  }

  .example-caption {
    max-width: 52ch;
    margin: 0;
    color: #485158;
    font-family: "Geist", sans-serif;
    font-size: 0.85rem;
    font-weight: 300;
    line-height: 1.5;
  }

  .examples-grid {
    display: flex;
    flex-direction: column;
    gap: clamp(5rem, 10vw, 8rem);
    width: 100%;
    margin: 0;
  }

  .example-card {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background-color: var(--color-background-tint);
    border-radius: var(--ui-radius);
    padding: var(--size-32);
    user-select: none;
    justify-content: center;
    scroll-margin-top: 2rem;
  }

  .example-card h3 {
    color: #20262b;
    font-family: "Bitcount Grid Single", monospace;
    font-size: 24px;
    font-weight: 300;
    line-height: 1;
    margin: 0;
  }

  .gallery-demo-skeleton {
    min-height: clamp(420px, 42vw, 560px);
    background:
      linear-gradient(90deg, rgb(31 30 41 / 8%) 0 22%, transparent 22% 28%, rgb(31 30 41 / 6%) 28% 100%),
      var(--color-background-tint);
  }

  .gallery-skeleton-grid .gallery-demo-skeleton:nth-child(2),
  .gallery-skeleton-grid .gallery-demo-skeleton:nth-child(8) {
    min-height: clamp(380px, 48vw, 660px);
  }

  .gallery-skeleton-grid .clone-root,
  .gallery-skeleton-grid .trash-root,
  .gallery-skeleton-grid .swap-static-grid,
  .gallery-skeleton-grid .editor-field-list {
    display: flex;
  }

  .gallery-skeleton-grid .clone-root {
    align-items: stretch;
    gap: var(--size-24);
  }

  .gallery-skeleton-grid .clone-palette,
  .gallery-skeleton-grid .clone-canvas,
  .gallery-skeleton-grid .trash-list,
  .gallery-skeleton-grid .trash-drop-target {
    display: flex;
    flex-direction: column;
  }

  .gallery-skeleton-grid .trash-root {
    flex-direction: column;
  }

  .gallery-skeleton-grid .swap-static-grid {
    width: 100%;
    flex-wrap: wrap;
    gap: var(--size-4);
    padding: var(--size-4);
    border-radius: calc(var(--size-16) + var(--size-4));
    background: color-mix(in srgb, var(--color-background-tint) 88%, #000);
    box-sizing: border-box;
    overflow: hidden;
  }

  .gallery-skeleton-grid .swap-static-item {
    width: calc((100% - (var(--size-4) * 2)) / 3);
  }

  .static-file-window {
    min-height: 300px;
    padding: var(--size-16);
    border-radius: var(--ui-radius);
    background: #ffffff;
    box-shadow: 0 18px 36px -28px rgb(31 30 41 / 30%);
    box-sizing: border-box;
  }

  .static-file-window .tree-row {
    padding: 0.5rem 0.65rem;
    border-radius: 8px;
    color: #33383b;
    font-size: 0.9rem;
  }

  .example-placard {
    display: flex;
    flex-direction: column;
    gap: var(--size-12);
  }

  /* Smaller exhibits: placard on the side, demo beside it. */
  .example-side {
    display: grid;
    grid-template-columns: clamp(220px, 26%, 300px) minmax(0, 1fr);
    column-gap: clamp(var(--size-24), 4vw, var(--size-64));
    align-items: center;
  }

  .example-side .example-placard {
    align-self: start;
    padding-top: var(--size-8);
  }

  .file-example {
    min-width: 0;
  }

  /* Exhibits don't need to fill the full column width. */
  .file-example :global(.file-explorer-card) {
    width: min(100%, 480px);
    height: auto;
    justify-self: center;
  }

  .file-example :global(.code-tree) {
    min-height: 0;
  }

  /* Clone Palette */
  .clone-workspace {
    width: min(100%, 480px);
    justify-self: center;
  }

  .clone-workspace :global(.clone-root) {
    align-items: stretch;
    width: 100%;
    gap: var(--size-24);
    flex-wrap: nowrap;
  }

  .clone-workspace :global(.clone-palette) {
    flex: 0 0 auto;
    align-items: stretch;
    width: 132px;
    gap: 0.5rem;
    padding: 0.75rem;
    background: #f3f5f6;
    border-radius: var(--ui-radius);
  }

  .clone-workspace :global(.clone-palette .snapsort-item) {
    align-items: stretch;
    width: 100%;
    padding: 0;
  }

  .clone-workspace :global(.clone-canvas) {
    flex: 1;
    align-items: stretch;
    min-height: 220px;
    gap: 0.5rem;
    padding: 0.75rem;
    border: 1px dashed #c7cccf;
    border-radius: var(--ui-radius);
    background: #ffffff;
  }

  .clone-workspace :global(.clone-canvas .snapsort-item) {
    align-items: stretch;
    width: 100%;
    padding: 0;
  }

  .clone-canvas-empty {
    margin: auto;
    color: #b3b8bc;
    font-size: 0.85rem;
    text-align: center;
  }

  .clone-block {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem;
    border-radius: calc(var(--ui-radius) - 2px);
    border: 1px solid #d5d8dc;
    background: #ffffff;
    font-size: 0.85rem;
    color: #232526;
    cursor: grab;
    touch-action: none;
  }

  .clone-palette-block:active {
    cursor: grabbing;
  }

  .clone-canvas-block {
    cursor: default;
    padding-right: 2rem;
  }

  .clone-block :global(.material-symbols-rounded) {
    font-family: "Material Symbols Rounded";
    font-size: 1.1rem;
    line-height: 1;
    font-style: normal;
    color: var(--color-primary);
  }

  .clone-block-remove {
    position: absolute;
    top: 50%;
    right: 0.4rem;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.4rem;
    height: 1.4rem;
    padding: 0;
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    color: #8f9497;
    cursor: pointer;
  }

  .clone-block-remove:hover {
    color: #c7472f;
  }

  .clone-block-remove :global(.material-symbols-rounded) {
    font-size: 1rem;
    color: inherit;
  }

  /* Trash It */
  .trash-workspace {
    width: min(100%, 420px);
    justify-self: center;
  }

  .trash-workspace :global(.trash-root) {
    align-items: stretch;
    width: 100%;
    gap: 0.75rem;
  }

  .trash-workspace :global(.trash-list) {
    align-items: stretch;
    width: 100%;
    gap: 0.4rem;
  }

  .trash-workspace :global(.trash-list .snapsort-item) {
    align-items: stretch;
    width: 100%;
    padding: 0;
  }

  .trash-task {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.65rem 0.85rem;
    border-radius: calc(var(--ui-radius) - 2px);
    border: 1px solid #d5d8dc;
    background: #ffffff;
    font-size: 0.85rem;
    color: #232526;
    cursor: grab;
    touch-action: none;
  }

  .trash-task:active {
    cursor: grabbing;
  }

  .trash-task-grip {
    font-family: "Material Symbols Rounded";
    font-size: 1.1rem;
    color: #8f9497;
  }

  .trash-zone {
    border-radius: var(--ui-radius);
    border: 2px dashed #d5d8dc;
    transition: border-color 120ms ease-out, background-color 120ms ease-out;
  }

  .trash-zone-active {
    border-color: #c7472f;
    background: rgba(199, 71, 47, 0.06);
  }

  .trash-workspace :global(.trash-drop-target) {
    width: 100%;
    min-height: 64px;
    align-items: center;
    justify-content: center;
  }

  .trash-zone-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    color: #8f9497;
    font-size: 0.85rem;
  }

  .trash-zone-active .trash-zone-content {
    color: #c7472f;
  }

  .trash-zone-content :global(.material-symbols-rounded) {
    font-family: "Material Symbols Rounded";
    font-size: 1.2rem;
    color: inherit;
  }

  /* Swap Grid */
  .swap-workspace {
    width: min(100%, 520px);
    justify-self: center;
  }

  .swap-workspace :global(.swap-grid) {
    width: 100%;
    gap: var(--size-4);
    flex-wrap: wrap;
    padding: var(--size-4);
    border-radius: calc(var(--size-16) + var(--size-4));
    background: color-mix(in srgb, var(--color-background-tint) 88%, #000);
    box-sizing: border-box;
    overflow: hidden;
  }

  .swap-workspace :global(.swap-grid .snapsort-item) {
    width: calc((100% - (var(--size-4) * 2)) / 3);
    padding: 0;
  }

  .swap-workspace :global(.swap-tile) {
    --tile-color: #999;
    --card-color: var(--color-background-tint);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    width: 100%;
    padding: clamp(0.85rem, 1.8vw, 1.25rem) clamp(2.75rem, 5vw, 3.75rem);
    border-radius: var(--size-16);
    background: var(--card-color);
    color: #20262b;
    font-family: "Bitcount Grid Single", monospace;
    font-size: clamp(1.35rem, 3vw, 2rem);
    font-weight: 300;
    cursor: grab;
    touch-action: none;
    box-sizing: border-box;
  }

  .swap-workspace :global(.swap-tile:active) {
    cursor: grabbing;
  }

  .swap-workspace :global(.swap-tile-grip) {
    position: absolute;
    left: clamp(1rem, 2vw, 1.45rem);
    top: 50%;
    display: grid;
    grid-template-columns: repeat(2, 0.28rem);
    grid-template-rows: repeat(3, 0.28rem);
    gap: 0.28rem;
    opacity: 1;
    transform: translateY(-50%);
  }

  .swap-workspace :global(.swap-tile-grip i) {
    display: block;
    width: 0.28rem;
    height: 0.28rem;
    border-radius: 50%;
    background: #9ca3a8;
  }

  .swap-workspace :global(.swap-tile-label) {
    position: relative;
    z-index: 1;
    color: inherit;
    font: inherit;
    line-height: 1;
  }

  .swap-workspace :global(.swap-tile-hovered) {
    outline: 3px solid color-mix(in srgb, var(--tile-color) 68%, #232526);
    outline-offset: 2px;
  }

  .swap-workspace :global(.snapsort-item[data-snapsort-dragging="true"] .swap-tile) {
    opacity: 0.35;
  }

  .swap-workspace :global(.swap-tile-ghost) {
    pointer-events: none;
  }

  .editor-example {
    position: relative;
    justify-content: stretch;
    min-height: 470px;
  }

  @media (max-width: 900px) {
    .gallery-body {
      grid-template-columns: minmax(0, 1fr);
    }

    .gallery-sidebar {
      display: none;
    }
  }

  @media (max-width: 720px) {
    .examples-grid {
      margin: 2rem 0;
    }

    .example-side {
      display: flex;
      flex-direction: column;
      align-items: stretch;
    }

    .example-side .example-placard {
      padding-top: 0;
    }

    .kanban-example {
      display: none;
    }

    .gallery-skeleton-grid .gallery-demo-skeleton {
      min-height: 660px;
    }

    .gallery-skeleton-grid .gallery-demo-skeleton:nth-child(2) {
      display: none;
    }

    .gallery-skeleton-grid #editor {
      min-height: 1230px;
    }
  }

  /* Sentence Builder */
  .sentence-builder {
    padding: var(--size-24);
    display: flex;
    flex-direction: column;
    gap: var(--size-16);
    background: white;
    width: min(100%, 420px);
    justify-self: center;
    min-height: 300px;
    box-sizing: border-box;
    touch-action: none;
  }

  .prompt-section {
    --card-color: #232526;
    --display-text-color: #e8e6dc;
    font-family: "Bitcount Grid Single", monospace;
  }

  .english-sentence {
    span {
      color: #ffffff;
      font-family: inherit;
    }
  }

  .sentence-container-area {
    width: 100%;
    flex: 1;
    min-height: 116px;
  }

  .sentence-builder :global(.sentence-workspace-root) {
    width: 100%;
    height: 100%;
    align-items: stretch;
    justify-content: space-between;
  }

  .sentence-builder :global(.sentence-drop-zone),
  .sentence-builder :global(.sentence-source-zone) {
    position: relative;
    width: 100%;
    min-height: 38px;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--size-4);
  }

  .sentence-builder :global(.sentence-drop-zone) {
    border-bottom: 2px solid #eee;
    padding-bottom: var(--size-2);
    align-items: flex-start;
    align-content: flex-start;
  }

  .sentence-builder :global(.sentence-source-zone) {
    align-content: flex-start;
    justify-content: center;
    margin-top: auto;
    padding: var(--size-16) 0 0;
  }

  .sentence-builder :global(.sentence-tile-wrapper) {
    padding: 0.15rem;
  }

  .sentence-builder :global(.sentence-tile-ghost) {
    background: #d8dde0;
    border-radius: 4px;
    opacity: 0.55;
  }

  .sentence-word {
    background: #ffffff;
    border: 1px solid #ddd;
    padding: 2px 4px;
    border-radius: 4px;
    cursor: grab;
    touch-action: none;
    font-family: "DotGothic16", sans-serif;
    box-shadow: 0 3px 0 0 #d8dde0;
    color: #232526;
    font-size: 1rem;
    line-height: 1.2;
  }

  .sentence-word:active {
    cursor: grabbing;
  }

  .sentence-word.selected {
    box-shadow: 0 3px 0 0 #b9c3ca;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: auto;
  }

  .check-btn {
    width: 100%;
    padding: 0.5rem 1.5rem;
    --button-color: var(--color-primary);
    // background: #3a2a22;
    color: white;
    // border: none;
    // border-radius: 4px;
    cursor: pointer;
    // font-weight: 600;
    // font-family: inherit;
  }

  .check-btn.success {
    --button-color: #2e7d32;
  }

  /* Editor Builder */
  .editor-builder {
    display: grid;
    grid-template-columns: minmax(180px, 240px) minmax(0, 1fr);
    gap: var(--size-24);
    min-height: 406px;
    padding-top: 2.2rem;
  }

  .editor-palette {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-content: start;
    gap: 0.65rem;
    padding: var(--size-16);
  }

  .editor-tool {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    min-height: 74px;
    padding: 0.75rem 0.55rem;
    border: 1px solid #d5d8dc;
    border-radius: var(--ui-radius);
    background: #ffffff;
    color: #232526;
    box-shadow: none;
    cursor: pointer;
  }

  .editor-tool:hover {
    border-color: var(--color-primary);
  }

  .editor-tool :global(.material-symbols-rounded) {
    font-family: "Material Symbols Rounded";
    font-size: 1.25rem;
    line-height: 1;
    font-style: normal;
    font-variation-settings: "FILL" 0, "wght" 500, "GRAD" 0, "opsz" 24;
  }

  .editor-tool span {
    font-size: 0.82rem;
    line-height: 1;
  }

  .editor-canvas {
    --card-color: #f2f2f3;
    display: flex;
    flex-direction: column;
    justify-self: center;
    min-width: 0;
    width: min(calc(100% - 3rem), 640px);
    align-self: stretch;
    padding: var(--size-32);
    margin-inline: 1.5rem;
    box-sizing: border-box;
    background: var(--card-color);
  }

  .editor-canvas-header {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 2rem;
  }

  .editor-canvas-title {
    margin: 0;
    color: #232526;
    font-family: "Bitcount Grid Single", monospace !important;
    font-size: 2.8rem;
    font-weight: 300;
    line-height: 1;
  }

  .editor-canvas :global(.editor-field-list) {
    width: 100%;
    align-items: stretch;
    gap: 1.25rem;
  }

  .editor-canvas :global(.editor-field-list .snapsort-item) {
    width: 100%;
    align-items: stretch;
    padding: 0;
  }

  .editor-field {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: stretch;
    gap: 0.85rem;
    padding: 1rem;
    background: #ffffff;
    border: 1px solid #d5d8dc;
    border-radius: var(--ui-radius);
  }

  .editor-field-main {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
    gap: 0.85rem;
    min-width: 0;
  }

  .editor-question-input {
    font-weight: 600;
    pointer-events: auto;
    min-width: 0;
  }

  .editor-field input:not([type="checkbox"]):not([type="radio"]):not([type="range"]),
  .editor-field textarea {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 0.55rem 0.8rem;
  }

  .editor-field textarea {
    resize: none;
    font-family: "Geist", sans-serif;
    font-size: 1rem;
    border: 1px solid #d5d8dc;
    border-radius: var(--ui-radius);
    background: #ffffff;
    box-shadow: none;
  }

  .editor-field input,
  .editor-field textarea {
    pointer-events: none;
  }

  .editor-field .editor-question-input {
    pointer-events: auto;
  }

  .editor-canvas :global(.editor-option-stack) {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.45rem;
    min-width: 0;
    width: 100%;
  }

  .editor-canvas :global(.editor-option-item) {
    width: 100%;
    align-items: stretch;
    padding: 0;
  }

  .editor-option-row {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.55rem;
    width: 100%;
  }

  .editor-option-row :global(label) {
    margin: 0;
  }

  .editor-field .editor-option-input {
    pointer-events: auto;
  }

  .editor-option-action,
  .editor-add-option {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    width: fit-content;
    min-height: 0;
    padding: 0.25rem 0.45rem;
    font-size: 0.78rem;
    line-height: 1;
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
  }

  .editor-option-action {
    padding: 0.25rem;
    color: #c7472f;
  }

  .editor-option-action :global(.material-symbols-rounded),
  .editor-add-option :global(.material-symbols-rounded),
  .editor-option-type-icon,
  .editor-option-grip {
    font-family: "Material Symbols Rounded";
    font-size: 1rem;
    line-height: 1;
    font-style: normal;
    font-variation-settings: "FILL" 0, "wght" 500, "GRAD" 0, "opsz" 20;
  }

  .editor-option-type-icon {
    color: #8f9497;
  }

  .editor-option-grip {
    color: currentColor;
  }

  :global(.editor-option-handle),
  :global(.editor-field-handle) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #7c8387;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }

  :global(.editor-field-handle) {
    width: 1.35rem;
    align-self: stretch;
    border: 1px solid #d5d8dc;
    border-radius: calc(var(--ui-radius) - 2px);
    background: #f3f5f6;
  }

  :global(.editor-option-handle) {
    width: 1.25rem;
    min-height: 2rem;
  }

  :global(.editor-option-handle:active),
  :global(.editor-field-handle:active) {
    cursor: grabbing;
    color: #232526;
  }

  .editor-add-option {
    justify-self: start;
    margin-top: 0.1rem;
    pointer-events: auto;
    color: var(--color-primary);
    font-weight: 500;
  }

  .editor-rating-preview {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    justify-self: center;
    gap: 0.2rem;
    width: 100%;
    padding: 0.3rem 0;
    color: #b8bec2;
  }

  .editor-rating-preview :global(.material-symbols-rounded) {
    font-family: "Material Symbols Rounded";
    font-size: 1.7rem;
    line-height: 1;
    font-style: normal;
    font-variation-settings: "FILL" 0, "wght" 500, "GRAD" 0, "opsz" 24;
  }

  .editor-rating-preview :global(.material-symbols-rounded.filled) {
    color: var(--color-primary);
    font-variation-settings: "FILL" 1, "wght" 500, "GRAD" 0, "opsz" 24;
  }

  .editor-field-grip {
    font-family: "Material Symbols Rounded";
    font-size: 1.2rem;
    line-height: 1;
    color: currentColor;
  }

  @media (max-width: 720px) {
    .editor-builder {
      grid-template-columns: 1fr;
      padding-top: 0;
    }

    .editor-palette {
      padding: var(--size-16);
    }

    .editor-field-main {
      gap: 0.55rem;
    }
  }

  /* Project List */
  .project-list {
    padding: 1rem;
    background: transparent;
    // height: 100%;
  }

  .project-list :global(.snapsort-container) {
    align-items: stretch;
    width: 100%;
  }

  .project-list :global(.snapsort-item) {
    align-items: stretch;
    width: 100%;
    padding: 0;
    cursor: auto !important;
  }

  .project-card {
    --todo-row-font-size: 0.82rem;
    --todo-meta-font-size: 0.72rem;
    --todo-meta-width: 5.6rem;
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr) var(--todo-meta-width);
    align-items: center;
    gap: 0.75rem;
    font-size: var(--todo-row-font-size);
    padding: 0.75rem 1rem;
    margin: 0;
    background: white;
    border: 0;
    border-radius: 0;
    width: 100%;
    box-sizing: border-box;
    box-shadow: 0 1px 0 rgba(35, 37, 38, 0.04);
  }

  :global(.project-drag-handle) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.2rem;
    height: 1.2rem;
    color: #8f9497;
    cursor: default;
    touch-action: none;
    user-select: none;
  }

  :global(.project-drag-handle:hover) {
    cursor: grab;
  }

  :global(.project-drag-handle:active) {
    cursor: grabbing;
  }

  :global(.project-drag-handle) :global(.material-symbols-rounded) {
    font-family: "Material Symbols Rounded";
    font-size: 1rem;
    line-height: 1;
    font-style: normal;
    font-variation-settings: "FILL" 0, "wght" 500, "GRAD" 0, "opsz" 20;
  }

  .project-text {
    color: #232526;
    font-size: var(--todo-row-font-size);
    font-weight: 500;
    line-height: 1.15;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .project-card.checked .project-text {
    color: #747a7d;
    text-decoration: line-through;
    text-decoration-thickness: 1.5px;
    text-decoration-color: #747a7d;
  }

  .project-meta {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.55rem;
    width: var(--todo-meta-width);
    color: #8f9497;
    font-size: var(--todo-meta-font-size);
    line-height: 1;
    justify-self: end;
  }

  .project-meta-item {
    display: inline-flex;
    align-items: center;
    gap: 0.28rem;
    font-size: var(--todo-meta-font-size);
    line-height: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .project-meta-item :global(.material-symbols-rounded) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-family: "Material Symbols Rounded";
    color: var(--todo-icon-color);
    font-size: var(--todo-meta-font-size);
    font-weight: 500;
    line-height: 1;
    font-style: normal;
    font-variation-settings: "FILL" 0, "wght" 500, "GRAD" 0, "opsz" 20;
    -webkit-font-feature-settings: "liga";
    -webkit-font-smoothing: antialiased;
    font-feature-settings: "liga";
  }

  .project-meta-item:nth-child(1) {
    --todo-icon-color: #4f8fc7;
  }

  .project-meta-item:nth-child(2) {
    --todo-icon-color: #4f8fc7;
  }

  .project-meta-item:nth-child(3) {
    --todo-icon-color: #4f8fc7;
  }

  .project-card.checked .project-meta {
    color: #a3a8ab;
  }

  .project-list :global(label) {
    margin: 0;
  }

  @media (max-width: 720px) {
    .project-list {
      padding: 0;
    }

    .project-card {
      --todo-meta-width: 100%;
      grid-template-columns: auto auto minmax(0, 1fr);
      gap: 0.45rem 0.65rem;
      padding: 0.75rem;
    }

    .project-text {
      white-space: normal;
      overflow-wrap: anywhere;
    }

    .project-meta {
      grid-column: 3;
      grid-template-columns: minmax(0, 1fr);
      justify-self: stretch;
      width: 100%;
    }
  }

  /* Kanban Board */
  .kanban-board {
    display: flex;
    height: 100%;
  }

  .kanban-board > :global(.snapsort-container) {
    width: 100%;
    gap: 1rem;
    flex-wrap: nowrap;
    align-items: stretch;
  }

  .kanban-board :global(.kanban-column) {
    flex: 1;
    padding: 0.75rem;
    min-height: 600px;
    align-items: stretch;
    border-radius: 12px;
    background: rgb(31 30 41 / 4%);
  }

  .kanban-board :global(.kanban-column .snapsort-item) {
    align-items: stretch;
    width: 100%;
    padding-inline: 0;
  }

  .kanban-board :global(.kanban-column h4) {
    margin: 0 0 1rem 0;
    font-family: "Bitcount Grid Single", monospace;
    font-size: 0.9rem;
    font-weight: 300;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #8f9497;
  }

  .kanban-card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    padding: 0.85rem 0.95rem;
    background: var(--color-background);
    border: 1px solid rgb(31 30 41 / 8%);
    border-radius: 10px;
    box-shadow:
      0 1px 2px rgb(31 30 41 / 5%),
      0 4px 12px -6px rgb(31 30 41 / 8%);
    cursor: grab;
    touch-action: none;
    width: 100%;
    box-sizing: border-box;
  }

  .kanban-card:active {
    cursor: grabbing;
  }

  .kanban-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .kanban-title {
    font-weight: 600;
    font-size: 0.95rem;
    line-height: 1.25;
    color: #232526;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .kanban-tag {
    flex: 0 0 auto;
    padding: 0.16rem 0.5rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-primary) 10%, #fff);
    color: color-mix(in srgb, var(--color-primary) 72%, #222);
    font-size: 0.7rem;
    font-weight: 600;
    line-height: 1.2;
  }

  .kanban-desc {
    margin: 0;
    font-size: 0.85rem;
    color: #5f6569;
    line-height: 1.35;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .kanban-footer {
    display: grid;
    grid-template-columns: auto auto;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding-top: 0.45rem;
  }

  .kanban-avatar {
    width: 1.6rem;
    height: 1.6rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--avatar-color);
    color: white;
    font-family: "Bitcount Grid Single", monospace;
    font-size: 0.67rem;
    font-weight: 300;
    line-height: 1;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28);
  }

  .kanban-meta {
    display: grid;
    grid-template-columns: repeat(2, max-content);
    gap: 0.65rem;
    justify-self: end;
    color: #8f9497;
    font-size: 0.78rem;
    line-height: 1;
  }

  .kanban-meta-item {
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.18rem;
    color: inherit;
    font-size: inherit;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .kanban-meta-item :global(.material-symbols-rounded) {
    flex: 0 0 auto;
    font-family: "Material Symbols Rounded";
    color: currentColor;
    font-size: inherit;
    font-weight: 500;
    line-height: 1;
  }

</style>
