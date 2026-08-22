<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type { Engine as SnapEngine } from "@snap-engine/core";
  import {
    createRenderEntries,
    createRenderEntry,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
    type Container as SortContainer,
    type ContainerCallbacks,
    type RenderTree,
    type RenderTreeEvent,
  } from "@snap-engine/snapsort";
  import { prioritizeIntersectingContainer, rejectDrop } from "@snap-engine/snapsort/callbacks";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";

  type SentenceZone = "answer" | "bank";

  type SentenceTile = {
    id: string;
    text: string;
  };

  type SentenceValue = SentenceTile | { zone: SentenceZone };

  const words: SentenceTile[] = [
    { id: "sw-1", text: "あり" },
    { id: "sw-2", text: "の" },
    { id: "sw-3", text: "ます" },
    { id: "sw-4", text: "多く" },
    { id: "sw-5", text: "が" },
    { id: "sw-6", text: "用途" },
  ];

  const animation = {
    duration: 180,
    timing_function: "cubic-bezier(0.2, 0, 0, 1)",
  };

  let engine: SnapEngine | null = $state(null);
  let answerContainer: SortContainer | undefined = $state();
  let bankContainer: SortContainer | undefined = $state();
  let result = $state("");
  let pointerStart: { x: number; y: number } | null = null;
  let suppressClick = false;
  let tree = $state.raw(
    createRenderTree<SentenceValue>([
      createRenderEntry({ zone: "answer" }, "sentence-zone-answer", createRenderTree()),
      createRenderEntry(
        { zone: "bank" },
        "sentence-zone-bank",
        createRenderTree(createRenderEntries<SentenceValue>(words, (tile) => "id" in tile ? tile.id : `sentence-zone-${tile.zone}`)),
      ),
    ]),
  );

  $effect(() => {
    if (engine) engine.input.config.maxSimultaneousDrags = 1;
  });

  function ordinaryValues<T>(value: RenderTree<T>): T[] {
    return value.entries.flatMap((entry) => entry.isGhost ? [] : [entry.value]);
  }

  function zoneTree(zone: SentenceZone): RenderTree<SentenceValue> | null {
    const entry = tree.entries.find(
      (candidate) =>
        !candidate.isGhost &&
        "zone" in candidate.value &&
        candidate.value.zone === zone,
    );
    return entry && !entry.isGhost ? entry.childTree : null;
  }

  function findTile(tileId: string | undefined): SentenceTile | null {
    if (!tileId) return null;
    const answer = zoneTree("answer")?.entries.find(
      (entry) => !entry.isGhost && entry.itemId === tileId,
    );
    if (answer && !answer.isGhost && "text" in answer.value) return answer.value;
    const bank = zoneTree("bank")?.entries.find(
      (entry) => !entry.isGhost && entry.itemId === tileId,
    );
    return bank && !bank.isGhost && "text" in bank.value ? bank.value : null;
  }

  function handleRenderEvent(event: RenderTreeEvent) {
    tree = reduceRenderTree(tree, event);
    result = "";
  }

  function moveTile(tile: SentenceValue, destination: SentenceZone) {
    if (!("text" in tile)) return;
    const source: SentenceZone = zoneTree("answer")?.entries.some(
      (entry) => !entry.isGhost && entry.itemId === tile.id,
    ) ? "answer" : "bank";
    const sourceContainer = source === "answer" ? answerContainer : bankContainer;
    const destinationContainer = destination === "answer" ? answerContainer : bankContainer;
    const destinationIndex = zoneTree(destination)?.entries.filter(
      (entry) => !entry.isGhost,
    ).length ?? 0;
    if (sourceContainer && destinationContainer) {
      sourceContainer.moveItem(tile.id, destinationContainer, destinationIndex);
    }
  }

  function handlePointerDown(event: PointerEvent) {
    pointerStart = { x: event.clientX, y: event.clientY };
    suppressClick = false;
  }

  function handlePointerMove(event: PointerEvent) {
    if (!pointerStart) return;
    if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 3) {
      suppressClick = true;
    }
  }

  function handleClick(event: MouseEvent, action: () => void) {
    pointerStart = null;
    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
      suppressClick = false;
      return;
    }
    action();
  }

  function checkSentence() {
    const answer = zoneTree("answer");
    const answerWords = answer
      ? ordinaryValues(answer).flatMap((value) => "text" in value ? [value.text] : [])
      : [];
    const correct = ["多く", "の", "用途", "が", "あり", "ます"];
    result = answerWords.length === correct.length &&
      answerWords.every((word, index) => word === correct[index])
      ? "Correct!"
      : "Incorrect, try again.";
  }

  const callbacks = {
    onItemMove: handleRenderEvent,
    onGhostInsert: handleRenderEvent,
    onGhostMove: handleRenderEvent,
    onGhostRemove: handleRenderEvent,
    canDrop: rejectDrop,
  } satisfies ContainerCallbacks;
</script>

<div class="sentence-example" data-snapsort-example="sentence-builder">
  <Engine id="snapsort-sentence-example" bind:engine>
    <div class="sentence-builder card ground">
      <div class="display prompt-section">
        <span>It has many uses</span>
      </div>
      <div class="sentence-container-area">
        <Container
          itemId="example-sentence-root"
          className="sentence-workspace-root"
          config={{
            animation: defaultAnimations,
            mode: "progressive",
            direction: "column",
            name: "sentence-root",
            callbacks,
          }}
          locked={true}
        >
          {#each tree.entries as entry (entry.itemId)}
            {#if entry.isGhost}
              <Ghost ghost={entry.ghost} />
            {:else if entry.childTree && "zone" in entry.value && entry.value.zone === "answer"}
              <Container
                className="sentence-drop-zone"
                itemId={entry.itemId}
                bind:container={answerContainer}
                config={{
                  mode: "progressive",
                  direction: "row",
                  name: "sentence-answer",
                  animation: { reorder: animation, drop: animation, move: animation },
                  callbacks: { getDropPriority: prioritizeIntersectingContainer },
                }}
                locked={true}
                metadata={{ zone: "answer" }}
              >
                {#each entry.childTree.entries as child (child.itemId)}
                  {#if child.isGhost}
                    <Ghost ghost={child.ghost}>
                      <button type="button" class="word-card sentence-tile-ghost selected" tabindex="-1">
                        {findTile(child.ghost.original.itemId)?.text ?? ""}
                      </button>
                    </Ghost>
                  {:else if child.childTree}
                    <Container itemId={child.itemId} />
                  {:else if "text" in child.value}
                    <Item itemId={child.itemId} className="sentence-tile-wrapper">
                      <button
                        type="button"
                        class="word-card selected"
                        onpointerdown={handlePointerDown}
                        onpointermove={handlePointerMove}
                        onclick={(event) => handleClick(event, () => moveTile(child.value, "bank"))}
                        aria-label={`Move ${child.value.text} to bank`}
                      >{child.value.text}</button>
                    </Item>
                  {/if}
                {/each}
              </Container>
            {:else if entry.childTree && "zone" in entry.value}
              <Container
                className="sentence-source-zone"
                itemId={entry.itemId}
                bind:container={bankContainer}
                config={{
                  mode: "progressive",
                  direction: "row",
                  mainAxisAlign: "center",
                  name: "sentence-bank",
                  animation: { reorder: animation, drop: animation, move: animation },
                  callbacks: { getDropPriority: prioritizeIntersectingContainer },
                }}
                locked={true}
                metadata={{ zone: "bank" }}
              >
                {#each entry.childTree.entries as child (child.itemId)}
                  {#if child.isGhost}
                    <Ghost ghost={child.ghost}>
                      <button type="button" class="word-card sentence-tile-ghost" tabindex="-1">
                        {findTile(child.ghost.original.itemId)?.text ?? ""}
                      </button>
                    </Ghost>
                  {:else if child.childTree}
                    <Container itemId={child.itemId} />
                  {:else if "text" in child.value}
                    <Item itemId={child.itemId} className="sentence-tile-wrapper">
                      <button
                        type="button"
                        class="word-card"
                        onpointerdown={handlePointerDown}
                        onpointermove={handlePointerMove}
                        onclick={(event) => handleClick(event, () => moveTile(child.value, "answer"))}
                        aria-label={`Move ${child.value.text} to answer`}
                      >{child.value.text}</button>
                    </Item>
                  {/if}
                {/each}
              </Container>
            {/if}
          {/each}
        </Container>
      </div>
      <div class="controls">
        <button type="button" class="check-btn" class:success={result === "Correct!"} onclick={checkSentence}>
          {result === "Correct!" ? "Correct" : "Check"}
        </button>
        <p class:error={result.startsWith("Incorrect")} aria-live="polite">{result}</p>
      </div>
    </div>
  </Engine>
</div>

<style>
  .sentence-example {
    width: min(100%, 30rem);
    margin-inline: auto;
    user-select: none;
  }

  .sentence-example :global(.snap-engine-canvas) {
    overflow: visible !important;
  }

  .sentence-builder {
    display: flex;
    flex-direction: column;
    gap: var(--size-16);
    width: 100%;
    min-height: 300px;
    padding: var(--size-24);
    background: white;
    box-sizing: border-box;
    touch-action: none;
  }

  .prompt-section {
    --card-color: #232526;
    --display-text-color: #e8e6dc;
    font-family: "Bitcount Grid Single", monospace;
  }

  .prompt-section span {
    color: white;
    font-family: inherit;
  }

  .sentence-container-area {
    flex: 1;
    width: 100%;
    min-height: 116px;
  }

  .sentence-builder :global(.sentence-workspace-root) {
    align-items: stretch;
    justify-content: space-between;
    width: 100%;
    height: 100%;
  }

  .sentence-builder :global(.sentence-drop-zone),
  .sentence-builder :global(.sentence-source-zone) {
    position: relative;
    align-items: center;
    align-content: flex-start;
    width: 100%;
    min-height: 38px;
    gap: var(--size-4);
    flex-wrap: wrap;
  }

  .sentence-builder :global(.sentence-drop-zone) {
    align-items: flex-start;
    padding-bottom: var(--size-2);
    border-bottom: 2px solid #eee;
  }

  .sentence-builder :global(.sentence-source-zone) {
    justify-content: center;
    margin-top: auto;
    padding-top: var(--size-16);
  }

  .sentence-builder :global(.sentence-tile-wrapper) {
    padding: 0.15rem;
  }

  .sentence-builder :global(.sentence-tile-ghost) {
    border-radius: 4px;
    background: #d8dde0;
    opacity: 0.55;
  }

  .word-card {
    padding: 2px 4px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: white;
    box-shadow: 0 3px 0 #d8dde0;
    color: #232526;
    cursor: grab;
    font-family: "DotGothic16", sans-serif;
    font-size: 1rem;
    line-height: 1.2;
    touch-action: none;
  }

  .word-card:active {
    cursor: grabbing;
  }

  .word-card.selected {
    box-shadow: 0 3px 0 #b9c3ca;
  }

  .controls {
    display: grid;
    grid-template-columns: minmax(7rem, 1fr) minmax(0, 1fr);
    align-items: center;
    gap: 1rem;
    margin-top: auto;
  }

  .check-btn {
    width: 100%;
    padding: 0.5rem 1.5rem;
    --button-color: var(--color-primary);
    color: white;
    cursor: pointer;
  }

  .check-btn.success {
    --button-color: #2e7d32;
  }

  .controls p {
    min-height: 1.4em;
    margin: 0;
    color: #2e7d32;
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .controls p.error {
    color: #a33d2b;
  }

  @media (max-width: 520px) {
    .sentence-builder {
      padding: var(--size-16);
    }

    .controls {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }
  }
</style>
