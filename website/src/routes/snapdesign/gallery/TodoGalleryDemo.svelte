<script lang="ts">
  import Toggle from "$lib/components/Toggle.svelte";
  import {
    Container,
    Ghost,
    Item,
  } from "@snap-engine/snapsort/svelte";
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
  import type { Engine } from "@snap-engine/core";
  import { getContext, onMount, untrack } from "svelte";
  import GalleryVirtualPointer from "./GalleryVirtualPointer.svelte";
  import {
    VirtualPointerController,
    type VirtualPointerPoint,
  } from "./virtual-pointer";

  type Todo = {
    id: string;
    label: string;
    done: boolean;
  };

  type TodoPhase =
    | "waiting"
    | "checked"
    | "dragging"
    | "moved"
    | "resetting";

  const TODO_ITEMS = [
    { id: "todo-promo", label: "Promo video", done: false },
    {
      id: "todo-accessibility",
      label: "Support accessibility",
      done: false,
    },
    { id: "todo-ssr", label: "SSR mode", done: false },
    { id: "todo-publish", label: "Publish gallery", done: false },
  ] satisfies readonly Todo[];

  const ACTIVE_TODO_ID = TODO_ITEMS[0].id;
  const FINAL_TODO_ID = TODO_ITEMS[TODO_ITEMS.length - 1].id;
  const FINAL_TODO_INDEX = TODO_ITEMS.length - 1;

  // Presentation holds are deliberate; input readiness is callback-gated.
  const TODO_INITIAL_PAUSE_MS = 300;
  const TODO_CURSOR_APPROACH_MS = 520;
  const TODO_CLICK_HOLD_MS = 90;
  const TODO_CHECKED_HOLD_MS = 260;
  const TODO_GRIP_APPROACH_MS = 440;
  const TODO_DRAG_DURATION_MS = 720;
  const TODO_MOVED_HOLD_MS = 800;
  const TODO_RESET_FADE_MS = 180;
  const TODO_RESET_SETTLE_MS = 160;
  const TODO_INITIAL_CURSOR_RIGHT_INSET = 32;

  const TODO_ANIMATIONS = {
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
      throw new Error("Todo Gallery demo must be rendered inside SnapEngine.");
    }
    return engine;
  }

  const galleryEngine = requireGalleryEngine();

  function createTodoTree(values: readonly Todo[] = TODO_ITEMS) {
    return createRenderTree(
      createRenderEntries(
        values.map((todo) => ({ ...todo })),
        (todo) => todo.id,
      ),
    );
  }

  let todo = $state.raw(createTodoTree());
  let todoContainer = $state<SnapSortContainer | null>(null);
  let demoElement = $state<HTMLDivElement | null>(null);
  let cursorElement = $state<HTMLDivElement | null>(null);
  let todoPhase = $state<TodoPhase>("waiting");
  let documentVisible = $state(true);
  let prefersReducedMotion = $state(false);
  let lastDropTargetIndex = $state<number | null>(null);
  let lastDropIndex = $state<number | null>(null);
  let dragEnded = false;
  let automationController: AbortController | null = null;
  let pendingAutomationRestart: AbortController | null = null;
  let pendingStaticReset: AbortController | null = null;

  const todoOrder = $derived(
    todo.entries
      .filter((entry) => !entry.isGhost)
      .map((entry) => entry.itemId)
      .join(","),
  );
  const autoplayActive = $derived(documentVisible && !prefersReducedMotion);
  const renderedPhase = $derived(
    prefersReducedMotion ? "reduced" : todoPhase,
  );

  function applyTodoEvent(event: RenderTreeEvent) {
    todo = reduceRenderTree(todo, event);
  }

  const todoCallbacks = {
    onItemMove: applyTodoEvent,
    onItemRemove: applyTodoEvent,
    onGhostInsert: applyTodoEvent,
    onGhostMove: applyTodoEvent,
    onGhostRemove: applyTodoEvent,
    onDropTargetChange(event) {
      const current = event.current;
      lastDropTargetIndex =
        current?.container === todoContainer ? current.index : null;
    },
    onDragEnd(event) {
      dragEnded = true;
      lastDropIndex =
        event.destination?.container === todoContainer
          ? event.destination.index
          : null;
    },
  } satisfies ContainerCallbacks;

  function setTodoCompleted(done: boolean) {
    const values = todo.entries.flatMap((entry) =>
      entry.isGhost
        ? []
        : [
            {
              ...entry.value,
              done: entry.itemId === ACTIVE_TODO_ID ? done : entry.value.done,
            },
          ],
    );
    todo = createTodoTree(values);
  }

  function resetTodoState(done: boolean) {
    todo = createTodoTree(
      TODO_ITEMS.map((entry) => ({
        ...entry,
        done: entry.id === ACTIVE_TODO_ID ? done : entry.done,
      })),
    );
  }

  function cancelPendingStaticReset() {
    pendingStaticReset?.abort();
    pendingStaticReset = null;
  }

  function applyStaticTodoState(done: boolean) {
    todoPhase = "waiting";
    resetTodoState(done);
    lastDropTargetIndex = null;
    lastDropIndex = null;
  }

  function scheduleStaticTodoState(done: boolean) {
    cancelPendingStaticReset();
    if (todoContainer?.dragSession == null) {
      applyStaticTodoState(done);
      return;
    }

    const controller = new AbortController();
    pendingStaticReset = controller;
    galleryEngine.frameController.subscribe(
      () => {
        if (todoContainer?.dragSession != null) return;
        if (pendingStaticReset !== controller) return;

        pendingStaticReset = null;
        controller.abort();
        applyStaticTodoState(done);
      },
      { signal: controller.signal },
    );
  }

  function queryDemoElement(selector: string): HTMLElement {
    const element = demoElement?.querySelector<HTMLElement>(selector);
    if (!element) {
      throw new Error(`Todo Gallery automation target is missing: ${selector}`);
    }
    return element;
  }

  function activeToggle(): HTMLElement {
    return queryDemoElement(
      `[data-todo-id="${ACTIVE_TODO_ID}"] [role="switch"]`,
    );
  }

  function activeGrip(): HTMLElement {
    return queryDemoElement(
      `[data-todo-id="${ACTIVE_TODO_ID}"] .grip`,
    );
  }

  function initialCursorPoint(): VirtualPointerPoint {
    if (!demoElement) {
      throw new Error("Todo Gallery demo is not mounted.");
    }
    return {
      x:
        demoElement.scrollLeft +
        Math.max(0, demoElement.clientWidth - TODO_INITIAL_CURSOR_RIGHT_INSET),
      y: demoElement.scrollTop + 18,
    };
  }

  function todoLocalPoint(x: number, y: number): VirtualPointerPoint {
    if (!demoElement) {
      throw new Error("Todo Gallery demo is not mounted.");
    }
    const rect = demoElement.getBoundingClientRect();
    return {
      x: x - rect.left - demoElement.clientLeft + demoElement.scrollLeft,
      y: y - rect.top - demoElement.clientTop + demoElement.scrollTop,
    };
  }

  function finalDropPoint(): VirtualPointerPoint {
    const finalRow = queryDemoElement(`[data-todo-id="${FINAL_TODO_ID}"]`);
    const finalItem = finalRow.closest<HTMLElement>(".snapsort-item");
    if (!finalItem) {
      throw new Error("Final Todo item has no SnapSort element.");
    }
    const finalGrip = finalRow.querySelector(".grip");
    if (!finalGrip) {
      throw new Error("Final Todo item has no grip element.");
    }
    const gripRect = finalGrip.getBoundingClientRect();
    const itemRect = finalItem.getBoundingClientRect();
    return todoLocalPoint(
      gripRect.left + gripRect.width / 2,
      itemRect.bottom - 2,
    );
  }

  async function runTodoAutomation(controller: AbortController) {
    if (!cursorElement || !demoElement) return;
    const { signal } = controller;
    const pointer = new VirtualPointerController(galleryEngine, cursorElement, {
      coordinateRoot: demoElement,
      signal,
    });

    let shouldRestart = false;
    try {
      while (!signal.aborted) {
        await pointer.waitUntil(() => todoContainer?.dragSession == null, {
          timeout: 2_000,
        });
        todoPhase = "resetting";
        pointer.hide();
        resetTodoState(false);
        lastDropTargetIndex = null;
        lastDropIndex = null;
        await pointer.wait(TODO_RESET_SETTLE_MS);
        todoPhase = "waiting";

        await pointer.moveTo(initialCursorPoint, {
          duration: 0,
          dispatchEvent: false,
        });
        pointer.show();
        await pointer.wait(TODO_INITIAL_PAUSE_MS);
        await pointer.moveTo(activeToggle, {
          duration: TODO_CURSOR_APPROACH_MS,
          arc: -18,
        });
        await pointer.click(activeToggle, {
          holdDuration: TODO_CLICK_HOLD_MS,
        });
        todoPhase = "checked";

        await pointer.wait(TODO_CHECKED_HOLD_MS);
        todoPhase = "dragging";
        lastDropTargetIndex = null;
        lastDropIndex = null;
        dragEnded = false;
        await pointer.moveTo(activeGrip, {
          duration: TODO_GRIP_APPROACH_MS,
          arc: 12,
        });
        await pointer.press(activeGrip);
        await pointer.activateDrag();
        await pointer.waitUntil(
          () => {
            const session = todoContainer?.dragSession;
            return (
              session?.pointerId === pointer.pointerId &&
              session.status === "active"
            );
          },
          { timeout: 1_000 },
        );
        await pointer.moveTo(finalDropPoint, {
          duration: TODO_DRAG_DURATION_MS,
          arc: -24,
        });
        await pointer.waitUntil(
          () => lastDropTargetIndex === FINAL_TODO_INDEX,
          { timeout: 1_000 },
        );
        await pointer.release();
        await pointer.waitUntil(
          () => dragEnded && lastDropIndex === FINAL_TODO_INDEX,
          { timeout: 1_000 },
        );
        todoPhase = "moved";

        await pointer.wait(TODO_MOVED_HOLD_MS);
        todoPhase = "resetting";
        pointer.hide();
        await pointer.wait(TODO_RESET_FADE_MS);
      }
    } catch (error) {
      if (!signal.aborted) {
        shouldRestart = true;
        console.error("Todo Gallery automation failed.", error);
      }
    } finally {
      pointer.destroy();
      if (automationController === controller) {
        automationController = null;
      }
      if (shouldRestart) queueTodoAutomationRestart();
    }
  }

  function cancelPendingAutomationRestart() {
    pendingAutomationRestart?.abort();
    pendingAutomationRestart = null;
  }

  function queueTodoAutomationRestart() {
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
          todoContainer !== null &&
          demoElement !== null &&
          cursorElement !== null
        ) {
          startTodoAutomation();
        }
      },
      { signal: controller.signal },
    );
  }

  function startTodoAutomation() {
    if (automationController || !demoElement || !cursorElement) return;
    cancelPendingAutomationRestart();
    const controller = new AbortController();
    automationController = controller;
    void runTodoAutomation(controller);
  }

  function stopTodoAutomation() {
    cancelPendingAutomationRestart();
    automationController?.abort();
    automationController = null;
  }

  $effect(() => {
    const shouldRun =
      autoplayActive &&
      todoContainer !== null &&
      demoElement !== null &&
      cursorElement !== null;
    if (shouldRun) {
      untrack(startTodoAutomation);
    } else {
      stopTodoAutomation();
    }

    return stopTodoAutomation;
  });

  onMount(() => {
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const syncReducedMotion = () => {
      const nextReducedMotion = reducedMotionQuery.matches;
      if (prefersReducedMotion === nextReducedMotion) return;

      stopTodoAutomation();
      cancelPendingStaticReset();
      prefersReducedMotion = nextReducedMotion;
      scheduleStaticTodoState(nextReducedMotion);
    };
    const syncDocumentVisibility = () => {
      documentVisible = document.visibilityState === "visible";
    };

    syncReducedMotion();
    syncDocumentVisibility();
    reducedMotionQuery.addEventListener("change", syncReducedMotion);
    document.addEventListener("visibilitychange", syncDocumentVisibility);

    return () => {
      stopTodoAutomation();
      cancelPendingStaticReset();
      reducedMotionQuery.removeEventListener("change", syncReducedMotion);
      document.removeEventListener("visibilitychange", syncDocumentVisibility);
    };
  });
</script>

<div
  bind:this={demoElement}
  class:resetting={todoPhase === "resetting"}
  class="todo-demo"
  data-todo-autoplay-active={autoplayActive}
  data-todo-phase={renderedPhase}
  data-todo-target-index={lastDropTargetIndex ?? ""}
  data-todo-drop-index={lastDropIndex ?? ""}
  style={`--todo-reset-duration: ${TODO_RESET_FADE_MS}ms;`}
>
  <Container
    bind:container={todoContainer}
    itemId="gallery-todo-root"
    className="todo-list"
    config={{
      animation: TODO_ANIMATIONS,
      direction: "column",
      callbacks: todoCallbacks,
    }}
    data-demo="todo-list"
    data-todo-order={todoOrder}
  >
    {#each todo.entries as entry (entry.itemId)}
      {#if entry.isGhost}
        <Ghost ghost={entry.ghost} className="todo-ghost" />
      {:else}
        <Item itemId={entry.itemId}>
          <div
            class:completed={entry.value.done}
            class="todo-row"
            data-completed={entry.value.done}
            data-todo-id={entry.itemId}
          >
            <Toggle
              checked={entry.value.done}
              className="todo-toggle"
              tabindex={-1}
              aria-label={`${entry.value.label} completed`}
              onclick={() => setTodoCompleted(true)}
            />
            <span class="todo-label">{entry.value.label}</span>
            <span class="grip" aria-hidden="true"
              ><i></i><i></i><i></i><i></i><i></i><i></i></span
            >
          </div>
        </Item>
      {/if}
    {/each}
  </Container>

  <GalleryVirtualPointer bind:element={cursorElement} />
</div>

<style>
  .todo-demo,
  :global(.todo-list) {
    width: min(100%, 430px);
  }

  .todo-demo {
    position: relative;
    overflow: visible;
    opacity: 1;
    transition: opacity var(--todo-reset-duration) ease;
  }

  .todo-demo.resetting {
    opacity: 0;
  }

  :global(.todo-list > .snapsort-item) {
    width: 100%;
    align-items: stretch;
  }

  :global(
    .gallery-engine
      .todo-demo
      .todo-ghost:not([data-snapsort-ghost="pointer"]):not(
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

  .todo-row {
    display: grid;
    width: 100%;
    min-height: 58px;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--size-16);
    padding: 0 var(--size-20);
    border: 1px solid
      color-mix(in srgb, var(--color-background-dark) 24%, transparent);
    border-radius: var(--size-8);
    background: var(--color-background);
    box-shadow: 0 3px 10px rgb(36 38 39 / 5%);
    box-sizing: border-box;
    color: var(--color-text);
  }

  .todo-label {
    transition:
      color 180ms ease,
      opacity 180ms ease;
  }

  .todo-row.completed .todo-label {
    color: var(--color-text-subtle);
    opacity: 0.62;
    text-decoration: line-through;
    text-decoration-thickness: 1px;
  }

  .grip {
    display: grid;
    grid-template-columns: repeat(2, 3px);
    gap: 3px;
    color: var(--color-background-dark);
    opacity: 0.42;
  }

  .grip i {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: currentColor;
  }

  @media (max-width: 700px) {
    .todo-row {
      min-height: 42px;
      gap: var(--size-8);
      padding-inline: var(--size-12);
      font-size: 0.78rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .todo-demo,
    .todo-label {
      transition: none;
    }
  }
</style>
