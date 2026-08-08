<script lang="ts">
    import { Engine as EngineComponent } from "@snap-engine/asset-base/svelte";
    import type {Engine} from "@snap-engine/core";
    import {ElementObject, BaseObject} from "@snap-engine/core";
    import type {
        dragProp,
        dragStartProp,
        dragEndProp,
        pointerDownProp,
        pointerUpProp,
        pinchProp,
        pinchStartProp,
        pinchEndProp,
        pointerMoveProp} from "@snap-engine/core";
    import { onMount, onDestroy } from "svelte";

    let { canvasId = "drag-demo-canvas" } = $props();

    let engine: Engine | null = $state(null);
    let canvasComponent: EngineComponent | null = null;
    let debugHelper: BaseObject | null = null;

    $effect(() => {
        if (engine && !debugHelper) {
             debugHelper = new BaseObject(engine, null);
        }
    });

    interface pinchGesture {
        id: string;
        x0: number;
        y0: number;
        x1: number;
        y1: number;
        object: ElementObject;
    }

    let pinchMarker: Record<string, pinchGesture> = $state({});
    

    function round(value: number) {
        return Math.round(value * 100) / 100;
    }

    function getEventSource(id: string | null): string {
        if (id === "global") return "[GLOBAL]";
        return `[OBJ:${id?.slice(0, 8) || "null"}]`;
    }

    function pointerDown(_: pointerDownProp, __: string, ___: string) {
    }

    function pointerMove(prop: pointerMoveProp, _color: string, caller: string) {
        if (debugHelper && prop.event) {
            const source = getEventSource(prop.objectId);
            debugHelper.addDebugPoint(prop.position.x, prop.position.y, "blue", true, "cursor");
            debugHelper.addDebugText(
                prop.position.x + 10,
                prop.position.y - 10,
                `${source} ${caller}\nCursor: (${round(prop.position.x)}, ${round(prop.position.y)})`,
                "blue",
                true,
                "cursor-text"
            );
        }
    }

    function pointerUp(_prop: pointerUpProp) {
        if (debugHelper) {
            debugHelper.clearDebugMarker("cursor");
            debugHelper.clearDebugMarker("cursor-text");
        }
    }

    function dragStart(prop: dragStartProp, _color: string, caller: string) {
        if (debugHelper) {
            const id = "drag-" + prop.pointerId;
            const source = getEventSource(prop.objectId);
            debugHelper.addDebugPoint(prop.start.x, prop.start.y, "green", true, id + "-start");
            debugHelper.addDebugText(
                prop.start.x + 10, 
                prop.start.y - 10, 
                `${source} ${caller}\nStart: (${round(prop.start.x)}, ${round(prop.start.y)})`, 
                "green", 
                true, 
                id + "-start-text"
            );
        }
    }

    function drag(prop: dragProp, caller: string) {
        if (debugHelper) {
            const id = "drag-" + prop.pointerId;
            const source = getEventSource(prop.objectId);
            // Draw line from start to current position
            debugHelper.addDebugLine(
                prop.start.x, 
                prop.start.y, 
                prop.position.x, 
                prop.position.y, 
                "red", 
                true, 
                id + "-line"
            );
            // Draw current position point
            debugHelper.addDebugPoint(prop.position.x, prop.position.y, "red", true, id + "-current");
            // Show current position text
            debugHelper.addDebugText(
                prop.position.x + 10, 
                prop.position.y + 20, 
                `${source} ${caller}\nCurrent: (${round(prop.position.x)}, ${round(prop.position.y)})`, 
                "red", 
                true, 
                id + "-current-text"
            );
        }
    }

    function dragEnd(prop: dragEndProp, caller: string) {
        if (debugHelper) {
            const id = "drag-" + prop.pointerId;
            const source = getEventSource(prop.objectId);
            // Clear the drag markers
            debugHelper.clearDebugMarker(id + "-start");
            debugHelper.clearDebugMarker(id + "-start-text");
            debugHelper.clearDebugMarker(id + "-line");
            debugHelper.clearDebugMarker(id + "-current");
            debugHelper.clearDebugMarker(id + "-current-text");
            
            // Show final end position briefly
            debugHelper.addDebugPoint(prop.end.x, prop.end.y, "purple", true, id + "-end");
            debugHelper.addDebugText(
                prop.end.x + 10, 
                prop.end.y - 10, 
                `${source} ${caller}\nEnd: (${round(prop.end.x)}, ${round(prop.end.y)})`, 
                "purple", 
                true, 
                id + "-end-text"
            );
            
            // Clear end markers after a short delay
            setTimeout(() => {
                if (debugHelper) {
                    debugHelper.clearDebugMarker(id + "-end");
                    debugHelper.clearDebugMarker(id + "-end-text");
                }
            }, 1000);
        }
    }


    function pinchStart(prop: pinchStartProp) {
        if (!engine) return;
        const id = "pinch-" + prop.gestureID;
        const source = getEventSource(prop.objectId);
        
        pinchMarker[prop.gestureID] = {
            id: prop.gestureID,
            x0: prop.start.pointerList[0].x,
            y0: prop.start.pointerList[0].y, 
            x1: prop.start.pointerList[1].x, 
            y1: prop.start.pointerList[1].y, 
            object: new ElementObject(engine, null)
        };

        if (debugHelper) {
            // Draw points at each finger position
            debugHelper.addDebugPoint(prop.start.pointerList[0].x, prop.start.pointerList[0].y, "orange", true, id + "-p0");
            debugHelper.addDebugPoint(prop.start.pointerList[1].x, prop.start.pointerList[1].y, "orange", true, id + "-p1");
            // Draw line between fingers
            debugHelper.addDebugLine(
                prop.start.pointerList[0].x, prop.start.pointerList[0].y,
                prop.start.pointerList[1].x, prop.start.pointerList[1].y,
                "orange", true, id + "-line"
            );
            // Show distance text at midpoint
            const midX = (prop.start.pointerList[0].x + prop.start.pointerList[1].x) / 2;
            const midY = (prop.start.pointerList[0].y + prop.start.pointerList[1].y) / 2;
            debugHelper.addDebugText(
                midX, midY - 20,
                `${source} Pinch Start\nDist: ${round(prop.start.distance)}`,
                "orange", true, id + "-text"
            );
        }
    }

    function pinch(prop: pinchProp) {
        const id = "pinch-" + prop.gestureID;
        const source = getEventSource(prop.objectId);
        const { current } = prop;
        
        Object.assign(pinchMarker[prop.gestureID], {
            x0: current.pointerList[0].x,
            y0: current.pointerList[0].y,
            x1: current.pointerList[1].x,
            y1: current.pointerList[1].y,
        });

        if (debugHelper) {
            // Update points at each finger position
            debugHelper.addDebugPoint(current.pointerList[0].x, current.pointerList[0].y, "cyan", true, id + "-p0");
            debugHelper.addDebugPoint(current.pointerList[1].x, current.pointerList[1].y, "cyan", true, id + "-p1");
            // Update line between fingers
            debugHelper.addDebugLine(
                current.pointerList[0].x, current.pointerList[0].y,
                current.pointerList[1].x, current.pointerList[1].y,
                "cyan", true, id + "-line"
            );
            // Show distance and scale text at midpoint
            const midX = (current.pointerList[0].x + current.pointerList[1].x) / 2;
            const midY = (current.pointerList[0].y + current.pointerList[1].y) / 2;
            const scale = current.distance / prop.start.distance;
            debugHelper.addDebugText(
                midX, midY - 20,
                `${source} Pinch\nDist: ${round(current.distance)}\nScale: ${round(scale)}x`,
                "cyan", true, id + "-text"
            );
        }
    }

    function pinchEnd(prop: pinchEndProp) {
        const id = "pinch-" + prop.gestureID;
        const source = getEventSource(prop.objectId);
        
        delete pinchMarker[prop.gestureID];

        if (debugHelper) {
            // Clear pinch markers
            debugHelper.clearDebugMarker(id + "-p0");
            debugHelper.clearDebugMarker(id + "-p1");
            debugHelper.clearDebugMarker(id + "-line");
            debugHelper.clearDebugMarker(id + "-text");
            
            // Show final pinch end briefly
            const midX = (prop.end.pointerList[0].x + prop.end.pointerList[1].x) / 2;
            const midY = (prop.end.pointerList[0].y + prop.end.pointerList[1].y) / 2;
            const scale = prop.end.distance / prop.start.distance;
            debugHelper.addDebugText(
                midX, midY - 20,
                `${source} Pinch End\nFinal Scale: ${round(scale)}x`,
                "magenta", true, id + "-end-text"
            );
            
            // Clear end marker after delay
            setTimeout(() => {
                if (debugHelper) {
                    debugHelper.clearDebugMarker(id + "-end-text");
                }
            }, 1000);
        }
    }


    interface AreaConfig {
        name: string;
        color: string;
        style: string;
        element?: HTMLDivElement;
        object?: ElementObject;
    }

    let areas: AreaConfig[] = [
        { name: "Center", color: "#FF5733", style: "grid-area: 2 / 2 / 5 / 5;" },
        { name: "TopLeft", color: "#33FF57", style: "grid-area: 1 / 1 / 2 / 3;" },
        { name: "BottomRight", color: "#3357FF", style: "grid-area:3 / 5 / 6 / 6;" },
        { name: "TopRight", color: "#F333FF", style: "grid-area: 1 / 4 / 2 / 6;" },
        { name: "BottomLeft", color: "#FF33A8", style: "grid-area: 4 / 1 / 6 / 2;" },
    ];

    let nestedArea: AreaConfig = {
        name: "Nested",
        color: "#000000",
        style: "width: 50%; height: 50%; display: flex; align-items: center; justify-content: center;",
    };

    function attachEvents(area: AreaConfig) {
        if (!area.object) return;
        area.object.event.input.dragStart = (prop: dragStartProp) => {
            dragStart(prop, area.color, area.name);
        }
        area.object.event.input.drag = (prop: dragProp) => {
            drag(prop, area.name);
        }
        area.object.event.input.dragEnd = (prop: dragEndProp) => {
            dragEnd(prop, area.name);
        }
        area.object.event.input.pointerDown = (prop: pointerDownProp) => {
            pointerDown(prop, area.color, area.name);
        }
        area.object.event.input.pointerUp = (prop: pointerUpProp) => {
            pointerUp(prop);
        }
        area.object.event.input.pointerMove = (prop: pointerMoveProp) => {
            pointerMove(prop, area.color, area.name);
        }
    }

    let listenerId: string | null = null;

    onMount(() => {
        // window.requestAnimationFrame(renderFrame); // Disabled for debug API test

        const currentEngine = engine;
        if (!currentEngine) {
            console.warn("Engine not ready for Drag demo.");
            return;
        }

        const inputControl = currentEngine.input;
        if (inputControl) {
            listenerId = currentEngine.global!.createId();
            
            inputControl.subscribeGlobalCursorEvent("pointerDown", listenerId, (prop: pointerDownProp) => {
                pointerDown(prop, "#000", "Global");
            }, currentEngine);
            inputControl.subscribeGlobalCursorEvent("pointerUp", listenerId, (prop: pointerUpProp) => {
                pointerUp(prop);
            }, currentEngine);
            inputControl.subscribeGlobalCursorEvent("pointerMove", listenerId, (prop: pointerMoveProp) => {
                pointerMove(prop, "#000", "Global");
            }, currentEngine);
            
            inputControl.subscribeGlobalCursorEvent("dragStart", listenerId, (prop: dragStartProp) => {
                dragStart(prop, "#000", "Global");
            }, currentEngine);
             inputControl.subscribeGlobalCursorEvent("drag", listenerId, (prop: dragProp) => {
                drag(prop, "Global");
            }, currentEngine);
             inputControl.subscribeGlobalCursorEvent("dragEnd", listenerId, (prop: dragEndProp) => {
                dragEnd(prop, "Global");
            }, currentEngine);
            
             inputControl.subscribeGlobalCursorEvent("pinchStart", listenerId, (prop: pinchStartProp) => {
                pinchStart(prop);
            }, currentEngine);
             inputControl.subscribeGlobalCursorEvent("pinch", listenerId, (prop: pinchProp) => {
                pinch(prop);
            }, currentEngine);
             inputControl.subscribeGlobalCursorEvent("pinchEnd", listenerId, (prop: pinchEndProp) => {
                pinchEnd(prop);
            }, currentEngine);
        }
            
        for (const area of areas) {
            if (!area.element) continue;
            area.object = new ElementObject(engine, null);
            area.object.element = area.element;
            attachEvents(area);
        }

        if (nestedArea.element) {
             const centerArea = areas.find(a => a.name === "Center");
             nestedArea.object = new ElementObject(engine, centerArea?.object || null);
             nestedArea.object.element = nestedArea.element;
             attachEvents(nestedArea);
        }
    
    });

    onDestroy(() => {
        if (engine && listenerId) {
            const inputControl = engine.input;
            if (inputControl) {
                inputControl.unsubscribeGlobalCursorEvent("pointerDown", listenerId);
                inputControl.unsubscribeGlobalCursorEvent("pointerUp", listenerId);
                inputControl.unsubscribeGlobalCursorEvent("pointerMove", listenerId);
                inputControl.unsubscribeGlobalCursorEvent("dragStart", listenerId);
                inputControl.unsubscribeGlobalCursorEvent("drag", listenerId);
                inputControl.unsubscribeGlobalCursorEvent("dragEnd", listenerId);
                inputControl.unsubscribeGlobalCursorEvent("pinchStart", listenerId);
                inputControl.unsubscribeGlobalCursorEvent("pinch", listenerId);
                inputControl.unsubscribeGlobalCursorEvent("pinchEnd", listenerId);
            }
        }
    });

    export function setDebug(enabled: boolean) {
        if (enabled) {
            canvasComponent?.enableDebug();
        } else {
            canvasComponent?.disableDebug();
        }
    }

   
</script>

<div class="drag-demo-wrapper">
    <EngineComponent
        id={canvasId}
        bind:this={canvasComponent}
        bind:engine={engine}
    >
        <div class="drag-demo-surface">
            <div class="grid-container">
                {#each areas as area}
                    <div bind:this={area.element} class="pointer-area slot" style={area.style}>
                        <p>{area.name}</p>
                        {#if area.name === 'Center'}
                            <div 
                                bind:this={nestedArea.element} 
                                class="pointer-area card" 
                                style={nestedArea.style}
                            >
                                <p>{nestedArea.name}</p>
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
    </EngineComponent>
</div>


<style lang="scss">
     li {
        list-style-type: none;
    }

    p {
        line-height: 1;
        margin: 0;
        font-size: 12px;
        color: var(--color-text);
    }

    .drag-demo-wrapper {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
    }

    .drag-demo-surface {
        position: relative;
        width: 100%;
        height: 100%;
    }

    .grid-container {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        grid-template-rows: repeat(5, 1fr);
        gap: var(--size-16);
        padding: var(--size-16);
        box-sizing: border-box;
        pointer-events: none;
    }

    .pointer-area {
        position: relative;
        background-color: var(--color-background-tint);
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
        
        p {
            pointer-events: none;
            user-select: none;
            position: absolute;
            top: var(--size-16);
            left: var(--size-16);
            opacity: 0.5;
        }
    }

    .pinch-marker {
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
        overflow: visible;

        line {
            stroke: #9a9a9a;
            stroke-width: 2;
        }
    }
</style>
