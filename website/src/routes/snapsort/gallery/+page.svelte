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
    ContainerCallbacks,
    Container as SortContainer,
    DragEndEvent,
    DragItemHoverEvent,
    DragStartEvent,
    DropTargetChangeEvent,
    ItemMoveEvent,
    ItemSwapEvent,
    RenderTree,
    RenderTreeEvent,
  } from "@snap-engine/snapsort";
  import {
    createRenderEntries,
    createRenderEntry,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
  } from "@snap-engine/snapsort";
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
    options?: RenderTree<EditorOption>;
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

  function ordinaryValues<T>(tree: RenderTree<T>): T[] {
    return tree.entries.flatMap((entry) =>
      entry.isGhost ? [] : [entry.value],
    );
  }

  function entryOrder<T>(tree: RenderTree<T>): string {
    return tree.entries
      .filter((entry) => !entry.isGhost)
      .map((entry) => entry.itemId)
      .join(",");
  }

  function structuralCallbacks(
    handler: (event: RenderTreeEvent) => void,
  ): ContainerCallbacks {
    return {
      onItemMove: handler,
      onGhostInsert: handler,
      onGhostMove: handler,
      onGhostRemove: handler,
    };
  }

  type TodoItem = {
    id: string;
    text: string;
    due: string;
    priority: string;
    estimate: string;
    checked: boolean;
  };

  const initialTodoItems: TodoItem[] = [
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
  ];
  let todoItems = $state.raw(
    createRenderTree(createRenderEntries(initialTodoItems, (todo) => todo.id)),
  );

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
  };
  type KanbanValue = KanbanCard | KanbanColumn;

  const kanbanColumnEntry = (
    column: KanbanColumn,
    cards: readonly KanbanCard[],
  ) =>
    createRenderEntry<KanbanValue>(
      column,
      column.id,
      createRenderTree(
        createRenderEntries<KanbanValue>(cards, (card) => card.id),
      ),
    );
  let kanbanColumns = $state.raw(
    createRenderTree<KanbanValue>([
      kanbanColumnEntry(
        { id: "kanban-todo", title: "To Do", target: "kanban-review" },
        kanbanTodo,
      ),
      kanbanColumnEntry(
        { id: "kanban-review", title: "Review", target: "kanban-done" },
        kanbanReview,
      ),
      kanbanColumnEntry(
        { id: "kanban-done", title: "Done", target: "kanban-todo" },
        kanbanDone,
      ),
    ]),
  );

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

  function createEditorOptions(options: readonly EditorOption[]) {
    return createRenderTree(createRenderEntries(options, (option) => option.id));
  }

  function defaultEditorOptions(type: EditorFieldType): RenderTree<EditorOption> | undefined {
    if (type === "multipleChoice" || type === "checkboxes") {
      return createEditorOptions([
        createEditorOption("Option 1"),
        createEditorOption("Option 2"),
      ]);
    }
    if (type === "dropdown") {
      return createEditorOptions([
        createEditorOption("Option 1"),
        createEditorOption("Option 2"),
        createEditorOption("Option 3"),
      ]);
    }
    return undefined;
  }

  let editorFieldCount = 3;
  let editorFields = $state.raw(
    createRenderTree(
      createRenderEntries<EditorField>(
        [
          { id: "editor-field-1", type: "shortText", label: "Question 1" },
          {
            id: "editor-field-2",
            type: "multipleChoice",
            label: "Question 2",
            options: createEditorOptions([
              { id: "editor-option-1", label: "Option 1" },
              { id: "editor-option-2", label: "Option 2" },
            ]),
          },
          { id: "editor-field-3", type: "rating", label: "Question 3" },
        ],
        (field) => field.id,
      ),
    ),
  );

  let sentenceAnswerContainer: SortContainer | undefined = $state();
  let sentenceBankContainer: SortContainer | undefined = $state();
  type SentenceValue = SentenceTile | { zone: SentenceZone };
  let sentenceTiles = $state.raw(
    createRenderTree<SentenceValue>([
      createRenderEntry(
        { zone: "answer" },
        "sentence-zone-answer",
        createRenderTree(),
      ),
      createRenderEntry(
        { zone: "bank" },
        "sentence-zone-bank",
        createRenderTree(
          createRenderEntries<SentenceValue>(
            sentenceWords,
            (tile) => "id" in tile ? tile.id : `sentence-zone-${tile.zone}`,
          ),
        ),
      ),
    ]),
  );
  let sentenceResult = $state("");
  let sentencePointerStart: { x: number; y: number } | null = null;
  let suppressSentenceClick = false;
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
    const field: EditorField = {
      id: `editor-field-${editorFieldCount}`,
      type,
      label: `Question ${editorFieldCount}`,
      options: defaultEditorOptions(type),
    };
    editorFields = {
      ...editorFields,
      entries: [
        ...editorFields.entries,
        createRenderEntry(field, field.id),
      ],
    };
  }

  function updateEditorFieldLabel(id: string, label: string) {
    editorFields = {
      ...editorFields,
      entries: editorFields.entries.map((entry) =>
        !entry.isGhost && entry.itemId === id
          ? { ...entry, value: { ...entry.value, label } }
          : entry,
      ),
    };
  }

  function updateEditorFieldOptions(
    fieldId: string,
    update: (options: RenderTree<EditorOption>) => RenderTree<EditorOption>,
  ) {
    editorFields = {
      ...editorFields,
      entries: editorFields.entries.map((entry) =>
        !entry.isGhost && entry.itemId === fieldId
          ? {
              ...entry,
              value: {
                ...entry.value,
                options: update(entry.value.options ?? createRenderTree()),
              },
            }
          : entry,
      ),
    };
  }

  function updateEditorOptionLabel(fieldId: string, optionId: string, label: string) {
    updateEditorFieldOptions(fieldId, (options) =>
      ({
        ...options,
        entries: options.entries.map((entry) =>
          !entry.isGhost && entry.itemId === optionId
            ? { ...entry, value: { ...entry.value, label } }
            : entry,
        ),
      }),
    );
  }

  function addEditorOption(fieldId: string) {
    const field = editorFields.entries.find(
      (entry) => !entry.isGhost && entry.itemId === fieldId,
    );
    const optionCount =
      field && !field.isGhost && field.value.options
        ? ordinaryValues(field.value.options).length
        : 0;
    const option = createEditorOption(`Option ${optionCount + 1}`);
    updateEditorFieldOptions(fieldId, (options) => ({
      ...options,
      entries: [...options.entries, createRenderEntry(option, option.id)],
    }));
  }

  function removeEditorOption(fieldId: string, optionId: string) {
    updateEditorFieldOptions(fieldId, (options) => {
      if (ordinaryValues(options).length <= 1) return options;
      return {
        ...options,
        entries: options.entries.filter(
          (entry) => entry.isGhost || entry.itemId !== optionId,
        ),
      };
    });
  }

  function handleEditorOptionEvent(fieldId: string, event: RenderTreeEvent) {
    updateEditorFieldOptions(fieldId, (options) =>
      reduceRenderTree(options, event),
    );
  }

  function handleEditorFieldEvent(event: RenderTreeEvent) {
    editorFields = reduceRenderTree(editorFields, event);
  }

  function handleTodoEvent(event: RenderTreeEvent) {
    todoItems = reduceRenderTree(todoItems, event);
  }

  function setTodoChecked(itemId: string, checked: boolean) {
    todoItems = {
      ...todoItems,
      entries: todoItems.entries.map((entry) =>
        !entry.isGhost && entry.itemId === itemId
          ? { ...entry, value: { ...entry.value, checked } }
          : entry,
      ),
    };
  }

  function handleKanbanEvent(event: RenderTreeEvent) {
    kanbanColumns = reduceRenderTree(kanbanColumns, event);
  }

  function sentenceContainerForZone(zone: SentenceZone) {
    return zone === "answer" ? sentenceAnswerContainer : sentenceBankContainer;
  }

  function sentenceZoneTree(zone: SentenceZone): RenderTree<SentenceValue> | null {
    const entry = sentenceTiles.entries.find(
      (candidate) =>
        !candidate.isGhost &&
        "zone" in candidate.value &&
        candidate.value.zone === zone,
    );
    return entry && !entry.isGhost ? entry.childTree : null;
  }

  function findSentenceTile(tileId: string | undefined): SentenceTile | null {
    if (!tileId) return null;
    for (const zone of ["answer", "bank"] as const) {
      const entry = sentenceZoneTree(zone)?.entries.find(
        (candidate) => !candidate.isGhost && candidate.itemId === tileId,
      );
      if (entry && !entry.isGhost && "text" in entry.value) return entry.value;
    }
    return null;
  }

  function handleSentenceEvent(event: RenderTreeEvent) {
    sentenceTiles = reduceRenderTree(sentenceTiles, event);
    sentenceResult = "";
  }

  function sentenceGhostTileText(itemId: string): string {
    return findSentenceTile(itemId)?.text ?? "";
  }

  function moveSentenceTileToZone(tile: SentenceValue, targetZone: SentenceZone) {
    if (!("text" in tile)) return;
    const sourceZone: SentenceZone = sentenceZoneTree("answer")?.entries.some(
      (candidate) => !candidate.isGhost && candidate.itemId === tile.id,
    )
      ? "answer"
      : "bank";
    const sourceContainer = sentenceContainerForZone(sourceZone);
    const targetContainer = sentenceContainerForZone(targetZone);
    const targetIndex = sentenceZoneTree(targetZone)?.entries.filter(
      (entry) => !entry.isGhost,
    ).length ?? 0;

    if (sourceContainer && targetContainer) {
      sourceContainer.moveItem(tile.id, targetContainer, targetIndex);
    }
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
    const answer = sentenceZoneTree("answer");
    const words = answer
      ? ordinaryValues(answer).flatMap((value) =>
          "text" in value ? [value.text] : [],
        )
      : [];
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

  // --- Clone Palette: ordinary move + source backfill ---

  type PaletteBlockType = "button" | "image" | "divider" | "spacer";

  type PaletteBlockTemplate = {
    type: PaletteBlockType;
    label: string;
    icon: string;
  };

  type CloneBlock = PaletteBlockTemplate & {
    id: string;
    template: boolean;
  };

  const paletteBlockTemplates: PaletteBlockTemplate[] = [
    { type: "button", label: "Button", icon: "smart_button" },
    { type: "image", label: "Image", icon: "image" },
    { type: "divider", label: "Divider", icon: "horizontal_rule" },
    { type: "spacer", label: "Spacer", icon: "space_bar" },
  ];
  type CloneZone = "palette" | "canvas";

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

  let paletteInstanceCount = 0;
  type CloneValue = CloneBlock | { zone: CloneZone };
  const initialPaletteBlocks: CloneBlock[] = paletteBlockTemplates.map(
    (template) => ({
      ...template,
      id: `palette-${template.type}-${paletteInstanceCount++}`,
      template: true,
    }),
  );
  let cloneWorkspace = $state.raw(
    createRenderTree<CloneValue>([
      createRenderEntry(
        { zone: "palette" },
        "clone-palette",
        createRenderTree(
          createRenderEntries<CloneValue>(
            initialPaletteBlocks,
            (block) => "id" in block ? block.id : `clone-${block.zone}`,
          ),
        ),
      ),
      createRenderEntry(
        { zone: "canvas" },
        "clone-canvas",
        createRenderTree(),
      ),
    ]),
  );

  function cloneZoneTree(zone: CloneZone): RenderTree<CloneValue> | null {
    const entry = cloneWorkspace.entries.find(
      (candidate) =>
        !candidate.isGhost &&
        "zone" in candidate.value &&
        candidate.value.zone === zone,
    );
    return entry && !entry.isGhost ? entry.childTree : null;
  }

  function updateCloneZone(
    zone: CloneZone,
    update: (tree: RenderTree<CloneValue>) => RenderTree<CloneValue>,
  ) {
    cloneWorkspace = {
      ...cloneWorkspace,
      entries: cloneWorkspace.entries.map((entry) =>
        !entry.isGhost &&
        "zone" in entry.value &&
        entry.value.zone === zone &&
        entry.childTree
          ? { ...entry, childTree: update(entry.childTree) }
          : entry,
      ),
    };
  }

  function handleCloneDragStart(event: DragStartEvent) {
    // Metadata chooses the application recipe. The preview is presentation
    // only; the eventual state change is still an ordinary move.
    if (event.itemMetadata.template === true) {
      event.session.dragVisual = "preview";
    }
  }

  function handleCloneMove(event: ItemMoveEvent) {
    const blockId = event.itemId;
    const type = event.itemMetadata.blockType;
    if (
      typeof type !== "string" ||
      event.to.containerMetadata.copyZone !== "canvas"
    ) {
      return;
    }

    if (event.itemMetadata.template === true) {
      const original = cloneZoneTree("palette")?.entries.find(
        (entry) => !entry.isGhost && entry.itemId === blockId,
      );
      if (!original || original.isGhost || !("template" in original.value)) return;

      cloneWorkspace = reduceRenderTree(cloneWorkspace, event);
      const replacement: CloneBlock = {
        ...original.value,
        id: `palette-${original.value.type}-${paletteInstanceCount++}`,
        template: true,
      };
      updateCloneZone("palette", (tree) => {
        const entries = [...tree.entries];
        entries.splice(
          Math.max(0, Math.min(event.from.index, entries.length)),
          0,
          createRenderEntry<CloneValue>(replacement, replacement.id),
        );
        return { ...tree, entries };
      });
      return;
    }

    cloneWorkspace = reduceRenderTree(cloneWorkspace, event);
  }

  function handleCloneGhost(event: RenderTreeEvent) {
    cloneWorkspace = reduceRenderTree(cloneWorkspace, event);
  }

  function removeCanvasBlock(id: string) {
    updateCloneZone("canvas", (tree) => ({
      ...tree,
      entries: tree.entries.filter(
        (entry) => entry.isGhost || entry.itemId !== id,
      ),
    }));
  }

  // --- Trash It: session.dropEffect = "none" + onDragEnd cleanup ---

  type TrashTask = {
    id: string;
    text: string;
  };

  type TrashZone = "list" | "bin";
  type TrashValue = TrashTask | { zone: TrashZone };
  let trashTasks = $state.raw(
    createRenderTree<TrashValue>([
      createRenderEntry(
        { zone: "list" },
        "trash-zone-list",
        createRenderTree(
          createRenderEntries<TrashValue>(
            [
              { id: "trash-task-1", text: "Reply to design feedback" },
              { id: "trash-task-2", text: "Archive last sprint's board" },
              { id: "trash-task-3", text: "Renew the SSL certificate" },
              { id: "trash-task-4", text: "Clean up unused feature flags" },
              { id: "trash-task-5", text: "Update the onboarding checklist" },
            ],
            (value) => "id" in value ? value.id : `trash-zone-${value.zone}`,
          ),
        ),
      ),
      createRenderEntry(
        { zone: "bin" },
        "trash-zone-bin",
        createRenderTree(),
      ),
    ]),
  );
  let trashHovered = $state(false);

  function handleTrashDropTargetChange(event: DropTargetChangeEvent) {
    const overTrash = event.current?.containerMetadata.role === "trash";
    event.session.dropEffect = overTrash ? "none" : "move";
    trashHovered = overTrash;
  }

  function handleTrashEvent(event: RenderTreeEvent) {
    trashTasks = reduceRenderTree(trashTasks, event);
  }

  function trashZoneTree(zone: TrashZone): RenderTree<TrashValue> | null {
    const entry = trashTasks.entries.find(
      (candidate) =>
        !candidate.isGhost &&
        "zone" in candidate.value &&
        candidate.value.zone === zone,
    );
    return entry && !entry.isGhost ? entry.childTree : null;
  }

  function removeTrashTask(itemId: string) {
    trashTasks = {
      ...trashTasks,
      entries: trashTasks.entries.map((entry) =>
        !entry.isGhost && entry.childTree
          ? {
              ...entry,
              childTree: {
                ...entry.childTree,
                entries: entry.childTree.entries.filter(
                  (child) => child.isGhost || child.itemId !== itemId,
                ),
              },
            }
          : entry,
      ),
    };
  }

  function handleTrashDragEnd(event: DragEndEvent) {
    const shouldDelete = trashHovered || event.destination?.containerMetadata.role === "trash";
    trashHovered = false;
    if (!shouldDelete) return;
    removeTrashTask(event.itemId);
  }

  // --- Swap Grid: mode: "swap" + onDragItemEnter/Leave hover highlight ---

  type SwapTile = {
    id: string;
    label: string;
    color: string;
  };

  let swapTiles = $state.raw(
    createRenderTree(
      createRenderEntries<SwapTile>(
        [
          { id: "swap-1", label: "A1", color: "#ff7a59" },
          { id: "swap-2", label: "A2", color: "#ffb703" },
          { id: "swap-3", label: "A3", color: "#06d6a0" },
          { id: "swap-4", label: "B1", color: "#4cc9f0" },
          { id: "swap-5", label: "B2", color: "#4361ee" },
          { id: "swap-6", label: "B3", color: "#7209b7" },
          { id: "swap-7", label: "C1", color: "#f72585" },
          { id: "swap-8", label: "C2", color: "#3a86ff" },
          { id: "swap-9", label: "C3", color: "#8ecae6" },
        ],
        (tile) => tile.id,
      ),
    ),
  );
  let swapHoveredId: string | null = $state(null);

  function handleSwapCommit(event: ItemSwapEvent) {
    swapTiles = reduceRenderTree(swapTiles, event);
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

  function handleSwapGhost(event: RenderTreeEvent) {
    swapTiles = reduceRenderTree(swapTiles, event);
  }

  function swapGhostTile(itemId: string) {
    const entry = swapTiles.entries.find(
      (candidate) => !candidate.isGhost && candidate.itemId === itemId,
    );
    return entry && !entry.isGhost ? entry.value : undefined;
  }

  const todoCallbacks = structuralCallbacks(handleTodoEvent);
  const kanbanCallbacks = {
    ...structuralCallbacks(handleKanbanEvent),
    canDrop: rejectDrop,
  } satisfies ContainerCallbacks;
  const sentenceCallbacks = {
    ...structuralCallbacks(handleSentenceEvent),
    canDrop: rejectDrop,
  } satisfies ContainerCallbacks;
  const cloneCallbacks = {
    onItemMove: handleCloneMove,
    onGhostInsert: handleCloneGhost,
    onGhostMove: handleCloneGhost,
    onGhostRemove: handleCloneGhost,
    canDrop: rejectDrop,
    onDragStart: handleCloneDragStart,
  } satisfies ContainerCallbacks;
  const trashCallbacks = {
    ...structuralCallbacks(handleTrashEvent),
    canDrop: rejectDrop,
    onDropTargetChange: handleTrashDropTargetChange,
    onDragEnd: handleTrashDragEnd,
  } satisfies ContainerCallbacks;
  const swapCallbacks = {
    onItemSwap: handleSwapCommit,
    onGhostInsert: handleSwapGhost,
    onGhostMove: handleSwapGhost,
    onGhostRemove: handleSwapGhost,
    onDragItemEnter: handleSwapHoverEnter,
    onDragItemLeave: handleSwapHoverLeave,
  } satisfies ContainerCallbacks;
  const editorFieldCallbacks = structuralCallbacks(handleEditorFieldEvent);
</script>

{#snippet editorOptions(field: EditorField)}
  {@const options = field.options ?? createRenderTree<EditorOption>()}
  {@const firstOptionId = options.entries.find((entry) => !entry.isGhost)?.itemId}
  <SnapSortContextBoundary>
    <Container
      itemId={`gallery-${field.id}-options-root`}
      className="editor-option-stack"
      config={{
        animation: defaultAnimations,
        mode: "progressive",
        direction: "column",
        name: `editor-options-${field.id}`,
        callbacks: structuralCallbacks((event) =>
          handleEditorOptionEvent(field.id, event)
        ),
      }}
      locked={true}
      metadata={{ fieldId: field.id }}
    >
      {#each options.entries as optionEntry (optionEntry.itemId)}
        {#if optionEntry.isGhost}
          <Ghost ghost={optionEntry.ghost} />
        {:else}
          <Item itemId={optionEntry.itemId} className="editor-option-item">
            <div class="editor-option-row">
              <Handle className="editor-option-handle">
                <i class="material-symbols-rounded editor-option-grip" aria-hidden="true">drag_indicator</i>
              </Handle>
              {#if field.type === "multipleChoice"}
                <label class="radio-label">
                  <input type="radio" name={`${field.id}-choice`} checked={optionEntry.itemId === firstOptionId} tabindex="-1" />
                  <span></span>
                </label>
              {:else if field.type === "checkboxes"}
                <label class="checkbox-label">
                  <input type="checkbox" checked={optionEntry.itemId === firstOptionId} tabindex="-1" />
                  <span></span>
                </label>
              {:else}
                <i class="material-symbols-rounded editor-option-type-icon" aria-hidden="true">arrow_drop_down</i>
              {/if}
              <input
                class="editor-option-input"
                type="text"
                value={optionEntry.value.label}
                aria-label="Option text"
                oninput={(event) =>
                  updateEditorOptionLabel(field.id, optionEntry.itemId, event.currentTarget.value)}
                onpointerdown={(event) => event.stopPropagation()}
                onclick={(event) => event.stopPropagation()}
              />
              <button
                class="editor-option-action"
                type="button"
                aria-label="Remove option"
                disabled={ordinaryValues(options).length <= 1}
                onpointerdown={(event) => event.stopPropagation()}
                onclick={(event) => {
                  event.stopPropagation();
                  removeEditorOption(field.id, optionEntry.itemId);
                }}
              >
                <i class="material-symbols-rounded" aria-hidden="true">delete</i>
              </button>
            </div>
          </Item>
        {/if}
      {/each}
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
{/snippet}

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
            {#each ordinaryValues(todoItems) as todo}
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
                  {#each ordinaryValues(sentenceZoneTree("bank") ?? createRenderTree()) as tile}
                    {#if "text" in tile}
                      <button type="button" class="word-card sentence-word" tabindex="-1">
                        {tile.text}
                      </button>
                    {/if}
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
              the palette stays stocked. Built from a normal move, source
              backfill, and a <code>preview</code> drag visual.
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
                {#each ordinaryValues(trashZoneTree("list") ?? createRenderTree()) as task}
                  {#if "text" in task}
                    <div class="trash-task">
                      <i class="material-symbols-rounded trash-task-grip" aria-hidden="true">drag_indicator</i>
                      <span>{task.text}</span>
                    </div>
                  {/if}
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
              {#each ordinaryValues(swapTiles) as tile}
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
                {#each ordinaryValues(editorFields) as field}
                  <div class="editor-field">
                    <i class="material-symbols-rounded editor-field-grip" aria-hidden="true">drag_indicator</i>
                    <div class="editor-field-main">
                      <input class="editor-question-input" type="text" value={field.label} tabindex="-1" readonly />
                      {#if field.type === "longText"}
                        <textarea rows="3" readonly tabindex="-1">Long answer response</textarea>
                      {:else if field.options}
                        <div class="editor-option-stack">
                          {#each ordinaryValues(field.options) as option}
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
            itemId="gallery-todo-root"
            config={{ animation: defaultAnimations, direction: "column", callbacks: todoCallbacks }}
          >
            {#each todoItems.entries as entry (entry.itemId)}
              {#if entry.isGhost}
                <Ghost ghost={entry.ghost} />
              {:else}
              <Item itemId={entry.itemId}>
                <div class="project-card" class:checked={entry.value.checked}>
                  <Handle className="project-drag-handle">
                    <i class="material-symbols-rounded" aria-hidden="true">drag_indicator</i>
                  </Handle>
                  <label>
                    <input
                      type="checkbox"
                      checked={entry.value.checked}
                      onchange={(event) => setTodoChecked(entry.itemId, event.currentTarget.checked)}
                    />
                    <span></span>
                  </label>
                  <span class="project-text">{entry.value.text}</span>
                  <div class="project-meta" aria-label="Task metadata">
                    <span class="project-meta-item">
                      <i class="material-symbols-rounded" aria-hidden="true">schedule</i>
                      {entry.value.due}
                    </span>
                  </div>
                </div>
              </Item>
              {/if}
            {/each}
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
            itemId="gallery-kanban-root"
            config={{
              animation: defaultAnimations,
              direction: "row",
              name: "kanban-root",
              callbacks: kanbanCallbacks,
            }}
            locked={true}
          >
            {#each kanbanColumns.entries as entry (entry.itemId)}
              {#if entry.isGhost}
                <Ghost ghost={entry.ghost} />
              {:else if entry.childTree && "title" in entry.value}
              <Container
                className="kanban-column"
                itemId={entry.itemId}
                config={{
                  animation: defaultAnimations,
                  direction: "column",
                  name: entry.itemId,
                  ...({ onClickAction: { action: "moveTo", target: entry.value.target } } as object),
                }}
                locked={true}
                metadata={{ columnId: entry.itemId }}
              >
                <h4>{entry.value.title}</h4>
                {#each entry.childTree.entries as child (child.itemId)}
                  {#if child.isGhost}
                    <Ghost ghost={child.ghost} />
                  {:else if child.childTree}
                    <Container itemId={child.itemId} />
                  {:else if "text" in child.value}
                  <Item itemId={child.itemId}>
                    <div class="kanban-card">
                      <div class="kanban-header">
                        <span class="kanban-title">{child.value.text}</span>
                        <span class="kanban-tag">{child.value.tag}</span>
                      </div>
                      <p class="kanban-desc">{child.value.desc}</p>
                      <div class="kanban-footer">
                        <span
                          class="kanban-avatar"
                          style={`--avatar-color: ${child.value.avatarColor};`}
                          title={child.value.assignee}
                          aria-label={child.value.assignee}
                        >
                          {child.value.avatar}
                        </span>
                        <div class="kanban-meta" aria-label="Task metadata">
                          <span class="kanban-meta-item">
                            <i class="material-symbols-rounded" aria-hidden="true">event</i>
                            {child.value.due}
                          </span>
                          <span class="kanban-meta-item">
                            <i class="material-symbols-rounded" aria-hidden="true">forum</i>
                            {child.value.activity}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Item>
                  {/if}
                {/each}
              </Container>
              {:else}
                <Item itemId={entry.itemId}>{entry.itemId}</Item>
              {/if}
            {/each}
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
              itemId="gallery-sentence-root"
              className="sentence-workspace-root"
              config={{
                animation: defaultAnimations,
                mode: "progressive",
                direction: "column",
                name: "sentence-root",
                callbacks: sentenceCallbacks,
              }}
              locked={true}
            >
              {#each sentenceTiles.entries as entry (entry.itemId)}
                {#if entry.isGhost}
                  <Ghost ghost={entry.ghost} />
                {:else if entry.childTree && "zone" in entry.value && entry.value.zone === "answer"}
                  <Container
                    className="sentence-drop-zone"
                    itemId={entry.itemId}
                    bind:container={sentenceAnswerContainer}
                    config={{
                      mode: "progressive",
                      direction: "row",
                      name: "sentence-target",
                      animation: {
                        reorder: sentenceAnimation,
                        drop: sentenceAnimation,
                        move: sentenceAnimation,
                      },
                      callbacks: {
                        getDropPriority: prioritizeIntersectingContainer,
                      },
                    }}
                    locked={true}
                    metadata={{ zone: "answer" }}
                  >
                    {#each entry.childTree.entries as child (child.itemId)}
                      {#if child.isGhost}
                        <Ghost ghost={child.ghost}>
                          <button type="button" class="word-card sentence-word sentence-tile-ghost selected" tabindex="-1">
                            {sentenceGhostTileText(child.ghost.original.itemId)}
                          </button>
                        </Ghost>
                      {:else if child.childTree}
                        <Container itemId={child.itemId} />
                      {:else if "text" in child.value}
                      <Item itemId={child.itemId} className="sentence-tile-wrapper">
                        <button
                          type="button"
                          class="word-card sentence-word selected"
                          onpointerdown={handleSentenceTilePointerDown}
                          onpointermove={handleSentenceTilePointerMove}
                          onclick={(event) => handleSentenceTileClick(event, () => moveSentenceTileToZone(child.value, "bank"))}
                          aria-label={`Move ${child.value.text} to bank`}
                        >
                          {child.value.text}
                        </button>
                      </Item>
                      {/if}
                    {/each}
                  </Container>
                {:else if entry.childTree && "zone" in entry.value}
                  <Container
                    className="sentence-source-zone"
                    itemId={entry.itemId}
                    bind:container={sentenceBankContainer}
                    config={{
                      mode: "progressive",
                      direction: "row",
                      mainAxisAlign: "center",
                      name: "sentence-source",
                      animation: {
                        reorder: sentenceAnimation,
                        drop: sentenceAnimation,
                        move: sentenceAnimation,
                      },
                      callbacks: {
                        getDropPriority: prioritizeIntersectingContainer,
                      },
                    }}
                    locked={true}
                    metadata={{ zone: "bank" }}
                  >
                    {#each entry.childTree.entries as child (child.itemId)}
                      {#if child.isGhost}
                        <Ghost ghost={child.ghost}>
                          <button type="button" class="word-card sentence-word sentence-tile-ghost" tabindex="-1">
                            {sentenceGhostTileText(child.ghost.original.itemId)}
                          </button>
                        </Ghost>
                      {:else if child.childTree}
                        <Container itemId={child.itemId} />
                      {:else if "text" in child.value}
                      <Item itemId={child.itemId} className="sentence-tile-wrapper">
                        <button
                          type="button"
                          class="word-card sentence-word"
                          onpointerdown={handleSentenceTilePointerDown}
                          onpointermove={handleSentenceTilePointerMove}
                          onclick={(event) => handleSentenceTileClick(event, () => moveSentenceTileToZone(child.value, "answer"))}
                          aria-label={`Move ${child.value.text} to answer`}
                        >
                          {child.value.text}
                        </button>
                      </Item>
                      {/if}
                    {/each}
                  </Container>
                {/if}
              {/each}
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
            the palette stays stocked. Built from a normal move, source
            backfill, and a <code>preview</code> drag visual.
          </p>
          <ExhibitSource href={data.sourceLinks["clone-palette"]} label="Clone Palette" />
        </div>
        <div class="clone-workspace">
          <Container
            itemId="gallery-clone-root"
            className="clone-root"
            config={{
              animation: defaultAnimations,
              direction: "row",
              name: "clone-root",
              callbacks: cloneCallbacks,
            }}
            locked={true}
          >
            {#each cloneWorkspace.entries as entry (entry.itemId)}
              {#if entry.isGhost}
              <Ghost ghost={entry.ghost} className="clone-pointer-ghost">
                {#if entry.ghost.type === "pointer-preview"}
                  {@const type = entry.ghost.original.metadata.blockType as PaletteBlockType}
                  <div class="clone-block clone-block-{type} clone-pointer-preview">
                    <i class="material-symbols-rounded" aria-hidden="true">{blockIcon[type]}</i>
                    <span>{blockLabel[type]}</span>
                  </div>
                {/if}
              </Ghost>
              {:else if entry.childTree && "zone" in entry.value && entry.value.zone === "palette"}
                <Container
                  className="clone-palette"
                  itemId={entry.itemId}
                  config={{
                    animation: defaultAnimations,
                    direction: "column",
                    name: "clone-palette",
                    callbacks: {
                      canDrop: rejectDrop,
                    },
                  }}
                  locked={true}
                  metadata={{ copyZone: "palette" }}
                >
                  {#each entry.childTree.entries as child (child.itemId)}
                    {#if child.isGhost}
                      <Ghost ghost={child.ghost} className="clone-pointer-ghost">
                        {#if child.ghost.type === "pointer-preview"}
                          {@const type = child.ghost.original.metadata.blockType as PaletteBlockType}
                          <div class="clone-block clone-block-{type} clone-pointer-preview">
                            <i class="material-symbols-rounded" aria-hidden="true">{blockIcon[type]}</i>
                            <span>{blockLabel[type]}</span>
                          </div>
                        {/if}
                      </Ghost>
                    {:else if child.childTree}
                      <Container itemId={child.itemId} />
                    {:else if "template" in child.value}
                    <Item
                      itemId={child.itemId}
                      metadata={{ blockType: child.value.type, template: true }}
                    >
                      <div class="clone-block clone-block-{child.value.type} clone-palette-block">
                        <i class="material-symbols-rounded" aria-hidden="true">{child.value.icon}</i>
                        <span>{child.value.label}</span>
                      </div>
                    </Item>
                    {/if}
                  {/each}
                </Container>
              {:else if entry.childTree && "zone" in entry.value}
                <Container
                  className="clone-canvas"
                  itemId={entry.itemId}
                  config={{
                    animation: defaultAnimations,
                    direction: "column",
                    name: "clone-canvas",
                    callbacks: {
                      getDropPriority: prioritizeIntersectingContainer,
                    },
                  }}
                  locked={true}
                  metadata={{ copyZone: "canvas" }}
                >
                  {#if ordinaryValues(entry.childTree).length === 0}
                    <p class="clone-canvas-empty">Drop blocks here</p>
                  {/if}
                  {#each entry.childTree.entries as child (child.itemId)}
                    {#if child.isGhost}
                      <Ghost ghost={child.ghost} className="clone-pointer-ghost">
                        {#if child.ghost.type === "pointer-preview"}
                          {@const type = child.ghost.original.metadata.blockType as PaletteBlockType}
                          <div class="clone-block clone-block-{type} clone-pointer-preview">
                            <i class="material-symbols-rounded" aria-hidden="true">{blockIcon[type]}</i>
                            <span>{blockLabel[type]}</span>
                          </div>
                        {/if}
                      </Ghost>
                    {:else if child.childTree}
                      <Container itemId={child.itemId} />
                    {:else if "template" in child.value}
                    <Item
                      itemId={child.itemId}
                      metadata={{ blockType: child.value.type, template: false }}
                    >
                      <div class="clone-block clone-block-{child.value.type} clone-canvas-block">
                        <i class="material-symbols-rounded" aria-hidden="true">{blockIcon[child.value.type]}</i>
                        <span>{blockLabel[child.value.type]}</span>
                        <button
                          type="button"
                          class="clone-block-remove"
                          aria-label={`Remove ${blockLabel[child.value.type]}`}
                          onpointerdown={(event) => event.stopPropagation()}
                          onclick={(event) => {
                            event.stopPropagation();
                            removeCanvasBlock(child.itemId);
                          }}
                        >
                          <i class="material-symbols-rounded" aria-hidden="true">close</i>
                        </button>
                      </div>
                    </Item>
                    {/if}
                  {/each}
                </Container>
              {/if}
            {/each}
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
            itemId="gallery-trash-root"
            className="trash-root"
            config={{
              animation: defaultAnimations,
              direction: "column",
              name: "trash-root",
              callbacks: trashCallbacks,
            }}
            locked={true}
          >
            {#each trashTasks.entries as entry (entry.itemId)}
              {#if entry.isGhost}
                <Ghost ghost={entry.ghost} />
              {:else if entry.childTree && "zone" in entry.value && entry.value.zone === "list"}
                <Container
                  className="trash-list"
                  itemId={entry.itemId}
                  config={{
                    animation: defaultAnimations,
                    direction: "column",
                    name: "trash-list",
                  }}
                  locked={true}
                >
                  {#each entry.childTree.entries as child (child.itemId)}
                    {#if child.isGhost}
                      <Ghost ghost={child.ghost} />
                    {:else if child.childTree}
                      <Container itemId={child.itemId} />
                    {:else if "text" in child.value}
                    <Item itemId={child.itemId}>
                      <div class="trash-task">
                        <i class="material-symbols-rounded trash-task-grip" aria-hidden="true">drag_indicator</i>
                        <span>{child.value.text}</span>
                      </div>
                    </Item>
                    {/if}
                  {/each}
                </Container>
              {:else if entry.childTree && "zone" in entry.value}
                <div class="trash-zone" class:trash-zone-active={trashHovered}>
                  <Container
                    className="trash-drop-target"
                    itemId={entry.itemId}
                    config={{
                      animation: defaultAnimations,
                      direction: "column",
                      name: "trash-bin",
                      callbacks: {
                        getDropPriority: prioritizeIntersectingContainer,
                      },
                    }}
                    locked={true}
                    metadata={{ role: "trash" }}
                  >
                    <div class="trash-zone-content">
                      <i class="material-symbols-rounded" aria-hidden="true">delete</i>
                      <span>Drop to delete</span>
                    </div>
                    {#each entry.childTree.entries as child (child.itemId)}
                      {#if child.isGhost}
                        <Ghost ghost={child.ghost} />
                      {:else if child.childTree}
                        <Container itemId={child.itemId} />
                      {:else if "text" in child.value}
                        <Item itemId={child.itemId}>{child.value.text}</Item>
                      {/if}
                    {/each}
                  </Container>
                </div>
              {/if}
            {/each}
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
            itemId="gallery-swap-root"
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
              callbacks: swapCallbacks,
            }}
            locked={true}
          >
            {#each swapTiles.entries as entry (entry.itemId)}
              {#if entry.isGhost}
                {@const tile = swapGhostTile(entry.ghost.original.itemId)}
                {#if tile}
                  <Ghost
                    ghost={entry.ghost}
                    className="swap-tile card swap-tile-ghost"
                    style={`--tile-color: ${tile.color};`}
                  >
                      <span class="swap-tile-grip" aria-hidden="true">
                        <i></i><i></i><i></i><i></i><i></i><i></i>
                      </span>
                      <span class="swap-tile-label">{tile.label}</span>
                  </Ghost>
                {/if}
              {:else}
              <Item itemId={entry.itemId} metadata={{ color: entry.value.color, label: entry.value.label }}>
                <div
                  class="swap-tile card"
                  class:swap-tile-hovered={swapHoveredId === entry.itemId}
                  style={`--tile-color: ${entry.value.color};`}
                >
                  <span class="swap-tile-grip" aria-hidden="true">
                    <i></i>
                    <i></i>
                    <i></i>
                    <i></i>
                    <i></i>
                    <i></i>
                  </span>
                  <span class="swap-tile-label">{entry.value.label}</span>
                </div>
              </Item>
              {/if}
            {/each}
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
              itemId="gallery-editor-fields-root"
              className="editor-field-list"
              config={{ animation: defaultAnimations, direction: "column", callbacks: editorFieldCallbacks }}
            >
              {#each editorFields.entries as entry (entry.itemId)}
                {#if entry.isGhost}
                  <Ghost ghost={entry.ghost} />
                {:else}
                <Item itemId={entry.itemId}>
                  <div class="editor-field">
                    <Handle className="editor-field-handle">
                      <i class="material-symbols-rounded editor-field-grip" aria-hidden="true">drag_indicator</i>
                    </Handle>
                    <div class="editor-field-main">
                      <input
                        class="editor-question-input"
                        type="text"
                        value={entry.value.label}
                        aria-label="Question text"
                        oninput={(event) =>
                          updateEditorFieldLabel(entry.itemId, event.currentTarget.value)}
                        onpointerdown={(event) => event.stopPropagation()}
                        onclick={(event) => event.stopPropagation()}
                      />
                      {#if entry.value.type === "shortText"}
                        <input id={entry.itemId} type="text" value="Short answer" readonly tabindex="-1" />
                      {:else if entry.value.type === "longText"}
                        <textarea id={entry.itemId} rows="3" readonly tabindex="-1">Long answer response</textarea>
                      {:else if entry.value.type === "multipleChoice" || entry.value.type === "checkboxes" || entry.value.type === "dropdown"}
                        {@render editorOptions(entry.value)}
                      {:else if entry.value.type === "date"}
                        <input id={entry.itemId} type="date" tabindex="-1" />
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
                {/if}
              {/each}
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

  .clone-workspace :global(.clone-pointer-ghost) {
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: 0 10px 28px rgba(26, 31, 34, 0.18);
  }

  .clone-pointer-preview {
    width: 132px;
    box-sizing: border-box;
    pointer-events: none;
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
