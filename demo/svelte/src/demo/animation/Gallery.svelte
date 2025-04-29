<script lang="ts">
  
    import Canvas from "../../lib2/Canvas.svelte";
    import Basic from "./Basic.svelte";
    import Variable from "./Variable.svelte";
    import Sequence from "./Sequence.svelte";
    import TimeControl from "./TimeControl.svelte";
  </script>
    
  <Canvas id="input">
    <div class="gallery">
      <Basic />
      <Variable />
      <Sequence />
      <TimeControl />
    </div>
  </Canvas>
    
  <style lang="scss">
    :global(#snap-canvas) {
      width: 100%;
      height: 100%;
    }

    :global(.gallery) {
      width: 100%;
      height: 100%;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }

    :global(.gallery > .exhibit) {
      position: relative;
      background-color: #f0f0f0;
      border-radius: 16px;
      overflow: hidden;
      height: 300px;
      // break-inside: avoid;
    }
  
  </style>
  