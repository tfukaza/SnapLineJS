<script lang="ts">
  import { onMount } from "svelte";
  import Checkbox from "$lib/components/Checkbox.svelte";
  import Dial from "$lib/components/Dial.svelte";
  import Radio from "$lib/components/Radio.svelte";
  import Slider from "$lib/components/Slider.svelte";
  import SnapButton from "$lib/components/SnapButton.svelte";
  import Toggle from "$lib/components/Toggle.svelte";

  let buttonPressed = $state(false);
  let dialValue = $state(130);
  let sliderValue = $state(65);
  let toggleEnabled = $state(true);
  let checkboxChecked = $state(true);
  let radioValue = $state("a");
  let matrixElement: HTMLDivElement;
  let autoplayPhase = $state("waiting");
  let autoplayActive = $state(false);

  function wait(duration: number, signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(resolve, duration);
      signal.addEventListener(
        "abort",
        () => {
          window.clearTimeout(timer);
          reject(signal.reason);
        },
        { once: true },
      );
    });
  }

  async function animateValues(
    values: readonly number[],
    update: (value: number) => void,
    signal: AbortSignal,
  ) {
    for (const value of values) {
      update(value);
      await wait(80, signal);
    }
  }

  async function animateButton(signal: AbortSignal) {
    const button = matrixElement.querySelector<HTMLButtonElement>(
      'button[aria-label="Run action"]',
    );
    if (!button) return;

    button.dispatchEvent(new MouseEvent("mouseenter"));
    await wait(120, signal);
    button.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, button: 0 }),
    );
    await wait(180, signal);
    button.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, button: 0 }),
    );
    button.click();
    await wait(120, signal);
    button.dispatchEvent(new MouseEvent("mouseleave"));
  }

  function resetControls() {
    buttonPressed = false;
    dialValue = 130;
    sliderValue = 65;
    toggleEnabled = true;
    checkboxChecked = true;
    radioValue = "a";
  }

  async function runShowcase(signal: AbortSignal) {
    resetControls();
    await wait(500, signal);

    while (!signal.aborted) {
      autoplayPhase = "button";
      await animateButton(signal);

      autoplayPhase = "dial";
      await animateValues(
        [140, 150, 160, 170, 180, 190, 200],
        (value) => (dialValue = value),
        signal,
      );

      autoplayPhase = "slider";
      await animateValues(
        [60, 55, 50, 45, 40, 35],
        (value) => (sliderValue = value),
        signal,
      );

      autoplayPhase = "toggle";
      toggleEnabled = false;
      await wait(420, signal);

      autoplayPhase = "checkbox";
      checkboxChecked = false;
      await wait(420, signal);

      autoplayPhase = "radio";
      radioValue = "b";
      await wait(420, signal);

      autoplayPhase = "complete";
      await wait(1000, signal);

      autoplayPhase = "radio-return";
      radioValue = "a";
      await wait(420, signal);

      autoplayPhase = "checkbox-return";
      checkboxChecked = true;
      await wait(420, signal);

      autoplayPhase = "toggle-return";
      toggleEnabled = true;
      await wait(420, signal);

      autoplayPhase = "slider-return";
      await animateValues(
        [40, 45, 50, 55, 60, 65],
        (value) => (sliderValue = value),
        signal,
      );

      autoplayPhase = "dial-return";
      await animateValues(
        [190, 180, 170, 160, 150, 140, 130],
        (value) => (dialValue = value),
        signal,
      );

      autoplayPhase = "button-return";
      await animateButton(signal);

      autoplayPhase = "resting";
      await wait(800, signal);
    }
  }

  onMount(() => {
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let documentVisible = document.visibilityState === "visible";
    let manuallyPaused = false;
    let automationController: AbortController | null = null;
    let resumeTimer: number | null = null;

    const stop = () => {
      automationController?.abort();
      automationController = null;
    };
    const sync = () => {
      const shouldRun =
        documentVisible &&
        !manuallyPaused &&
        !reducedMotionQuery.matches;
      autoplayActive = shouldRun;
      if (shouldRun && !automationController) {
        automationController = new AbortController();
        void runShowcase(automationController.signal).catch(() => {});
      } else if (!shouldRun) {
        stop();
        autoplayPhase = reducedMotionQuery.matches ? "reduced" : "paused";
      }
    };
    const handleVisibility = () => {
      documentVisible = document.visibilityState === "visible";
      sync();
    };
    const handleReducedMotion = () => sync();
    const handleManualInteraction = (event: PointerEvent) => {
      if (!event.isTrusted) return;
      manuallyPaused = true;
      stop();
      autoplayPhase = "manual";
      if (resumeTimer !== null) window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        manuallyPaused = false;
        resumeTimer = null;
        sync();
      }, 8000);
    };

    matrixElement.addEventListener("pointerdown", handleManualInteraction);
    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotionQuery.addEventListener("change", handleReducedMotion);
    sync();

    return () => {
      autoplayActive = false;
      stop();
      matrixElement.removeEventListener("pointerdown", handleManualInteraction);
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotionQuery.removeEventListener("change", handleReducedMotion);
      if (resumeTimer !== null) window.clearTimeout(resumeTimer);
    };
  });
</script>

<div
  class="control-matrix"
  data-control-matrix
  data-control-autoplay-active={autoplayActive}
  data-control-autoplay-phase={autoplayPhase}
  bind:this={matrixElement}
>
  <div class="matrix-cell" data-control-cell="button">
    <span class="matrix-cell-label">Button</span>
    <div class="matrix-control">
      <SnapButton
        className="matrix-button"
        aria-label="Run action"
        aria-pressed={buttonPressed}
        onclick={() => (buttonPressed = !buttonPressed)}
      ><span aria-hidden="true"></span></SnapButton>
    </div>
  </div>

  <div class="matrix-cell" data-control-cell="dial">
    <span class="matrix-cell-label">Dial</span>
    <div class="matrix-control">
      <Dial
        size={72}
        step={10}
        className="matrix-dial"
        bind:value={dialValue}
        aria-label="Dial specimen"
      />
    </div>
  </div>

  <div class="matrix-cell" data-control-cell="slider">
    <span class="matrix-cell-label">Slider</span>
    <div class="matrix-control matrix-slider-control">
      <Slider
        min={0}
        max={100}
        step={5}
        markers="dots"
        fluid
        bind:value={sliderValue}
        className="matrix-slider"
        aria-label="Slider specimen"
      />
    </div>
  </div>

  <div class="matrix-cell" data-control-cell="toggle">
    <span class="matrix-cell-label">Toggle</span>
    <div class="matrix-control matrix-inline-control">
      <Toggle bind:checked={toggleEnabled} aria-label="Toggle specimen" />
    </div>
  </div>

  <div class="matrix-cell" data-control-cell="checkbox">
    <span class="matrix-cell-label">Checkbox</span>
    <div class="matrix-control">
      <Checkbox
        bind:checked={checkboxChecked}
        aria-label="Checkbox specimen"
      />
    </div>
  </div>

  <div class="matrix-cell" data-control-cell="radio">
    <span class="matrix-cell-label">Radio</span>
    <div class="matrix-control matrix-radio-group" role="radiogroup" aria-label="Radio specimen">
      <Radio
        name="matrix-radio"
        value="a"
        bind:group={radioValue}
        aria-label="Option A"
      />
      <Radio
        name="matrix-radio"
        value="b"
        bind:group={radioValue}
        aria-label="Option B"
      />
    </div>
  </div>

</div>

<style>
  .control-matrix {
    display: grid;
    width: 50%;
    aspect-ratio: 1 / 1;
    min-width: 0;
    min-height: 0;
    margin: auto;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: repeat(3, minmax(0, 1fr));
    gap: 1px;
    overflow: hidden;
    border: 1px solid #d7d7d7;
    border-radius: var(--size-12);
    background: #d7d7d7;
    box-sizing: border-box;
    container-type: size;
  }

  .matrix-cell {
    display: grid;
    min-width: 0;
    min-height: 0;
    grid-template-rows: auto minmax(0, 1fr);
    gap: clamp(6px, 1.5cqi, 10px);
    padding: clamp(9px, 2.4cqi, 16px);
    overflow: hidden;
    background: #ececeb;
    box-sizing: border-box;
  }

  .matrix-cell-label {
    color: var(--color-text-subtle);
    font-family: var(--font-label);
    font-size: clamp(0.58rem, 1.8cqi, 0.74rem);
    font-weight: 400;
    line-height: 1;
  }

  .matrix-control {
    display: flex;
    min-width: 0;
    min-height: 0;
    align-items: center;
    justify-content: center;
  }

  .matrix-inline-control,
  .matrix-radio-group {
    gap: clamp(6px, 1.6cqi, 10px);
  }

  .matrix-radio-group {
    flex-direction: column;
    align-items: center;
  }

  .matrix-slider-control {
    width: 100%;
  }

  .matrix-slider-control :global(.matrix-slider) {
    width: min(100%, 160px);
  }

  .matrix-control :global(.matrix-button .snap-button-surface) {
    min-width: 54px;
  }

  .matrix-control :global(.matrix-dial .dial-value) {
    display: none;
  }

  @container (max-width: 360px) {
    .matrix-cell {
      padding: 7px;
    }

    .matrix-radio-group {
      gap: 4px;
    }

  }
</style>
