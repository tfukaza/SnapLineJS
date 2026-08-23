<script lang="ts">
  import type { InsertionMarkerState } from "@snap-engine/snapsort";
  import { Ghost } from "@snap-engine/snapsort/svelte";
  import { insertionTreeMarkerOptions } from "./insertionTreeMarker";

  let {
    ghost,
    hidden = false,
  }: {
    ghost: InsertionMarkerState;
    hidden?: boolean;
  } = $props();
</script>

<Ghost
  {ghost}
  className="insertion-tree-marker"
  data-tree-marker-hidden={hidden ? "true" : "false"}
  insertionMarker={insertionTreeMarkerOptions(ghost)}
  style={`visibility:${hidden ? "hidden" : "visible"};color:var(--color-primary);background:currentColor;`}
>
  <span class="insertion-tree-marker-dot" aria-hidden="true"></span>
</Ghost>

<style>
  .insertion-tree-marker-dot {
    position: absolute;
    top: 50%;
    left: 0;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
    transform: translateY(-50%);
  }
</style>
