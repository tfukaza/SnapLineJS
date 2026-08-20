<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import MaterialSurface from "./MaterialSurface.svelte";
  import type { MaterialSettings } from "./materialSurface";

  type SnapButtonProps = Omit<HTMLButtonAttributes, "children" | "class"> & {
    children: Snippet;
    material?: MaterialSettings;
    class?: string;
    className?: string;
  };

  let {
    children,
    material,
    class: classValue = "",
    className = "",
    type = "button",
    ...buttonProps
  }: SnapButtonProps = $props();

  const mergedClass = $derived(`snap-button ${classValue} ${className}`.trim());
</script>

<button {...buttonProps} {type} class={mergedClass}>
  <MaterialSurface depth="raised" shape="rounded" radius={8} {material} className="snap-button-surface">
    <span class="snap-button-content">{@render children()}</span>
  </MaterialSurface>
</button>

<style>
  .snap-button {
    --snap-button-color: #ececeb;
    --snap-button-text-color: var(--color-text-muted);
    --snap-button-min-height: 36px;
    --snap-button-padding-block: 6px;
    --snap-button-padding-inline: var(--size-16);

    display: inline-flex;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--snap-button-text-color);
    font: inherit;
    cursor: pointer;
  }

  :global(.snap-button-surface) {
    --material-color: var(--snap-button-color);
    --material-content-padding: var(--snap-button-padding-block) var(--snap-button-padding-inline);
    min-height: var(--snap-button-min-height);
  }

  .snap-button-content {
    line-height: 1.25;
  }

  .snap-button.small {
    --snap-button-padding-block: 6px;
    --snap-button-padding-inline: var(--size-12);
    font-size: 0.875rem;
  }

  .snap-button:disabled {
    cursor: not-allowed;
    pointer-events: none;
  }

  .snap-button:disabled :global(.snap-button-surface) {
    opacity: 0.5;
  }

  .snap-button:focus-visible {
    outline: 2px solid var(--color-action);
    outline-offset: 3px;
  }
</style>
