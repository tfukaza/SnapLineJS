<script lang="ts">
  import CardDocsLink from "./CardDocsLink.svelte";
  import { onDestroy, onMount, tick } from "svelte";
  import { fade } from "svelte/transition";

  type RowId = "move" | "dragStart" | "drag" | "pinch";
  type Point = {
    x: number;
    y: number;
    xp: number;
    yp: number;
  };
  type PointerMarker = Point & {
    id: number;
  };
  type DragLine = {
    id: number;
    start: Point;
    current: Point;
  };

  const rows: RowId[] = ["move", "dragStart", "drag", "pinch"];
  const plusCells = Array.from({ length: 180 }, (_, index) => index);
  const rowLabels: Record<RowId, string> = {
    move: "pointerMove",
    dragStart: "dragStart",
    drag: "drag",
    pinch: "pinch",
  };
  const asciiBoxRows = ["┌──┬──┐", "│  □  │", "├─────┤", "└─────┘"];
  const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const spinnerRows = new Set<RowId>(["move", "drag", "pinch"]);
  const touchColumns = [2, 3, 3, 2];

  let activeRow = $state<RowId | null>(null);
  let rowValues = $state<Record<RowId, string>>({
    move: "x:null y:null",
    dragStart: "x:null y:null",
    drag: "x:null y:null",
    pinch: "d:null",
  });
  let rowArrows = $state<Record<RowId, string>>({
    move: "",
    dragStart: "",
    drag: "",
    pinch: "",
  });
  let rowSpinnerFrames = $state<Record<RowId, number>>({
    move: 0,
    dragStart: 0,
    drag: 0,
    pinch: 0,
  });
  let mouseButtons = $state(0);
  let inputMode = $state<"mouse" | "touch">("mouse");
  let activePointers = $state<PointerMarker[]>([]);
  let dragLines = $state<DragLine[]>([]);
  let glyphPanelHidden = $state(false);
  // The hint only earns its space until the visitor discovers the surface is live.
  let hasInteracted = $state(false);

  const hintLines = ["Click or touch to", "visualize input handling"];
  const hintRunnerGlyph = "*";
  const hintInnerWidth = Math.max(...hintLines.map((line) => line.length));

  // Plain ASCII rather than Unicode box-drawing: Bitcount has no ┌─┐ glyphs, so those
  // silently fall back to another font at a wider advance and the box stops lining up.
  const hintGrid = hintLines
    .map((line) => ["|", " ", ...line.padEnd(hintInnerWidth, " "), " ", "|"])
    .reduce(
      (rows, row) => (rows.push(row), rows),
      [["+", ...Array(hintInnerWidth + 2).fill("-"), "+"]] as string[][],
    )
    .concat([["+", ...Array(hintInnerWidth + 2).fill("-"), "+"]]);

  // Perimeter walked clockwise from the top-left, so the runner circles the box.
  const hintPerimeter: Array<[number, number]> = (() => {
    const rows = hintGrid.length;
    const cols = hintGrid[0].length;
    const path: Array<[number, number]> = [];
    for (let c = 0; c < cols; c++) path.push([0, c]);
    for (let r = 1; r < rows - 1; r++) path.push([r, cols - 1]);
    for (let c = cols - 1; c >= 0; c--) path.push([rows - 1, c]);
    for (let r = rows - 2; r >= 1; r--) path.push([r, 0]);
    return path;
  })();

  let hintRunner = $state(0);

  const hintFrame = $derived.by(() => {
    const [row, col] = hintPerimeter[hintRunner % hintPerimeter.length];
    return hintGrid
      .map((chars, r) =>
        chars.map((char, c) => (r === row && c === col ? hintRunnerGlyph : char)).join(""),
      )
      .join("\n");
  });

  $effect(() => {
    if (hasInteracted) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      hintRunner = (hintRunner + 1) % hintPerimeter.length;
    }, 55);
    return () => clearInterval(timer);
  });
  let tapDisplayElement: HTMLDivElement | null = null;
  let displayResizeObserver: ResizeObserver | null = null;
  let glyphPanelCheckPending = false;
  let rowTimer: ReturnType<typeof setTimeout> | null = null;
  const previousPoints = new Map<number, Point>();
  const pointerArrows = new Map<number, string>();
  const leftMousePressed = $derived((mouseButtons & 1) !== 0);
  const rightMousePressed = $derived((mouseButtons & 2) !== 0);
  const middleMousePressed = $derived((mouseButtons & 4) !== 0);

  const pinchLine = $derived(
    activePointers.length >= 2
      ? {
          a: activePointers[0],
          b: activePointers[1],
        }
      : null,
  );

  function pointFromEvent(event: PointerEvent & { currentTarget: HTMLElement }): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));

    return {
      x,
      y,
      xp: (x / rect.width) * 100,
      yp: (y / rect.height) * 100,
    };
  }

  function coordText(point: Point) {
    return `x:${Math.round(point.x)} y:${Math.round(point.y)}`;
  }

  function directionArrow(from: Point | undefined, to: Point) {
    if (!from) return "";

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.hypot(dx, dy) < 2) return "";

    const angle = Math.atan2(dy, dx);
    const directions = ["→︎", "↘︎", "↓︎", "↙︎", "←︎", "↖︎", "↑︎", "↗︎"];
    const index = Math.round(angle / (Math.PI / 4));
    return directions[(index + 8) % 8];
  }

  function activateRow(row: RowId, value: string, arrows = "") {
    activeRow = row;
    rowValues = { ...rowValues, [row]: value };
    rowArrows = { ...rowArrows, [row]: arrows };
    if (spinnerRows.has(row)) {
      rowSpinnerFrames = {
        ...rowSpinnerFrames,
        [row]: (rowSpinnerFrames[row] + 1) % spinnerFrames.length,
      };
    }

    if (rowTimer) clearTimeout(rowTimer);
    rowTimer = setTimeout(() => {
      activeRow = null;
      rowTimer = null;
    }, 420);
    scheduleGlyphPanelCheck();
  }

  function updatePointer(id: number, point: Point) {
    const existing = activePointers.find((pointer) => pointer.id === id);
    if (existing) {
      activePointers = activePointers.map((pointer) =>
        pointer.id === id ? { id, ...point } : pointer,
      );
      return;
    }

    activePointers = [...activePointers, { id, ...point }];
  }

  function updateDragLine(id: number, point: Point) {
    dragLines = dragLines.map((line) =>
      line.id === id ? { ...line, current: point } : line,
    );
  }

  function handlePointerDown(event: PointerEvent & { currentTarget: HTMLElement }) {
    hasInteracted = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    inputMode = event.pointerType === "touch" ? "touch" : "mouse";
    mouseButtons = event.buttons;
    const point = pointFromEvent(event);
    updatePointer(event.pointerId, point);
    previousPoints.set(event.pointerId, point);
    pointerArrows.set(event.pointerId, "");
    dragLines = [...dragLines, { id: event.pointerId, start: point, current: point }];
    activateRow("dragStart", coordText(point));
    scheduleGlyphPanelCheck();
  }

  function handlePointerMove(event: PointerEvent & { currentTarget: HTMLElement }) {
    inputMode = event.pointerType === "touch" ? "touch" : "mouse";
    mouseButtons = event.buttons;
    const point = pointFromEvent(event);
    const arrow = directionArrow(previousPoints.get(event.pointerId), point);
    if (arrow) pointerArrows.set(event.pointerId, arrow);

    const isDragging = dragLines.some((line) => line.id === event.pointerId);
    if (isDragging) {
      updatePointer(event.pointerId, point);
      updateDragLine(event.pointerId, point);
      activateRow("drag", coordText(point), arrow);
    } else {
      activateRow("move", coordText(point), arrow);
    }

    if (activePointers.length >= 2) {
      const [first, second] = activePointers;
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const pinchArrows = [first, second]
        .map((pointer) => pointerArrows.get(pointer.id))
        .filter(Boolean)
        .join(" ");
      activateRow("pinch", `d:${Math.round(distance)}`, pinchArrows);
    }

    previousPoints.set(event.pointerId, point);
    scheduleGlyphPanelCheck();
  }

  function handlePointerUp(event: PointerEvent & { currentTarget: HTMLElement }) {
    inputMode = event.pointerType === "touch" ? "touch" : "mouse";
    mouseButtons = event.buttons;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    activePointers = activePointers.filter((pointer) => pointer.id !== event.pointerId);
    dragLines = dragLines.filter((line) => line.id !== event.pointerId);
    previousPoints.delete(event.pointerId);
    pointerArrows.delete(event.pointerId);
    scheduleGlyphPanelCheck();
  }

  function rowOutput(row: RowId) {
    return `${rowLabels[row]}(${rowValues[row]})`;
  }

  function bulletGlyph(row: RowId) {
    if (activeRow === row && spinnerRows.has(row)) {
      return spinnerFrames[rowSpinnerFrames[row]];
    }

    return "•";
  }

  function asciiBoxRow(index: number) {
    if (inputMode === "touch") {
      return touchGridRow(index);
    }

    if (index === 1) {
      const leftFill = leftMousePressed ? "██" : "  ";
      const rightFill = rightMousePressed ? "██" : "  ";
      return `│${leftFill}${middleMousePressed ? "■" : "□"}${rightFill}│`;
    }

    return asciiBoxRows[index];
  }

  function touchGridRow(row: number) {
    const activeCount = Math.min(activePointers.length, 10);
    const squares: string[] = [];
    let fingerIndex = 0;

    for (let previousRow = 0; previousRow < row; previousRow += 1) {
      fingerIndex += touchColumns.filter((columnHeight) => previousRow < columnHeight).length;
    }

    for (const columnHeight of touchColumns) {
      if (row >= columnHeight) {
        squares.push(" ");
        continue;
      }

      fingerIndex += 1;
      squares.push(fingerIndex <= activeCount ? "■" : "□");
    }

    return squares.join(" ");
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
  }

  async function scheduleGlyphPanelCheck() {
    if (glyphPanelCheckPending) return;
    glyphPanelCheckPending = true;
    glyphPanelHidden = false;
    await tick();
    glyphPanelCheckPending = false;

    if (!tapDisplayElement) return;
    const displayRows = tapDisplayElement.querySelectorAll<HTMLElement>(".display-row");
    glyphPanelHidden = Array.from(displayRows).some(
      (row) => row.scrollWidth > row.clientWidth + 1,
    );
  }

  onMount(() => {
    scheduleGlyphPanelCheck();

    if (typeof ResizeObserver === "undefined" || !tapDisplayElement) {
      return;
    }

    displayResizeObserver = new ResizeObserver(() => scheduleGlyphPanelCheck());
    displayResizeObserver.observe(tapDisplayElement);
  });

  onDestroy(() => {
    if (rowTimer) clearTimeout(rowTimer);
    displayResizeObserver?.disconnect();
  });
</script>

<article class="input-handling-card theme-secondary-5">
  <div class="input-card-layout">
    <div class="input-card-heading">
      <h3>Input Handling</h3>
      <p>A standardized API for mouse, touch, and stylus inputs.
          Includes support for basic mouse and touch gestures like
          drag and pinch. It also handles edge cases like tracking
          drag gestures even while mouse leaves the browser window.
        </p>
          <CardDocsLink href="/docs/snapengine/introduction/04_input_system" label="Input system docs" />
    </div>

    <div class="input-card-body card">
      <div
        class={`tap-display display ${glyphPanelHidden ? "glyph-panel-hidden" : ""}`}
        aria-live="polite"
        bind:this={tapDisplayElement}
      >
        {#each rows as row, index (row)}
          <div class={`display-row ${activeRow === row ? "is-active" : ""}`}>
            <span class="display-bullet" aria-hidden="true">{bulletGlyph(row)}</span>
            <span class="display-value">{rowOutput(row)}</span>
            <span class="display-arrow" aria-hidden="true">{rowArrows[row]}</span>
            {#if !glyphPanelHidden}
              <span class="ascii-box-row" aria-hidden="true">{asciiBoxRow(index)}</span>
            {/if}
          </div>
        {/each}
      </div>

      <div
        class="tap-surface"
        role="group"
        aria-label="Input gesture area"
        onpointerdown={handlePointerDown}
        onpointermove={handlePointerMove}
        onpointerup={handlePointerUp}
        onpointercancel={handlePointerUp}
        oncontextmenu={handleContextMenu}
      >
        <div class="touch-plus-grid" aria-hidden="true">
          {#each plusCells as cell (cell)}
            <span>+</span>
          {/each}
        </div>

        <svg class="gesture-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {#each dragLines as line (line.id)}
            <line
              class="drag-line"
              x1={line.start.xp}
              y1={line.start.yp}
              x2={line.current.xp}
              y2={line.current.yp}
            />
          {/each}
          {#if pinchLine}
            <line
              class="pinch-line"
              x1={pinchLine.a.xp}
              y1={pinchLine.a.yp}
              x2={pinchLine.b.xp}
              y2={pinchLine.b.yp}
            />
          {/if}
        </svg>

        {#each dragLines as line (line.id)}
          <span
            class="gesture-pin start-pin"
            style={`left: ${line.start.xp}%; top: ${line.start.yp}%;`}
            aria-hidden="true"
          ></span>
        {/each}

        {#each activePointers as pointer (pointer.id)}
          <span
            class="gesture-pin active-pin"
            style={`left: ${pointer.xp}%; top: ${pointer.yp}%;`}
            aria-hidden="true"
          ></span>
        {/each}

        {#if !hasInteracted}
          <pre class="tap-hint" aria-hidden="true" out:fade={{ duration: 220 }}>{hintFrame}</pre>
        {/if}
      </div>
    </div>
  </div>
</article>

<style lang="scss">
  .input-handling-card {
    --card-padding: var(--size-48);
    --card-top-padding: var(--card-padding);
    container-type: inline-size;
    container-name: input-handling-card;
    min-height: 520px;
    height: 100%;
    overflow: hidden;
    box-sizing: border-box;
    background: var(--color-background-tint);
    border-radius: var(--ui-radius);

    @media (max-width: 720px) {
      --card-padding: var(--size-24);
      --card-top-padding: var(--highlight-card-mobile-top-padding);
      grid-column: span 2;
    }
  }

  .input-card-layout {
    width: 100%;
    min-height: inherit;
    height: 100%;
    display: grid;
    grid-template-columns: minmax(0, 0.42fr) minmax(0, 0.58fr);
    align-items: stretch;
    gap: var(--size-32);
    box-sizing: border-box;

    @container input-handling-card (max-width: 400px) {
      display: flex;
      flex-direction: column;
    }
  }

  .input-card-heading {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: var(--size-16);
    padding: var(--card-top-padding) 0 var(--card-padding) var(--card-padding);
    min-width: 0;

    h3 {
      width: min(100%, min-content);
      margin: 0;
      font-family: "Geist Pixel Circle", "Doto", sans-serif;
      font-size: var(--highlight-card-heading-size);
      line-height: 0.88;
    }

    p {
      margin: 0;
      max-width: 18rem;
    }

    @container input-handling-card (max-width: 400px) {
      justify-content: flex-start;
      gap: var(--size-12);
      padding: var(--card-top-padding) var(--card-padding) 0 var(--card-padding);

      > * {
        grid-column: auto;
      }
    }
  }

  .input-card-body {
    min-width: 0;
    min-height: 360px;
    margin: var(--card-padding) var(--card-padding) var(--card-padding) 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-start;
    gap: var(--size-24);
    padding: var(--size-24);
    box-sizing: border-box;

    @container input-handling-card (max-width: 400px) {
      margin: 0 var(--card-padding) var(--card-padding) var(--card-padding);
    }
  }

  .tap-display {
    width: 100%;
    display: grid;
    grid-template-columns: 1fr;
    gap: 0;
    padding: var(--size-16) var(--size-12);
    box-sizing: border-box;
    border-radius: var(--ui-radius);
    overflow: hidden;
  }

  .display-row {
    min-width: 0;
    display: grid;
    grid-template-columns: 10px max-content minmax(20px, max-content) minmax(7ch, 1fr);
    align-items: center;
    gap: 6px;
    min-height: 13px;
    color: inherit;
    letter-spacing: 0;
  }

  .tap-display.glyph-panel-hidden .display-row {
    grid-template-columns: 10px max-content minmax(20px, max-content);
  }

  .display-bullet {
    width: 10px;
    justify-self: center;
    overflow: hidden;
    font-family: "Bitcount Grid Single", monospace !important;
    font-size: 10px;
    line-height: 13px;
    color: #4b4b4b;
    opacity: 0.72;
    text-align: center;
    white-space: pre;
  }

  .display-row.is-active .display-bullet {
    font-size: 12px;
    color: inherit;
    opacity: 1;
  }

  .display-value {
    min-width: 0;
    overflow: visible;
    font-family: "Bitcount Grid Single", monospace !important;
    font-optical-sizing: auto;
    font-style: normal;
    font-size: 12px;
    font-weight: 300;
    line-height: 13px;
    color: inherit;
    letter-spacing: 0;
    margin: 0;
    white-space: nowrap;
    text-overflow: clip;
  }

  .display-arrow {
    min-width: 20px;
    overflow: hidden;
    font-family: "Bitcount Grid Single", monospace !important;
    font-size: 12px;
    line-height: 13px;
    color: inherit;
    letter-spacing: 0;
    margin: 0;
    white-space: nowrap;
  }

  .ascii-box-row {
    display: inline-block;
    justify-self: end;
    overflow: hidden;
    font-family: "Bitcount Grid Single", monospace !important;
    font-size: 12px;
    line-height: 13px;
    color: inherit;
    letter-spacing: 0;
    margin: 0;
    white-space: pre;
  }

  .tap-surface {
    width: 100%;
    flex: 1;
    min-height: 180px;
    position: relative;
    overflow: hidden;
    touch-action: none;
    isolation: isolate;
    box-sizing: border-box;
    border-radius: var(--ui-radius);
    border: 1px solid rgba(0, 0, 0, 0.14);
    background-color: var(--color-background-tint);
  }

  // Orange is the site's "this is interactive" signal. Drawn as bare monospace type in
  // the ASCII idiom rather than a chrome button, so it reads as part of the demo.
  .tap-hint {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 3;
    margin: 0;
    transform: translate(-50%, -50%);
    background: none;
    border: 0;
    padding: 0;
    color: var(--color-primary);
    font-family: "Bitcount Single", "Geist Mono", monospace;
    font-size: clamp(0.62rem, 1.5cqw, 0.82rem);
    font-weight: 500;
    line-height: 1.15;
    letter-spacing: 0;
    white-space: pre;
    text-align: left;
    // Must not swallow the very interaction it is asking for.
    pointer-events: none;
    user-select: none;
  }

  .touch-plus-grid {
    position: absolute;
    inset: 10px;
    z-index: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
    grid-auto-rows: 36px;
    overflow: hidden;
    pointer-events: none;
    color: rgba(0, 0, 0, 0.08);
    font-family: "Bitcount Grid Single", monospace;
    font-size: 10px;
    font-weight: 300;
    line-height: 1;
    place-items: center;
    user-select: none;
  }

  .touch-plus-grid span {
    color: inherit;
    margin: 0;
  }

  .gesture-lines {
    position: absolute;
    inset: 0;
    z-index: 1;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .drag-line,
  .pinch-line {
    vector-effect: non-scaling-stroke;
    stroke-linecap: round;
  }

  .drag-line {
    stroke: rgba(255, 117, 58, 0.88);
    stroke-width: 2;
    filter: drop-shadow(0 0 4px rgba(255, 117, 58, 0.48));
  }

  .pinch-line {
    stroke: rgba(255, 31, 31, 0.8);
    stroke-width: 2.5;
    stroke-dasharray: 5 4;
    filter: drop-shadow(0 0 5px rgba(255, 31, 31, 0.45));
  }

  .gesture-pin {
    position: absolute;
    z-index: 2;
    width: 14px;
    height: 14px;
    border-radius: 999px;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  .start-pin {
    background: var(--color-primary);
    box-shadow:
      0 0 0 5px rgba(255, 117, 58, 0.12),
      0 0 12px rgba(255, 117, 58, 0.36);
  }

  .active-pin {
    background: var(--color-primary);
    box-shadow:
      0 0 0 6px rgba(255, 117, 58, 0.16),
      0 0 14px rgba(255, 117, 58, 0.42);
  }
</style>
