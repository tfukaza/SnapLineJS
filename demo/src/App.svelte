
<script>
  import "./app.css";
  import {onMount} from 'svelte';

  import { youtube } from "./nodes/youtube";
  import { math, displayData, lerp } from "./nodes/math";
  import  SnapLine  from './lib/snapline';

  const dev = import.meta.env.DEV;
  const basePath = dev ? '/src/lib/' : '/SnapLineJS/';

  let sl = null;

  onMount(async () => {
    sl = new SnapLine("node-editor");
  });
  
  let cssPath = "standard.css";
  function setTheme(e) {
    cssPath = e;
  }
</script>

<!-- <svelte:window on:load={loadSnapLine} /> -->

<main>
  <link href="{basePath}theme/{cssPath}" rel="stylesheet" type="text/css" />

  <navbar class="navbar px-5 fixed z-20 bg-white shadow-sm">
    <div class="flex-1">
      <div class="dropdown">
        <label tabindex="0" class="btn btn-sm">Add Node</label>
        <ul
          tabindex="0"
          class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52"
        >
          <li><button class="btn-sm" on:click={() => sl.addNode(math, 0, 0)}>Math</button></li>
          <li><button class="btn-sm" on:click={() => sl.addNode(youtube, 0, 0)}>YouTube</button></li>
          <li><button class="btn-sm" on:click={() => sl.addNode(displayData, 0, 0)}>Print</button></li>
          <li><button class="btn-sm" on:click={() => sl.addNode(lerp, 0, 0)}>Print</button></li>
        </ul>
      </div>
    </div>
    <div class="flex-none">
      <div class="dropdown dropdown-end">
        <label tabindex="0" class="btn btn-sm btn-outline">Theme</label>
        <ul tabindex="0" class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52">
          <li><button class="btn-sm" on:click={() => setTheme("standard.css")}>Standard</button></li>
          <li><button class="btn-sm" on:click={() => setTheme("dark.css")}>Standard (Dark)</button></li>
          <li><button class="btn-sm" on:click={() => setTheme("retro.css")}>Retro</button></li>
        </ul>
      </div>
    </div>
  </navbar>
  <div
    class="w-full h-screen bg-white overflow-hidden relative select-none"
    id="node-editor"
  />
</main>
