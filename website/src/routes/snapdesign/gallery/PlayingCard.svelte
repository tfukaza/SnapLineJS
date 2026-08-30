<script lang="ts">
  type CardSuit = "clubs" | "diamonds" | "hearts" | "spades";
  type PipPosition = { row: number; column: number; flipped?: boolean };

  let {
    rank,
    suit,
    suitUrl,
    flipped = $bindable(false),
  }: {
    rank: 3 | 5 | 7 | 9;
    suit: CardSuit;
    suitUrl: string;
    flipped?: boolean;
  } = $props();

  const pipLayouts: Record<3 | 5 | 7 | 9, readonly PipPosition[]> = {
    3: [
      { row: 1, column: 2 },
      { row: 3, column: 2 },
      { row: 5, column: 2, flipped: true },
    ],
    5: [
      { row: 1, column: 1 },
      { row: 1, column: 3 },
      { row: 3, column: 2 },
      { row: 5, column: 1, flipped: true },
      { row: 5, column: 3, flipped: true },
    ],
    7: [
      { row: 1, column: 1 },
      { row: 1, column: 3 },
      { row: 2, column: 2 },
      { row: 3, column: 1 },
      { row: 3, column: 3 },
      { row: 5, column: 1, flipped: true },
      { row: 5, column: 3, flipped: true },
    ],
    9: [
      { row: 1, column: 1 },
      { row: 1, column: 3 },
      { row: 2, column: 1 },
      { row: 2, column: 3 },
      { row: 3, column: 2 },
      { row: 4, column: 1, flipped: true },
      { row: 4, column: 3, flipped: true },
      { row: 5, column: 1, flipped: true },
      { row: 5, column: 3, flipped: true },
    ],
  };

  let pointerStart: { x: number; y: number; pointerId: number } | null = null;
  let suppressPointerClick = false;

  const isRed = $derived(suit === "diamonds" || suit === "hearts");
  const accessibleName = $derived(`${rank} of ${suit}`);
  const accessibleAction = $derived(
    `${accessibleName}, ${flipped ? "back" : "front"} showing. Activate to show the ${flipped ? "front" : "back"}.`,
  );

  function handlePointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    pointerStart = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };
    suppressPointerClick = false;
  }

  function handlePointerMove(event: PointerEvent) {
    if (!pointerStart || event.pointerId !== pointerStart.pointerId) return;
    if (
      Math.hypot(
        event.clientX - pointerStart.x,
        event.clientY - pointerStart.y,
      ) > 3
    ) {
      suppressPointerClick = true;
    }
  }

  function handlePointerCancel(event: PointerEvent) {
    if (event.pointerId !== pointerStart?.pointerId) return;
    pointerStart = null;
    suppressPointerClick = false;
  }

  function handleClick(event: MouseEvent) {
    pointerStart = null;
    if (event.detail !== 0 && suppressPointerClick) {
      event.preventDefault();
      event.stopPropagation();
      suppressPointerClick = false;
      return;
    }

    suppressPointerClick = false;
    flipped = !flipped;
  }
</script>

<button
  type="button"
  class:red={isRed}
  class:flipped
  class="playing-card"
  data-card-rank={rank}
  data-card-suit={suit}
  data-card-side={flipped ? "back" : "front"}
  aria-label={accessibleAction}
  aria-pressed={flipped}
  style={`--card-suit: url("${suitUrl}");`}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointercancel={handlePointerCancel}
  onclick={handleClick}
>
  <span class="card-turntable">
    <span class="card-face card-front" aria-hidden={flipped}>
      <span class="card-index card-index-top" aria-hidden="true">
        <span class="card-rank">{rank}</span>
        <i class="card-suit-mark"></i>
      </span>

      <span class="card-pips" aria-hidden="true">
        {#each pipLayouts[rank] as pip, index (`${pip.row}-${pip.column}-${index}`)}
          <i
            class:flipped={pip.flipped}
            class="card-pip"
            style={`--pip-row: ${pip.row}; --pip-column: ${pip.column};`}
          ></i>
        {/each}
      </span>

      <span class="card-index card-index-bottom" aria-hidden="true">
        <span class="card-rank">{rank}</span>
        <i class="card-suit-mark"></i>
      </span>
    </span>

    <span class="card-face card-back" aria-hidden={!flipped}>
      <span class="card-back-frame">
        <span class="card-back-label card-back-label-top">SnapSort</span>
        <span class="card-back-label card-back-label-bottom">SnapSort</span>
      </span>
    </span>
  </span>
</button>

<style>
  .playing-card {
    position: relative;
    display: block;
    width: 100%;
    min-width: 0;
    aspect-ratio: 5 / 7;
    padding: 0;
    border: 0;
    box-sizing: border-box;
    appearance: none;
    background: transparent;
    color: #171717;
    container-type: inline-size;
    cursor: pointer;
    perspective: 900px;
  }

  .playing-card:focus-visible {
    border-radius: 10px;
    outline: 2px solid var(--color-action);
    outline-offset: 3px;
  }

  .card-turntable {
    position: absolute;
    inset: 0;
    display: block;
    transform-style: preserve-3d;
    transition: transform 420ms cubic-bezier(0.2, 0.75, 0.2, 1);
  }

  .playing-card.flipped .card-turntable {
    transform: rotateY(180deg);
  }

  .card-face {
    position: absolute;
    inset: 0;
    display: block;
    overflow: hidden;
    border: 1px solid #cfcfcf;
    border-radius: 10px;
    background: #fff;
    box-shadow: 0 5px 12px rgb(36 38 39 / 11%);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }

  .playing-card.red {
    color: #d62f2f;
  }

  .card-back {
    color: #080808;
    transform: rotateY(180deg);
  }

  .card-back-frame {
    position: absolute;
    inset: 8cqi;
    display: block;
    border: 1px solid currentColor;
    border-radius: 9px;
  }

  .card-back-label {
    position: absolute;
    left: 50%;
    color: currentColor;
    font-family: "Geist", sans-serif;
    font-size: clamp(15px, 17cqi, 24px);
    font-weight: 500;
    letter-spacing: -0.055em;
    line-height: 1;
    white-space: nowrap;
  }

  .card-back-label-top {
    top: 7.5%;
    transform: translateX(-50%);
  }

  .card-back-label-bottom {
    bottom: 7.5%;
    transform: translateX(-50%) rotate(180deg);
  }

  .card-index {
    position: absolute;
    z-index: 2;
    display: flex;
    width: 30px;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }

  .card-index-top {
    top: 8px;
    left: 7px;
  }

  .card-index-bottom {
    right: 7px;
    bottom: 8px;
    transform: rotate(180deg);
  }

  .card-rank {
    font-family: "Geist Pixel Circle", var(--font-code), monospace;
    font-size: clamp(25px, 3.4cqi, 34px);
    font-weight: 400;
    line-height: 0.9;
  }

  .card-suit-mark,
  .card-pip {
    display: block;
    flex: 0 0 auto;
    background: currentColor;
    -webkit-mask-image: var(--card-suit);
    mask-image: var(--card-suit);
    -webkit-mask-position: center;
    mask-position: center;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-size: contain;
    mask-size: contain;
  }

  .card-suit-mark {
    width: 14px;
    height: 14px;
  }

  .card-pips {
    position: absolute;
    inset: 40px 38px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-template-rows: repeat(5, minmax(0, 1fr));
    place-items: center;
  }

  .card-pip {
    width: clamp(16px, 2.2cqi, 20px);
    height: clamp(16px, 2.2cqi, 20px);
    grid-column: var(--pip-column);
    grid-row: var(--pip-row);
  }

  .card-pip.flipped {
    transform: rotate(180deg);
  }

  @media (max-width: 700px) {
    .card-index {
      width: 22px;
    }

    .card-index-top {
      top: 5px;
      left: 4px;
    }

    .card-index-bottom {
      right: 4px;
      bottom: 5px;
    }

    .card-rank {
      font-size: 20px;
    }

    .card-suit-mark {
      width: 10px;
      height: 10px;
    }

    .card-pips {
      inset: 28px 24px;
    }

    .card-pip {
      width: 13px;
      height: 13px;
    }

    .card-back-frame {
      border-radius: 7px;
    }

    .card-back-label {
      font-size: 18px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .card-turntable {
      transition: none;
    }
  }
</style>
