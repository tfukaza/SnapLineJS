<script lang="ts">
  import { onMount } from "svelte";
  import ClientDemoFrame from "$lib/components/ClientDemoFrame.svelte";
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { Container, Item } from "@snap-engine/snapsort/svelte";
  import type { ItemMoveEvent } from "@snap-engine/snapsort";
  import * as Tone from "tone";

  const recessedPadIndices = new Set([5, 6, 9, 10]);
  const padIndices = Array.from({ length: 16 }, (_, index) => index);
  let padOrder = $state<number[]>(padIndices.slice());
  const waveShapes = ["sine", "triangle8", "square8", "sawtooth8"] as const;
  type WaveShape = (typeof waveShapes)[number];

  const padColorClasses = [
    "",
    "pad-gray",
    "pad-gray",
    "",
    "pad-gray",
    "pad-primary",
    "",
    "pad-gray",
    "pad-gray",
    "",
    "pad-primary",
    "pad-gray",
    "",
    "pad-gray",
    "pad-gray",
    "",
  ];

  const padNotes = [
    "C3",
    "Eb3",
    "F3",
    "G3",
    "Bb3",
    "C4",
    "Eb4",
    "F4",
    "G4",
    "Bb4",
    "C5",
    "Eb5",
    "F5",
    "G5",
    "Bb5",
    "C6",
  ];

  let toneInstrument: ReturnType<typeof createToneInstrument> | null = null;
  let activePadIndex = $state<number | null>(null);
  let draggedPadGesture = false;

  // Fixed tone character now that the joystick that used to drive these is gone.
  const toneX = 0.5;
  const toneY = 0.5;

  function createToneInstrument() {
    const filter = new Tone.Filter({
      frequency: 1800,
      rolloff: -12,
      type: "lowpass",
    });
    const delay = new Tone.FeedbackDelay({
      delayTime: "16n",
      feedback: 0.18,
      wet: 0.14,
    });
    const reverb = new Tone.Reverb({
      decay: 1.4,
      wet: 0.12,
    });
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: "triangle8",
      },
      envelope: {
        attack: 0.006,
        decay: 0.12,
        sustain: 0.08,
        release: 0.28,
      },
      volume: -10,
    });

    synth.chain(filter, delay, reverb, Tone.Destination);
    return { delay, filter, reverb, synth, waveShape: "triangle8" as WaveShape };
  }

  function applyToneControls(instrument = toneInstrument) {
    if (!instrument) return;

    const now = Tone.now();
    const filterFrequency = 500 + toneX * 4200;
    const delayWet = 0.04 + toneY * 0.22;
    const delayFeedback = 0.08 + toneY * 0.26;
    const reverbWet = 0.04 + (1 - toneY) * 0.18;
    const nextWaveShape = waveShapes[Math.min(waveShapes.length - 1, Math.floor(toneX * waveShapes.length))];

    if (instrument.waveShape !== nextWaveShape) {
      instrument.synth.set({ oscillator: { type: nextWaveShape } });
      instrument.waveShape = nextWaveShape;
    }

    instrument.filter.frequency.cancelScheduledValues(now);
    instrument.filter.frequency.rampTo(filterFrequency, 0.08);
    instrument.delay.wet.rampTo(delayWet, 0.08);
    instrument.delay.feedback.rampTo(delayFeedback, 0.08);
    instrument.reverb.wet.rampTo(reverbWet, 0.08);
  }

  async function getToneInstrument() {
    if (typeof window === "undefined") return;

    await Tone.start();
    toneInstrument ??= createToneInstrument();
    applyToneControls(toneInstrument);
    return toneInstrument;
  }

  function handlePadMove(event: ItemMoveEvent) {
    const itemId = event.itemId;
    if (typeof itemId !== "string" || !itemId.startsWith("pad-")) return;

    const movedPad = Number(itemId.slice("pad-".length));
    if (!Number.isInteger(movedPad)) return;

    const nextOrder = padOrder.filter((index) => index !== movedPad);
    const targetIndex = Math.max(0, Math.min(event.to.index, nextOrder.length));
    nextOrder.splice(targetIndex, 0, movedPad);
    padOrder = nextOrder;
  }

  function handlePadPointerDown() {
    draggedPadGesture = false;
  }

  function handlePadDragStart() {
    draggedPadGesture = true;
  }

  function handlePadClick(index: number) {
    if (draggedPadGesture) {
      draggedPadGesture = false;
      return;
    }
    void playPad(index);
  }

  async function playPad(index: number) {
    const instrument = await getToneInstrument();
    if (!instrument) return;

    const note = padNotes[index] ?? "C4";
    const now = Tone.now();
    const brightness = 500 + toneX * 4200 + (index % 4) * 80 + Math.floor(index / 4) * 50;

    instrument.filter.frequency.cancelScheduledValues(now);
    instrument.filter.frequency.rampTo(brightness, 0.03);
    instrument.synth.triggerAttackRelease(note, "16n", now, 0.55);

    activePadIndex = index;
    window.setTimeout(() => {
      if (activePadIndex === index) activePadIndex = null;
    }, 160);
  }

  onMount(() => {
    return () => {
      toneInstrument?.synth.dispose();
      toneInstrument?.filter.dispose();
      toneInstrument?.delay.dispose();
      toneInstrument?.reverb.dispose();
    };
  });
</script>

<section id="landing">
  <div class="hero-layout">
    <div class="hero-text">
      <h1>
        Interactivity<br />Engine<br />for the Web
      </h1>
      <p class="hero-lede">
        SnapEngine is a toolkit for building interactive UI for web applications,
        framework-agnostic, zero-dependency, and style-less.
      </p>
      <div class="hero-actions">
        <a class="button primary hero-action" href="/#assets">
          Explore assets
        </a>
      </div>
    </div>
    <div class="hero-card card">
      <ClientDemoFrame>
        {#snippet fallback()}
          <div class="hero-synth-panel hero-synth-skeleton" aria-hidden="true">
            <div class="hero-button-bed slot">
              <div class="hero-skeleton-pad-grid">
                {#each padIndices as index}
                  <div class={`hero-synth-button ${padColorClasses[index]}`}></div>
                {/each}
              </div>
            </div>
          </div>
        {/snippet}
        <Engine id="hero-synth-pads">
        <div class="hero-synth-panel">
          <div class="hero-button-bed slot">
            <div class="hero-button-slots" aria-hidden="true">
              {#each Array(16) as _}
                <div class="hero-button-slot"></div>
              {/each}
            </div>
            <div
              class="hero-button-grid"
              role="group"
              aria-label="Interactive SnapSort music pad demo"
              aria-describedby="hero-demo-instructions"
            >
              <Container
                config={{
                  direction: "row",
                  mode: "euclidean",
                  callbacks: {
                    onDragStart: handlePadDragStart,
                    onItemMove: handlePadMove,
                  },
                }}
                items={padOrder}
                getItemId={(index) => `pad-${index}`}
              >
                {#snippet entry(index)}
                  <Item itemId={`pad-${index}`} className="hero-synth-item">
                    <div
                      class={`hero-synth-button ${padColorClasses[index]} ${activePadIndex === index ? "is-active" : ""}`}
                      data-pad-index={index}
                      onclick={() => handlePadClick(index)}
                      onpointerdown={handlePadPointerDown}
                      onkeydown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          playPad(index);
                        }
                      }}
                      aria-label={`Pad ${index + 1}, ${padNotes[index]}. Press to play; drag to reorder.`}
                      aria-describedby="hero-demo-instructions"
                      role="button"
                      tabindex="0"
                    >
                      {#if recessedPadIndices.has(index)}
                        <div class="hero-synth-button-indent"></div>
                      {:else}
                        <div class="hero-synth-button-bump"></div>
                      {/if}
                    </div>
                  </Item>
                {/snippet}
              </Container>
            </div>
          </div>
        </div>
        </Engine>
      </ClientDemoFrame>
      <p id="hero-demo-instructions" class="hero-demo-caption">
        Drag pads to reorder, tap to play.
      </p>
    </div>
  </div>
</section>

<style lang="scss">
  @use "../landing.scss";

  #landing {
    min-height: min(680px, calc(100svh - 5rem));
    position: relative;
    border-radius: var(--size-12);
    background-color: var(--color-background-tint);
    margin: 0px auto;
    container-type: inline-size;
    container-name: landing;
    overflow: hidden;
  }

  .hero-layout {
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-columns: 1fr 1.2fr;
    gap: 2rem;
    align-items: stretch;
    padding: clamp(var(--size-32), 5vw, var(--size-64));
    box-sizing: border-box;

    @container landing (max-width: 900px) {
      grid-template-columns: 100%;
      grid-template-rows: min-content 1fr;
      gap: var(--size-32);
      padding: var(--size-48) 0;

    }
  }

  .hero-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    text-align: left;
    padding-left: clamp(0px, 2vw, var(--size-24));

    h1 {
      max-width: 10ch;
      margin: 0 0 var(--size-20);
      font-family: var(--font-display);
      font-size: var(--type-page-title);
      line-height: var(--leading-display);
      text-wrap: balance;
    }

    .hero-lede {
      max-width: 33rem;
      color: var(--color-text-muted);
      font-size: var(--type-lead);
      line-height: var(--leading-body);
    }

    @container landing (max-width: 900px) {
        padding: 0px 10%;
        justify-content: center;
        align-items: center;
        text-align: center;

        .hero-actions {
            justify-content: center;
        }
    }

  }

  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-12);
    margin-top: var(--size-24);
  }

  .hero-action {
    display: inline-flex;
    align-items: center;
    gap: var(--size-4);
    text-decoration: none;
  }

  .hero-card {
    width: 440px;
    align-self: center;
    justify-self: end;
    box-sizing: border-box;
    padding: var(--size-24);
    position: relative;
  }

  .hero-demo-caption {
    margin: var(--size-16) auto 0;
    color: var(--color-text-subtle);
    font-size: var(--type-caption);
    font-weight: 400;
    line-height: var(--leading-caption);
    text-align: center;
  }

  .hero-synth-skeleton {
    min-height: 100%;
    pointer-events: none;
  }

  .hero-skeleton-pad-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--hero-pad-gap);
    width: 100%;
    height: 100%;
  }

  .hero-skeleton-pad-grid .hero-synth-button {
    aspect-ratio: auto;
  }

  .hero-card :global(#snap-canvas) {
    width: 100%;
    height: 100%;
  }

  .hero-synth-panel {
    --hero-pad-gap: 4px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    box-sizing: border-box;
  }

  .hero-button-bed {
    --hero-pad-size: calc((100% - (var(--hero-pad-gap) * 3)) / 4);
    width: 100%;
    aspect-ratio: 1 / 1;
    position: relative;
    padding: var(--hero-pad-gap);
    border-radius: calc(var(--ui-radius) + 4px);
    background: #3c3f45;
    box-sizing: border-box;
  }

  .hero-button-slots {
    position: absolute;
    inset: var(--hero-pad-gap);
    z-index: 0;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: repeat(4, 1fr);
    gap: var(--hero-pad-gap);
    place-items: center;
    pointer-events: none;
  }

  .hero-button-slot {
    width: 20%;
    height: 20%;
    border-radius: calc(var(--ui-radius) * 0.5);
    background: #25282e;
    box-shadow:
      -6px -6px 8px 0px rgba(255, 255, 255, 0.06) inset,
      2px 2px 6.1px -1px rgba(0, 0, 0, 0.5) inset,
      -1px -1px 1px 0px rgba(115, 124, 144, 0.14),
      1px 1px 1px 0px rgba(255, 255, 255, 0.06),
      8px 8px 20px -7px rgba(0, 0, 0, 0.45) inset;
  }

  .hero-button-grid {
    width: 100%;
    height: 100%;
    position: relative;
    z-index: 1;
  }

  .hero-button-grid :global(.snapsort-container) {
    width: 100%;
    height: 100%;
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    align-items: flex-start;
    gap: var(--hero-pad-gap);
  }

  .hero-button-grid :global(.hero-synth-item) {
    width: var(--hero-pad-size);
    height: var(--hero-pad-size);
    min-width: 0;
    min-height: 0;
    padding: 0;
    touch-action: none;
  }

  .hero-synth-button {
    --button-color: #fff;
    --button-dot-color: rgba(1, 11, 38, 0.32);
    --button-highlight-color: hsl(from var(--button-color) calc(h + 10) s calc(l + 20));
    --button-shadow-color: hsl(from var(--button-color) calc(h - 10) s calc(l - 20));
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    padding: 0;
    border: none;
    border-radius: var(--ui-radius);
    background: var(--button-color);
    color: var(--color-text);
    cursor: pointer;
    font-family: "Lato", sans-serif;
    font-size: 1rem;
    user-select: none;
    -webkit-user-select: none;
    position: relative;
    display: grid;
    place-items: center;
    box-shadow:
      0px 0px 1px 0.5px rgba(1, 11, 38, 0.157) inset,
      1px 1px 1px 0.5px hsl(from var(--button-highlight-color) h s l / 0.7) inset,
      -0.5px -0.5px 0.5px 0.5px hsl(from var(--button-shadow-color) h s l / 0.5) inset,
      2.5px 2.5px 3px -2px rgba(13, 34, 68, 0.43),
      5px 5px 6px -3px rgba(6, 29, 57, 0.348);
  }

  .hero-synth-button-bump {
    width: calc(100% - 8px);
    height: calc(100% - 8px);
    border-radius: calc(var(--ui-radius) - 1px);
    background: var(--button-color);
    position: relative;
    box-shadow:
      1.75px 2px 2.25px -1.25px rgba(32, 36, 37, 0.26),
      0.75px 0.75px 0.75px 0px hsl(from var(--button-highlight-color) h s l / 0.42) inset,
      -0.4px -0.4px 0.65px 0px hsl(from var(--button-shadow-color) h s l / 0.28) inset;
  }

  .hero-synth-button-bump::after {
    content: "";
    position: absolute;
    top: 0.4px;
    left: 0.4px;
    width: calc(100% - 0.8px);
    height: calc(100% - 0.8px);
    border-radius: calc(var(--ui-radius) - 1.4px);
    box-sizing: border-box;
    border: 0.7px solid rgb(255, 255, 255);
    mask-image: linear-gradient(
      to bottom right,
      rgba(0, 0, 0, 0.72) 0%,
      rgba(0, 0, 0, 0.48) 12%,
      rgba(0, 0, 0, 0.25) 28%,
      rgba(0, 0, 0, 0) 48%
    );
    filter: blur(0.15px);
  }

  .hero-synth-button-indent {
    width: 72%;
    aspect-ratio: 1 / 1;
    border-radius: 999px;
    background: radial-gradient(
      circle at 118% 118%,
      color-mix(in srgb, var(--button-color) 78%, #f0e8d4 22%) 0%,
      var(--button-color) 44%,
      color-mix(in srgb, var(--button-color) 92%, #2f2634 8%) 100%
    );
    box-shadow:
      1px 1px 1.5px 0 rgba(31, 18, 38, 0.14) inset,
      -0.75px -0.75px 1px 0 rgba(242, 234, 210, 0.32) inset,
      0 0 0 0.5px rgba(1, 11, 38, 0.08);
    filter: blur(1px);
  }

  .hero-synth-button.pad-gray {
    --button-color: #d8dde3;
  }

  .hero-synth-button.pad-primary {
    --button-color: var(--color-primary);
    --button-dot-color: rgba(255, 255, 255, 0.34);
    color: #fff;
  }

  .hero-synth-button.pad-primary .hero-synth-button-bump {
    --button-color: #d8dde3;
  }

  .hero-synth-button::before {
    content: "";
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 2;
    width: 12px;
    height: 7px;
    background-image: radial-gradient(circle, var(--button-dot-color) 1px, transparent 1.15px);
    background-size: 4px 4px;
    background-position: 0 0;
    pointer-events: none;
  }

  .hero-synth-button::after {
    content: "";
    position: absolute;
    top: 0.5px;
    left: 0.5px;
    width: calc(100% - 1px);
    height: calc(100% - 1px);
    border-radius: calc(var(--ui-radius) - 0.5px);
    box-sizing: border-box;
    border-style: inset;
    border: 1.5px solid rgb(255, 255, 255);
    mask-image: linear-gradient(
      to bottom right,
      rgba(0, 0, 0, 0.9) 0%,
      rgba(0, 0, 0, 0.8) 8%,
      rgba(0, 0, 0, 0.6) 10%,
      rgba(0, 0, 0, 0.5) 25%,
      rgba(0, 0, 0, 0) 50%
    );
    filter: blur(0.2px);
    pointer-events: none;
  }

  .hero-synth-button:hover {
    cursor: move;
    box-shadow:
      0px 0px 1px 0.5px rgba(1, 11, 38, 0.157) inset,
      1px 1px 1px 0.5px hsl(from var(--button-highlight-color) h s l / 0.7) inset,
      -0.5px -0.5px 0.5px 0.5px hsl(from var(--button-shadow-color) h s l / 0.5) inset,
      2px 2px 3px -2px rgba(13, 34, 68, 0.43),
      4px 4px 6px -3px rgba(6, 29, 57, 0.348);
  }

  .hero-synth-button.is-active {
    transform: scale(0.97);
    filter: saturate(1.08);
  }

  @container landing (max-width: 900px) {
    #landing {
      height: auto;
      min-height: 0;
    }

    .hero-layout {
      grid-template-columns: 100%;
      grid-template-rows: min-content 1fr;
      gap: var(--size-32);
      padding: var(--size-48) 0;
      align-items: start;
    }

    .hero-text h1 {
      text-align: center;
    }

    .hero-card {
      width: min(440px, calc(100% - var(--size-32)));
      justify-self: center;
    }
  }

  @media (max-width: 420px) {
    .hero-actions {
      width: 100%;
    }

    .hero-action {
      width: 100%;
      justify-content: center;
    }
  }
</style>
