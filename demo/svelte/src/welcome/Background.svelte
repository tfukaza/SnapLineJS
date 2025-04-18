<script lang="ts">
    import { onMount, getContext } from "svelte";
    // import { Background } from "../../../../src/index";
    import type { SnapLine } from "../../../../src/index";
    import { ElementObject, BaseObject } from "../../../../src/index";
    let background: HTMLDivElement | null = null;

    const engine:SnapLine = getContext("engine");
    // let bg = new Background(engine.global, null);

    const GRID_X_SIZE = 32;
    const GRID_Y_SIZE = 32;

    let gridCells:ElementObject[] = [];
    for (let i = 0; i < GRID_X_SIZE * GRID_Y_SIZE; i++) {
        let cell = new ElementObject(engine.global, null);
        cell.positionMode = "relative";
        cell.requestPreRead(true, true); // TODO: Do this automatically when element is assigned
        gridCells.push(cell);
    }

    let waveWatcher = new BaseObject(engine.global, null);
    waveWatcher.event.global.onCursorDown = (prop) => {
        if (prop.button != 1) {
            return;
        }
        // console.log("cursor down", prop);
        createWave(prop.worldX, prop.worldY);
    }

    function createWave(x: number, y: number) {
        // return;
        const WAVE_DURATION = 150;
        const WAVE_DELAY = 0;
        // const WAVE_SCALE = 20;
        gridCells.forEach((cell, _) => {
            // cell.read(cell.getCurrentStats());
            // cell.dom!.style.backgroundColor = "#FF0000";
            // cell.requestWrite();
            // Animate the circle growing and shrinking, with delay depending on the distance from 0, 0
            let dx = cell.dom.property.worldX - x;
            let dy = cell.dom.property.worldY - y;
            let distance = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
            let delay = WAVE_DELAY + distance / 0.8;
            let angle = Math.atan2(dy, dx);
            // if (angle < 0) {
            //     angle = angle + 2 * Math.PI;
            // }
            let offsetX = Math.cos(angle) * Math.max(30 - distance ** 1.15/50, 0);
            // if (dx < 0) {
            //     offsetX = -offsetX;
            // }
            let offsetY = Math.sin(angle) * Math.max(30 - distance ** 1.15/50, 0);
            // if (dy > 0) {
            //     offsetY = -offsetY;
            // }
            // console.log(delay, cell.dom.property.worldX, cell.dom.property.worldY);
            cell.animate(
                {
                    from: 0,
                    to: 1,
                    duration: WAVE_DURATION,
                    easing: "ease-in-out",
                    delay: delay,
                    setValue: (value) => {
                        // console.log("grow");
                        cell.position.scaleX = 1 + value/3;
                        cell.position.scaleY = 1 + value/3;
                        cell.dom.localX = offsetX  * value;
                        cell.dom.localY = offsetY * value;
                        // cell.dom.style.backgroundColor = `rgba(255, 0, 0, ${value})`;
                        cell.requestPostWrite();
                    },
                    onStart: () => {
                        delete cell.dom.style.transform;
                    },
                    onFinish: () => {
                        cell.animate(
                            {
                                from: 1,
                                to: 0,
                                duration: WAVE_DURATION,
                                easing: "ease-in-out",
                                // delay: delay + 500,
                                setValue: (value) => {
                                    // console.log("shrink");
                                    cell.position.scaleX = 1 + value / 3;
                                    cell.position.scaleY = 1 + value / 3;
                                    cell.dom.localX = offsetX * value;
                                    cell.dom.localY = offsetY * value;
                                    // cell.dom.style.backgroundColor = `rgba(255, 0, 0, ${value})`;
                                    cell.requestPostWrite();
                                },

                                onFinish: () => {
                                    cell.dom.style.transform = "none";
                                }
                            }
                        )
                    }
                }
            )
        });
    }

    onMount(() => {         
        // bg.addDom(background as HTMLElement);
        // console.log(gridCells);
        background!.style.width = `${GRID_X_SIZE * 40}px`;
        // background!.style.height = `${GRID_Y_SIZE * 24}px`;
        gridCells.forEach((cell, _) => {
            cell.read(cell.getCurrentStats());
        });
        //   cell.requestPreRead();
        // createWave(0, 0);
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
        // width: 100%;
        // background-color: #fff;
        pointer-events: none;
        // background-image: radial-gradient(circle, #cccccc 2px, transparent 1px);
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