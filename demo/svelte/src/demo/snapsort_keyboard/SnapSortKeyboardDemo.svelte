<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { Container, Ghost, Handle, Item } from "@snap-engine/snapsort/svelte";
  import {
    KeyboardDragController,
    createRenderEntries,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
    type Container as SnapSortContainer,
    type ContainerCallbacks,
    type RenderTree,
    type RenderTreeEvent,
  } from "@snap-engine/snapsort";
  import { renderTreeCallbacks } from "../snapsort-render-tree";
  import DirectResizeFixture from "./DirectResizeFixture.svelte";

  type KeyboardTask = {
    id: string;
    label: string;
    detail: string;
  };

  const initialTasks: readonly KeyboardTask[] = [
    { id: "outline", label: "Outline the idea", detail: "Planning" },
    { id: "prototype", label: "Build a prototype", detail: "In progress" },
    { id: "review", label: "Review the interaction", detail: "Feedback" },
    { id: "polish", label: "Polish the details", detail: "Refinement" },
    { id: "ship", label: "Ship the update", detail: "Ready" },
  ];

  function createTaskTree(): RenderTree<KeyboardTask> {
    return createRenderTree(
      createRenderEntries(initialTasks, (task) => task.id),
    );
  }

  let tasks = $state.raw(createTaskTree());
  let rootContainer = $state<SnapSortContainer | null>(null);
  let status = $state("Focus a card handle to begin.");
  const showResizeFixture =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("fixture") === "resize";

  function applyTaskEvent(event: RenderTreeEvent): void {
    tasks = reduceRenderTree(tasks, event);
  }

  const callbacks = {
    ...renderTreeCallbacks(applyTaskEvent),
    onDragStart(event) {
      const label = String(event.itemMetadata.label ?? "Item");
      status = event.session.input.inputType === "direct"
        ? `Lifted ${label}. Use the arrow keys to choose a position.`
        : `Dragging ${label}.`;
    },
    onDropTargetChange(event) {
      if (event.session.input.inputType !== "direct" || !event.current) return;
      const label = String(event.itemMetadata.label ?? "Item");
      status = `${label}, target position ${event.current.index + 1}.`;
    },
    onDragEnd(event) {
      const label = String(event.itemMetadata.label ?? "Item");
      status = event.destination
        ? `Dropped ${label} at position ${event.destination.index + 1}.`
        : `Cancelled moving ${label}.`;
    },
  } satisfies ContainerCallbacks;

  $effect(() => {
    if (!rootContainer) return;
    const keyboard = new KeyboardDragController(rootContainer);
    return () => keyboard.destroy();
  });
</script>

{#if showResizeFixture}
  <DirectResizeFixture />
{:else}
<div class="keyboard-demo">
  <header class="demo-header">
    <p class="eyebrow">DIRECT DRAG</p>
    <h1>Keyboard sorting</h1>
    <p>
      Focus a card, press Enter to lift it, then use Up and Down to choose a
      position. Press Enter again to drop or Escape to cancel.
    </p>
  </header>

  <main class="demo-stage">
    <section class="keyboard-card-panel" aria-labelledby="keyboard-list-title">
      <div class="panel-heading">
        <div>
          <p class="panel-kicker">TASKS</p>
          <h2 id="keyboard-list-title">Release checklist</h2>
        </div>
        <span>{tasks.entries.filter((entry) => !entry.isGhost).length}</span>
      </div>

      <Engine id="snapsort-keyboard-demo-canvas" style="height:auto;">
        <Container
          itemId="keyboard-demo-root"
          bind:container={rootContainer}
          className="keyboard-list"
          config={{
            direction: "column",
            name: "keyboard-demo-root",
            animation: defaultAnimations,
            callbacks,
          }}
          locked={true}
        >
          {#each tasks.entries as entry (entry.itemId)}
            {#if entry.isGhost}
              <Ghost ghost={entry.ghost} className="keyboard-card-ghost">
                <div class="keyboard-card-surface ghost-surface" aria-hidden="true">
                  <span class="drag-dots">⠿</span>
                  <div>
                    <strong>{String(entry.ghost.originalMetadata.label ?? "")}</strong>
                    <span>{String(entry.ghost.originalMetadata.detail ?? "")}</span>
                  </div>
                </div>
              </Ghost>
            {:else}
              <Item
                itemId={entry.itemId}
                className="keyboard-card"
                data-task-id={entry.itemId}
                metadata={{ label: entry.value.label, detail: entry.value.detail }}
              >
                <Handle
                  className="keyboard-card-surface keyboard-handle"
                  data-keyboard-handle={entry.itemId}
                  tabindex={0}
                  role="button"
                  aria-label={`Reorder ${entry.value.label}`}
                >
                  <span class="drag-dots" aria-hidden="true">⠿</span>
                  <span class="task-copy">
                    <strong>{entry.value.label}</strong>
                    <span>{entry.value.detail}</span>
                  </span>
                  <span class="key-hint" aria-hidden="true">↕</span>
                </Handle>
              </Item>
            {/if}
          {/each}
        </Container>
      </Engine>

      <p class="status" aria-live="polite" aria-atomic="true" data-keyboard-status>
        {status}
      </p>
    </section>

    <aside class="controls" aria-label="Keyboard controls">
      <div><kbd>Enter</kbd><span>Lift or drop</span></div>
      <div><span><kbd>↑</kbd> <kbd>↓</kbd></span><span>Move</span></div>
      <div><kbd>Esc</kbd><span>Cancel</span></div>
      <div><kbd>Tab</kbd><span>Leave and cancel</span></div>
    </aside>
  </main>
</div>
{/if}

<style>
  .keyboard-demo {
    min-height: 100%;
    box-sizing: border-box;
    padding: clamp(32px, 6vw, 88px);
    color: #242424;
    background: #f5f5f4;
  }

  .demo-header,
  .demo-stage {
    width: min(100%, 880px);
    margin-inline: auto;
  }

  .demo-header {
    margin-bottom: 36px;
  }

  .eyebrow,
  .panel-kicker {
    margin: 0 0 8px;
    color: #ff4f18;
    font-family: "Geist Pixel", monospace;
    font-size: 13px;
    letter-spacing: 0.08em;
  }

  h1,
  h2,
  p {
    margin-top: 0;
  }

  h1 {
    margin-bottom: 12px;
    font-size: clamp(42px, 7vw, 72px);
    font-weight: 500;
    letter-spacing: -0.055em;
    line-height: 0.95;
  }

  .demo-header > p:last-child {
    max-width: 650px;
    margin-bottom: 0;
    color: #666;
    font-size: 17px;
    line-height: 1.55;
  }

  .demo-stage {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 190px;
    gap: 18px;
    align-items: start;
  }

  .keyboard-card-panel,
  .controls {
    border: 1px solid #d7d7d5;
    border-radius: 18px;
    background: #ececeb;
  }

  .keyboard-card-panel {
    padding: 22px;
  }

  .panel-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 18px;
  }

  .panel-heading h2 {
    margin-bottom: 0;
    font-size: 20px;
    font-weight: 550;
  }

  .panel-heading > span {
    display: grid;
    width: 30px;
    height: 30px;
    place-items: center;
    border-radius: 50%;
    color: #5f5f5f;
    background: #dededc;
    font-family: "Geist Mono", monospace;
    font-size: 13px;
  }

  :global(.keyboard-list) {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 366px;
  }

  :global(.keyboard-card),
  :global(.keyboard-card-ghost) {
    width: 100%;
    height: 64px;
    box-sizing: border-box;
  }

  :global(.keyboard-card) {
    padding: 0 !important;
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
  }

  :global(.keyboard-card-surface) {
    display: grid;
    grid-template-columns: 24px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 11px 15px;
    border: 1px solid #d1d1cf;
    border-radius: 12px;
    background: #fff;
    box-shadow: 0 5px 0 #d8d8d6;
  }

  :global(.keyboard-handle) {
    cursor: grab;
    outline: none;
    transition: border-color 120ms ease, box-shadow 120ms ease,
      transform 120ms ease;
  }

  :global(.keyboard-handle:hover) {
    border-color: #bdbdb9;
  }

  :global(.keyboard-handle:focus-visible) {
    border-color: #ff4f18;
    box-shadow: 0 5px 0 #d8d8d6, 0 0 0 3px rgb(255 79 24 / 20%);
  }

  :global(.keyboard-card[data-snapsort-dragging="true"] .keyboard-handle) {
    cursor: grabbing;
    border-color: #ff4f18;
    box-shadow: 0 2px 0 #cfcfcd, 0 0 0 3px rgb(255 79 24 / 18%);
  }

  :global(.ghost-surface) {
    opacity: 0.42;
    box-shadow: none;
  }

  .drag-dots {
    color: #aaa;
    font-family: monospace;
    font-size: 22px;
    line-height: 1;
  }

  .task-copy,
  :global(.ghost-surface > div) {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 3px;
  }

  .task-copy strong,
  :global(.ghost-surface strong) {
    overflow: hidden;
    font-size: 15px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .task-copy > span,
  :global(.ghost-surface > div > span) {
    color: #888;
    font-size: 12px;
  }

  .key-hint {
    color: #ff4f18;
    font-size: 19px;
  }

  .status {
    min-height: 20px;
    margin: 20px 2px 0;
    color: #5d5d5d;
    font-size: 14px;
  }

  .controls {
    display: grid;
    gap: 14px;
    padding: 18px;
  }

  .controls > div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    color: #737373;
    font-size: 12px;
  }

  kbd {
    display: inline-grid;
    min-width: 25px;
    min-height: 25px;
    box-sizing: border-box;
    place-items: center;
    padding: 3px 7px;
    border: 1px solid #cacac7;
    border-radius: 6px;
    color: #3b3b3b;
    background: #fff;
    box-shadow: 0 2px 0 #d3d3d0;
    font-family: "Geist Mono", monospace;
    font-size: 11px;
  }

  @media (max-width: 720px) {
    .keyboard-demo {
      padding: 28px 16px 48px;
    }

    .demo-stage {
      grid-template-columns: 1fr;
    }

    .controls {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
