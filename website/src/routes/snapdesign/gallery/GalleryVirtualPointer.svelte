<script lang="ts">
  import cursorUrl from "$lib/assets/gallery/cursor.svg?url";

  let { element = $bindable<HTMLDivElement | null>(null) } = $props();
</script>

<div
  bind:this={element}
  class="virtual-pointer"
  data-virtual-pointer
  data-virtual-pointer-state="hidden"
  aria-hidden="true"
>
  <img
    class="virtual-pointer-image"
    src={cursorUrl}
    alt=""
    draggable="false"
  />
</div>

<style>
  .virtual-pointer {
    position: absolute;
    z-index: 1000;
    top: 0;
    left: 0;
    width: 32px;
    height: 32px;
    opacity: 0;
    pointer-events: none;
    transform: translate3d(-100vw, -100vh, 0);
    transition: opacity 120ms ease;
    will-change: transform, opacity;
  }

  :global(.virtual-pointer[data-virtual-pointer-state="visible"]),
  :global(.virtual-pointer[data-virtual-pointer-state="pressed"]) {
    opacity: 0.94;
  }

  .virtual-pointer-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    transform: scale(1);
    transform-origin: 0 0;
    transition: transform 80ms ease;
    user-select: none;
  }

  :global(.virtual-pointer[data-virtual-pointer-state="pressed"])
    :global(.virtual-pointer-image) {
    transform: scale(0.88);
  }

  @media (prefers-reduced-motion: reduce) {
    .virtual-pointer,
    .virtual-pointer-image {
      transition: none;
    }

    .virtual-pointer {
      display: none;
    }
  }
</style>
