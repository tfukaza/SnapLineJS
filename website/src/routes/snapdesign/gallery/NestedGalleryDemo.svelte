<script lang="ts">
  import { sessionPointerId } from "./session-pointer";
  import type { Engine } from "@snap-engine/core";
  import {
    createRenderEntries,
    createRenderEntry,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
  } from "@snap-engine/snapsort";
  import type {
    Container as SnapSortContainer,
    ContainerCallbacks,
    RenderTree,
    RenderTreeEvent,
  } from "@snap-engine/snapsort";
  import {
    Container,
    Ghost,
    Handle,
    Item,
  } from "@snap-engine/snapsort/svelte";
  import { getContext, onMount, untrack } from "svelte";
  import GalleryVirtualPointer from "./GalleryVirtualPointer.svelte";
  import {
    VirtualPointerController,
    type VirtualPointerPoint,
  } from "./virtual-pointer";

  type NestedEntry =
    | { kind: "item"; id: string; label: string }
    | { kind: "group"; id: "planning" };

  type NestedOwner = "root" | "planning";

  type NestedPhase =
    | "waiting"
    | "moving-in"
    | "inside"
    | "moving-out"
    | "outside"
    | "moving-container"
    | "complete"
    | "resetting";

  const INBOX_ID = "inbox";
  const PLANNING_ID = "planning";
  const REVIEW_ID = "review";
  const ARCHIVE_ID = "archive";
  const NESTED_VIRTUAL_POINTER_ID = 2_000_000_002;

  const NESTED_INITIAL_PAUSE_MS = 360;
  const NESTED_SOURCE_APPROACH_MS = 440;
  const NESTED_DRAG_DURATION_MS = 680;
  const NESTED_STEP_HOLD_MS = 480;
  const NESTED_COMPLETE_HOLD_MS = 900;
  const NESTED_RESET_FADE_MS = 180;
  const NESTED_RESET_SETTLE_MS = 180;
  const NESTED_INITIAL_CURSOR_RIGHT_INSET = 32;

  const NESTED_ANIMATIONS = {
    ...defaultAnimations,
    reorder: {
      duration: 240,
      timing_function: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
    drop: {
      duration: 420,
      timing_function: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
  };

  function requireGalleryEngine(): Engine {
    const engine = getContext<Engine | null>("engine");
    if (!engine) {
      throw new Error("Nested Gallery demo must be rendered inside SnapEngine.");
    }
    return engine;
  }

  const galleryEngine = requireGalleryEngine();

  function createList<T>(values: readonly T[], getId: (value: T) => string) {
    return createRenderTree(createRenderEntries(values, getId));
  }

  function createNestedTree(): RenderTree<NestedEntry> {
    return createRenderTree<NestedEntry>([
      createRenderEntry(
        { kind: "item", id: INBOX_ID, label: "Inbox" },
        INBOX_ID,
      ),
      createRenderEntry(
        { kind: "group", id: PLANNING_ID },
        PLANNING_ID,
        createList<NestedEntry>(
          [
            { kind: "item", id: "research", label: "Research" },
            { kind: "item", id: "wireframes", label: "Wireframes" },
            { kind: "item", id: REVIEW_ID, label: "Review" },
          ],
          (item) => item.id,
        ),
      ),
      createRenderEntry(
        { kind: "item", id: ARCHIVE_ID, label: "Archive" },
        ARCHIVE_ID,
      ),
    ]);
  }

  function entryOrder(tree: RenderTree<NestedEntry>): string {
    return tree.entries
      .filter((entry) => !entry.isGhost)
      .map((entry) => entry.itemId)
      .join(",");
  }

  function planningTree(tree: RenderTree<NestedEntry>): RenderTree<NestedEntry> {
    const planning = tree.entries.find(
      (entry) => !entry.isGhost && entry.itemId === PLANNING_ID,
    );
    if (!planning || planning.isGhost || !planning.childTree) {
      throw new Error("Nested Gallery Planning tree is missing.");
    }
    return planning.childTree;
  }

  let nested = $state.raw(createNestedTree());
  let rootContainer = $state<SnapSortContainer | null>(null);
  let planningContainer = $state<SnapSortContainer | null>(null);
  let demoElement = $state<HTMLDivElement | null>(null);
  let cursorElement = $state<HTMLDivElement | null>(null);
  let nestedPhase = $state<NestedPhase>("waiting");
  let documentVisible = $state(true);
  let prefersReducedMotion = $state(false);
  let lastTargetOwner = $state<NestedOwner | null>(null);
  let lastTargetIndex = $state<number | null>(null);
  let lastTargetItemId = $state<string | null>(null);
  let lastDropOwner = $state<NestedOwner | null>(null);
  let lastDropIndex = $state<number | null>(null);
  let lastDropItemId = $state<string | null>(null);
  let dragEnded = false;
  let automationController: AbortController | null = null;
  let pendingAutomationRestart: AbortController | null = null;
  let pendingStaticReset: AbortController | null = null;

  const rootOrder = $derived(entryOrder(nested));
  const childOrder = $derived(entryOrder(planningTree(nested)));
  const autoplayActive = $derived(documentVisible && !prefersReducedMotion);
  const renderedPhase = $derived(
    prefersReducedMotion ? "reduced" : nestedPhase,
  );

  function ownerForContainer(
    container: SnapSortContainer | null | undefined,
  ): NestedOwner | null {
    if (container === rootContainer) return "root";
    if (container === planningContainer) return "planning";
    return null;
  }

  function applyNestedEvent(event: RenderTreeEvent) {
    nested = reduceRenderTree(nested, event);
  }

  const nestedCallbacks = {
    onItemMove: applyNestedEvent,
    onItemRemove: applyNestedEvent,
    onGhostInsert: applyNestedEvent,
    onGhostMove: applyNestedEvent,
    onGhostRemove: applyNestedEvent,
    onDropTargetChange(event) {
      lastTargetOwner = ownerForContainer(event.current?.container);
      lastTargetIndex = event.current?.index ?? null;
      lastTargetItemId = event.current ? String(event.itemId) : null;
    },
    onDragEnd(event) {
      dragEnded = true;
      lastDropOwner = ownerForContainer(event.destination?.container);
      lastDropIndex = event.destination?.index ?? null;
      lastDropItemId = String(event.itemId);
    },
  } satisfies ContainerCallbacks;

  function clearDragResult() {
    lastTargetOwner = null;
    lastTargetIndex = null;
    lastTargetItemId = null;
    lastDropOwner = null;
    lastDropIndex = null;
    lastDropItemId = null;
    dragEnded = false;
  }

  function applyStaticNestedState() {
    nestedPhase = "waiting";
    nested = createNestedTree();
    clearDragResult();
  }

  function cancelPendingStaticReset() {
    pendingStaticReset?.abort();
    pendingStaticReset = null;
  }

  function scheduleStaticNestedState() {
    cancelPendingStaticReset();
    if (rootContainer?.dragSession == null) {
      applyStaticNestedState();
      return;
    }

    const controller = new AbortController();
    pendingStaticReset = controller;
    galleryEngine.frameController.subscribe(
      () => {
        if (rootContainer?.dragSession != null) return;
        if (pendingStaticReset !== controller) return;

        pendingStaticReset = null;
        controller.abort();
        applyStaticNestedState();
      },
      { signal: controller.signal },
    );
  }

  function queryDemoElement(selector: string): HTMLElement {
    const element = demoElement?.querySelector<HTMLElement>(selector);
    if (!element) {
      throw new Error(
        `Nested Gallery automation target is missing: ${selector}`,
      );
    }
    return element;
  }

  function itemHandle(itemId: string): HTMLElement {
    return queryDemoElement(
      `[data-nested-item-id="${itemId}"] [data-nested-item-handle]`,
    );
  }

  function containerHandle(): HTMLElement {
    return queryDemoElement("[data-nested-container-handle]");
  }

  function initialCursorPoint(): VirtualPointerPoint {
    if (!demoElement) {
      throw new Error("Nested Gallery demo is not mounted.");
    }
    return {
      x:
        demoElement.scrollLeft +
        Math.max(
          0,
          demoElement.clientWidth - NESTED_INITIAL_CURSOR_RIGHT_INSET,
        ),
      y: demoElement.scrollTop + 18,
    };
  }

  function nestedLocalPoint(x: number, y: number): VirtualPointerPoint {
    if (!demoElement) {
      throw new Error("Nested Gallery demo is not mounted.");
    }
    const rect = demoElement.getBoundingClientRect();
    return {
      x: x - rect.left - demoElement.clientLeft + demoElement.scrollLeft,
      y: y - rect.top - demoElement.clientTop + demoElement.scrollTop,
    };
  }

  function sortableElement(itemId: string): HTMLElement {
    if (itemId === PLANNING_ID) {
      return queryDemoElement(`[data-nested-container-id="${PLANNING_ID}"]`);
    }
    const row = queryDemoElement(`[data-nested-item-id="${itemId}"]`);
    const item = row.closest<HTMLElement>(".snapsort-item");
    if (!item) {
      throw new Error(`Nested Gallery item "${itemId}" has no wrapper.`);
    }
    return item;
  }

  function dragHandle(itemId: string): HTMLElement {
    return itemId === PLANNING_ID ? containerHandle() : itemHandle(itemId);
  }

  function placementDropPoint(
    sourceItemId: string,
    targetItemId: string,
    edge: "start" | "end",
    startGrabFactor = 1,
    endTargetInsetFactor = 0,
  ) {
    return () => {
      const sourceRect = sortableElement(sourceItemId).getBoundingClientRect();
      const handleRect = dragHandle(sourceItemId).getBoundingClientRect();
      const targetRect = sortableElement(targetItemId).getBoundingClientRect();
      const grabOffsetX =
        handleRect.left + handleRect.width / 2 - sourceRect.left;
      const grabOffsetY =
        handleRect.top + handleRect.height / 2 - sourceRect.top;
      return nestedLocalPoint(
        targetRect.left + grabOffsetX,
        edge === "start"
          ? targetRect.top + grabOffsetY * startGrabFactor
          : targetRect.bottom -
            targetRect.height * endTargetInsetFactor +
            grabOffsetY,
      );
    };
  }

  async function performDrag(
    pointer: VirtualPointerController,
    options: {
      itemId: string;
      source: () => HTMLElement;
      destination: () => VirtualPointerPoint;
      owner: NestedOwner;
      index: number;
      arc: number;
    },
  ) {
    clearDragResult();
    await pointer.moveTo(options.source, {
      duration: NESTED_SOURCE_APPROACH_MS,
      arc: options.arc / 2,
    });
    await pointer.press(options.source);
    await pointer.activateDrag();
    await pointer.waitUntil(
      () => {
        const session = rootContainer?.dragSession;
        return (
          session != null &&
          sessionPointerId(session) === pointer.pointerId &&
          session.primaryItem.itemId === options.itemId &&
          session.status === "active"
        );
      },
      { timeout: 1_200 },
    );
    await pointer.moveTo(options.destination, {
      duration: NESTED_DRAG_DURATION_MS,
      arc: options.arc,
    });
    await pointer.waitUntil(
      () =>
        lastTargetItemId === options.itemId &&
        lastTargetOwner === options.owner &&
        lastTargetIndex === options.index,
      { timeout: 1_200 },
    );
    await pointer.release();
    await pointer.waitUntil(
      () =>
        dragEnded &&
        lastDropItemId === options.itemId &&
        lastDropOwner === options.owner &&
        lastDropIndex === options.index,
      { timeout: 1_200 },
    );
  }

  async function runNestedAutomation(controller: AbortController) {
    if (!cursorElement || !demoElement) return;
    const { signal } = controller;
    const pointer = new VirtualPointerController(galleryEngine, cursorElement, {
      coordinateRoot: demoElement,
      signal,
      pointerId: NESTED_VIRTUAL_POINTER_ID,
    });

    let shouldRestart = false;
    try {
      while (!signal.aborted) {
        await pointer.waitUntil(() => rootContainer?.dragSession == null, {
          timeout: 2_000,
        });
        nestedPhase = "resetting";
        pointer.hide();
        nested = createNestedTree();
        clearDragResult();
        await pointer.wait(NESTED_RESET_SETTLE_MS);
        nestedPhase = "waiting";

        await pointer.moveTo(initialCursorPoint, {
          duration: 0,
          dispatchEvent: false,
        });
        pointer.show();
        await pointer.wait(NESTED_INITIAL_PAUSE_MS);

        nestedPhase = "moving-in";
        await performDrag(pointer, {
          itemId: INBOX_ID,
          source: () => itemHandle(INBOX_ID),
          destination: placementDropPoint(
            INBOX_ID,
            "research",
            "start",
            -1,
          ),
          owner: "planning",
          index: 0,
          arc: 28,
        });
        nestedPhase = "inside";
        await pointer.wait(NESTED_STEP_HOLD_MS);

        nestedPhase = "moving-out";
        await performDrag(pointer, {
          itemId: REVIEW_ID,
          source: () => itemHandle(REVIEW_ID),
          destination: placementDropPoint(
            REVIEW_ID,
            ARCHIVE_ID,
            "start",
            0,
          ),
          owner: "root",
          index: 1,
          arc: -28,
        });
        nestedPhase = "outside";
        await pointer.wait(NESTED_STEP_HOLD_MS);

        nestedPhase = "moving-container";
        await performDrag(pointer, {
          itemId: PLANNING_ID,
          source: containerHandle,
          destination: placementDropPoint(
            PLANNING_ID,
            ARCHIVE_ID,
            "end",
            1,
            0.3,
          ),
          owner: "root",
          index: 2,
          arc: 32,
        });
        nestedPhase = "complete";
        await pointer.wait(NESTED_COMPLETE_HOLD_MS);

        nestedPhase = "resetting";
        pointer.hide();
        await pointer.wait(NESTED_RESET_FADE_MS);
      }
    } catch (error) {
      if (!signal.aborted) {
        shouldRestart = true;
        console.error("Nested Gallery automation failed.", error);
      }
    } finally {
      pointer.destroy();
      if (automationController === controller) {
        automationController = null;
      }
      if (shouldRestart) queueNestedAutomationRestart();
    }
  }

  function cancelPendingAutomationRestart() {
    pendingAutomationRestart?.abort();
    pendingAutomationRestart = null;
  }

  function queueNestedAutomationRestart() {
    cancelPendingAutomationRestart();
    if (!autoplayActive) return;

    const controller = new AbortController();
    pendingAutomationRestart = controller;
    galleryEngine.frameController.subscribe(
      () => {
        if (pendingAutomationRestart !== controller) return;

        pendingAutomationRestart = null;
        controller.abort();
        if (
          autoplayActive &&
          automationController === null &&
          rootContainer !== null &&
          planningContainer !== null &&
          demoElement !== null &&
          cursorElement !== null
        ) {
          startNestedAutomation();
        }
      },
      { signal: controller.signal },
    );
  }

  function startNestedAutomation() {
    if (
      automationController ||
      !demoElement ||
      !cursorElement ||
      !rootContainer ||
      !planningContainer
    ) {
      return;
    }
    cancelPendingAutomationRestart();
    const controller = new AbortController();
    automationController = controller;
    void runNestedAutomation(controller);
  }

  function stopNestedAutomation() {
    cancelPendingAutomationRestart();
    automationController?.abort();
    automationController = null;
  }

  $effect(() => {
    const shouldRun =
      autoplayActive &&
      rootContainer !== null &&
      planningContainer !== null &&
      demoElement !== null &&
      cursorElement !== null;
    if (shouldRun) {
      untrack(startNestedAutomation);
    } else {
      stopNestedAutomation();
    }

    return stopNestedAutomation;
  });

  onMount(() => {
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const syncReducedMotion = () => {
      const nextReducedMotion = reducedMotionQuery.matches;
      if (prefersReducedMotion === nextReducedMotion) return;

      stopNestedAutomation();
      cancelPendingStaticReset();
      prefersReducedMotion = nextReducedMotion;
      scheduleStaticNestedState();
    };
    const syncDocumentVisibility = () => {
      documentVisible = document.visibilityState === "visible";
      if (!documentVisible) scheduleStaticNestedState();
    };

    syncReducedMotion();
    syncDocumentVisibility();
    reducedMotionQuery.addEventListener("change", syncReducedMotion);
    document.addEventListener("visibilitychange", syncDocumentVisibility);

    return () => {
      stopNestedAutomation();
      cancelPendingStaticReset();
      reducedMotionQuery.removeEventListener("change", syncReducedMotion);
      document.removeEventListener("visibilitychange", syncDocumentVisibility);
    };
  });
</script>

<div
  bind:this={demoElement}
  class:resetting={nestedPhase === "resetting"}
  class="nested-demo"
  data-nested-autoplay-active={autoplayActive}
  data-nested-phase={renderedPhase}
  data-nested-target-owner={lastTargetOwner ?? ""}
  data-nested-target-index={lastTargetIndex ?? ""}
  data-nested-target-item={lastTargetItemId ?? ""}
  data-nested-drop-owner={lastDropOwner ?? ""}
  data-nested-drop-index={lastDropIndex ?? ""}
  data-nested-drop-item={lastDropItemId ?? ""}
  style={`--nested-reset-duration: ${NESTED_RESET_FADE_MS}ms;`}
>
  <Container
    bind:container={rootContainer}
    itemId="gallery-nested-root"
    className="nested-root"
    metadata={{ listId: "root" }}
    config={{
      animation: NESTED_ANIMATIONS,
      direction: "column",
      callbacks: nestedCallbacks,
    }}
    data-demo="nested-containers"
    data-nested-root-order={rootOrder}
  >
    {#each nested.entries as entry (entry.itemId)}
      {#if entry.isGhost}
        <Ghost ghost={entry.ghost} className="nested-ghost" />
      {:else if entry.childTree && entry.value.kind === "group"}
        <Container
          bind:container={planningContainer}
          itemId={entry.itemId}
          locked={false}
          className="nested-child"
          metadata={{ listId: "planning" }}
          config={{ animation: NESTED_ANIMATIONS, direction: "column" }}
          data-nested-container-id={entry.itemId}
          data-nested-child-order={childOrder}
        >
          <div class="folder-heading">Planning</div>
          <Handle
            className="nested-container-handle"
            data-nested-container-handle
            aria-label="Move Planning"
          >
            <span class="handle-dots" aria-hidden="true"
              ><i></i><i></i><i></i><i></i><i></i><i></i></span
            >
          </Handle>
          {#each entry.childTree.entries as childEntry (childEntry.itemId)}
            {#if childEntry.isGhost}
              <Ghost ghost={childEntry.ghost} className="nested-ghost" />
            {:else if childEntry.value.kind === "item"}
              <Item itemId={childEntry.itemId}>
                <div
                  class="file-row child-row"
                  data-nested-item-id={childEntry.itemId}
                >
                  <span>{childEntry.value.label}</span>
                  <Handle
                    className="nested-item-handle"
                    data-nested-item-handle
                    aria-label={`Move ${childEntry.value.label}`}
                  >
                    <span class="handle-dots" aria-hidden="true"
                      ><i></i><i></i><i></i><i></i><i></i><i></i></span
                    >
                  </Handle>
                </div>
              </Item>
            {/if}
          {/each}
        </Container>
      {:else if entry.value.kind === "item"}
        <Item itemId={entry.itemId}>
          <div class="file-row" data-nested-item-id={entry.itemId}>
            <span>{entry.value.label}</span>
            <Handle
              className="nested-item-handle"
              data-nested-item-handle
              aria-label={`Move ${entry.value.label}`}
            >
              <span class="handle-dots" aria-hidden="true"
                ><i></i><i></i><i></i><i></i><i></i><i></i></span
              >
            </Handle>
          </div>
        </Item>
      {/if}
    {/each}
  </Container>

  <GalleryVirtualPointer bind:element={cursorElement} />
</div>

<style>
  .nested-demo,
  :global(.nested-root) {
    width: min(100%, 430px);
  }

  .nested-demo {
    position: relative;
    overflow: visible;
    opacity: 1;
    transition: opacity var(--nested-reset-duration) ease;
  }

  .nested-demo.resetting {
    opacity: 0;
  }

  :global(.nested-root) {
    align-content: center;
  }

  :global(.nested-root > .snapsort-item),
  :global(.nested-child > .snapsort-item) {
    width: 100%;
    align-items: stretch;
  }

  :global(
    .gallery-engine
      .nested-demo
      .nested-ghost:not([data-snapsort-ghost="pointer"]):not(
        [data-snapsort-ghost="insertion"]
      )
  ) {
    border: 0;
    background: color-mix(
      in srgb,
      var(--color-background-dark) 10%,
      transparent
    );
    outline: 0;
  }

  .file-row {
    display: grid;
    width: 100%;
    min-height: 56px;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--size-16);
    padding: 0 var(--size-16) 0 var(--size-20);
    border: 1px solid
      color-mix(in srgb, var(--color-background-dark) 24%, transparent);
    border-radius: var(--size-8);
    background: var(--color-background);
    box-shadow: 0 4px 14px rgb(36 38 39 / 7%);
    box-sizing: border-box;
    color: var(--color-text);
  }

  :global(.nested-child) {
    position: relative;
    width: calc(100% - 8px);
    margin: var(--size-4);
    padding: var(--size-8) 50px var(--size-12) var(--size-8);
    border: 2px solid
      color-mix(in srgb, var(--color-background-dark) 34%, transparent);
    border-radius: calc(var(--size-8) + var(--size-8));
    background: transparent;
    box-shadow: 0 5px 18px rgb(36 38 39 / 4%);
    box-sizing: border-box;
  }

  .folder-heading {
    padding: var(--size-8) var(--size-12) var(--size-4);
    color: var(--color-text-subtle);
    font-family: "Bitcount Grid Single", monospace;
    font-size: 0.8rem;
    font-weight: 400;
    letter-spacing: 0.06em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .child-row {
    min-height: 52px;
  }

  :global(.nested-item-handle),
  :global(.nested-container-handle) {
    display: grid;
    place-items: center;
    color: var(--color-background-dark);
    cursor: grab;
    opacity: 0.42;
    touch-action: none;
  }

  :global(.nested-item-handle) {
    width: 30px;
    height: 38px;
  }

  :global(.nested-container-handle) {
    position: absolute;
    z-index: 2;
    top: 50%;
    right: 10px;
    width: 30px;
    height: 54px;
    border-radius: 999px;
    transform: translateY(-50%);
  }

  .handle-dots {
    display: grid;
    grid-template-columns: repeat(2, 3px);
    gap: 3px;
  }

  .handle-dots i {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: currentColor;
  }

  @media (max-width: 700px) {
    .file-row {
      min-height: 42px;
      gap: var(--size-8);
      padding: 0 var(--size-8) 0 var(--size-12);
      font-size: 0.78rem;
    }

    :global(.nested-child) {
      padding-right: 42px;
    }

    .child-row {
      min-height: 40px;
    }

    :global(.nested-container-handle) {
      right: 6px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .nested-demo {
      transition: none;
    }
  }
</style>
