<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  type CodeLcdDisplayProps = Omit<HTMLAttributes<HTMLDivElement>, "class"> & {
    value: string;
    label?: string;
    class?: string;
    className?: string;
  };

  let {
    value,
    label = "LCD DISPLAY",
    class: classValue = "",
    className = "",
    ...displayProps
  }: CodeLcdDisplayProps = $props();

  const mergedClass = $derived(
    `code-lcd-display ${classValue} ${className}`.trim(),
  );
</script>

<div {...displayProps} class={mergedClass}>
  <span class="display-label">{label}</span>
  <code>{value}</code>
</div>

<style>
  .code-lcd-display {
    --display-bezel-width: 8px;
    --display-radius: 3px;
    --display-bezel-color: #15181a;
    --display-surface-color: #050708;
    --display-text-color: #e8e6dc;

    position: relative;
    display: flex;
    width: 100%;
    min-height: 72px;
    box-sizing: border-box;
    flex-direction: column;
    justify-content: space-between;
    gap: var(--size-8);
    padding: 8px;
    overflow: visible;
    border: var(--display-bezel-width) solid var(--display-bezel-color);
    border-radius: var(--display-radius);
    background: radial-gradient(
      circle at 50% 70%,
      #121516 0%,
      #07090a 48%,
      var(--display-surface-color) 82%
    );
    box-shadow:
      -1px -1px 1px 0 rgb(10 12 14 / 28%),
      1px 1px 1px 0 rgb(255 255 255 / 18%),
      2px 2px 6px -1px rgb(0 0 0 / 36%) inset,
      -1px -1px 2px 0 rgb(255 255 255 / 5%) inset;
    color: var(--display-text-color);
    font-family: var(--font-code);
  }

  .code-lcd-display::before,
  .code-lcd-display::after {
    content: "";
    position: absolute;
    top: calc(-1 * var(--display-bezel-width) + 2px);
    left: calc(-1 * var(--display-bezel-width) + 2px);
    width: calc(100% + var(--display-bezel-width) * 2 - 4px);
    height: calc(100% + var(--display-bezel-width) * 2 - 4px);
    box-sizing: border-box;
    border-radius: calc(var(--display-radius) - 1.5px);
    pointer-events: none;
  }

  .code-lcd-display::before {
    border: 0.6px solid rgb(255 255 255 / 14%);
  }

  .code-lcd-display::after {
    border: 0.8px solid rgb(255 255 255 / 42%);
    mask-image: linear-gradient(
      to bottom right,
      rgb(0 0 0 / 92%) 0%,
      rgb(0 0 0 / 56%) 10%,
      rgb(0 0 0 / 22%) 20%,
      transparent 42%,
      transparent 66%,
      rgb(0 0 0 / 16%) 84%,
      rgb(0 0 0 / 32%) 100%
    );
  }

  .display-label {
    color: rgb(232 230 220 / 56%);
    font-family: inherit;
    font-size: 0.52rem;
    letter-spacing: 0.08em;
    line-height: 1;
    text-transform: uppercase;
  }

  code {
    background: transparent;
    color: inherit;
    font-family: inherit;
    font-size: clamp(1.35rem, 3vw, 2rem);
    font-weight: 500;
    line-height: 1;
  }
</style>
