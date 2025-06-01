<script lang="ts">
    import { onMount, getContext } from "svelte";
    import type { SnapLine } from "../../../../src/index";
    import { ElementObject, BaseObject } from "../../../../src/index";
    let background: HTMLDivElement | null = null;

    const engine:SnapLine = getContext("engine");

    const GRID_X_SIZE = 32;
    const GRID_Y_SIZE = 32;

    let gridCells:ElementObject[] = [];
    for (let i = 0; i < GRID_X_SIZE * GRID_Y_SIZE; i++) {
        let cell = new ElementObject(engine.global, null);
        cell.transformMode = "relative";
        cell.requestPreRead(true, true); // TODO: Do this automatically when element is assigned
        gridCells.push(cell);
    }

    let waveWatcher = new BaseObject(engine.global, null);
    waveWatcher.event.global.pointerDown = (pointer) => {
        if (pointer.button != 1) {
            return;
        }
        console.log("Wave cursor down", pointer.position.x, pointer.position.y);
        createWave(pointer.position.x, pointer.position.y);
    }

    function createWave(x: number, y: number) {

        const WAVE_DURATION = 150;
        const WAVE_DELAY = 0;

        gridCells.forEach((cell, _) => {
            // Animate the circle growing and shrinking, with delay depending on the distance from 0, 0
            let dx = cell.dom.property.x - x;
            let dy = cell.dom.property.y - y;
            let distance = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
            let delay = WAVE_DELAY + distance / 0.8;
            let angle = Math.atan2(dy, dx);
            let offsetX = Math.cos(angle) * Math.max(30 - distance ** 1.15/50, 0);
       
            let offsetY = Math.sin(angle) * Math.max(30 - distance ** 1.15/50, 0);

            cell.animate(
                {
                    $alpha: [
                        0,
                        1,
                        0
                    ],
                },
                {
                    duration: WAVE_DURATION,
                    easing: ["ease-in", "ease-out"],
                    delay: delay,
                    tick: (value: Record<string, number>) => {
                        cell.transform.scaleX = 1 + value["$alpha"]/3;
                        cell.transform.scaleY = 1 + value["$alpha"]/3;
                        cell.offset.x = offsetX  * value["$alpha"];
                        cell.offset.y = offsetY * value["$alpha"];
                        cell.requestPostWrite();
                    },
                }
            )
            cell.animation.play();
        });
    }

    onMount(() => {         

        background!.style.width = `${GRID_X_SIZE * 40}px`;
        gridCells.forEach((cell, _) => {
            cell.read(cell.getCurrentStats());
        });
    });
</script>


<div id="sl-background" bind:this={background}>
    <div class="grid-container" style="column-count: {GRID_X_SIZE};">
        {#each Array(GRID_X_SIZE) as _, indexX}
            {#each Array(GRID_Y_SIZE) as _, indexY}
                <span class="grid-cell" bind:this={gridCells[indexX * GRID_Y_SIZE + indexY].element}></span>
            {/each}
        {/each}
    </div>
</div>   


<style lang="scss">
    #sl-background {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
        user-select: none;
        z-index: -1;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .grid-container {
        width: 100%;
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        column-gap: 40px;
        row-gap: 40px;
    }

    .grid-cell {
        width:4px;
        height:4px;
 
        background-color: #b8b8b8;
        border-radius: 2px;
    }
</style>