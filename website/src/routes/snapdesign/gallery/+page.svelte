<script lang="ts">
  import { sessionPointerId } from "./session-pointer";
  import SeoHead from "$lib/components/SeoHead.svelte";
  import CodeLcdDisplay from "$lib/components/CodeLcdDisplay.svelte";
  import Dial from "$lib/components/Dial.svelte";
  import ControlMatrixGalleryDemo from "./ControlMatrixGalleryDemo.svelte";
  import KanbanGalleryDemo from "./KanbanGalleryDemo.svelte";
  import LayersPanelGalleryDemo from "./LayersPanelGalleryDemo.svelte";
  import NestedGalleryDemo from "./NestedGalleryDemo.svelte";
  import SidewaysGalleryDemo from "./SidewaysGalleryDemo.svelte";
  import TodoGalleryDemo from "./TodoGalleryDemo.svelte";
  import ToucanLessonDemo from "./ToucanLessonDemo.svelte";
  import GalleryVirtualPointer from "./GalleryVirtualPointer.svelte";
  import { VirtualPointerController } from "./virtual-pointer";
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type { Engine as SnapEngine } from "@snap-engine/core";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";
  import {
    createRenderEntries,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
  } from "@snap-engine/snapsort";
  import type {
    Container as SnapSortContainer,
    ContainerCallbacks,
    GhostState,
    RenderTreeEvent,
  } from "@snap-engine/snapsort";
  import { onMount, untrack } from "svelte";

  type SwapTile =
    | { id: string; label: string; treatment: "dial"; value: number }
    | { id: string; label: string; treatment: "lcd" };
  type ReducerCallbacks = Pick<
    ContainerCallbacks,
    | "onItemMove"
    | "onItemRemove"
    | "onItemSwap"
    | "onGhostInsert"
    | "onGhostMove"
    | "onGhostRemove"
  >;

  function renderTreeCallbacks(
    apply: (event: RenderTreeEvent) => void,
  ): ReducerCallbacks {
    return {
      onItemMove: apply,
      onItemRemove: apply,
      onItemSwap: apply,
      onGhostInsert: apply,
      onGhostMove: apply,
      onGhostRemove: apply,
    };
  }

  function createList<T>(
    values: readonly T[],
    getId: (value: T) => string,
  ) {
    return createRenderTree(createRenderEntries(values, getId));
  }

  const SWAP_TILES = [
    { id: "swap-a", label: "A", treatment: "dial", value: 40 },
    { id: "swap-b", label: "B", treatment: "lcd" },
    { id: "swap-c", label: "C", treatment: "dial", value: 280 },
    { id: "swap-d", label: "D", treatment: "lcd" },
    { id: "swap-e", label: "E", treatment: "dial", value: 160 },
    { id: "swap-f", label: "F", treatment: "lcd" },
  ] satisfies readonly SwapTile[];
  const SWAP_VIRTUAL_POINTER_ID = 2_000_000_008;
  const SWAP_MANUAL_RESUME_MS = 8_000;
  const SWAP_AFTER_AF = "F,B,C,D,E,A";
  const SWAP_AFTER_CD = "F,B,D,C,E,A";

  function createSwapTree() {
    return createList(
      SWAP_TILES.map((tile) => ({ ...tile })),
      (item) => item.id,
    );
  }

  let swap = $state.raw(createSwapTree());
  let galleryEngine = $state<SnapEngine | null>(null);
  let swapContainer = $state<SnapSortContainer | null>(null);
  let swapDemoElement = $state<HTMLDivElement | null>(null);
  let swapCursorElement = $state<HTMLDivElement | null>(null);
  let swapPhase = $state("waiting");
  let documentVisible = $state(true);
  let prefersReducedMotion = $state(false);
  let manualSwapInteraction = $state(false);
  let swapAutomationController: AbortController | null = null;
  let swapManualResumeTimer: number | null = null;

  const swapOrder = $derived(
    swap.entries
      .filter((entry) => !entry.isGhost)
      .map((entry) => entry.value.label)
      .join(","),
  );
  const swapAutoplayActive = $derived(
    documentVisible && !prefersReducedMotion && !manualSwapInteraction,
  );

  const swapCallbacks = {
    ...renderTreeCallbacks((event) => {
      swap = reduceRenderTree(swap, event);
    }),
    onDragStart(event) {
      if (sessionPointerId(event.session) !== SWAP_VIRTUAL_POINTER_ID) {
        takeSwapManualControl();
      }
    },
  } satisfies ContainerCallbacks;

  function swapTileForGhost(ghost: GhostState) {
    const entry = swap.entries.find(
      (candidate) => candidate.itemId === ghost.originalItemId,
    );
    return entry && !entry.isGhost ? entry.value : undefined;
  }

  function handleSwapDialPointerDown(event: PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  function requireSwapElement(selector: string) {
    const element = swapDemoElement?.querySelector<HTMLElement>(selector);
    if (!element) {
      throw new Error(`Swap automation target is missing: ${selector}`);
    }
    return element;
  }

  function swapItem(label: string) {
    return requireSwapElement(`[data-swap-label="${label}"]`);
  }

  function swapHandle(label: string) {
    return requireSwapElement(
      `[data-swap-label="${label}"] .swap-tile-label`,
    );
  }

  async function performAutomatedSwap(
    pointer: VirtualPointerController,
    sourceLabel: string,
    targetLabel: string,
    expectedOrder: string,
    arc: number,
  ) {
    const source = () => swapHandle(sourceLabel);
    const target = () => swapItem(targetLabel);
    await pointer.moveTo(source, { duration: 380, arc: arc / 2 });
    await pointer.press(source);
    await pointer.activateDrag();
    await pointer.waitUntil(
      () => {
        const session = swapContainer?.dragSession;
        return (
          session != null &&
          sessionPointerId(session) === SWAP_VIRTUAL_POINTER_ID &&
          session.primaryItem.itemId === `swap-${sourceLabel.toLowerCase()}` &&
          session.status === "active"
        );
      },
      { timeout: 1_200 },
    );
    await pointer.moveTo(target, { duration: 680, arc });
    await pointer.wait(180);
    await pointer.release();
    await pointer.waitUntil(() => swapOrder === expectedOrder, {
      timeout: 1_500,
    });
  }

  async function runSwapAutomation(controller: AbortController) {
    if (!galleryEngine || !swapDemoElement || !swapCursorElement) return;
    const { signal } = controller;
    const pointer = new VirtualPointerController(
      galleryEngine,
      swapCursorElement,
      {
        coordinateRoot: swapDemoElement,
        signal,
        pointerId: SWAP_VIRTUAL_POINTER_ID,
      },
    );
    let shouldRestart = false;

    try {
      while (!signal.aborted) {
        await pointer.waitUntil(() => swapContainer?.dragSession == null, {
          timeout: 2_000,
        });
        swapPhase = "resetting";
        pointer.hide();
        swap = createSwapTree();
        await pointer.wait(220);

        swapPhase = "waiting";
        await pointer.moveTo(
          {
            x: Math.max(0, swapDemoElement.clientWidth - 28),
            y: 20,
          },
          { duration: 0, dispatchEvent: false },
        );
        pointer.show();
        await pointer.wait(500);

        swapPhase = "swapping-a-f";
        await performAutomatedSwap(
          pointer,
          "A",
          "F",
          SWAP_AFTER_AF,
          34,
        );
        await pointer.wait(700);

        swapPhase = "swapping-c-d";
        await performAutomatedSwap(
          pointer,
          "C",
          "D",
          SWAP_AFTER_CD,
          -24,
        );
        swapPhase = "complete";
        await pointer.wait(1_500);

        swapPhase = "resetting";
        pointer.hide();
        await pointer.wait(220);
      }
    } catch (error) {
      if (!signal.aborted) {
        shouldRestart = true;
        console.error("Swap Gallery automation failed.", error);
      }
    } finally {
      pointer.destroy();
      if (swapAutomationController === controller) {
        swapAutomationController = null;
      }
      if (shouldRestart) {
        window.setTimeout(() => {
          if (swapAutoplayActive) startSwapAutomation();
        }, 0);
      }
    }
  }

  function startSwapAutomation() {
    if (
      swapAutomationController ||
      !galleryEngine ||
      !swapContainer ||
      !swapDemoElement ||
      !swapCursorElement
    ) {
      return;
    }
    swapAutomationController = new AbortController();
    void runSwapAutomation(swapAutomationController);
  }

  function stopSwapAutomation() {
    swapAutomationController?.abort();
    swapAutomationController = null;
  }

  function resumeSwapAutomation() {
    if (swapContainer?.dragSession != null) {
      swapManualResumeTimer = window.setTimeout(resumeSwapAutomation, 250);
      return;
    }
    swapManualResumeTimer = null;
    swap = createSwapTree();
    swapPhase = "waiting";
    manualSwapInteraction = false;
  }

  function takeSwapManualControl() {
    manualSwapInteraction = true;
    swapPhase = "manual";
    stopSwapAutomation();
    if (swapManualResumeTimer !== null) {
      window.clearTimeout(swapManualResumeTimer);
    }
    swapManualResumeTimer = window.setTimeout(
      resumeSwapAutomation,
      SWAP_MANUAL_RESUME_MS,
    );
  }

  $effect(() => {
    const shouldRun =
      swapAutoplayActive &&
      galleryEngine !== null &&
      swapContainer !== null &&
      swapDemoElement !== null &&
      swapCursorElement !== null;
    if (shouldRun) {
      untrack(startSwapAutomation);
    } else {
      stopSwapAutomation();
    }
    return stopSwapAutomation;
  });

  onMount(() => {
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const syncReducedMotion = () => {
      prefersReducedMotion = reducedMotionQuery.matches;
      if (prefersReducedMotion) {
        if (swapManualResumeTimer !== null) {
          window.clearTimeout(swapManualResumeTimer);
        }
        swapManualResumeTimer = null;
        manualSwapInteraction = false;
        swap = createSwapTree();
        swapPhase = "reduced";
      }
    };
    const syncDocumentVisibility = () => {
      documentVisible = document.visibilityState === "visible";
      if (!documentVisible) {
        if (swapManualResumeTimer !== null) {
          window.clearTimeout(swapManualResumeTimer);
        }
        swapManualResumeTimer = null;
        manualSwapInteraction = false;
        swap = createSwapTree();
      }
    };
    const handleTrustedInteraction = (event: Event) => {
      if (!event.isTrusted) return;
      takeSwapManualControl();
    };

    syncReducedMotion();
    syncDocumentVisibility();
    reducedMotionQuery.addEventListener("change", syncReducedMotion);
    document.addEventListener("visibilitychange", syncDocumentVisibility);
    swapDemoElement?.addEventListener(
      "pointerdown",
      handleTrustedInteraction,
      true,
    );

    return () => {
      stopSwapAutomation();
      if (swapManualResumeTimer !== null) {
        window.clearTimeout(swapManualResumeTimer);
      }
      reducedMotionQuery.removeEventListener("change", syncReducedMotion);
      document.removeEventListener("visibilitychange", syncDocumentVisibility);
      swapDemoElement?.removeEventListener(
        "pointerdown",
        handleTrustedInteraction,
        true,
      );
    };
  });

</script>

{#snippet swapTile(tile: SwapTile)}
  <div
    class:dial-tile={tile.treatment === "dial"}
    class:lcd-tile={tile.treatment === "lcd"}
    class="swap-tile card"
  >
    {#if tile.treatment === "dial"}
      <span class="swap-tile-label">{tile.label}</span>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="swap-dial-control"
        onpointerdown={handleSwapDialPointerDown}
      >
        <Dial
          value={tile.value}
          step={10}
          size={72}
          aria-label={`Dial ${tile.label}`}
        />
      </div>
    {:else}
      <CodeLcdDisplay value={tile.label} label="ENGINE READY" />
    {/if}
  </div>
{/snippet}

<SeoHead
  title="SnapDesign Gallery"
  description="Interactive interface studies built with SnapEngine."
  path="/snapdesign/gallery"
  imageAlt="Eight interactive SnapEngine interface studies"
/>

<main class="gallery-page">
  <section class="gallery-hero">
    <div class="gallery-hero-copy">
      <h1>Gallery</h1>
    </div>
    <div class="gallery-hero-specimen" aria-hidden="true"></div>
  </section>

  <Engine
    id="snapdesign-gallery"
    className="gallery-engine"
    bind:engine={galleryEngine}
  >
    <section class="demo-list" aria-label="Interactive SnapEngine exhibits">
      <article class="gallery-exhibit" data-gallery="todo-list">
        <header class="exhibit-label">
          <div class="exhibit-heading">
            <span class="exhibit-index" aria-hidden="true">01</span>
            <h2>To-do list</h2>
          </div>
          <p class="exhibit-caption">
            A familiar checklist becomes a tactile reorderable surface without
            losing its quiet, readable hierarchy.
          </p>
          <dl class="exhibit-metadata">
            <div><dt>Engine</dt><dd>SnapSort</dd></div>
            <div><dt>Mode</dt><dd>Euclidean</dd></div>
          </dl>
        </header>
        <div class="demo-stage todo-stage" inert aria-hidden="true">
          <TodoGalleryDemo />
        </div>
      </article>

      <article class="gallery-exhibit" data-gallery="nested-containers">
        <header class="exhibit-label">
          <div class="exhibit-heading">
            <span class="exhibit-index" aria-hidden="true">02</span>
            <h2>Nested containers</h2>
          </div>
          <p class="exhibit-caption">
            A layered planning stack shows items moving between a parent list
            and a nested collection while preserving context.
          </p>
          <dl class="exhibit-metadata">
            <div><dt>Engine</dt><dd>SnapSort</dd></div>
            <div><dt>Mode</dt><dd>Nested</dd></div>
          </dl>
        </header>
        <div class="demo-stage nested-stage" inert aria-hidden="true">
          <NestedGalleryDemo />
        </div>
      </article>

      <article class="gallery-exhibit" data-gallery="sideways-insert">
        <header class="exhibit-label">
          <div class="exhibit-heading">
            <span class="exhibit-index" aria-hidden="true">03</span>
            <h2>Sideways insert</h2>
          </div>
          <p class="exhibit-caption">
            Click a card to reveal its reverse, or drag it through the row to
            preview the precise gap where it will settle.
          </p>
          <dl class="exhibit-metadata">
            <div><dt>Engine</dt><dd>SnapSort</dd></div>
            <div><dt>Mode</dt><dd>Euclidean / Row</dd></div>
          </dl>
        </header>
        <div class="demo-stage sideways-stage">
          <SidewaysGalleryDemo />
        </div>
      </article>

      <article class="gallery-exhibit" data-gallery="swap-mode">
        <header class="exhibit-label">
          <div class="exhibit-heading">
            <span class="exhibit-index" aria-hidden="true">04</span>
            <h2>Swap mode</h2>
          </div>
          <p class="exhibit-caption">
            A control grid treats the hovered tile as the destination and
            exchanges the two positions in one drop.
          </p>
          <dl class="exhibit-metadata">
            <div><dt>Engine</dt><dd>SnapSort</dd></div>
            <div><dt>Mode</dt><dd>Swap</dd></div>
          </dl>
        </header>
        <div
          bind:this={swapDemoElement}
          class:resetting={swapPhase === "resetting"}
          class="demo-stage swap-stage"
          data-swap-autoplay-active={swapAutoplayActive}
          data-swap-order={swapOrder}
          data-swap-phase={prefersReducedMotion ? "reduced" : swapPhase}
        >
          <Container
            bind:container={swapContainer}
            itemId="gallery-swap-root"
            className="swap-grid"
            config={{
              animation: defaultAnimations,
              mode: "swap",
              direction: "row",
              callbacks: swapCallbacks,
            }}
            data-demo="swap-mode"
          >
            {#each swap.entries as entry (entry.itemId)}
              {#if entry.isGhost}
                {@const ghostTile = swapTileForGhost(entry.ghost)}
                <Ghost ghost={entry.ghost} className="swap-ghost">
                  {#if entry.ghost.type === "pointer-preview" && ghostTile}
                    {@render swapTile(ghostTile)}
                  {/if}
                </Ghost>
              {:else}
                <Item
                  itemId={entry.itemId}
                  data-swap-label={entry.value.label}
                  metadata={{ label: entry.value.label }}
                >
                  {@render swapTile(entry.value)}
                </Item>
              {/if}
            {/each}
          </Container>
          <GalleryVirtualPointer bind:element={swapCursorElement} />
        </div>
      </article>

      <article class="gallery-exhibit" data-gallery="toucan-lesson">
        <header class="exhibit-label">
          <div class="exhibit-heading">
            <span class="exhibit-index" aria-hidden="true">05</span>
            <h2>Toucan lesson</h2>
          </div>
          <p class="exhibit-caption">
            A playful language drill assembles a sentence one tactile word at
            a time, turning a multi-container move into a tiny performance.
          </p>
          <dl class="exhibit-metadata">
            <div><dt>Engine</dt><dd>SnapSort</dd></div>
            <div><dt>Mode</dt><dd>Progressive / Multi-container</dd></div>
          </dl>
        </header>
        <div
          class="demo-stage toucan-stage"
          role="group"
          aria-label="Toucan word lesson"
        >
          <ToucanLessonDemo />
        </div>
      </article>

      <article class="gallery-exhibit" data-gallery="layers-panel">
        <header class="exhibit-label">
          <div class="exhibit-heading">
            <span class="exhibit-index" aria-hidden="true">06</span>
            <h2>Layers panel</h2>
          </div>
          <p class="exhibit-caption">
            A light, Figma-inspired layers panel demonstrates draggable depth
            across frames, groups, and individual design elements.
          </p>
          <dl class="exhibit-metadata">
            <div><dt>Engine</dt><dd>SnapSort</dd></div>
            <div><dt>Mode</dt><dd>Nested / Column</dd></div>
          </dl>
        </header>
        <div
          class="demo-stage layers-panel-stage"
          role="group"
          aria-label="Draggable design layers"
        >
          <LayersPanelGalleryDemo />
        </div>
      </article>

      <article class="gallery-exhibit" data-gallery="kanban-board">
        <header class="exhibit-label">
          <div class="exhibit-heading">
            <span class="exhibit-index" aria-hidden="true">07</span>
            <h2>Kanban board</h2>
          </div>
          <p class="exhibit-caption">
            A compact two-column workspace keeps task movement direct while
            showing how progressive placement works across lists.
          </p>
          <dl class="exhibit-metadata">
            <div><dt>Engine</dt><dd>SnapSort</dd></div>
            <div><dt>Mode</dt><dd>Progressive / Multi-container</dd></div>
          </dl>
        </header>
        <div
          class="demo-stage kanban-stage"
          role="group"
          aria-label="Draggable Kanban board"
        >
          <KanbanGalleryDemo />
        </div>
      </article>

      <article class="gallery-exhibit" data-gallery="control-matrix">
        <header class="exhibit-label">
          <div class="exhibit-heading">
            <span class="exhibit-index" aria-hidden="true">08</span>
            <h2>Control matrix</h2>
          </div>
          <p class="exhibit-caption">
            Six guideline-tuned elements share one compact matrix, keeping
            material, spacing, and interaction states visible at a glance.
          </p>
          <dl class="exhibit-metadata">
            <div><dt>Engine</dt><dd>SnapDesign</dd></div>
            <div><dt>Mode</dt><dd>Interactive / 2 × 3</dd></div>
          </dl>
        </header>
        <div
          class="demo-stage control-matrix-stage"
          role="group"
          aria-label="Interactive UI control matrix"
        >
          <ControlMatrixGalleryDemo />
        </div>
      </article>
    </section>
  </Engine>
</main>

<style>
  .gallery-page {
    width: 100%;
    min-height: 100vh;
    padding: clamp(18px, 3vw, 44px);
    box-sizing: border-box;
    background: #f6f6f6;
  }

  .gallery-hero,
  .demo-list {
    width: min(1400px, 100%);
    margin-inline: auto;
    box-sizing: border-box;
  }

  .gallery-hero {
    display: grid;
    min-height: clamp(300px, 43vw, 520px);
    grid-template-columns: minmax(0, 0.85fr) minmax(380px, 1.15fr);
    grid-template-rows: minmax(0, 1fr);
    align-items: stretch;
    margin-bottom: clamp(32px, 5vw, 60px);
    border: 1px solid #d7d7d7;
  }

  .gallery-hero-copy {
    display: flex;
    min-width: 0;
    align-items: center;
    padding: clamp(40px, 7vw, 96px);
  }

  .gallery-hero h1 {
    margin: 0;
    color: #080808;
    font-family: "Geist", sans-serif;
    font-size: clamp(72px, 11vw, 156px);
    font-weight: 500;
    letter-spacing: -0.075em;
    line-height: 0.86;
  }

  .gallery-hero-specimen {
    min-width: 0;
    margin: clamp(18px, 2.5vw, 34px);
    border-radius: var(--size-16);
    background: #ececeb;
  }

  :global(.gallery-engine) {
    width: 100%;
    height: auto !important;
  }

  .demo-list {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: clamp(32px, 5vw, 60px);
  }

  .gallery-exhibit {
    --exhibit-inset: clamp(18px, 2.5vw, 34px);

    display: grid;
    grid-template-columns: minmax(0, 1.7fr) minmax(300px, 0.8fr);
    box-sizing: border-box;
    border: 1px solid #d7d7d7;
    background: #f6f6f6;
  }

  .exhibit-label {
    display: flex;
    min-width: 0;
    grid-column: 2;
    grid-row: 1;
    flex-direction: column;
    padding: clamp(32px, 4vw, 56px);
    border-left: 1px solid #d7d7d7;
    box-sizing: border-box;
  }

  .exhibit-heading {
    display: flex;
    align-items: flex-start;
    gap: var(--size-16);
  }

  .exhibit-index {
    flex: 0 0 auto;
    color: #080808;
    font-family: "Zen Dots", sans-serif;
    font-size: clamp(2.25rem, 3vw, 3rem);
    font-weight: 400;
    line-height: 0.8;
  }

  .exhibit-heading h2 {
    margin: 0;
    color: #080808;
    font-family: var(--font-label);
    font-size: clamp(1.45rem, 2vw, 2rem);
    font-weight: 400;
    letter-spacing: 0;
    line-height: 1;
  }

  .exhibit-caption {
    max-width: 30ch;
    margin: clamp(32px, 4vw, 48px) 0 var(--size-32);
    color: var(--color-text);
    font-family: var(--font-body);
    font-size: clamp(1rem, 1.25vw, 1.15rem);
    line-height: 1.55;
  }

  .exhibit-metadata {
    display: grid;
    gap: var(--size-12);
    margin: auto 0 0;
    color: var(--color-text-subtle);
    font-family: var(--font-code);
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    line-height: 1.3;
    text-transform: uppercase;
  }

  .exhibit-metadata div {
    display: flex;
    justify-content: space-between;
    gap: var(--size-16);
    padding-top: var(--size-12);
    border-top: 1px solid #d7d7d7;
  }

  .exhibit-metadata dt,
  .exhibit-metadata dd {
    margin: 0;
  }

  .exhibit-metadata dd {
    color: var(--color-text);
    text-align: right;
  }

  .demo-stage {
    display: flex;
    width: calc(100% - (var(--exhibit-inset) * 2));
    min-width: 0;
    min-height: 0;
    aspect-ratio: 1 / 1;
    grid-column: 1;
    grid-row: 1;
    align-items: center;
    justify-content: center;
    justify-self: center;
    margin: var(--exhibit-inset);
    padding: clamp(24px, 4vw, 56px);
    box-sizing: border-box;
    border-radius: var(--size-16);
    background: #ececeb;
  }

  :global(.gallery-engine .snapsort-item) {
    padding: var(--size-4);
    user-select: none;
    touch-action: none;
  }
  :global(
      .gallery-engine
        .snapsort-ghost:not([data-snapsort-ghost="pointer"]):not(
          [data-snapsort-ghost="insertion"]
        )
    ) {
    border-radius: var(--size-8);
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    outline: 1px dashed
      color-mix(in srgb, var(--color-primary) 55%, transparent);
  }

  .todo-stage {
    pointer-events: none;
  }

  .toucan-stage {
    overflow: hidden;
    padding: 0;
    pointer-events: auto;
  }

  .layers-panel-stage {
    align-items: stretch;
    justify-content: stretch;
    overflow: hidden;
    padding: 0;
  }

  .kanban-stage {
    align-items: stretch;
    justify-content: center;
    overflow: hidden;
    padding: clamp(24px, 4vw, 48px);
  }

  .control-matrix-stage {
    overflow: hidden;
    padding: clamp(12px, 2vw, 24px);
  }

  .nested-stage {
    padding-block: 4%;
    pointer-events: none;
  }

  .sideways-stage {
    padding-inline: 3%;
  }

  .swap-stage {
    position: relative;
    opacity: 1;
    transition: opacity 220ms ease;
  }

  .swap-stage.resetting {
    opacity: 0;
  }

  :global(.swap-grid) {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--size-8);
    width: min(100%, 430px);
  }
  :global(.swap-grid > .snapsort-item) {
    min-width: 0;
    padding: 0;
  }
  .swap-tile {
    --card-color: #fff;

    display: grid;
    place-items: center;
    width: 100%;
    aspect-ratio: 1;
    box-sizing: border-box;
    color: #252728;
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 4vw, 2.7rem);
  }
  .swap-tile.lcd-tile {
    padding: 4px;
  }
  .swap-tile.dial-tile {
    --card-color: #ececeb;

    background: #ececeb;
  }
  .swap-tile.lcd-tile > :global(.code-lcd-display) {
    --display-radius: 12px;

    width: 100%;
    height: 100%;
    min-height: 0;
  }
  .swap-tile-label {
    position: absolute;
    top: var(--size-12);
    left: var(--size-12);
    color: var(--color-text-muted);
    font-family: var(--font-code);
    font-size: 0.7rem;
    line-height: 1;
  }
  .swap-dial-control {
    display: grid;
    place-items: center;
  }
  :global(.swap-ghost) {
    border: 0 !important;
    outline: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    opacity: 0.92;
  }
  :global(.swap-ghost) .swap-tile {
    box-shadow: none;
  }

  @media (max-width: 1050px) {
    .gallery-hero {
      grid-template-columns: 1fr;
    }

    .gallery-hero-specimen {
      min-height: 260px;
      margin-top: 0;
    }

    .gallery-exhibit {
      min-height: 0;
      grid-template-columns: minmax(0, 1fr);
    }

    .exhibit-label {
      grid-column: 1;
      grid-row: 1;
      border-left: 0;
      border-bottom: 1px solid #d7d7d7;
    }

    .demo-stage {
      grid-column: 1;
      grid-row: 2;
    }
  }

  @media (max-width: 700px) {
    .gallery-page {
      padding: var(--size-12);
    }

    .gallery-exhibit {
      --exhibit-inset: var(--size-12);
    }

    .gallery-hero {
      min-height: 0;
    }

    .gallery-hero-copy {
      padding: var(--size-32) var(--size-24);
    }

    .gallery-hero h1 {
      font-size: clamp(64px, 23vw, 96px);
    }

    .gallery-hero-specimen {
      min-height: 200px;
      margin: 0 var(--size-12) var(--size-12);
    }

    .exhibit-label {
      padding: var(--size-24);
    }

    .exhibit-heading {
      gap: var(--size-12);
    }

    .exhibit-caption {
      max-width: none;
    }

    .demo-stage {
      margin: 0 var(--exhibit-inset) var(--exhibit-inset);
      padding: var(--size-16);
    }

  }
</style>
