<script lang="ts">
  import { onMount } from "svelte";
  import type { LineMirror } from "@snap-engine/snapline";

  // Stands in for an external overlay library: it did not create the line and
  // does not paint it. It only watches, which is what onGeometryInvalidated is
  // for — bindGeometryWriter is already owned by the line's renderer.
  let { line }: { line: LineMirror } = $props();

  let el: HTMLDivElement;

  function place() {
    if (!el) return;
    const geometry = line.geometrySnapshot();
    el.style.transform = `translate(${geometry.start.x + geometry.delta.x / 2}px, ${
      geometry.start.y + geometry.delta.y / 2
    }px)`;
  }

  onMount(() => {
    // No priming call on subscribe, so read the initial position explicitly.
    place();
    // WRITE_3, because the line paints (and resolves its anchors) at WRITE_2 —
    // scheduling earlier would read last frame's geometry.
    return line.onGeometryInvalidated(() =>
      line.schedule(place, { stage: "WRITE_3", queueId: `${line.id}-label` }),
    );
  });
</script>

<div
  bind:this={el}
  class="line-label"
  data-testid="line-label"
  data-line-id={line.lineId}
></div>

<style>
  .line-label {
    position: absolute;
    top: 0;
    left: 0;
    width: 10px;
    height: 10px;
    margin: -5px 0 0 -5px;
    border-radius: 50%;
    background: #d33;
    pointer-events: none;
    transform-origin: top left;
  }
</style>
