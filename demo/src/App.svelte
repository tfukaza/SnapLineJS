<script>
  import "./app.css";
  import {onMount} from 'svelte';

  import { youtube } from "./nodes/youtube";
  import { math, displayData, lerp, constantFloat, clamp } from "./nodes/math";
  import  SnapLine  from './lib/snapline';
  import { colorPicker } from "./nodes/input";

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

  let openNodeMenu = false;
  let openThemeMenu = false;

  function addNode(node, e) {
    openNodeMenu = false;
    // get mouse position
    let x = sl.g.mouse_x_world;
    let y = sl.g.mouse_y_world;

    console.debug("Adding node", node, "at", x, y);
  
    sl.addNodeAtMouse(node, e);
  }
</script>

<!-- <svelte:window on:load={loadSnapLine} /> -->

<main on:click={()=> {openNodeMenu = false; openThemeMenu = false;}}
  on:keydown={()=>{}}
  >
  <link href="{basePath}theme/{cssPath}" rel="stylesheet" type="text/css" />

  <navbar class="navbar"
   
  >
    <div>
      <div class="sl-dropdown">
        <button class="button"
        on:click|stopPropagation={()=> {openNodeMenu = !openNodeMenu; openThemeMenu = false;}}
        class:active={openNodeMenu}
        >Add Node</button>
        <ul
        class:hide = {!openNodeMenu}
        >
          <div class="divider">Input</div> 
          <li><button class="sl-btn" on:mouseup={(e) => addNode(constantFloat, e)}>Float</button></li>
          <li><button class="sl-btn" on:mouseup={(e) => addNode(colorPicker, e)}>Color</button></li>
          <div class="divider">Output</div> 
          <li><button class="sl-btn" on:mouseup={(e) => addNode(displayData, e)}>Display</button></li>
          <li><button class="sl-btn" on:mouseup={(e) => addNode(youtube, e)}>Youtube</button></li>
          <div class="divider">Math</div> 
          <li><button class="sl-btn" on:mouseup={(e) => addNode(math, e)}>Math</button></li>
          <li><button class="sl-btn" on:mouseup={(e) => addNode(clamp, e)}>Clamp</button></li>
          <li><button class="sl-btn" on:mouseup={(e) => addNode(lerp, e)}>Lerp</button></li>
        </ul>
      </div>
    </div>
    <div>
      <div class="sl-dropdown">
        <button class="button"
        on:click|stopPropagation={()=> {openThemeMenu = !openThemeMenu; openNodeMenu = false;}}
        >Theme</button>
        <!-- <ul tabindex="0" class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52">
          <li><button class="btn-sm" on:click={() => setTheme("standard.css")}>Standard</button></li>
          <li><button class="btn-sm" on:click={() => setTheme("dark.css")}>Standard (Dark)</button></li>
          <li><button class="btn-sm" on:click={() => setTheme("retro.css")}>Retro</button></li>
        </ul> -->
        <ul
        class:hide = {!openThemeMenu}
        >
          <li><button class="sl-btn" on:click={() => setTheme("standard.css")}>Standard</button></li>
          <li><button class="sl-btn" on:click={() => setTheme("dark.css")}>Standard (Dark)</button></li>
          <li><button class="sl-btn" on:click={() => setTheme("retro.css")}>Retro</button></li>
        </ul>

      </div>
    </div>
  </navbar>
  <div
    class="w-full h-screen bg-white overflow-hidden relative select-none"
    id="node-editor"
  />
</main>


<style>
  .navbar{
    height:50px;
    top: 80vh;
    position: absolute;
    z-index: 10;
    width: auto;
    display: inline-flex;
    left: 50%;
    transform: translate3d(-50%, 0, 0);
    column-gap: 10px;
    
    border: #e0e0e0 1px solid;
    border-radius: 10px;
    background-color: rgba(255, 255, 255, 0.639);
    backdrop-filter: blur(4px);
    box-shadow: 0px 6px 10px 0px rgba(71, 76, 79, 0.184);
  }

  .navbar.dim{
    background-color: #e0e0e045;
  }

  .navbar.dim .button{
    background-color: #ff18614d;
  }

  .sl-dropdown{
    
  }

  .sl-dropdown > ul {
    position: absolute;
    transition: all 0.1s;
    padding: 10px;

    border: #e0e0e0 1px solid;
    border-radius: 10px;
    background-color: rgba(255, 255, 255, 0.83);
    backdrop-filter: blur(4px);
    box-shadow: 0px 6px 10px 0px rgba(71, 76, 79, 0.184);

    width: 200px;

    transform: translate3d(calc(-50% + 20px), calc(-100% - 50px), 0);

    /* pointer-events: none; */

  }

  /* .sl-dropdown > li{
      color: red;
  } */

  .sl-btn {
    width: 100%;
    color: rgb(61, 61, 61);
  }

  .sl-btn:hover {
    background-color: #e0e0e0;
  }

  li:hover {
    background-color: #e0e0e0;
  }

  .button{
    background-color: #ff1861;
    /* width: 40px; */
    height: 40px;
    padding: 0px 12px;
    border-radius: 8px;
    color: white;
    box-shadow: 0px 8px 7px 0px #b8215330;
    transition: all 0.1s;
  }

  .button.active {
    background-color: #ff1e4f;
    box-shadow: 0px 4px 7px 3px #ff1e4f45;
    transform: translate3d(0, 3px, 0px);
  }

  .button:hover {
    box-shadow: 0px 4px 7px 3px #ff1e4f45;
    transform: translate3d(0, 3px, 0px);
  }

  .hide {
    opacity: 0;
    pointer-events: none;
    
  }
</style>