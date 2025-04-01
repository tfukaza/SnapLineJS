<script lang="ts">
    import SnapLineSvelte  from "../lib/SnapLineSvelte.svelte";
    import { addNode } from "./add";
    import { onMount } from "svelte";
    
    let objects = $state([]);
  
    onMount(() => {
      objects.push(...addNode());
    });

  </script>
  
  <div class="app-container">
    <SnapLineSvelte id="flowchart" objects={objects}/>
  </div>
  
  <style lang="scss">
      .app-container {
          width: 100%;
          height: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          background-color: #f8f8f8;
          padding: 0px 10%;
          box-sizing: border-box;
      }
  </style>
  