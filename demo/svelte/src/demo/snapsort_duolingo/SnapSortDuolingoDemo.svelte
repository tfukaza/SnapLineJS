<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";
  import {
    prioritizeIntersectingContainer,
    rejectDrop,
  } from "@snap-engine/snapsort/callbacks";
  import type {
    Container as SortContainer,
    GhostInsertEvent,
    ItemMoveEvent,
    ItemRemoveEvent,
  } from "@snap-engine/snapsort";

  type TileZone = "answer" | "bank";

  type TileData = {
    id: string;
    text: string;
    originalIndex: number;
  };

  type Exercise = {
    english: string;
    target: string;
    tiles: string[];
  };

  let { embedded = false }: { embedded?: boolean } = $props();

  const exercise: Exercise = {
    english: "I drink water every morning.",
    target: "私は毎朝水を飲みます",
    tiles: ["私", "は", "毎朝", "水", "を", "飲みます"],
  };

  const snapSortAnimation = {
    duration: 180,
    timing_function: "cubic-bezier(0.2, 0, 0, 1)",
  };

  let answerContainer: SortContainer | undefined = $state();
  let bankContainer: SortContainer | undefined = $state();
  let answerTiles: TileData[] = $state([]);
  let bankTiles: TileData[] = $state(toTileData(exercise.tiles));
  const tileZones: TileZone[] = ["answer", "bank"];
  let result: { correct: boolean; expected: string } | null = $state(null);
  let lookupTarget: string | null = $state(null);
  let tilePointerStart: { x: number; y: number } | null = null;
  let suppressTileClick = false;

  function toTileData(texts: string[]): TileData[] {
    return texts.map((text, index) => ({
      id: `tile-${index}`,
      text,
      originalIndex: index,
    }));
  }

  function containerForZone(zone: TileZone) {
    return zone === "answer" ? answerContainer : bankContainer;
  }

  function updateTileZone(tileId: string, targetZone: TileZone, targetIndex: number) {
    const allTiles = [...answerTiles, ...bankTiles];
    const movedTile = allTiles.find((tile) => tile.id === tileId);
    if (!movedTile) return;

    const nextAnswerTiles = answerTiles.filter((tile) => tile.id !== tileId);
    const nextBankTiles = bankTiles.filter((tile) => tile.id !== tileId);
    const targetTiles = targetZone === "answer" ? nextAnswerTiles : nextBankTiles;
    const destinationIndex = Math.max(0, Math.min(targetIndex, targetTiles.length));

    targetTiles.splice(destinationIndex, 0, movedTile);
    answerTiles = nextAnswerTiles;
    bankTiles = nextBankTiles;
    result = null;
  }

  function handleSnapSortDomMove(event: ItemMoveEvent) {
    const itemId = event.itemId;
    if (typeof itemId !== "string") return;

    const targetZone = event.to.containerMetadata.zone;
    if (targetZone !== "answer" && targetZone !== "bank") return;

    updateTileZone(itemId, targetZone, event.to.index);
  }

  function handleSnapSortDomRemove(event: ItemRemoveEvent) {
    const itemId = event.itemId;
    if (typeof itemId !== "string") return;

    answerTiles = answerTiles.filter((tile) => tile.id !== itemId);
    bankTiles = bankTiles.filter((tile) => tile.id !== itemId);
  }

  function findTile(tileId: string | undefined) {
    if (!tileId) return null;
    return [...answerTiles, ...bankTiles].find((tile) => tile.id === tileId) ?? null;
  }

  /** Ghost snippet content for both zones — looks up the dragged tile's text via its itemId. */
  function ghostTileText(event: GhostInsertEvent): string {
    const itemId = event.originalItemId;
    return typeof itemId === "string" ? (findTile(itemId)?.text ?? "") : "";
  }

  function moveTileToZone(tile: TileData, targetZone: TileZone) {
    const sourceZone: TileZone = answerTiles.some((candidate) => candidate.id === tile.id)
      ? "answer"
      : "bank";
    const sourceContainer = containerForZone(sourceZone);
    const targetContainer = containerForZone(targetZone);
    const fallbackIndex = targetZone === "answer" ? answerTiles.length : bankTiles.length;

    if (sourceContainer && targetContainer) {
      const movedBySnapSort = sourceContainer.moveItem(tile.id, targetContainer, fallbackIndex);
      if (movedBySnapSort) return;
    }

    updateTileZone(tile.id, targetZone, fallbackIndex);
  }

  function handleTileKeydown(event: KeyboardEvent, tile: TileData, targetZone: TileZone) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    moveTileToZone(tile, targetZone);
  }

  function handleTilePointerDown(event: PointerEvent) {
    tilePointerStart = { x: event.clientX, y: event.clientY };
    suppressTileClick = false;
  }

  function handleTilePointerMove(event: PointerEvent) {
    if (!tilePointerStart) return;
    const distance = Math.hypot(
      event.clientX - tilePointerStart.x,
      event.clientY - tilePointerStart.y,
    );
    if (distance > 3) {
      suppressTileClick = true;
    }
  }

  function handleTileClick(event: MouseEvent, action: () => void) {
    if (suppressTileClick) {
      event.preventDefault();
      event.stopPropagation();
      suppressTileClick = false;
      tilePointerStart = null;
      return;
    }

    action();
    suppressTileClick = false;
    tilePointerStart = null;
  }

  function resetTiles() {
    answerTiles = [];
    bankTiles = toTileData(exercise.tiles);
    result = null;
  }

  function checkAnswer() {
    if (answerTiles.length === 0) return;

    const answer = answerTiles.map((tile) => tile.text).join("");
    const expected = exercise.target;
    result = {
      correct: answer === expected,
      expected,
    };
  }

  function normalizeForLookup(text: string) {
    return text.replace(/[.,!?]/g, "").trim();
  }

  function openLookup(text: string) {
    lookupTarget = normalizeForLookup(text);
  }

  function closeLookup() {
    lookupTarget = null;
  }
</script>

<div class="game-demo" class:embedded>
  <main>
    <section class="prompt">
      <p class="label">Translate this sentence:</p>
      <p class="english">{exercise.english}</p>
    </section>

    <div class="snapsort-engine" data-lang="ja">
      <Engine id="sentence-builder-snapsort-demo">
        <Container
          className="sentence-builder-root"
          config={{
            mode: "progressive",
            direction: "column",
            name: "sentence-builder-root",
            callbacks: { canDrop: rejectDrop },
          }}
          locked={true}
          metadata={{ purpose: "sentence-builder" }}
          items={tileZones}
          getItemId={(zone) => `sentence-zone-${zone}`}
        >
          {#snippet entry(zone)}
            {#if zone === "answer"}
              <Container
                itemId="sentence-zone-answer"
                className="answer-area answer-box"
                bind:container={answerContainer}
                config={{
                  mode: "progressive",
                  direction: "row",
                  name: "sentence-answer",
                  animation: {
                    reorder: snapSortAnimation,
                    drop: snapSortAnimation,
                    clickMove: snapSortAnimation,
                  },
                  callbacks: {
                    getDropPriority: prioritizeIntersectingContainer,
                    onItemMove: handleSnapSortDomMove,
                    onItemRemove: handleSnapSortDomRemove,
                  },
                }}
                locked={true}
                metadata={{ zone: "answer" }}
                items={answerTiles}
                getItemId={(tile) => tile.id}
              >
                {#snippet before()}
                  {#if answerTiles.length === 0}
                    <span class="placeholder">Drag tiles here or click to add</span>
                  {/if}
                {/snippet}
                {#snippet entry(tile)}
                  <Item itemId={tile.id} className="tile-wrapper">
                    <button
                      type="button"
                      class="tile selected"
                      onpointerdown={handleTilePointerDown}
                      onpointermove={handleTilePointerMove}
                      onclick={(event) => handleTileClick(event, () => moveTileToZone(tile, "bank"))}
                      ondblclick={() => openLookup(tile.text)}
                      onkeydown={(event) => handleTileKeydown(event, tile, "bank")}
                      aria-label={tile.text}
                      title="Click to remove"
                    >
                      {tile.text}
                    </button>
                  </Item>
                {/snippet}
                {#snippet ghost(event)}
                  <Ghost {event}>
                    <button type="button" class="tile tile-ghost selected" tabindex="-1">{ghostTileText(event)}</button>
                  </Ghost>
                {/snippet}
              </Container>
            {:else}
              <Container
                itemId="sentence-zone-bank"
                className="tile-bank-container tile-bank"
                bind:container={bankContainer}
                config={{
                  mode: "progressive",
                  direction: "row",
                  mainAxisAlign: "center",
                  name: "sentence-bank",
                  animation: {
                    reorder: snapSortAnimation,
                    drop: snapSortAnimation,
                    clickMove: snapSortAnimation,
                  },
                  callbacks: {
                    getDropPriority: prioritizeIntersectingContainer,
                    onItemMove: handleSnapSortDomMove,
                    onItemRemove: handleSnapSortDomRemove,
                  },
                }}
                locked={true}
                metadata={{ zone: "bank" }}
                items={bankTiles}
                getItemId={(tile) => tile.id}
              >
                {#snippet entry(tile)}
                  <Item itemId={tile.id} className="tile-wrapper">
                    <button
                      type="button"
                      class="tile"
                      onpointerdown={handleTilePointerDown}
                      onpointermove={handleTilePointerMove}
                      onclick={(event) => handleTileClick(event, () => moveTileToZone(tile, "answer"))}
                      ondblclick={() => openLookup(tile.text)}
                      onkeydown={(event) => handleTileKeydown(event, tile, "answer")}
                      aria-label={tile.text}
                      title="Click to add"
                    >
                      {tile.text}
                    </button>
                  </Item>
                {/snippet}
                {#snippet ghost(event)}
                  <Ghost {event}>
                    <button type="button" class="tile tile-ghost" tabindex="-1">{ghostTileText(event)}</button>
                  </Ghost>
                {/snippet}
              </Container>
            {/if}
          {/snippet}
        </Container>
      </Engine>
    </div>

    <section class="actions">
      <button class="btn secondary" onclick={resetTiles} disabled={answerTiles.length === 0}>
        Reset
      </button>
      <button class="btn primary" onclick={checkAnswer} disabled={answerTiles.length === 0}>
        Check
      </button>
    </section>

    {#if result}
      <section class="result" class:correct={result.correct} class:incorrect={!result.correct}>
        {#if result.correct}
          <div class="result-icon">OK</div>
          <p class="result-text">Correct</p>
        {:else}
          <div class="result-icon">No</div>
          <p class="result-text">Not quite right</p>
          <p class="expected">Expected: {result.expected}</p>
        {/if}
        <button class="btn next" onclick={resetTiles}>Try Again</button>
      </section>
    {/if}

    {#if lookupTarget}
      <section class="lookup-panel">
        <div>
          <p class="label">Lookup</p>
          <p class="lookup-word">{lookupTarget}</p>
        </div>
        <button type="button" onclick={closeLookup}>Close</button>
      </section>
    {/if}
  </main>
</div>

<style>
  .game-demo {
    --bg-primary: #f7f7f7;
    --bg-secondary: #ffffff;
    --bg-tertiary: #eeeeee;
    --text-primary: #171717;
    --text-secondary: #555555;
    --text-muted: #8a8a8a;
    --border-color: #d8d8d8;
    --border-dashed: #b8b8b8;
    --action-primary: #171717;
    --action-primary-shadow: #000000;
    --tile-bg: #ffffff;
    --tile-border: #d8d8d8;
    --tile-shadow: #bdbdbd;
    --shadow-color: rgba(0, 0, 0, 0.08);

    width: 100%;
    min-height: 100%;
    overflow: auto;
    background: var(--bg-primary);
    box-sizing: border-box;
    padding: var(--size-24);
  }

  main {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    padding: 1rem;
    box-sizing: border-box;
  }

  .game-demo.embedded {
    min-height: auto;
    overflow: visible;
    padding: 0;
    background: transparent;
  }

  .game-demo.embedded main {
    max-width: 720px;
    margin: 0;
    padding: 0;
  }

  .prompt {
    background: var(--bg-secondary);
    padding: 1.5rem;
    border-radius: 16px;
    margin-bottom: 1.5rem;
    box-shadow: 0 2px 8px var(--shadow-color);
  }

  .label {
    color: var(--text-secondary);
    margin: 0 0 0.5rem;
    font-size: 0.9rem;
  }

  .english {
    font-size: 1.4rem;
    color: var(--text-primary);
    margin: 0;
    font-weight: 500;
  }

  .snapsort-engine {
    position: relative;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .snapsort-engine :global(.sentence-builder-root) {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    gap: 0;
  }

  .snapsort-engine :global(.answer-area) {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
    margin-bottom: 1.5rem;
  }

  .snapsort-engine :global(.answer-box) {
    position: relative;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    min-height: 112px;
    box-sizing: border-box;
    background: var(--bg-secondary);
    border: 2px dashed var(--border-dashed);
    border-radius: 16px;
    padding: 0.75rem;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    align-content: flex-start;
    gap: 0.25rem;
  }

  .placeholder {
    position: absolute;
    top: 1.25rem;
    left: 1.25rem;
    color: var(--text-muted);
    font-style: italic;
    padding: 0.5rem;
    pointer-events: none;
  }

  /* Hide the placeholder the moment an incoming ghost occupies the answer
     box — the ghost entry is a sibling, adapter-rendered by Container's
     items mode, so this is the CSS-native equivalent of the old
     `ghostEntry?.zone !== "answer"` state check. `:global(...)` must wrap
     the whole selector here (Svelte rejects it mid-chain), since both
     `.answer-box` (applied dynamically via a prop) and `.placeholder`
     (matched only as this global selector's descendant) need to resolve
     outside Svelte's per-component scoping hash. */
  :global(.snapsort-engine .answer-box:has([data-snapsort-ghost-entry]) .placeholder) {
    display: none;
  }

  .snapsort-engine :global(.tile-bank-container) {
    width: 100%;
    background: var(--bg-tertiary);
    border-radius: 16px;
    padding: 0.75rem;
    margin-bottom: 1rem;
    box-sizing: border-box;
  }

  .snapsort-engine :global(.tile-bank) {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    min-height: 60px;
    gap: 0.25rem;
    align-content: flex-start;
  }

  .snapsort-engine :global(.answer-box .tile-wrapper),
  .snapsort-engine :global(.tile-bank .tile-wrapper),
  .snapsort-engine :global(.answer-box [data-snapsort-ghost-entry]),
  .snapsort-engine :global(.tile-bank [data-snapsort-ghost-entry]) {
    display: inline-flex;
    padding: 0;
    align-items: center;
    justify-content: center;
  }

  /* Two classes for specificity over `.tile`'s own background/box-shadow —
     the ghost preview should read as a dimmed placeholder, not a live tile. */
  .snapsort-engine :global(.tile.tile-ghost) {
    background: var(--border-color);
    color: var(--text-secondary);
    border-color: var(--border-color);
    opacity: 0.55;
    box-shadow: none;
    cursor: default;
  }

  .tile {
    padding: 0.6rem 1rem;
    border: 2px solid var(--tile-border);
    border-radius: 12px;
    background: var(--tile-bg);
    color: var(--text-primary);
    font-size: 1.1rem;
    line-height: 1.4;
    min-height: 1.4em;
    cursor: grab;
    box-shadow: 0 2px 0 var(--tile-shadow);
    font-family: "Geist", sans-serif;
    user-select: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  [data-lang="ja"] .tile {
    font-family: "Zen Kaku Gothic New", "Noto Sans JP", sans-serif;
  }

  .tile:hover {
    background: var(--bg-tertiary);
    transform: translateY(-1px);
  }

  .tile:active {
    cursor: grabbing;
    transform: translateY(2px);
    box-shadow: none;
  }

  .tile.selected {
    background: var(--action-primary);
    color: white;
    border-color: var(--action-primary-shadow);
    box-shadow: 0 2px 0 var(--action-primary-shadow);
  }

  .actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-top: 1.5rem;
  }

  .btn,
  .lookup-panel button {
    padding: 0.75rem 2rem;
    border: none;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 600;
    font-family: "Geist", sans-serif;
    cursor: pointer;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn.primary {
    background: var(--action-primary);
    color: white;
    box-shadow: 0 4px 0 var(--action-primary-shadow);
  }

  .btn.secondary {
    background: var(--bg-secondary);
    color: var(--text-secondary);
    border: 2px solid var(--border-color);
    box-shadow: 0 4px 0 var(--border-color);
  }

  .btn.next {
    background: var(--action-primary);
    color: white;
    box-shadow: 0 4px 0 var(--action-primary-shadow);
  }

  .result {
    margin-top: 1.5rem;
    padding: 1.5rem;
    border-radius: 16px;
    text-align: center;
  }

  .result.correct {
    background: var(--bg-secondary);
    border: 2px solid var(--action-primary);
  }

  .result.incorrect {
    background: var(--bg-tertiary);
    border: 2px solid var(--action-primary);
  }

  .result-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    font-weight: 700;
  }

  .result-text {
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0 0 0.5rem;
    color: var(--text-primary);
  }

  .expected {
    color: var(--text-secondary);
    margin: 0.5rem 0 1rem;
    font-size: 1.1rem;
  }

  .lookup-panel {
    position: fixed;
    right: 1rem;
    bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    background: var(--bg-secondary);
    border: 2px solid var(--border-color);
    border-radius: 12px;
    padding: 0.9rem;
    box-shadow: 0 8px 24px var(--shadow-color);
  }

  .lookup-word {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .lookup-panel button {
    padding: 0.5rem 0.8rem;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
</style>
