<script lang="ts">
  import clubsUrl from "$lib/assets/gallery/playing-cards/clubs.svg?url";
  import diamondsUrl from "$lib/assets/gallery/playing-cards/diamonds.svg?url";
  import heartsUrl from "$lib/assets/gallery/playing-cards/hearts.svg?url";
  import spadesUrl from "$lib/assets/gallery/playing-cards/spades.svg?url";
  import type { Engine } from "@snap-engine/core";
  import {
    createRenderEntries,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
  } from "@snap-engine/snapsort";
  import type {
    Container as SnapSortContainer,
    ContainerCallbacks,
    RenderTreeEvent,
  } from "@snap-engine/snapsort";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";
  import { getContext, onMount, untrack } from "svelte";
  import GalleryVirtualPointer from "./GalleryVirtualPointer.svelte";
  import PlayingCard from "./PlayingCard.svelte";
  import {
    VirtualPointerController,
    type VirtualPointerPoint,
  } from "./virtual-pointer";

  type SidewaysCard = {
    id: string;
    rank: 3 | 5 | 7 | 9;
    suit: "clubs" | "diamonds" | "hearts" | "spades";
    suitUrl: string;
  };

  type SidewaysPhase =
    | "waiting"
    | "flipping"
    | "shuffle-1"
    | "shuffle-2"
    | "shuffle-3"
    | "revealing"
    | "complete"
    | "manual"
    | "resetting";

  const SIDEWAYS_CARDS = [
    { id: "side-discover", rank: 3, suit: "clubs", suitUrl: clubsUrl },
    {
      id: "side-design",
      rank: 5,
      suit: "diamonds",
      suitUrl: diamondsUrl,
    },
    { id: "side-build", rank: 7, suit: "hearts", suitUrl: heartsUrl },
    { id: "side-ship", rank: 9, suit: "spades", suitUrl: spadesUrl },
  ] satisfies readonly SidewaysCard[];

  const SIDEWAYS_CARD_IDS = SIDEWAYS_CARDS.map((card) => card.id);
  const SIDEWAYS_INITIAL_ORDER = SIDEWAYS_CARD_IDS.join(",");
  const SIDEWAYS_VIRTUAL_POINTER_ID = 2_000_000_004;
  const SIDEWAYS_MANUAL_RESUME_MS = 8_000;
  const SIDEWAYS_INITIAL_PAUSE_MS = 350;
  const SIDEWAYS_CARD_APPROACH_MS = 320;
  const SIDEWAYS_CLICK_HOLD_MS = 80;
  const SIDEWAYS_FLIP_INTERVAL_MS = 120;
  const SIDEWAYS_ALL_BACKS_HOLD_MS = 320;
  const SIDEWAYS_DRAG_APPROACH_MS = 360;
  const SIDEWAYS_DRAG_DURATION_MS = 620;
  const SIDEWAYS_SHUFFLE_HOLD_MS = 220;
  const SIDEWAYS_REVEAL_APPROACH_MS = 420;
  const SIDEWAYS_COMPLETE_HOLD_MS = 1_200;
  const SIDEWAYS_RESET_FADE_MS = 180;
  const SIDEWAYS_RESET_SETTLE_MS = 180;
  const SIDEWAYS_INITIAL_CURSOR_RIGHT_INSET = 32;

  const SIDEWAYS_ANIMATIONS = {
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
      throw new Error("Sideways Gallery demo must be rendered inside SnapEngine.");
    }
    return engine;
  }

  const galleryEngine = requireGalleryEngine();

  function createSidewaysTree() {
    return createRenderTree(
      createRenderEntries(
        SIDEWAYS_CARDS.map((card) => ({ ...card })),
        (card) => card.id,
      ),
    );
  }

  function createFlippedState(): Record<string, boolean> {
    return Object.fromEntries(SIDEWAYS_CARD_IDS.map((id) => [id, false]));
  }

  let sideways = $state.raw(createSidewaysTree());
  let flippedById = $state(createFlippedState());
  let sidewaysContainer = $state<SnapSortContainer | null>(null);
  let demoElement = $state<HTMLDivElement | null>(null);
  let cursorElement = $state<HTMLDivElement | null>(null);
  let sidewaysPhase = $state<SidewaysPhase>("waiting");
  let documentVisible = $state(true);
  let prefersReducedMotion = $state(false);
  let manualInteraction = $state(false);
  let revealId = $state<string | null>(null);
  let completedCycles = $state(0);
  let lastDropTargetIndex = $state<number | null>(null);
  let lastDropIndex = $state<number | null>(null);
  let lastDropItemId = $state<string | null>(null);
  let dragEnded = false;
  let automationController: AbortController | null = null;
  let pendingAutomationRestart: AbortController | null = null;
  let pendingStaticReset: AbortController | null = null;
  let manualResumeTimer: number | null = null;

  const sidewaysOrder = $derived(
    sideways.entries
      .filter((entry) => !entry.isGhost)
      .map((entry) => entry.itemId)
      .join(","),
  );
  const autoplayEligible = $derived(documentVisible && !prefersReducedMotion);
  const autoplayActive = $derived(autoplayEligible && !manualInteraction);
  const renderedPhase = $derived(
    prefersReducedMotion ? "reduced" : sidewaysPhase,
  );

  function applySidewaysEvent(event: RenderTreeEvent) {
    sideways = reduceRenderTree(sideways, event);
  }

  const sidewaysCallbacks = {
    onItemMove: applySidewaysEvent,
    onItemRemove: applySidewaysEvent,
    onGhostInsert: applySidewaysEvent,
    onGhostMove: applySidewaysEvent,
    onGhostRemove: applySidewaysEvent,
    onDropTargetChange(event) {
      lastDropTargetIndex =
        event.current?.container === sidewaysContainer
          ? event.current.index
          : null;
    },
    onDragStart(event) {
      if (event.session.pointerId !== SIDEWAYS_VIRTUAL_POINTER_ID) {
        takeManualControl();
      }
    },
    onDragEnd(event) {
      dragEnded = true;
      lastDropItemId = String(event.itemId);
      lastDropIndex =
        event.destination?.container === sidewaysContainer
          ? event.destination.index
          : null;
    },
  } satisfies ContainerCallbacks;

  function clearDragResult() {
    lastDropTargetIndex = null;
    lastDropIndex = null;
    lastDropItemId = null;
    dragEnded = false;
  }

  function resetSidewaysState() {
    sideways = createSidewaysTree();
    flippedById = createFlippedState();
    sidewaysPhase = "waiting";
    revealId = null;
    clearDragResult();
  }

  function cancelPendingStaticReset() {
    pendingStaticReset?.abort();
    pendingStaticReset = null;
  }

  function scheduleStaticReset() {
    cancelPendingStaticReset();
    if (sidewaysContainer?.dragSession == null) {
      resetSidewaysState();
      return;
    }

    const controller = new AbortController();
    pendingStaticReset = controller;
    galleryEngine.frameController.subscribe(
      () => {
        if (sidewaysContainer?.dragSession != null) return;
        if (pendingStaticReset !== controller) return;

        pendingStaticReset = null;
        controller.abort();
        resetSidewaysState();
      },
      { signal: controller.signal },
    );
  }

  function queryDemoElement(selector: string): HTMLElement {
    const element = demoElement?.querySelector<HTMLElement>(selector);
    if (!element) {
      throw new Error(
        `Sideways Gallery automation target is missing: ${selector}`,
      );
    }
    return element;
  }

  function cardButton(cardId: string): HTMLElement {
    return queryDemoElement(
      `[data-sideways-card-id="${cardId}"] .playing-card`,
    );
  }

  function cardItem(cardId: string): HTMLElement {
    return queryDemoElement(`[data-sideways-card-id="${cardId}"]`);
  }

  function initialCursorPoint(): VirtualPointerPoint {
    if (!demoElement) {
      throw new Error("Sideways Gallery demo is not mounted.");
    }
    return {
      x:
        demoElement.scrollLeft +
        Math.max(
          0,
          demoElement.clientWidth - SIDEWAYS_INITIAL_CURSOR_RIGHT_INSET,
        ),
      y: demoElement.scrollTop + 18,
    };
  }

  function localPoint(x: number, y: number): VirtualPointerPoint {
    if (!demoElement) {
      throw new Error("Sideways Gallery demo is not mounted.");
    }
    const rect = demoElement.getBoundingClientRect();
    return {
      x: x - rect.left - demoElement.clientLeft + demoElement.scrollLeft,
      y: y - rect.top - demoElement.clientTop + demoElement.scrollTop,
    };
  }

  function cardBoundaryPoint(
    cardId: string,
    placement: "before" | "after",
  ): VirtualPointerPoint {
    const rect = cardItem(cardId).getBoundingClientRect();
    return localPoint(
      placement === "before" ? rect.left - 12 : rect.right + 12,
      rect.top + rect.height / 2,
    );
  }

  async function flipCard(
    pointer: VirtualPointerController,
    cardId: string,
    duration: number,
    expectedFlipped: boolean,
  ) {
    const target = () => cardButton(cardId);
    await pointer.moveTo(target, { duration, arc: 12 });
    await pointer.click(target, { holdDuration: SIDEWAYS_CLICK_HOLD_MS });
    await pointer.waitUntil(() => flippedById[cardId] === expectedFlipped, {
      timeout: 1_000,
    });
  }

  async function performShuffle(
    pointer: VirtualPointerController,
    options: {
      itemId: string;
      destination: () => VirtualPointerPoint;
      expectedIndex: number;
      expectedOrder: string;
      arc: number;
    },
  ) {
    clearDragResult();
    const source = () => cardButton(options.itemId);
    await pointer.moveTo(source, {
      duration: SIDEWAYS_DRAG_APPROACH_MS,
      arc: options.arc / 2,
    });
    await pointer.press(source);
    await pointer.activateDrag();
    await pointer.waitUntil(
      () => {
        const session = sidewaysContainer?.dragSession;
        return (
          session?.pointerId === SIDEWAYS_VIRTUAL_POINTER_ID &&
          session.primaryItem.itemId === options.itemId &&
          session.status === "active"
        );
      },
      { timeout: 1_200 },
    );
    await pointer.moveTo(options.destination, {
      duration: SIDEWAYS_DRAG_DURATION_MS,
      arc: options.arc,
    });
    await pointer.waitUntil(
      () => lastDropTargetIndex === options.expectedIndex,
      { timeout: 1_200 },
    );
    await pointer.release();
    await pointer.waitUntil(
      () =>
        dragEnded &&
        lastDropItemId === options.itemId &&
        lastDropIndex === options.expectedIndex &&
        sidewaysOrder === options.expectedOrder,
      { timeout: 1_200 },
    );
  }

  async function runSidewaysAutomation(controller: AbortController) {
    if (!cursorElement || !demoElement) return;
    const { signal } = controller;
    const pointer = new VirtualPointerController(galleryEngine, cursorElement, {
      coordinateRoot: demoElement,
      signal,
      pointerId: SIDEWAYS_VIRTUAL_POINTER_ID,
    });

    let shouldRestart = false;
    try {
      while (!signal.aborted) {
        await pointer.waitUntil(() => sidewaysContainer?.dragSession == null, {
          timeout: 2_000,
        });
        sidewaysPhase = "resetting";
        pointer.hide();
        resetSidewaysState();
        sidewaysPhase = "resetting";
        await pointer.wait(SIDEWAYS_RESET_SETTLE_MS);
        sidewaysPhase = "waiting";

        await pointer.moveTo(initialCursorPoint, {
          duration: 0,
          dispatchEvent: false,
        });
        pointer.show();
        await pointer.wait(SIDEWAYS_INITIAL_PAUSE_MS);

        sidewaysPhase = "flipping";
        for (const cardId of SIDEWAYS_CARD_IDS) {
          await flipCard(pointer, cardId, SIDEWAYS_CARD_APPROACH_MS, true);
          await pointer.wait(SIDEWAYS_FLIP_INTERVAL_MS);
        }
        await pointer.wait(SIDEWAYS_ALL_BACKS_HOLD_MS);

        sidewaysPhase = "shuffle-1";
        await performShuffle(pointer, {
          itemId: "side-discover",
          destination: () => cardBoundaryPoint("side-ship", "after"),
          expectedIndex: 3,
          expectedOrder: "side-design,side-build,side-ship,side-discover",
          arc: -28,
        });
        await pointer.wait(SIDEWAYS_SHUFFLE_HOLD_MS);

        sidewaysPhase = "shuffle-2";
        await performShuffle(pointer, {
          itemId: "side-ship",
          destination: () => cardBoundaryPoint("side-design", "before"),
          expectedIndex: 0,
          expectedOrder: "side-ship,side-design,side-build,side-discover",
          arc: 30,
        });
        await pointer.wait(SIDEWAYS_SHUFFLE_HOLD_MS);

        sidewaysPhase = "shuffle-3";
        await performShuffle(pointer, {
          itemId: "side-design",
          destination: () => cardBoundaryPoint("side-discover", "after"),
          expectedIndex: 3,
          expectedOrder: "side-ship,side-build,side-discover,side-design",
          arc: -30,
        });
        await pointer.wait(SIDEWAYS_SHUFFLE_HOLD_MS);

        sidewaysPhase = "revealing";
        revealId = SIDEWAYS_CARD_IDS[completedCycles % SIDEWAYS_CARD_IDS.length];
        await flipCard(
          pointer,
          revealId,
          SIDEWAYS_REVEAL_APPROACH_MS,
          false,
        );
        completedCycles += 1;
        sidewaysPhase = "complete";
        await pointer.wait(SIDEWAYS_COMPLETE_HOLD_MS);

        sidewaysPhase = "resetting";
        pointer.hide();
        await pointer.wait(SIDEWAYS_RESET_FADE_MS);
      }
    } catch (error) {
      if (!signal.aborted) {
        shouldRestart = true;
        console.error("Sideways Gallery automation failed.", error);
      }
    } finally {
      pointer.destroy();
      if (automationController === controller) {
        automationController = null;
      }
      if (shouldRestart) queueSidewaysAutomationRestart();
    }
  }

  function cancelPendingAutomationRestart() {
    pendingAutomationRestart?.abort();
    pendingAutomationRestart = null;
  }

  function queueSidewaysAutomationRestart() {
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
          sidewaysContainer !== null &&
          demoElement !== null &&
          cursorElement !== null
        ) {
          startSidewaysAutomation();
        }
      },
      { signal: controller.signal },
    );
  }

  function startSidewaysAutomation() {
    if (
      automationController ||
      !sidewaysContainer ||
      !demoElement ||
      !cursorElement
    ) {
      return;
    }
    cancelPendingAutomationRestart();
    const controller = new AbortController();
    automationController = controller;
    void runSidewaysAutomation(controller);
  }

  function stopSidewaysAutomation() {
    cancelPendingAutomationRestart();
    automationController?.abort();
    automationController = null;
  }

  function takeManualControl() {
    manualInteraction = true;
    sidewaysPhase = "manual";
    stopSidewaysAutomation();
    if (manualResumeTimer !== null) window.clearTimeout(manualResumeTimer);
    manualResumeTimer = window.setTimeout(
      resumeSidewaysAutomation,
      SIDEWAYS_MANUAL_RESUME_MS,
    );
  }

  function resumeSidewaysAutomation() {
    if (sidewaysContainer?.dragSession != null) {
      manualResumeTimer = window.setTimeout(resumeSidewaysAutomation, 250);
      return;
    }
    manualResumeTimer = null;
    resetSidewaysState();
    manualInteraction = false;
  }

  function handleTrustedInteraction(event: Event) {
    if (event.isTrusted) takeManualControl();
  }

  $effect(() => {
    const shouldRun =
      autoplayActive &&
      sidewaysContainer !== null &&
      demoElement !== null &&
      cursorElement !== null;
    if (shouldRun) {
      untrack(startSidewaysAutomation);
    } else {
      stopSidewaysAutomation();
    }

    return stopSidewaysAutomation;
  });

  onMount(() => {
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const syncReducedMotion = () => {
      const nextReducedMotion = reducedMotionQuery.matches;
      if (prefersReducedMotion === nextReducedMotion) return;

      stopSidewaysAutomation();
      if (manualResumeTimer !== null) window.clearTimeout(manualResumeTimer);
      manualResumeTimer = null;
      manualInteraction = false;
      prefersReducedMotion = nextReducedMotion;
      scheduleStaticReset();
    };
    const syncDocumentVisibility = () => {
      documentVisible = document.visibilityState === "visible";
      if (!documentVisible) {
        if (manualResumeTimer !== null) window.clearTimeout(manualResumeTimer);
        manualResumeTimer = null;
        manualInteraction = false;
        scheduleStaticReset();
      }
    };

    syncReducedMotion();
    syncDocumentVisibility();
    reducedMotionQuery.addEventListener("change", syncReducedMotion);
    document.addEventListener("visibilitychange", syncDocumentVisibility);
    demoElement?.addEventListener(
      "pointerdown",
      handleTrustedInteraction,
      true,
    );
    demoElement?.addEventListener("click", handleTrustedInteraction, true);
    demoElement?.addEventListener("keydown", handleTrustedInteraction, true);

    return () => {
      stopSidewaysAutomation();
      cancelPendingStaticReset();
      if (manualResumeTimer !== null) window.clearTimeout(manualResumeTimer);
      reducedMotionQuery.removeEventListener("change", syncReducedMotion);
      document.removeEventListener("visibilitychange", syncDocumentVisibility);
      demoElement?.removeEventListener(
        "pointerdown",
        handleTrustedInteraction,
        true,
      );
      demoElement?.removeEventListener("click", handleTrustedInteraction, true);
      demoElement?.removeEventListener(
        "keydown",
        handleTrustedInteraction,
        true,
      );
    };
  });
</script>

<div
  bind:this={demoElement}
  class:resetting={sidewaysPhase === "resetting"}
  class="sideways-demo"
  data-sideways-autoplay-active={autoplayActive}
  data-sideways-cycle={completedCycles}
  data-sideways-drop-index={lastDropIndex ?? ""}
  data-sideways-drop-item={lastDropItemId ?? ""}
  data-sideways-manual={manualInteraction}
  data-sideways-phase={renderedPhase}
  data-sideways-reveal-id={revealId ?? ""}
  data-sideways-target-index={lastDropTargetIndex ?? ""}
  style={`--sideways-reset-duration: ${SIDEWAYS_RESET_FADE_MS}ms;`}
>
  <Container
    bind:container={sidewaysContainer}
    itemId="gallery-sideways-root"
    className="sideways-list"
    config={{
      animation: SIDEWAYS_ANIMATIONS,
      mode: "euclidean",
      direction: "row",
      callbacks: sidewaysCallbacks,
    }}
    data-demo="sideways-insert"
    data-sideways-initial-order={SIDEWAYS_INITIAL_ORDER}
    data-sideways-order={sidewaysOrder}
  >
    {#each sideways.entries as entry (entry.itemId)}
      {#if entry.isGhost}
        <Ghost ghost={entry.ghost} className="side-card-ghost" />
      {:else}
        <Item
          itemId={entry.itemId}
          className="side-card-item"
          data-sideways-card-id={entry.itemId}
        >
          <PlayingCard
            rank={entry.value.rank}
            suit={entry.value.suit}
            suitUrl={entry.value.suitUrl}
            bind:flipped={flippedById[entry.itemId]}
          />
        </Item>
      {/if}
    {/each}
  </Container>

  <GalleryVirtualPointer bind:element={cursorElement} />
</div>

<style>
  .sideways-demo {
    position: relative;
    width: 100%;
    overflow: visible;
    opacity: 1;
    transition: opacity var(--sideways-reset-duration) ease;
  }

  .sideways-demo.resetting {
    opacity: 0;
  }

  :global(.sideways-list) {
    flex-wrap: nowrap !important;
    align-items: stretch;
    justify-content: center !important;
    width: 100%;
  }

  :global(.sideways-list > .snapsort-item) {
    flex: 0 1 142px;
    min-width: 0;
    padding: 6px;
  }

  :global(
      .side-card-ghost:not([data-snapsort-ghost="pointer"]):not(
          [data-snapsort-ghost="insertion"]
        )
    ) {
    border: 0 !important;
    border-radius: 10px !important;
    background: #d3d3d2 !important;
    box-shadow: none !important;
    outline: 0 !important;
  }

  @media (max-width: 700px) {
    :global(.sideways-list > .snapsort-item) {
      flex-basis: 104px;
      padding: 3px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sideways-demo {
      transition: none;
    }
  }
</style>
