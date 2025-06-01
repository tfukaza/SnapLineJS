<script lang="ts">
  
  import Canvas from "../../lib2/Canvas.svelte";
  import Mouse from "./Mouse.svelte";
  import Drag from "./Drag.svelte";
</script>
  
<Canvas id="input">
  <Mouse />
  <Drag />
</Canvas>
  
<style lang="scss">
  :global(#snap-canvas) {
    width: 100%;
    height: 100%;
  }

</style>
