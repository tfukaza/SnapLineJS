<script lang="ts">
  import type { Engine } from "@snap-engine/core";
  import {
    Container,
    Ghost,
    Item,
  } from "@snap-engine/snapsort/svelte";
  import SnapButton from "$lib/components/SnapButton.svelte";
  import {
    DROP_REJECT_PRIORITY,
    createRenderEntries,
    createRenderEntry,
    createRenderTree,
    reduceRenderTree,
  } from "@snap-engine/snapsort";
  import type {
    Container as SnapSortContainer,
    ContainerCallbacks,
    DragEndEvent,
    DragStartEvent,
    DropPriorityEvent,
    ItemMoveEvent,
    RenderTree,
    RenderTreeEvent,
  } from "@snap-engine/snapsort";
  import {
    prioritizePointerContainer,
    rejectDrop,
  } from "@snap-engine/snapsort/callbacks";
  import { getContext, onMount, untrack } from "svelte";
  import toucanUrl from "$lib/assets/gallery/toucan.svg?url";
  import GalleryVirtualPointer from "./GalleryVirtualPointer.svelte";
  import {
    VirtualPointerController,
    type VirtualPointerPoint,
  } from "./virtual-pointer";

  type LessonZone = "answer" | "bank";

  type LessonTile = {
    kind: "tile";
    id: string;
    text: string;
    distractor?: boolean;
  };

  type LessonSlot = {
    kind: "slot";
    tileId: string;
    text: string;
  };

  type LessonValue =
    | LessonTile
    | LessonSlot
    | { kind: "zone"; zone: LessonZone };
  type LessonPhase =
    | "waiting"
    | "drafting"
    | "hesitating"
    | "returning"
    | "reordering"
    | "finishing"
    | "checking"
    | "complete"
    | "resetting";
  type LessonCheckState = "idle" | "correct" | "incorrect";

  const LESSON_TILES = [
    { kind: "tile", id: "lesson-exists", text: "あります" },
    {
      kind: "tile",
      id: "lesson-very",
      text: "とても",
      distractor: true,
    },
    { kind: "tile", id: "lesson-usage", text: "使い方" },
    { kind: "tile", id: "lesson-this", text: "この" },
    {
      kind: "tile",
      id: "lesson-new",
      text: "新しい",
      distractor: true,
    },
    { kind: "tile", id: "lesson-subject", text: "が" },
    { kind: "tile", id: "lesson-library", text: "ライブラリ" },
    { kind: "tile", id: "lesson-many", text: "多く" },
    {
      kind: "tile",
      id: "lesson-useful",
      text: "便利な",
      distractor: true,
    },
    { kind: "tile", id: "lesson-context", text: "には" },
    { kind: "tile", id: "lesson-link", text: "の" },
  ] satisfies readonly LessonTile[];

  const CORRECT_TILE_IDS = [
    "lesson-this",
    "lesson-library",
    "lesson-context",
    "lesson-many",
    "lesson-link",
    "lesson-usage",
    "lesson-subject",
    "lesson-exists",
  ] as const;

  const TILE_BY_ID = new Map(
    LESSON_TILES.map((tile) => [tile.id, tile] as const),
  );
  const CORRECT_TILE_ID_SET = new Set<string>(CORRECT_TILE_IDS);
  const CORRECT_ANSWER_ORDER = CORRECT_TILE_IDS.join(",");
  const IMPERFECT_DRAFT_IDS = [
    "lesson-this",
    "lesson-new",
    "lesson-library",
    "lesson-link",
    "lesson-many",
    "lesson-context",
  ] as const;
  const IMPERFECT_DRAFT_ORDER = IMPERFECT_DRAFT_IDS.join(",");
  const DRAFT_WITHOUT_DISTRACTOR_ORDER = IMPERFECT_DRAFT_IDS.filter(
    (tileId) => tileId !== "lesson-new",
  ).join(",");
  const CORRECTED_DRAFT_ORDER = [
    "lesson-this",
    "lesson-library",
    "lesson-context",
    "lesson-many",
    "lesson-link",
  ].join(",");
  const DRAFT_CORRECTIONS = [
    {
      tileId: "lesson-context",
      targetTileId: "lesson-link",
      targetIndex: 2,
      expectedOrder:
        "lesson-this,lesson-library,lesson-context,lesson-link,lesson-many",
    },
    {
      tileId: "lesson-many",
      targetTileId: "lesson-context",
      targetIndex: 2,
      expectedOrder:
        "lesson-this,lesson-library,lesson-many,lesson-context,lesson-link",
    },
    {
      tileId: "lesson-context",
      targetTileId: "lesson-many",
      targetIndex: 2,
      expectedOrder: CORRECTED_DRAFT_ORDER,
    },
  ] as const;
  const FINISHING_TILE_IDS = [
    "lesson-usage",
    "lesson-subject",
    "lesson-exists",
  ] as const;
  const LESSON_VIRTUAL_POINTER_ID = 2_000_000_003;
  const LESSON_MANUAL_RESUME_MS = 8_000;
  // Presentation holds are deliberate; input readiness is state-gated.
  const LESSON_INITIAL_PAUSE_MS = 420;
  const LESSON_CURSOR_APPROACH_MS = 360;
  const LESSON_CLICK_HOLD_MS = 80;
  const LESSON_TILE_INTERVAL_MS = 180;
  const LESSON_DRAFT_CURSOR_APPROACH_MS = 110;
  const LESSON_DRAFT_CLICK_HOLD_MS = 45;
  const LESSON_DRAFT_TILE_INTERVAL_MS = 35;
  const LESSON_HESITATION_MS = 620;
  const LESSON_CORRECTION_HOLD_MS = 360;
  const LESSON_RETURN_DRAG_DURATION_MS = 760;
  const LESSON_DRAG_DURATION_MS = 680;
  const LESSON_CHECK_APPROACH_MS = 460;
  const LESSON_TILE_MOVE_MS = 420;
  const LESSON_COMPLETE_HOLD_MS = 1_300;
  const LESSON_RESET_FADE_MS = 180;
  const LESSON_RESET_SETTLE_MS = 220;
  const LESSON_INITIAL_CURSOR_RIGHT_INSET = 32;
  const TILE_ANIMATION = {
    duration: LESSON_TILE_MOVE_MS,
    timing_function: "cubic-bezier(0.22, 1, 0.36, 1)",
  };
  const ZONE_ANIMATIONS = {
    reorder: TILE_ANIMATION,
    drop: TILE_ANIMATION,
    move: TILE_ANIMATION,
  };

  function requireGalleryEngine(): Engine {
    const engine = getContext<Engine | null>("engine");
    if (!engine) {
      throw new Error("Toucan lesson must be rendered inside SnapEngine.");
    }
    return engine;
  }

  const galleryEngine = requireGalleryEngine();

  function orderedTiles(ids: readonly string[]) {
    return ids.flatMap((id) => {
      const tile = TILE_BY_ID.get(id);
      return tile ? [{ ...tile }] : [];
    });
  }

  function createSlot(tile: LessonTile): LessonSlot {
    return { kind: "slot", tileId: tile.id, text: tile.text };
  }

  function slotId(tileId: string) {
    return `lesson-slot-${tileId}`;
  }

  function createLessonTree(completed = false) {
    const answerTiles = completed ? orderedTiles(CORRECT_TILE_IDS) : [];
    const bankSlots = LESSON_TILES.map((tile) =>
      createRenderEntry<LessonValue>(
        createSlot(tile),
        slotId(tile.id),
        createRenderTree(
          completed && CORRECT_TILE_ID_SET.has(tile.id)
            ? []
            : [
                createRenderEntry<LessonValue>(
                  { ...tile },
                  tile.id,
                ),
              ],
        ),
      ),
    );

    return createRenderTree<LessonValue>([
      createRenderEntry(
        { kind: "zone", zone: "answer" },
        "toucan-zone-answer",
        createRenderTree(
          createRenderEntries<LessonValue>(answerTiles, getValueId),
        ),
      ),
      createRenderEntry(
        { kind: "zone", zone: "bank" },
        "toucan-zone-bank",
        createRenderTree(bankSlots),
      ),
    ]);
  }

  function getValueId(value: LessonValue) {
    if (value.kind === "tile") return value.id;
    if (value.kind === "slot") return slotId(value.tileId);
    return `toucan-zone-${value.zone}`;
  }

  let tree = $state.raw(createLessonTree());
  let answerContainer = $state<SnapSortContainer | null>(null);
  let bankContainer = $state<SnapSortContainer | null>(null);
  let slotContainers = $state<Record<string, SnapSortContainer | null>>(
    Object.fromEntries(LESSON_TILES.map((tile) => [tile.id, null])),
  );
  let demoElement = $state<HTMLDivElement | null>(null);
  let cursorElement = $state<HTMLDivElement | null>(null);
  let lessonPhase = $state<LessonPhase>("waiting");
  let lessonCheckState = $state<LessonCheckState>("idle");
  let documentVisible = $state(true);
  let prefersReducedMotion = $state(false);
  let manualInteraction = $state(false);
  let automationController: AbortController | null = null;
  let pendingAutomationRestart: AbortController | null = null;
  let manualResumeTimer: number | null = null;
  let dragClickGuardTileId: string | null = null;
  let dragClickGuardTimer: number | null = null;
  let lastDropTargetIndex = $state<number | null>(null);
  let lastDropIndex = $state<number | null>(null);
  let lastDropItemId = $state<string | null>(null);
  let startedDragPointerId: number | null = null;
  let startedDragItemId: string | null = null;
  let dragEnded = false;

  function zoneTileOrder(zone: LessonZone, sourceTree = tree) {
    const entries = zoneTreeFrom(sourceTree, zone)?.entries ?? [];
    if (zone === "answer") {
      return entries.flatMap((entry) =>
        entry.isGhost || entry.value.kind !== "tile" ? [] : [entry.itemId],
      );
    }

    return entries.flatMap((slot) => {
      if (
        slot.isGhost ||
        slot.value.kind !== "slot" ||
        !slot.childTree
      ) {
        return [];
      }
      return slot.childTree.entries.flatMap((entry) =>
        entry.isGhost || entry.value.kind !== "tile" ? [] : [entry.itemId],
      );
    });
  }

  function zoneTreeFrom(
    sourceTree: RenderTree<LessonValue>,
    zone: LessonZone,
  ): RenderTree<LessonValue> | null {
    const entry = sourceTree.entries.find(
      (candidate) =>
        !candidate.isGhost &&
        candidate.value.kind === "zone" &&
        candidate.value.zone === zone,
    );
    return entry && !entry.isGhost ? entry.childTree : null;
  }

  const answerOrder = $derived(zoneTileOrder("answer").join(","));
  const bankOrder = $derived(zoneTileOrder("bank").join(","));
  const answerLength = $derived(zoneTileOrder("answer").length);
  const answerIsCorrect = $derived(answerOrder === CORRECT_ANSWER_ORDER);
  const checkButtonLabel = $derived(
    lessonCheckState === "correct"
      ? "Correct!"
      : lessonCheckState === "incorrect"
        ? "Try again"
        : "Check",
  );
  const autoplayActive = $derived(documentVisible && !prefersReducedMotion);
  const lessonContainersReady = $derived(
    LESSON_TILES.every((tile) => slotContainers[tile.id] !== null),
  );
  const directAutoplayActive = $derived(autoplayActive && !manualInteraction);
  const renderedPhase = $derived(
    prefersReducedMotion ? "reduced" : lessonPhase,
  );

  function handleRenderEvent(event: RenderTreeEvent) {
    tree = reduceRenderTree(tree, event);
  }

  function resumeLessonAutomation() {
    if (
      answerContainer?.dragSession != null ||
      bankContainer?.dragSession != null
    ) {
      manualResumeTimer = window.setTimeout(resumeLessonAutomation, 250);
      return;
    }
    manualResumeTimer = null;
    resetLessonState(false);
    manualInteraction = false;
  }

  function takeManualControl() {
    manualInteraction = true;
    stopLessonAutomation();
    if (manualResumeTimer !== null) window.clearTimeout(manualResumeTimer);
    manualResumeTimer = window.setTimeout(
      resumeLessonAutomation,
      LESSON_MANUAL_RESUME_MS,
    );
  }

  function handleItemMove(event: ItemMoveEvent) {
    const destinationSlot = slotContainerFor(event.itemId);
    const resolvedEvent =
      event.to.container === bankContainer && destinationSlot
        ? {
            ...event,
            to: {
              container: destinationSlot,
              containerMetadata: destinationSlot.metadata,
              index: 0,
            },
            beforeElement: null,
          }
        : event;
    const nextTree = reduceRenderTree(tree, resolvedEvent);
    tree = nextTree;
    lessonCheckState = "idle";
    if (manualInteraction) {
      lessonPhase =
        zoneTileOrder("answer", nextTree).join(",") === CORRECT_ANSWER_ORDER
          ? "complete"
          : "drafting";
    }
  }

  function handleDragStart(event: DragStartEvent) {
    if (event.itemMetadata.kind !== "lesson-tile") return false;
    startedDragPointerId = event.session.pointerId;
    startedDragItemId = String(event.itemId);
    dragClickGuardTileId = event.itemId;
    if (dragClickGuardTimer !== null) {
      window.clearTimeout(dragClickGuardTimer);
      dragClickGuardTimer = null;
    }
    if (event.session.pointerId !== LESSON_VIRTUAL_POINTER_ID) {
      takeManualControl();
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    dragEnded = true;
    lastDropItemId = String(event.itemId);
    lastDropIndex =
      event.destination?.container === answerContainer
        ? event.destination.index
        : null;
    const tileId = event.itemId;
    if (dragClickGuardTimer !== null) {
      window.clearTimeout(dragClickGuardTimer);
    }
    dragClickGuardTimer = window.setTimeout(() => {
      if (dragClickGuardTileId === tileId) dragClickGuardTileId = null;
      dragClickGuardTimer = null;
    }, 50);
  }

  function slotDropCallbacks(tileId: string): ContainerCallbacks {
    return {
      getDropPriority(event: DropPriorityEvent) {
        if (event.itemId !== tileId) return DROP_REJECT_PRIORITY;
        const returningToSource = event.source?.container === event.container;
        const hasTile = event.container.itemOrderedList.some(
          (item) => !item.isGhost,
        );
        if (hasTile && !returningToSource) {
          return DROP_REJECT_PRIORITY;
        }
        return prioritizePointerContainer(event) ?? DROP_REJECT_PRIORITY;
      },
    };
  }

  function slotContainsTile(slotTree: RenderTree<LessonValue>) {
    return slotTree.entries.some(
      (entry) => !entry.isGhost && entry.value.kind === "tile",
    );
  }

  function slotContainerFor(tileId: string) {
    return slotContainers[tileId] ?? null;
  }

  function prioritizeBankReturn(event: DropPriorityEvent) {
    if (event.itemMetadata.kind !== "lesson-tile") {
      return DROP_REJECT_PRIORITY;
    }
    return prioritizePointerContainer(event) ?? DROP_REJECT_PRIORITY;
  }

  function prioritizeAnswer(event: DropPriorityEvent) {
    if (event.itemMetadata.kind !== "lesson-tile") {
      return DROP_REJECT_PRIORITY;
    }
    const answerBottom = event.containerRect.y + event.containerRect.height;
    if (event.pointer.y >= answerBottom) return DROP_REJECT_PRIORITY;
    return prioritizePointerContainer(event) ?? DROP_REJECT_PRIORITY;
  }

  const rootCallbacks = {
    onItemMove: handleItemMove,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onGhostInsert: handleRenderEvent,
    onGhostMove: handleRenderEvent,
    onGhostRemove: handleRenderEvent,
    onDropTargetChange(event) {
      lastDropTargetIndex =
        event.current?.container === answerContainer
          ? event.current.index
          : null;
    },
    getDropPriority: rejectDrop,
  } satisfies ContainerCallbacks;

  function resetLessonState(completed: boolean) {
    tree = createLessonTree(completed);
    lessonPhase = completed ? "complete" : "waiting";
    lessonCheckState = "idle";
  }

  function handleCheckPointerDown(event: PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleLessonCheck(event: MouseEvent) {
    event.stopPropagation();
    if (event.isTrusted) {
      takeManualControl();
    }
    lessonCheckState = answerIsCorrect ? "correct" : "incorrect";
    lessonPhase = answerIsCorrect ? "complete" : "drafting";
  }

  function queryLessonElement(selector: string): HTMLElement {
    const element = demoElement?.querySelector<HTMLElement>(selector);
    if (!element) {
      throw new Error(
        `Toucan lesson automation target is missing: ${selector}`,
      );
    }
    return element;
  }

  function tileButton(tileId: string, zone: LessonZone): HTMLElement {
    return queryLessonElement(
      `[data-lesson-tile-id="${tileId}"][data-lesson-zone="${zone}"]`,
    );
  }

  function checkButton(): HTMLElement {
    return queryLessonElement("button.lesson-check-button");
  }

  function initialCursorPoint(): VirtualPointerPoint {
    if (!demoElement) {
      throw new Error("Toucan lesson is not mounted.");
    }
    return {
      x:
        demoElement.scrollLeft +
        Math.max(
          0,
          demoElement.clientWidth - LESSON_INITIAL_CURSOR_RIGHT_INSET,
        ),
      y: demoElement.scrollTop + 18,
    };
  }

  function lessonLocalPoint(x: number, y: number): VirtualPointerPoint {
    if (!demoElement) {
      throw new Error("Toucan lesson is not mounted.");
    }
    const rect = demoElement.getBoundingClientRect();
    return {
      x: x - rect.left - demoElement.clientLeft + demoElement.scrollLeft,
      y: y - rect.top - demoElement.clientTop + demoElement.scrollTop,
    };
  }

  function answerReorderPoint(
    tileId: string,
    targetTileId: string,
  ): VirtualPointerPoint {
    const tileRect = tileButton(tileId, "answer").getBoundingClientRect();
    const targetRect = tileButton(
      targetTileId,
      "answer",
    ).getBoundingClientRect();
    return lessonLocalPoint(
      targetRect.left + tileRect.width / 2,
      targetRect.top + targetRect.height / 2,
    );
  }

  function bankSlotDropPoint(tileId: string): VirtualPointerPoint {
    const slotRect = queryLessonElement(
      `[data-lesson-slot-for="${tileId}"] .lesson-slot-surface`,
    ).getBoundingClientRect();
    return lessonLocalPoint(
      slotRect.left + slotRect.width / 2,
      slotRect.top + slotRect.height / 2,
    );
  }

  async function clickLessonTile(
    pointer: VirtualPointerController,
    tileId: string,
    sourceZone: LessonZone,
    expectedOrder: string,
    timing = {
      approach: LESSON_CURSOR_APPROACH_MS,
      hold: LESSON_CLICK_HOLD_MS,
      interval: LESSON_TILE_INTERVAL_MS,
    },
  ) {
    const target = () => tileButton(tileId, sourceZone);
    await pointer.moveTo(target, {
      duration: timing.approach,
      arc: sourceZone === "bank" ? 12 : -12,
    });
    await pointer.click(target, { holdDuration: timing.hold });
    await pointer.waitUntil(() => answerOrder === expectedOrder, {
      timeout: 1_200,
    });
    await pointer.wait(timing.interval);
  }

  function clearDragResult() {
    lastDropTargetIndex = null;
    lastDropIndex = null;
    lastDropItemId = null;
    startedDragPointerId = null;
    startedDragItemId = null;
    dragEnded = false;
  }

  async function activateTileDrag(
    pointer: VirtualPointerController,
    tileId: string,
    source: () => HTMLElement,
  ) {
    await pointer.press(source);
    await pointer.activateDrag();
    await pointer.waitUntil(
      () =>
        startedDragPointerId === LESSON_VIRTUAL_POINTER_ID &&
        startedDragItemId === tileId,
      { timeout: 1_200 },
    );
  }

  async function returnDraftDistractor(
    pointer: VirtualPointerController,
  ) {
    clearDragResult();
    const tileId = "lesson-new";
    const source = () => tileButton(tileId, "answer");
    // The empty slot remains stable while its tile is in the answer area.
    const destination = bankSlotDropPoint(tileId);
    await pointer.moveTo(source, {
      duration: LESSON_CURSOR_APPROACH_MS,
      arc: -12,
    });
    await activateTileDrag(pointer, tileId, source);
    await pointer.moveTo(destination, {
      duration: LESSON_RETURN_DRAG_DURATION_MS,
      arc: 0,
    });
    await pointer.release();
    await pointer.waitUntil(
      () =>
        dragEnded &&
        lastDropItemId === tileId &&
        answerOrder === DRAFT_WITHOUT_DISTRACTOR_ORDER,
      { timeout: 1_200 },
    );
  }

  async function reorderDraft(
    pointer: VirtualPointerController,
    correction: (typeof DRAFT_CORRECTIONS)[number],
  ) {
    clearDragResult();
    const source = () => tileButton(correction.tileId, "answer");
    // Sample before activation so SnapSort's animated layout cannot move the
    // cursor's destination and create a target-tracking feedback loop.
    const destination = answerReorderPoint(
      correction.tileId,
      correction.targetTileId,
    );
    await pointer.moveTo(source, {
      duration: LESSON_CURSOR_APPROACH_MS,
      arc: 10,
    });
    await activateTileDrag(pointer, correction.tileId, source);
    await pointer.moveTo(destination, {
      duration: LESSON_DRAG_DURATION_MS,
      arc: -20,
      stopWhen: () => lastDropTargetIndex === correction.targetIndex,
    });
    try {
      await pointer.waitUntil(
        () => lastDropTargetIndex === correction.targetIndex,
        { timeout: 1_200 },
      );
      await pointer.release();
      await pointer.waitUntil(
        () =>
          dragEnded &&
          lastDropItemId === correction.tileId &&
          lastDropIndex === correction.targetIndex &&
          answerOrder === correction.expectedOrder,
        { timeout: 1_200 },
      );
    } catch (error) {
      throw new Error(
        `Correction ${correction.tileId} failed at target ${lastDropTargetIndex}, drop ${lastDropIndex}, order ${answerOrder}.`,
        { cause: error },
      );
    }
  }

  async function runLessonAutomation(controller: AbortController) {
    if (!cursorElement || !demoElement) return;
    const { signal } = controller;
    const pointer = new VirtualPointerController(galleryEngine, cursorElement, {
      coordinateRoot: demoElement,
      signal,
      pointerId: LESSON_VIRTUAL_POINTER_ID,
    });

    let shouldRestart = false;
    try {
      while (!signal.aborted) {
        await pointer.waitUntil(() => answerContainer?.dragSession == null, {
          timeout: 2_000,
        });
        pointer.hide();
        resetLessonState(false);
        clearDragResult();
        lessonPhase = "resetting";
        await pointer.wait(LESSON_RESET_SETTLE_MS);
        lessonPhase = "waiting";

        await pointer.moveTo(initialCursorPoint, {
          duration: 0,
          dispatchEvent: false,
        });
        pointer.show();
        await pointer.wait(LESSON_INITIAL_PAUSE_MS);

        lessonPhase = "drafting";
        const draftIds: string[] = [];
        for (const tileId of IMPERFECT_DRAFT_IDS) {
          draftIds.push(tileId);
          await clickLessonTile(
            pointer,
            tileId,
            "bank",
            draftIds.join(","),
            {
              approach: LESSON_DRAFT_CURSOR_APPROACH_MS,
              hold: LESSON_DRAFT_CLICK_HOLD_MS,
              interval: LESSON_DRAFT_TILE_INTERVAL_MS,
            },
          );
        }
        await pointer.waitUntil(() => answerOrder === IMPERFECT_DRAFT_ORDER);

        lessonPhase = "hesitating";
        await pointer.wait(LESSON_HESITATION_MS);

        lessonPhase = "returning";
        await returnDraftDistractor(pointer);
        await pointer.wait(LESSON_CORRECTION_HOLD_MS);

        lessonPhase = "reordering";
        for (const correction of DRAFT_CORRECTIONS) {
          await reorderDraft(pointer, correction);
          await pointer.wait(LESSON_CORRECTION_HOLD_MS);
        }

        lessonPhase = "finishing";
        const finishingIds = CORRECTED_DRAFT_ORDER.split(",");
        for (const tileId of FINISHING_TILE_IDS) {
          finishingIds.push(tileId);
          await clickLessonTile(
            pointer,
            tileId,
            "bank",
            finishingIds.join(","),
          );
        }
        await pointer.waitUntil(() => answerIsCorrect);

        lessonPhase = "checking";
        const submit = () => checkButton();
        await pointer.moveTo(submit, {
          duration: LESSON_CHECK_APPROACH_MS,
          arc: 18,
        });
        await pointer.click(submit, { holdDuration: LESSON_CLICK_HOLD_MS });
        await pointer.waitUntil(
          () => lessonCheckState === "correct" && lessonPhase === "complete",
          { timeout: 1_200 },
        );
        await pointer.wait(LESSON_COMPLETE_HOLD_MS);

        lessonPhase = "resetting";
        pointer.hide();
        await pointer.wait(LESSON_RESET_FADE_MS);
      }
    } catch (error) {
      if (!signal.aborted) {
        shouldRestart = true;
        console.error("Toucan lesson automation failed.", error);
      }
    } finally {
      pointer.destroy();
      if (automationController === controller) {
        automationController = null;
      }
      if (shouldRestart) queueLessonAutomationRestart();
    }
  }

  function cancelPendingAutomationRestart() {
    pendingAutomationRestart?.abort();
    pendingAutomationRestart = null;
  }

  function queueLessonAutomationRestart() {
    cancelPendingAutomationRestart();
    if (!directAutoplayActive) return;

    const controller = new AbortController();
    pendingAutomationRestart = controller;
    galleryEngine.frameController.subscribe(
      () => {
        if (pendingAutomationRestart !== controller) return;

        pendingAutomationRestart = null;
        controller.abort();
        if (
          directAutoplayActive &&
          automationController === null &&
          answerContainer !== null &&
          bankContainer !== null &&
          lessonContainersReady &&
          demoElement !== null &&
          cursorElement !== null
        ) {
          startLessonAutomation();
        }
      },
      { signal: controller.signal },
    );
  }

  function startLessonAutomation() {
    if (
      automationController ||
      !answerContainer ||
      !bankContainer ||
      !lessonContainersReady ||
      !demoElement ||
      !cursorElement
    ) {
      return;
    }
    cancelPendingAutomationRestart();
    const controller = new AbortController();
    automationController = controller;
    void runLessonAutomation(controller);
  }

  function stopLessonAutomation() {
    cancelPendingAutomationRestart();
    automationController?.abort();
    automationController = null;
  }

  function handleTileClick(
    event: MouseEvent,
    tileId: string,
    sourceZone: LessonZone,
  ) {
    if (dragClickGuardTileId === tileId) {
      event.preventDefault();
      return;
    }
    if (event.isTrusted) {
      takeManualControl();
    }

    const slotContainer = slotContainerFor(tileId);
    if (sourceZone === "bank") {
      slotContainer?.moveItem(
        tileId,
        answerContainer ?? slotContainer,
        answerLength,
      );
      return;
    }

    if (!answerContainer || !slotContainer) return;
    answerContainer.moveItem(tileId, slotContainer, 0);
  }

  $effect(() => {
    const shouldRun =
      directAutoplayActive &&
      answerContainer !== null &&
      bankContainer !== null &&
      lessonContainersReady &&
      demoElement !== null &&
      cursorElement !== null;
    if (shouldRun) {
      untrack(startLessonAutomation);
    } else {
      stopLessonAutomation();
    }

    return stopLessonAutomation;
  });

  onMount(() => {
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const syncReducedMotion = () => {
      const nextReducedMotion = reducedMotionQuery.matches;
      if (prefersReducedMotion === nextReducedMotion) return;

      prefersReducedMotion = nextReducedMotion;
      if (manualResumeTimer !== null) window.clearTimeout(manualResumeTimer);
      manualResumeTimer = null;
      manualInteraction = false;
      resetLessonState(nextReducedMotion);
    };
    const syncDocumentVisibility = () => {
      documentVisible = document.visibilityState === "visible";
    };

    syncReducedMotion();
    syncDocumentVisibility();
    reducedMotionQuery.addEventListener("change", syncReducedMotion);
    document.addEventListener("visibilitychange", syncDocumentVisibility);

    return () => {
      stopLessonAutomation();
      if (dragClickGuardTimer !== null) {
        window.clearTimeout(dragClickGuardTimer);
      }
      if (manualResumeTimer !== null) window.clearTimeout(manualResumeTimer);
      reducedMotionQuery.removeEventListener("change", syncReducedMotion);
      document.removeEventListener("visibilitychange", syncDocumentVisibility);
    };
  });
</script>

<div
  bind:this={demoElement}
  class:complete={answerIsCorrect}
  class:resetting={lessonPhase === "resetting"}
  class="toucan-lesson"
  data-lesson-active={autoplayActive}
  data-lesson-answer-order={answerOrder}
  data-lesson-bank-order={bankOrder}
  data-lesson-check-state={lessonCheckState}
  data-lesson-drop-index={lastDropIndex ?? ""}
  data-lesson-manual={manualInteraction}
  data-lesson-phase={renderedPhase}
  data-lesson-target-index={lastDropTargetIndex ?? ""}
  style={`--lesson-reset-duration: ${LESSON_RESET_FADE_MS}ms;`}
>
  <div class="lesson-scene">
    <img src={toucanUrl} alt="" class="lesson-toucan" />
    <div class="speech-bubble">
      <p>There are a lot of ways<br />you can use this library.</p>
    </div>
  </div>

  <Container
    itemId="toucan-lesson-root"
    className="toucan-workspace-root"
    config={{
      mode: "progressive",
      direction: "column",
      name: "toucan-lesson-root",
      callbacks: rootCallbacks,
    }}
    locked={true}
  >
    {#each tree.entries as entry (entry.itemId)}
      {#if entry.isGhost}
        <Ghost ghost={entry.ghost} />
      {:else if entry.childTree && entry.value.kind === "zone" && entry.value.zone === "answer"}
        <Container
          itemId={entry.itemId}
          bind:container={answerContainer}
          className="toucan-answer-zone"
          config={{
            mode: "progressive",
            direction: "row",
            name: "toucan-answer",
            animation: ZONE_ANIMATIONS,
            callbacks: { getDropPriority: prioritizeAnswer },
          }}
          locked={true}
          metadata={{ zone: "answer" }}
        >
          <span class="answer-rules" aria-hidden="true">
            <i data-answer-rule="first"></i>
            <i data-answer-rule="second"></i>
          </span>
          {#each entry.childTree.entries as child (child.itemId)}
            {#if child.isGhost}
              <Ghost ghost={child.ghost} className="lesson-tile-ghost" />
            {:else if !child.childTree && child.value.kind === "tile"}
              <Item
                itemId={child.itemId}
                className="lesson-tile-wrapper"
                metadata={{ kind: "lesson-tile", tileId: child.itemId }}
              >
                <button
                  type="button"
                  class="lesson-word"
                  data-lesson-tile-id={child.itemId}
                  data-lesson-zone="answer"
                  aria-label="Return {child.value.text} to the word bank"
                  onclick={(event) =>
                    handleTileClick(event, child.itemId, "answer")}
                >
                  {child.value.text}
                </button>
              </Item>
            {/if}
          {/each}
        </Container>
      {:else if entry.childTree && entry.value.kind === "zone"}
        <Container
          itemId={entry.itemId}
          bind:container={bankContainer}
          className="toucan-bank-zone"
          config={{
            mode: "progressive",
            direction: "row",
            mainAxisAlign: "center",
            name: "toucan-bank",
            animation: ZONE_ANIMATIONS,
            callbacks: { getDropPriority: prioritizeBankReturn },
          }}
          locked={true}
          metadata={{ zone: "bank" }}
        >
          {#each entry.childTree.entries as child (child.itemId)}
            {#if child.isGhost}
              <Ghost
                ghost={child.ghost}
                className="lesson-tile-ghost lesson-bank-target-ghost"
              />
            {:else if child.childTree && child.value.kind === "slot"}
              <Container
                itemId={child.itemId}
                bind:container={slotContainers[child.value.tileId]}
                className="lesson-bank-slot"
                config={{
                  mode: "progressive",
                  direction: "row",
                  name: child.itemId,
                  animation: ZONE_ANIMATIONS,
                  callbacks: slotDropCallbacks(child.value.tileId),
                }}
                locked={true}
                metadata={{ zone: "bank-slot", tileId: child.value.tileId }}
                data-lesson-slot-for={child.value.tileId}
              >
                <span class="lesson-slot-measure" aria-hidden="true">
                  {child.value.text}
                </span>
                <span
                  class="lesson-slot-surface"
                  aria-hidden="true"
                  data-lesson-stub-for={slotContainsTile(child.childTree)
                    ? undefined
                    : child.value.tileId}
                >
                  {child.value.text}
                </span>
                {#each child.childTree.entries as slotChild (slotChild.itemId)}
                  {#if slotChild.isGhost}
                    <Ghost
                      ghost={slotChild.ghost}
                      className="lesson-tile-ghost lesson-slot-ghost"
                    />
                  {:else if !slotChild.childTree && slotChild.value.kind === "tile"}
                    <Item
                      itemId={slotChild.itemId}
                      className="lesson-slot-tile-wrapper"
                      metadata={{
                        kind: "lesson-tile",
                        tileId: slotChild.itemId,
                      }}
                    >
                      <button
                        type="button"
                        class="lesson-word"
                        data-lesson-tile-id={slotChild.itemId}
                        data-lesson-zone="bank"
                        aria-label="Add {slotChild.value.text} to the answer"
                        onclick={(event) =>
                          handleTileClick(event, slotChild.itemId, "bank")}
                      >
                        {slotChild.value.text}
                      </button>
                    </Item>
                  {/if}
                {/each}
              </Container>
            {/if}
          {/each}
        </Container>
      {/if}
    {/each}
    <div class="lesson-check-row">
      <SnapButton
        className="lesson-check-button primary"
        disabled={answerLength === 0}
        aria-live="polite"
        onpointerdown={handleCheckPointerDown}
        onclick={handleLessonCheck}
      >{checkButtonLabel}</SnapButton>
    </div>
  </Container>
  <GalleryVirtualPointer bind:element={cursorElement} />
</div>

<style>
  .toucan-lesson {
    --lesson-column-gap: clamp(16px, 3cqi, 28px);
    --lesson-top-gap: clamp(12px, 1.5vw, 18px);

    position: relative;
    display: grid;
    width: 65%;
    height: 70%;
    min-width: 0;
    grid-template-rows: max-content minmax(0, 1fr);
    gap: var(--lesson-top-gap);
    padding: 0;
    box-sizing: border-box;
    background: inherit;
    container-type: size;
    opacity: 1;
    transition: opacity var(--lesson-reset-duration) ease;
  }

  .toucan-lesson.resetting {
    opacity: 0;
  }

  .lesson-scene {
    display: grid;
    min-height: 0;
    grid-template-columns: minmax(0, 0.42fr) minmax(0, 0.58fr);
    align-items: center;
    gap: var(--lesson-column-gap);
  }

  .lesson-toucan {
    z-index: 1;
    width: 98.4%;
    max-height: 100%;
    height: auto;
    justify-self: center;
    object-fit: contain;
    pointer-events: none;
  }

  .speech-bubble {
    position: relative;
    display: flex;
    width: fit-content;
    max-width: 100%;
    min-height: 0;
    align-items: center;
    align-self: center;
    padding: 18px 22px;
    box-sizing: border-box;
    border: 2px solid
      color-mix(in srgb, var(--color-background-dark) 52%, transparent);
    border-radius: 2.2cqi;
    background: transparent;
  }

  .speech-bubble::before,
  .speech-bubble::after {
    position: absolute;
    top: 26%;
    right: 100%;
    width: 0;
    height: 0;
    border-style: solid;
    content: "";
  }

  .speech-bubble::before {
    border-width: 1.9cqi 4.2cqi 1.9cqi 0;
    border-color: transparent
      color-mix(in srgb, var(--color-background-dark) 52%, transparent)
      transparent transparent;
  }

  .speech-bubble::after {
    margin-top: max(1px, 0.14cqi);
    margin-right: -0.18cqi;
    border-width: 1.72cqi 3.9cqi 1.72cqi 0;
    border-color: transparent #ececeb transparent transparent;
  }

  .speech-bubble p {
    width: max-content;
    max-width: 100%;
    margin: 0;
    color: var(--color-text);
    font-family: var(--font-body);
    font-size: 1.3rem;
    line-height: 1.35;
  }

  :global(.toucan-workspace-root) {
    display: grid !important;
    width: 100%;
    height: 100%;
    min-height: 0;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: max-content minmax(111px, 1fr) max-content;
    gap: 0;
    align-items: stretch !important;
  }

  :global(.toucan-answer-zone) {
    position: relative;
    display: flex !important;
    width: 100%;
    min-width: 0;
    min-height: 115px;
    height: 115px;
    flex-flow: row wrap !important;
    align-items: stretch !important;
    align-content: flex-start !important;
    justify-content: flex-start !important;
    gap: 0 0.9cqi;
    box-sizing: border-box;
    grid-row: 1;
  }

  :global(.toucan-bank-zone) {
    position: relative;
    display: flex !important;
    width: 100%;
    min-width: 0;
    min-height: 111px;
    height: 100%;
    flex-flow: row wrap !important;
    align-items: flex-start !important;
    align-content: flex-end !important;
    justify-content: center !important;
    gap: 1.2cqi;
    padding: 0 5cqi;
    box-sizing: border-box;
    grid-row: 2;
    overflow: visible;
  }

  .lesson-check-row {
    display: flex;
    width: 100%;
    grid-row: 3;
    justify-content: center;
    margin-top: clamp(12px, 2cqi, 18px);
  }

  .lesson-check-row :global(.lesson-check-button) {
    --snap-button-min-height: 42px;
    --snap-button-padding-inline: var(--size-32);

    width: min(100%, 220px);
    justify-content: stretch;
  }

  .lesson-check-row :global(.lesson-check-button .snap-button-surface) {
    width: 100%;
  }

  .lesson-check-row :global(.lesson-check-button .snap-button-content) {
    width: 100%;
    text-align: center;
  }

  .answer-rules {
    position: absolute;
    z-index: 0;
    inset: 0;
    pointer-events: none;
  }

  .answer-rules i {
    position: absolute;
    right: 0;
    left: 0;
    border-bottom: 2px solid
      color-mix(in srgb, var(--color-background-dark) 22%, transparent);
  }

  .answer-rules i:first-child {
    top: 48px;
  }

  .answer-rules i:last-child {
    top: 100px;
  }

  :global(.toucan-answer-zone > .snapsort-item) {
    z-index: 1;
    display: flex !important;
    width: auto !important;
    height: 36px;
    min-width: 0;
    flex: 0 0 auto !important;
    align-items: flex-start !important;
    justify-content: flex-start !important;
    margin: 0 0 16px !important;
    padding: 0 !important;
    box-sizing: border-box;
  }

  :global(.lesson-bank-slot) {
    position: relative !important;
    z-index: 1;
    display: flex !important;
    width: max-content !important;
    height: 52px !important;
    min-width: 0;
    flex: 0 0 auto !important;
    align-items: flex-start !important;
    justify-content: flex-start !important;
    padding: 0 0 0.55cqi !important;
    box-sizing: border-box;
    overflow: visible;
  }

  :global(.lesson-bank-slot:has([data-snapsort-dragging])) {
    z-index: 20;
  }

  .lesson-word,
  .lesson-slot-measure,
  .lesson-slot-surface {
    appearance: none;
    display: flex;
    width: max-content;
    min-width: max-content;
    align-items: center;
    justify-content: center;
    padding: 6px 12px 5px;
    box-sizing: border-box;
    border: 2px solid
      color-mix(in srgb, var(--color-background-dark) 19%, transparent);
    border-radius: 8px;
    background: var(--color-background);
    box-shadow: 0 6px 0
      color-mix(in srgb, var(--color-background-dark) 13%, #ececeb);
    color: var(--color-text);
    font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
    font-size: 1.3rem;
    font-weight: 500;
    line-height: 1;
    text-align: center;
    white-space: nowrap;
  }

  .lesson-word {
    cursor: pointer;
  }

  .lesson-slot-measure {
    visibility: hidden;
  }

  .lesson-slot-surface {
    position: absolute;
    left: 0;
    top: 6px;
    border-color: color-mix(
      in srgb,
      var(--color-background-dark) 14%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--color-background-dark) 5%,
      var(--color-background)
    );
    box-shadow: inset 0 2px 4px
      color-mix(in srgb, var(--color-background-dark) 11%, transparent);
    color: transparent;
  }

  :global(.lesson-slot-tile-wrapper) {
    position: absolute !important;
    z-index: 2;
    left: 0;
    top: 0;
    display: flex !important;
    width: auto !important;
    height: 36px !important;
    align-items: flex-start !important;
    justify-content: flex-start !important;
    padding: 0 !important;
    box-sizing: border-box;
    pointer-events: auto;
  }

  :global(.lesson-slot-ghost) {
    position: absolute !important;
    inset: 0 auto auto 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }

  :global(.lesson-bank-target-ghost) {
    position: absolute !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }

  :global(
    .gallery-engine
      .toucan-lesson
      .lesson-tile-ghost:not([data-snapsort-ghost="pointer"]):not(
        [data-snapsort-ghost="insertion"]
      )
  ) {
    border: 0 !important;
    border-radius: 8px !important;
    background: color-mix(
      in srgb,
      var(--color-background-dark) 22%,
      var(--color-background)
    ) !important;
    box-shadow: none !important;
    outline: 0 !important;
  }

  button.lesson-word:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 3px;
  }

  @container (max-width: 520px) {
    :global(.toucan-bank-zone) {
      padding-inline: 2cqi;
    }
  }

  @media (max-width: 520px) {
    .toucan-lesson {
      --lesson-column-gap: 6px;
      --lesson-top-gap: 4px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toucan-lesson {
      transition: none;
    }
  }
</style>
