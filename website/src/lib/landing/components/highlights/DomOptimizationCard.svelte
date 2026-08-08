<script lang="ts">
  import CardDocsLink from "./CardDocsLink.svelte";
  import { onDestroy, tick } from "svelte";
  import { fade } from "svelte/transition";
  import ClientDemoFrame from "$lib/components/ClientDemoFrame.svelte";
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { ElementObject } from "@snapline/object";
  import { AnimationObject } from "@snapline/animation";
  import type { Engine as EngineType } from "@snapline/index";
  import { debugState } from "$lib/landing/debugState.svelte";

  type OperationType = "read" | "write" | "reflow";

  type Operation = {
    id: string;
    type: OperationType;
    label: string;
    meta: string;
  };

  type OperationRect = {
    x: number;
    y: number;
  };

  type FlameCategory = "task" | "script" | "layout";

  type FlameBlock = {
    id: string;
    /** Flame-chart label. */
    label: string;
    category: FlameCategory;
    /** Milliseconds from the start of the shared timeline. */
    start: number;
    duration: number;
    /** Nesting row: 0 = task, 1 = frame, 2 = individual operation. */
    depth: number;
    /** Present on leaves only — these are what the mobile pill list is built from. */
    op?: OperationType;
    /** Used when the pill wording differs from the flame-chart label. */
    pillLabel?: string;
    meta?: string;
  };

  type ProfileTrack = {
    id: "baseline" | "optimized";
    blocks: FlameBlock[];
    totalMs: number;
    overBudget: boolean;
  };

  const TRANSITION_DURATION = 520;
  const REVEAL_SPAN_MS = 900;
  const BLOCK_REVEAL_MS = 380;
  const MORPH_MS = 420;
  const FRAME_BUDGET_MS = 16.7;

  // Timings are illustrative, not measured — the engine exposes no frame or stage
  // instrumentation, so there is nothing real to sample here. They are still built
  // from shared per-operation costs rather than hand-tuned per track: a layout
  // recalculation costs the same wherever it happens, and both tracks perform the
  // SAME four reads and four writes. The only difference is the ordering, so the
  // gap between the two traces comes entirely from how many layouts it forces.
  const LAYOUT_MS = 3.4;
  const READ_MS = 0.6;
  const WRITE_MS = 0.4;
  // Shared by both tracks so the task, frame and first read all begin at the same
  // x. Their left edges then hold still across the toggle and only the widths
  // change; anything that does move is moving because the ordering differs.
  const FRAME_START_MS = 0.3;
  const FIRST_OP_START_MS = 0.5;

  const READ_LABELS = [
    ["read-bounds", "getBoundingClientRect"],
    ["read-style", "getComputedStyle"],
    ["read-offset", "offsetWidth"],
    ["read-scroll", "scrollHeight"],
  ] as const;
  const WRITE_LABELS = [
    ["write-width", "style.width = ..."],
    ["write-height", "style.height = ..."],
    ["write-class", "classList.add"],
    ["write-transform", "style.transform = ..."],
  ] as const;

  function readBlock(index: number, start: number): FlameBlock {
    const [id, label] = READ_LABELS[index];
    return { id, label, category: "script", start, duration: READ_MS, depth: 2, op: "read", meta: "R" };
  }

  function writeBlock(index: number, start: number): FlameBlock {
    const [id, label] = WRITE_LABELS[index];
    return { id, label, category: "script", start, duration: WRITE_MS, depth: 2, op: "write", meta: "W" };
  }

  function layoutBlock(id: string, start: number, pillLabel: string): FlameBlock {
    return { id, label: "Layout", category: "layout", start, duration: LAYOUT_MS, depth: 2, op: "reflow", meta: "layout", pillLabel };
  }

  /** Read -> write -> layout, four times over: every read after a write forces one. */
  function buildBaselineBlocks(): FlameBlock[] {
    const blocks: FlameBlock[] = [];
    let cursor = FIRST_OP_START_MS;
    for (let index = 0; index < READ_LABELS.length; index += 1) {
      blocks.push(readBlock(index, cursor));
      cursor += READ_MS;
      blocks.push(writeBlock(index, cursor));
      cursor += WRITE_MS;
      blocks.push(layoutBlock(`layout-${index}`, cursor, "forced reflow"));
      cursor += LAYOUT_MS;
    }
    return blocks;
  }

  /** All reads, then a single layout, then all writes. */
  function buildOptimizedBlocks(): FlameBlock[] {
    const blocks: FlameBlock[] = [];
    let cursor = FIRST_OP_START_MS;
    for (let index = 0; index < READ_LABELS.length; index += 1) {
      blocks.push(readBlock(index, cursor));
      cursor += READ_MS;
    }
    // Shares layout-0's id with the unbatched track so the surviving layout bar
    // morphs across the toggle instead of one vanishing and another appearing.
    blocks.push(layoutBlock("layout-0", cursor, "single reflow"));
    cursor += LAYOUT_MS;
    for (let index = 0; index < WRITE_LABELS.length; index += 1) {
      blocks.push(writeBlock(index, cursor));
      cursor += WRITE_MS;
    }
    return blocks;
  }

  // Ids are deliberately identical across the two tracks — that is what lets every
  // shared block keep its DOM node and animate between the two shapes rather than
  // being torn down and rebuilt. The frame bar keeps one name for the same reason.
  const FRAME_LABEL = "updateNodes()";

  function buildTrack(
    id: ProfileTrack["id"],
    leaves: FlameBlock[],
  ): ProfileTrack {
    const last = leaves[leaves.length - 1];
    const totalMs = Math.round((last.start + last.duration) * 10) / 10;
    return {
      id,
      totalMs,
      overBudget: totalMs > FRAME_BUDGET_MS,
      blocks: [
        { id: "task", label: "Task", category: "task", start: 0, duration: totalMs, depth: 0 },
        { id: "frame", label: FRAME_LABEL, category: "script", start: FRAME_START_MS, duration: totalMs - FRAME_START_MS, depth: 1 },
        ...leaves,
      ],
    };
  }

  const BASELINE_TRACK = buildTrack("baseline", buildBaselineBlocks());
  const OPTIMIZED_TRACK = buildTrack("optimized", buildOptimizedBlocks());

  /**
   * Shared denominator for BOTH tracks. Pinned to the unbatched total so that
   * trace fills the container exactly, which makes the batched one read as a
   * fraction of it. Deriving it means the two can never be scaled independently.
   */
  const TIMELINE_MS = BASELINE_TRACK.totalMs;

  // The mobile pill list is a projection of the same data, so the two views cannot
  // drift. Leaf ids and their order match what the FLIP animation keys on.
  function toOperations(track: ProfileTrack): Operation[] {
    return track.blocks
      .filter((block): block is FlameBlock & { op: OperationType } =>
        block.op !== undefined,
      )
      .map((block) => ({
        id: block.id,
        type: block.op,
        label: block.pillLabel ?? block.label,
        meta: block.meta ?? "",
      }));
  }

  const baselineOperations = toOperations(BASELINE_TRACK);
  const optimizedOperations = toOperations(OPTIMIZED_TRACK);

  // Desktop swaps the pill stack for the profiler. Visibility itself is CSS-only
  // (see the media query on .dom-profiler) so markup never depends on this — it
  // gates behaviour only, and can therefore be seeded synchronously without
  // risking a hydration mismatch.
  const PROFILER_QUERY = "(min-width: 900px)";

  let optimize = $state(false);
  let engine: EngineType | null = $state(null);
  let visualRef: HTMLDivElement | null = $state(null);
  let profilerRef: HTMLDivElement | null = $state(null);
  let isProfilerMode = $state(
    typeof window !== "undefined" && window.matchMedia(PROFILER_QUERY).matches,
  );
  let hasEnteredView = $state(false);
  /** False only before the first reveal, when blocks are held hidden by CSS. */
  let armed = $state(false);
  let revealKey = "";
  let pendingBlockRects: Map<string, { x: number; width: number }> | null = null;
  /**
   * The measured duration, animated rather than swapped. Drives both the readout
   * and the line's width, so the number counting down and the line shortening are
   * the same value and cannot drift apart.
   */
  let measuredMs = $state(0);
  let measureObject: ElementObject | null = null;
  let measureAnimation: InstanceType<typeof AnimationObject> | null = null;
  let operationAnimations: Array<InstanceType<typeof AnimationObject>> = [];
  let revealAnimations: Array<InstanceType<typeof AnimationObject>> = [];
  let pendingOperationRects: Map<string, OperationRect> | null = null;
  let runKey = "";

  const operations = $derived(
    optimize ? optimizedOperations : baselineOperations,
  );
  /**
   * The profiler shows one lane at a time, driven by the same toggle as mobile.
   * The timeline scale stays pinned at TIMELINE_MS for both, so switching visibly
   * collapses the trace from ~90% of the ruler to ~20% — that contrast is the
   * whole point, and it would be destroyed by normalising per track.
   */
  const activeTrack = $derived(optimize ? OPTIMIZED_TRACK : BASELINE_TRACK);

  $effect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const query = window.matchMedia(PROFILER_QUERY);
    const sync = () => {
      isProfilerMode = query.matches;
    };

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  });

  $effect(() => {
    // The pill stack is display:none on desktop, so measuring it would produce
    // zeroed rects. Clearing runKey lets a resize back to mobile rebuild cleanly.
    if (isProfilerMode) {
      runKey = "";
      return;
    }

    if (!engine || !visualRef) {
      return;
    }

    const nextRunKey = `${optimize ? "optimized" : "baseline"}:${operations.length}`;
    if (nextRunKey === runKey) {
      return;
    }

    runKey = nextRunKey;
    setupTimeline();
  });

  // Arm the first reveal on scroll-in; this only decides *when* the trace is
  // allowed to record, never which track.
  $effect(() => {
    if (!isProfilerMode || !profilerRef || hasEnteredView) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      hasEnteredView = true;
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          return;
        }
        observer.disconnect();
        hasEnteredView = true;
      },
      { threshold: 0.35 },
    );

    observer.observe(profilerRef);
    return () => observer.disconnect();
  });

  // Re-records the trace whenever the visible track changes, so toggling reads as
  // a fresh profile rather than bars silently resizing.
  $effect(() => {
    if (!isProfilerMode) {
      revealKey = "";
      return;
    }
    if (!profilerRef || !hasEnteredView) {
      return;
    }

    const nextRevealKey = activeTrack.id;
    if (nextRevealKey === revealKey) {
      return;
    }

    revealKey = nextRevealKey;

    if (prefersReducedMotion()) {
      // armed must be set here too, or the CSS that holds blocks hidden before
      // the first reveal would never be released.
      armed = true;
      pendingBlockRects = null;
      measureAnimation?.cancel();
      measureAnimation = null;
      measuredMs = activeTrack.totalMs;
      return;
    }

    playReveal();
  });

  onDestroy(() => {
    stopTimeline();
    stopReveal();
    measureAnimation?.cancel();
    measureAnimation = null;
    measureObject?.destroy();
    measureObject = null;
  });

  function prefersReducedMotion() {
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function stopReveal() {
    for (const animation of revealAnimations) {
      animation.cancel();
    }
    revealAnimations = [];
  }

  /**
   * Counts the readout from wherever it currently sits to the new total, using
   * the engine's $variable channel. Interpolating from the live value rather than
   * from the outgoing track's total means an interrupted toggle picks up
   * mid-count instead of jumping.
   *
   * The tick needs the engine to sample it each frame, which only happens for
   * animations owned by an ElementObject — hence the object below.
   */
  function playMeasure(target: number, duration: number) {
    if (!engine || !profilerRef) {
      return;
    }

    measureAnimation?.cancel();

    if (!measureObject) {
      measureObject = new ElementObject(engine, null);
      measureObject.element = profilerRef;
    }

    const from = measuredMs;
    const animation = new AnimationObject(
      profilerRef,
      { $measure: [from, target] },
      {
        duration,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        tick: (values: Record<string, number>) => {
          if (typeof values.$measure === "number") {
            measuredMs = values.$measure;
          }
        },
        finish: () => {
          measuredMs = target;
        },
      },
    );

    measureObject.addAnimation(animation, { replaceExisting: false });
    measureAnimation = animation;
    animation.play();
  }

  function collectBlockRects() {
    const rects = new Map<string, { x: number; width: number }>();
    if (!profilerRef) {
      return rects;
    }

    for (const element of profilerRef.querySelectorAll<HTMLElement>(
      "[data-block-id]",
    )) {
      const id = element.dataset.blockId;
      if (!id) {
        continue;
      }
      const rect = element.getBoundingClientRect();
      rects.set(id, { x: rect.x, width: rect.width });
    }

    return rects;
  }

  /**
   * Two behaviours share one pass:
   *
   * - First view: bars sweep in staggered by their position on the shared clock,
   *   so the trace reads as being recorded left to right.
   * - On toggle: every block that exists in both tracks keeps its DOM node and
   *   FLIPs from its old geometry to its new one, so the Task and frame bars grow
   *   and shrink and the reads and writes slide into their new slots. Only the
   *   layout bars with no counterpart enter or leave.
   *
   * transform/opacity only. Animating width or left would trigger layout every
   * frame, inside the card whose whole argument is not doing that. scaleX does
   * squash the labels, which is why they stay hidden until the motion settles.
   */
  function playReveal() {
    if (!profilerRef) {
      return;
    }

    stopReveal();
    const previousRects = pendingBlockRects;
    pendingBlockRects = null;
    armed = true;

    // On first view the readout counts up alongside the sweep; on a toggle it
    // counts between the two totals over the same span as the bars morphing.
    playMeasure(
      activeTrack.totalMs,
      previousRects ? MORPH_MS : REVEAL_SPAN_MS + BLOCK_REVEAL_MS,
    );

    for (const block of activeTrack.blocks) {
      const element = profilerRef.querySelector<HTMLElement>(
        `[data-block-id="${block.id}"]`,
      );
      if (!element) {
        continue;
      }

      const label = profilerRef.querySelector<HTMLElement>(
        `[data-label-id="${block.id}"]`,
      );
      const rect = element.getBoundingClientRect();
      const previous = previousRects?.get(block.id);
      let barKeyframes: Record<string, string[] | number[]>;
      let labelKeyframes: Record<string, string[] | number[]>;
      let duration = BLOCK_REVEAL_MS;
      let delay = 0;
      let easing = "cubic-bezier(0.22, 1, 0.36, 1)";

      if (previous && rect.width > 0.5) {
        const dx = previous.x - rect.x;
        const scaleX = Math.max(previous.width, 0.5) / rect.width;
        if (Math.abs(dx) < 0.5 && Math.abs(scaleX - 1) < 0.01) {
          continue;
        }
        barKeyframes = {
          transform: [
            `translateX(${dx.toFixed(2)}px) scaleX(${scaleX.toFixed(4)})`,
            "translateX(0px) scaleX(1)",
          ],
        };
        // Position only — scaling here is what used to squash the text.
        labelKeyframes = {
          transform: [`translateX(${dx.toFixed(2)}px)`, "translateX(0px)"],
        };
        duration = MORPH_MS;
        easing = "cubic-bezier(0.4, 0, 0.2, 1)";
      } else {
        // No counterpart in the outgoing track (or this is the first reveal).
        barKeyframes = { transform: ["scaleX(0)", "scaleX(1)"], opacity: [0, 1] };
        labelKeyframes = { opacity: [0, 1] };
        delay = previousRects
          ? 0
          : (block.start / TIMELINE_MS) * REVEAL_SPAN_MS;
      }

      for (const [target, keyframes] of [
        [element, barKeyframes],
        [label, labelKeyframes],
      ] as const) {
        if (!target) {
          continue;
        }

        const animation = new AnimationObject(target, keyframes, {
          duration,
          delay,
          easing,
          finish: () => {
            target.style.transform = "";
            target.style.opacity = "";
            // Leaving this set would pin a compositor layer per bar forever.
            target.style.willChange = "";
          },
        });

        revealAnimations.push(animation);
        animation.play();
      }
    }
  }

  async function toggleOptimize() {
    pendingOperationRects = collectOperationRects();
    if (isProfilerMode && !prefersReducedMotion()) {
      // Measure before the swap so every surviving block can FLIP from where it
      // was, and hide the labels in the same update so they never show squashed.
      pendingBlockRects = collectBlockRects();
    }
    optimize = !optimize;
    await tick();
  }

  function setupTimeline() {
    if (!engine || !visualRef) {
      return;
    }

    stopTimeline();

    const previousRects = pendingOperationRects;
    pendingOperationRects = null;

    animateOperationObjects(previousRects);
  }

  function stopTimeline() {
    for (const animation of operationAnimations) {
      animation.cancel();
    }
    operationAnimations = [];
  }

  function animateOperationObjects(
    previousRects: Map<string, OperationRect> | null,
  ) {
    operations.forEach((operation) => {
      const element = visualRef?.querySelector<HTMLElement>(
        `[data-operation-id="${operation.id}"]`,
      );
      if (!element) {
        return;
      }

      const currentRect = element.getBoundingClientRect();
      const previousRect = previousRects?.get(operation.id);
      const dx = previousRect ? previousRect.x - currentRect.x : 0;
      const dy = previousRect ? previousRect.y - currentRect.y : 0;
      const isMoving = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;
      const isEntering = !previousRect;

      element.style.setProperty(
        "--operation-pulse",
        operation.type === "reflow" ? "0.8" : "0",
      );

      if (!isMoving && !isEntering) {
        element.style.opacity = "1";
        element.style.transform = "";
        return;
      }

      const animation = new AnimationObject(
        element,
        {
          opacity: isEntering ? [0, 1] : [1, 1],
          transform: isMoving
            ? [`translate(${dx}px, ${dy}px)`, "translate(0px, 0px)"]
            : ["translate(0px, 0px)", "translate(0px, 0px)"],
        },
        {
          duration: TRANSITION_DURATION,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          finish: () => {
            element.style.opacity = "1";
            element.style.transform = "";
          },
        },
      );

      operationAnimations.push(animation);
      animation.play();
    });
  }

  function collectOperationRects() {
    const rects = new Map<string, OperationRect>();
    if (!visualRef) {
      return rects;
    }

    for (const element of visualRef.querySelectorAll<HTMLElement>(
      "[data-operation-id]",
    )) {
      const id = element.dataset.operationId;
      if (!id) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      rects.set(id, { x: rect.x, y: rect.y });
    }

    return rects;
  }

</script>

<article class="dom-optimization-card theme-secondary-2">
  <div class="dom-optimization-layout">
    <div class="dom-optimization-heading">
      <h3>DOM Optimization</h3>
      <p>The task queue system allows DOM read and write operations
          to be batched together to reduce <i>layout thrashing</i>.
          This allows for higher framerates when multiple elements are
          being mutated on screen.</p>
          <CardDocsLink href="/docs/snapengine/introduction/03_render" label="Render queue docs" />
    </div>

    <div class="dom-optimization-column">
      <div
        class="dom-optimization-body card"
        bind:this={visualRef}
      >
        <button
          class="optimize-control"
          type="button"
          onclick={toggleOptimize}
          role="switch"
          aria-checked={optimize}
          aria-label="Batch DOM operations"
        >
          <span class={`optimize-label optimize-label-left ${!optimize ? "is-active" : ""}`}>
            <span class="optimize-label-icon material-symbols-outlined" aria-hidden="true">traffic_jam</span>
          </span>
          <div
            class="mini-toggle-switch slot"
            class:enabled={optimize}
          >
            <div class="mini-toggle-knob disk"></div>
          </div>
          <span class={`optimize-label optimize-label-right ${optimize ? "is-active" : ""}`}>
            <span class="optimize-label-icon material-symbols-outlined" aria-hidden="true">bolt</span>
          </span>
        </button>

        <p class="sr-only">
          Unbatched DOM access interleaves {READ_LABELS.length} reads and
          {WRITE_LABELS.length} writes, forcing {READ_LABELS.length} separate
          layouts and taking {BASELINE_TRACK.totalMs} milliseconds — over the
          {FRAME_BUDGET_MS} millisecond frame budget. Batching the same
          operations performs every read, then a single layout, then every write,
          taking {OPTIMIZED_TRACK.totalMs} milliseconds.
        </p>

        <ClientDemoFrame>
          {#snippet fallback()}
            <div class="operation-stack dom-optimization-skeleton" aria-hidden="true">
              {#each baselineOperations as operation (operation.id)}
                <div class={`operation-pill ${operation.type}`}>
                  <span>{operation.meta}</span>
                  <strong>{operation.label}</strong>
                </div>
              {/each}
            </div>
            <div class="dom-profiler dom-profiler-skeleton" aria-hidden="true">
              <span></span>
              <div class="dom-profiler-measure"></div>
              <span></span>
              <div class="dom-profiler-lane"><span class="dom-profiler-grid"></span></div>
            </div>
          {/snippet}
          <Engine id="dom-optimization-highlight" bind:engine debug={debugState.enabled}>
          <div class:optimized={optimize} class="operation-stack" aria-hidden="true">
            {#each operations as operation (operation.id)}
              <div
                class={`operation-pill ${operation.type}`}
                data-operation-id={operation.id}
              >
                <span>{operation.meta}</span>
                <strong>{operation.label}</strong>
              </div>
            {/each}
          </div>

          <div
            class="dom-profiler"
            class:is-armed={armed}
            style={`--total: ${TIMELINE_MS};`}
            bind:this={profilerRef}
            aria-hidden="true"
          >
            <!-- Spans the trace itself rather than the full scale, so it shortens
                 visibly when the batched run is selected. -->
            <div class="dom-profiler-measure">
              <span
                class="dom-profiler-measure-line"
                style={`--dur: ${measuredMs.toFixed(2)};`}
              >
                <span
                  class="dom-profiler-measure-value"
                  class:is-win={measuredMs <= FRAME_BUDGET_MS}
                >{measuredMs.toFixed(1)} ms</span>
              </span>
            </div>

            <div class="dom-profiler-lane">
              <span class="dom-profiler-grid"></span>
              <span class="dom-profiler-budget"></span>
              {#each activeTrack.blocks as block (block.id)}
                {@const geometry = `--start: ${block.start}; --dur: ${block.duration}; --depth: ${block.depth};`}
                <span
                  class={`dom-profiler-block is-${block.category}`}
                  class:is-write={block.op === "write"}
                  class:is-overbudget={block.depth === 0 && activeTrack.overBudget}
                  data-block-id={block.id}
                  style={geometry}
                  out:fade={{ duration: 140 }}
                ></span>
                <!-- Sibling of the bar, not a child: the bar is scaled to morph
                     between widths, and nesting the label inside would squash the
                     text along with it. -->
                <span
                  class={`dom-profiler-label is-${block.category}`}
                  data-label-id={block.id}
                  style={geometry}
                  out:fade={{ duration: 140 }}
                >{block.label}</span>
              {/each}
            </div>
          </div>
          </Engine>
        </ClientDemoFrame>
      </div>

      <p class="dom-optimization-disclaimer">
        Synthetic figures illustrating the effect of batching DOM access — not
        benchmark results.
      </p>
    </div>
  </div>
</article>

<style lang="scss">
  .dom-optimization-card {
    --card-padding: 40px;
    --card-top-padding: var(--card-padding);
    container-type: inline-size;
    container-name: dom-optimization-card;
    position: relative;
    height: 100%;
    min-height: 0;
    box-sizing: border-box;
    /* Padding lives on the children so the visual can bleed to the card edge,
       matching the other highlight cards. */
    padding: 0;
    background: var(--color-background-tint);
    border-radius: var(--ui-radius);
    overflow: hidden;

    @media (max-width: 720px) {
      --card-padding: var(--size-24);
      --card-top-padding: var(--highlight-card-mobile-top-padding);
      grid-column: span 2;
    }
  }

  /* Heading sits above the demo rather than beside it, so this is a single
     column at every width and needs no breakpoint of its own. */
  .dom-optimization-layout {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--size-32);
    width: 100%;
    height: 100%;
    box-sizing: border-box;

    @container dom-optimization-card (max-width: 400px) {
      gap: var(--size-24);
    }
  }

  .dom-optimization-heading {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--size-16);
    padding: var(--card-top-padding) var(--card-padding) 0;
    min-width: 0;
    text-align: center;

    h3 {
      max-width: 100%;
      margin: 0;
      font-family: var(--font-display);
      font-size: var(--highlight-card-heading-size);
      line-height: 0.9;
    }

    p {
      margin: 0;
      max-width: 500px;
    }

    @container dom-optimization-card (max-width: 400px) {
      gap: var(--size-12);
    }
  }

  .optimize-control {
    /* Reset the design system's button chrome — this is a bare toggle row. */
    appearance: none;
    background: none;
    border: none;
    box-shadow: none;
    padding: 0;
    text-align: inherit;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: var(--size-12);
    width: 100%;
    min-width: 0;
    color: #202426;
    cursor: pointer;

    /* The design system's button:hover carries a bevel and drop shadow, and its
       :not() chain outranks the flat reset above — so it has to be undone at
       matching specificity. */
    &:hover:not(:disabled):not(.active) {
      color: #202426;
      box-shadow: none;
      text-shadow: none;
    }

    &:active {
      box-shadow: none;
      transform: none;
    }
    font-family: "Bitcount Grid Single", monospace;
    font-size: 0.92rem;
    font-weight: 450;
    line-height: 1;
    user-select: none;
  }

  .optimize-control:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 3px;
  }

  .optimize-label {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    font-family: "Bitcount Grid Single", monospace;
    font-optical-sizing: auto;
    font-style: normal;
    letter-spacing: 0;
    text-transform: lowercase;
  }

  .optimize-label-icon {
    display: inline-block;
    font-family: "Material Symbols Outlined";
    font-size: 1.15rem;
    font-style: normal;
    font-weight: 500;
    line-height: 1;
    color: rgba(0, 0, 0, 0.8);
    transition:
      color 0.18s ease,
      filter 0.18s ease;
    font-variation-settings:
      "FILL" 0,
      "wght" 500,
      "GRAD" 0,
      "opsz" 24;
  }

  .optimize-label.is-active .optimize-label-icon {
    color: var(--color-primary);
    filter: drop-shadow(0 0 6px rgba(255, 117, 58, 0.58));
  }

  .optimize-label-left {
    justify-content: flex-end;
    text-align: right;
  }

  .optimize-label-right {
    justify-content: flex-start;
    text-align: left;
  }

  .mini-toggle-switch {
    position: relative;
    width: 36px;
    height: 22px;
    flex: 0 0 auto;
    border-radius: 999px;
    --ui-radius: 999px;
    cursor: pointer;
    overflow: hidden;
    transition: background-color 0.3s ease;

    &:hover {
      background-color: rgba(0, 0, 0, 0.08);
    }

    &.enabled {
      background-color: var(--color-primary);
    }
  }

  .mini-toggle-knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    padding: 0;
    --ui-radius: 999px;
    --card-color: rgb(29, 29, 29);
    background-color: var(--color-primary);
    transition:
      transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275),
      background-color 0.3s ease;
  }

  .mini-toggle-switch.enabled .mini-toggle-knob {
    transform: translateX(14px);
    background-color: white;
  }

  /* Holds the white card plus the disclaimer that sits beneath it, so the outer
     spacing lives here rather than on the card itself. */
  .dom-optimization-column {
    display: flex;
    flex-direction: column;
    gap: var(--size-12);
    min-width: 0;
    /* Capped and centred rather than filling the card. The min() keeps a gutter
       of --card-padding on narrow screens, so the width is expressed once instead
       of as a max-width fighting a margin. */
    width: min(700px, calc(100% - var(--card-padding) * 2));
    margin: 0 auto var(--card-padding);
  }

  .dom-optimization-body {
    container-type: inline-size;
    container-name: dom-optimization-visual;
    position: relative;
    box-sizing: border-box;
    min-width: 0;
    padding: var(--size-16);
    /* Driven by a media query rather than isProfilerMode: this has to be correct
       during SSR and on the pre-effect frame, or the card jumps height on
       hydration and shoves everything below it down.
       Sized for the tallest mobile stack — 12 pills in the unbatched state. */
    min-height: 28.5rem;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: var(--size-16);

    @media (min-width: 900px) {
      min-height: 15rem;
    }
  }

  .dom-optimization-body :global(.snap-engine-canvas) {
    width: 100%;
    flex: 1;
    min-height: 0;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  /* ── Desktop profiler ──────────────────────────────────────────────────────
     Visibility is CSS-only. ClientDemoFrame paints its fallback for a frame on
     the client too, and isProfilerMode can only be set from an effect, so an
     {#if} would show the mobile tree on desktop for two successive states. */
  .sr-only {
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

  .dom-profiler {
    /* Fallback only — the real value is set inline from TIMELINE_MS, which is the
       unbatched total. Both tracks share it, so there is no code path where the
       batched trace could normalise to its own duration and destroy the contrast. */
    --total: 18.1;
    --row-h: 27px;
    /* One value for both axes, so the space between blocks reads as a grid. */
    --block-gap: 3px;
    --flame-gridline: rgba(51, 54, 55, 0.08);
    --flame-task: #eef0f1;
    --flame-task-border: #d8dde0;
    --flame-read: #e3e7e9;
    --flame-write: #cfd5d8;
    --flame-layout: #e5301f;
    --flame-ink: #4b5155;
    flex-direction: column;
    gap: var(--size-16);
    width: 100%;
  }

  .dom-profiler-measure {
    position: relative;
    height: 30px;
  }

  .dom-profiler-measure-line {
    position: absolute;
    left: 0;
    bottom: 3px;
    /* Same gap subtraction as the blocks, so the line ends flush with the bar. */
    width: calc(var(--dur) / var(--total) * 100% - var(--block-gap));
    height: 1px;
    background: rgba(51, 54, 55, 0.35);
  }

  /* End caps, so the line reads as a measurement rather than a divider. */
  .dom-profiler-measure-line::before,
  .dom-profiler-measure-line::after {
    content: "";
    position: absolute;
    top: -4px;
    width: 1px;
    height: 9px;
    background: rgba(51, 54, 55, 0.45);
  }

  .dom-profiler-measure-line::before {
    left: 0;
  }

  .dom-profiler-measure-line::after {
    right: 0;
  }

  /* Centred on the span it measures, so it stays inside the lane at any width. */
  .dom-profiler-measure-value {
    position: absolute;
    bottom: 7px;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    font-family: "Bitcount Grid Single", monospace;
    font-size: 1.05rem;
    font-variant-numeric: tabular-nums;
    color: var(--flame-layout);
  }

  .dom-profiler-measure-value.is-win {
    color: var(--color-primary);
  }

  .dom-profiler-lane {
    position: relative;
    height: calc(3 * var(--row-h));
    min-width: 0;
  }

  .dom-profiler-grid {
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    /* 25% of the lane == 5ms of the 20ms scale, so this stays locked to the
       ruler at any width without a node per line. */
    background-image: repeating-linear-gradient(
      to right,
      var(--flame-gridline) 0 1px,
      transparent 1px 25%
    );
  }

  .dom-profiler-budget {
    position: absolute;
    top: 0;
    bottom: 0;
    left: calc(16.7 / var(--total) * 100%);
    z-index: 2;
    border-left: 1px dashed rgba(217, 58, 46, 0.45);
    pointer-events: none;
  }

  .dom-profiler-block {
    position: absolute;
    left: calc(var(--start) / var(--total) * 100%);
    /* Each block gives up --block-gap on its right and bottom, so neighbours are
       separated by the same distance horizontally and vertically. The clamp keeps
       a 0.2ms block visible; those bars are not to scale. */
    width: max(3px, calc(var(--dur) / var(--total) * 100% - var(--block-gap)));
    top: calc(var(--depth) * var(--row-h));
    height: calc(var(--row-h) - var(--block-gap));
    z-index: 1;
    overflow: hidden;
    border-radius: 2px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
    transform-origin: left center;
    background: var(--flame-read);
    color: var(--flame-ink);
    font-family: "Bitcount Grid Single", monospace;
  }

  .dom-profiler-block.is-task {
    background: var(--flame-task);
    border: 1px solid var(--flame-task-border);
  }

  .dom-profiler-block.is-write {
    background: var(--flame-write);
  }

  .dom-profiler-block.is-layout {
    background: var(--flame-layout);
    color: #fff;
  }

  /* DevTools' long-task marker fires at 50ms, so this borrows the signifier but
     states the claim it can actually support: over the frame budget. */
  .dom-profiler-block.is-overbudget::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      45deg,
      rgba(217, 58, 46, 0.26) 0 3px,
      transparent 3px 6px
    );
  }

  .dom-profiler-block.is-overbudget::before {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    z-index: 2;
    border-top: 9px solid var(--flame-layout);
    border-left: 9px solid transparent;
  }

  /* Same geometry as its bar, but positioned independently so the bar's scaleX
     never reaches it. Only ever translated, never scaled. */
  .dom-profiler-label {
    position: absolute;
    left: calc(var(--start) / var(--total) * 100%);
    top: calc(var(--depth) * var(--row-h));
    width: max(3px, calc(var(--dur) / var(--total) * 100% - var(--block-gap)));
    height: calc(var(--row-h) - var(--block-gap));
    z-index: 2;
    box-sizing: border-box;
    overflow: hidden;
    padding-inline: 6px;
    color: var(--flame-ink);
    font-family: "Bitcount Grid Single", monospace;
    font-size: 0.8rem;
    line-height: calc(var(--row-h) - var(--block-gap));
    text-overflow: ellipsis;
    white-space: nowrap;
    pointer-events: none;
    transform-origin: left center;
  }

  /* No longer inherited from the bar, so the colour has to be restated. */
  .dom-profiler-label.is-layout {
    color: #fff;
  }

  /* Held hidden only until the first reveal runs — otherwise the trace paints at
     full size for a frame before the animation collapses it, which reads as a
     flash. Labels are separate elements now, so nothing needs hiding mid-morph. */
  .dom-profiler:not(.is-armed) .dom-profiler-block {
    opacity: 0;
    transform: scaleX(0);
  }

  .dom-profiler:not(.is-armed) .dom-profiler-label {
    opacity: 0;
  }

  /* Hidden only until the first reveal starts, so it never shows 0.0 ms. After
     that it stays put — the line shortens and the number counts, rather than
     fading out and back in. */
  .dom-profiler:not(.is-armed) .dom-profiler-measure {
    opacity: 0;
  }

  .dom-optimization-disclaimer {
    margin: 0;
    font-size: 0.68rem;
    line-height: 1.3;
    color: rgba(51, 54, 55, 0.5);
    text-align: center;
    text-wrap: balance;
  }

  .dom-profiler-skeleton .dom-profiler-lane {
    background: rgba(51, 54, 55, 0.03);
  }

  .operation-stack {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    width: 100%;
    justify-content: center;
  }

  .operation-stack.optimized {
    gap: var(--size-8);
  }

  .dom-optimization-skeleton {
    opacity: 0.72;
  }

  .operation-pill {
    --operation-pulse: 0;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
    padding: 0.32rem 0.5rem;
    border-radius: var(--size-4);
    background:
      linear-gradient(
        90deg,
        rgba(255, 255, 255, calc(0.5 + var(--operation-pulse) * 0.32)),
        rgba(255, 255, 255, 0.55)
      );
    border: 1px solid rgba(0, 0, 0, 0.08);
    box-shadow: 0 0 0 calc(var(--operation-pulse) * 3px)
      rgba(255, 255, 255, 0.35);
    transform-origin: center;
    will-change: opacity, transform;
  }

  .operation-pill.read,
  .operation-pill.write {
    flex-direction: row;
    align-items: center;
    gap: var(--size-8);
    padding: 0.22rem 0.45rem;
  }

  .operation-pill.reflow {
    background: var(--color-secondary-1);
    border-color: transparent;
    box-shadow: none;
  }

  .operation-pill span {
    font-family: "Bitcount Grid Single", monospace;
    font-size: 0.58rem;
    line-height: 1;
    text-transform: uppercase;
  }

  .operation-pill.read span,
  .operation-pill.write span {
    display: inline-flex;
    width: 0.9rem;
    height: 0.9rem;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    border-radius: var(--size-4);
    background: rgba(255, 255, 255, 0.68);
    font-size: 0.58rem;
  }

  .operation-pill strong {
    min-width: 0;
    overflow: hidden;
    color: #222628;
    font-family: "Bitcount Grid Single", monospace;
    font-optical-sizing: auto;
    font-size: clamp(0.54rem, 1.2vw, 0.64rem);
    font-style: normal;
    font-weight: 360;
    letter-spacing: 0;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .operation-pill.read span {
    color: var(--color-text-muted);
  }

  .operation-pill.write span {
    color: var(--color-action);
  }

  .operation-pill.reflow span,
  .operation-pill.reflow strong {
    color: #ffffff;
  }

  /* ── Mobile / desktop visibility swap ──────────────────────────────────────
     MUST stay last in this stylesheet. These selectors have the same specificity
     as the base rules they override (a media query adds none), so source order
     is the only thing deciding the winner — `.operation-stack { display: flex }`
     above would otherwise beat `display: none` here and both views would render
     at once, squashing the profiler. */
  .dom-profiler {
    display: none;
  }

  @media (min-width: 900px) {
    /* The toggle stays on desktop — the profiler shows one lane at a time. */
    .operation-stack {
      display: none;
    }

    .dom-profiler {
      display: flex;
    }
  }
</style>
