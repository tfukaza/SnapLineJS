<script lang="ts">
    // import type {Engine} from "@snap-engine/core";
    // import { getContext } from "svelte";

    // let engine:Engine = getContext("engine");

    // let pointerPosition: any = $state({x: 0, y: 0, screen: {x: 0, y: 0}, camera: {x: 0, y: 0}});
    // let style = $derived(`top: ${pointerPosition.screen.y}px; left: ${pointerPosition.screen.x}px;`);

    // function updateMousePosition(prop: pointerMoveProp) {
    //     pointerPosition = prop.position;
    //     for (const [key, value] of Object.entries(prop.position)) {
    //         // Round to the nearest 1/100th of a pixel
    //         pointerPosition[key] = Math.round(value * 100) / 100;
    //     }
    // }
    // onMount(() => {
    //     engine.input.subscribeGlobalCursorEvent("pointerMove", "100", updateMousePosition, engine);
    // });



</script>

<!-- <div style={style} class="mouse-position-display">
   <ol>
    <li>
        <p>World Coordinates: {pointerPosition.x}, {pointerPosition.y}</p>
    </li>
    <li>
        <p>Camera Coordinates: {pointerPosition.camera.x}, {pointerPosition.camera.y}</p>
    </li>
    <li>
        <p>Screen Coordinates: {pointerPosition.screen.x}, {pointerPosition.screen.y}</p>
    </li>
   </ol>
</div> -->


<style lang="scss">
    .mouse-position-display {
        position: fixed;
        top: 0;
        left: 0;
        li {
            list-style-type: none;
        }

        p {
            font-size: 12px;
            font-family: 'IBM Plex Mono', monospace;
           
        }
    }
</style>
