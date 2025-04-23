<script lang="ts">
    import type {SnapLine} from "../../../../index";
    import {ElementObject} from "../../../../../src/object";
    import type {
        dragProp, 
        dragStartProp, 
        dragEndProp, 
        pointerDownProp, 
        pointerUpProp, 
        pinchProp, 
        pinchStartProp,
        pinchEndProp, 
        pointerMoveProp} from "../../../../../src/input";
    import { GLOBAL_GID } from "../../../../../src/input";
    import { onMount, getContext } from "svelte";

    let engine:SnapLine = getContext("engine");

    let startPosition: any = $state([]);
    let endPosition: any = $state([]);
    let dragCount: number = $state(0);
    startPosition.push({id: dragCount, startX: 0, startY: 0});
    dragCount++;
    let style = $derived(`top: ${startPosition[startPosition.length - 1].startY - 10}px; left: ${startPosition[startPosition.length - 1].startX}px;`);

    let dots: any = $state([]);

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

    function dragStart(prop: dragStartProp, color: string) {
        // console.log("Global dragStart", prop);
        // if (dragCount > 0) {
        //     startPosition.pop();
        //     endPosition.pop();
        //     dragCount--;
        // }
        const startX = round(prop.start.x);
        const startY = round(prop.start.y);
        const data = {id: dragCount, pointerId: prop.pointerId, startX: startX, startY: startY, color: color};
        startPosition.push(data);
        dragCount++;
    }

    function updateDragPosition(prop: dragProp) {
        // console.log("Global updateDragPosition");
        let pointer = startPosition[startPosition.length - 1];
        pointer.x = round(prop.delta.x);
        pointer.y = round(prop.delta.y);
        // dots.push({x: round(prop.position.x), y: round(prop.position.y)});
        drawCircle(round(prop.position.x), round(prop.position.y), 1);
    }

    function dragEnd(prop: dragEndProp) {
        // console.log("Global dragEnd");
        const data = {id: dragCount, pointerId: prop.pointerId, x: round(prop.end.x), y: round(prop.end.y), color: "#555555"};
        endPosition.push(data);
        // dragCount++;
    }


    function pinchStart(prop: pinchStartProp) {
        console.log("Global pinchStart", prop);
        // startPosition.push({id: dragCount, startX: prop.dragPointList[0].start.x, startY: prop.dragPointList[0].start.y, color: "#000"});
        pinchMarker[prop.gestureID] = {
            id: prop.gestureID,
            x0: prop.start.pointerList[0].x,
            y0: prop.start.pointerList[0].y, 
            x1: prop.start.pointerList[1].x, 
            y1: prop.start.pointerList[1].y, 
            object: new ElementObject(engine.global, null)
        }
    }

    function updatePinchMarker(prop: pinchProp) {
        console.log("Global pinch", prop);
        Object.assign(pinchMarker[prop.gestureID], {
            x0: prop.pointerList[0].x, 
            y0: prop.pointerList[0].y, 
            x1: prop.pointerList[1].x, 
            y1: prop.pointerList[1].y, 
        });
    }
    function pinchEnd(prop: pinchEndProp) {
        console.log("Global pinchEnd", prop);
        delete pinchMarker[prop.gestureID];
    }

    // function pinch(prop: pinchProp) {
    //     console.log("Global pinch", prop);
    // }

    let testDrag: HTMLDivElement | null = $state(null);
    let testObject = new ElementObject(engine.global, null);

    let canvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;

    function drawCircle(x: number, y: number, radius: number) {
        ctx!.beginPath();
        ctx!.arc(x, y, radius, 0, Math.PI * 2);
        ctx!.fillStyle = "#AAAAAA";
        ctx!.fill();
    }

    onMount(() => {
        if (engine.global.inputEngine) {
            // engine.global.inputEngine.inputControl.event.dragStart = dragStart;
            // engine.global.inputEngine.inputControl.event.drag = updateDragPosition;
            // engine.global.inputEngine.inputControl.event.dragEnd = dragEnd;
            // engine.global.inputEngine.inputControl.event.pointerDown = (prop: pointerDownProp) => {
            //     console.log("Global pointerDown", prop);
            // }
            engine.global.inputEngine.subscribeGlobalCursorEvent("dragStart", GLOBAL_GID, (prop: any) => {
                console.log("Global dragStart", prop);
                dragStart(prop, "#000")
            });
            engine.global.inputEngine.subscribeGlobalCursorEvent("drag", GLOBAL_GID, (prop: any) => {
                console.log("Global drag", prop);
                updateDragPosition(prop);
            });
            engine.global.inputEngine.subscribeGlobalCursorEvent("dragEnd", GLOBAL_GID, (prop: any) => {
                console.log("Global dragEnd", prop);
                dragEnd(prop);
            });
            engine.global.inputEngine.subscribeGlobalCursorEvent("pinchStart", GLOBAL_GID, (prop: pinchStartProp) => {
                console.log("Global pinchStart", prop);
                pinchStart(prop);
            });
            engine.global.inputEngine.subscribeGlobalCursorEvent("pinch", GLOBAL_GID, (prop: pinchProp) => {
                console.log("Global pinch", prop);
                updatePinchMarker(prop);
            });
            engine.global.inputEngine.subscribeGlobalCursorEvent("pinchEnd", GLOBAL_GID, (prop: pinchEndProp) => {
                console.log("Global pinchEnd", prop);
                pinchEnd(prop);
            });
            engine.global.inputEngine.subscribeGlobalCursorEvent("pointerDown", GLOBAL_GID, (prop: pointerDownProp) => {
                console.log("Global pointerDown", prop);
            });
            engine.global.inputEngine.subscribeGlobalCursorEvent("pointerUp", GLOBAL_GID, (prop: pointerUpProp) => {
                console.log("Global pointerUp", prop);
            });
            engine.global.inputEngine.subscribeGlobalCursorEvent("pointerMove", GLOBAL_GID, (prop: pointerMoveProp) => {
                console.log("Global pointerMove", prop);
            });
        }
            
        testObject.element = testDrag!;
        testObject.event.input.dragStart = (prop: dragStartProp) => {
            console.log("Test dragStart", prop);
            dragStart(prop, "#FF0000");
        }
        testObject.event.input.drag = (prop: dragProp) => {
            console.log("Test drag", prop);
            updateDragPosition(prop);
        }
        testObject.event.input.dragEnd = (prop: dragEndProp) => {
            console.log("Test dragEnd", prop);
            dragEnd(prop);
        }

        testObject.event.input.pointerDown = (prop: pointerDownProp) => {
            console.log("Test pointerDown", prop);
        }
        testObject.event.input.pointerUp = (prop: pointerUpProp) => {
            console.log("Test pointerUp", prop);
        }
        testObject.event.input.pointerMove = (prop: pointerMoveProp) => {
            console.log("Test pointerMove", prop);
        }

        ctx = canvas!.getContext("2d");
        canvas!.width = 1000;
        canvas!.height = 1000;
    });

   

</script>

<canvas bind:this={canvas} class="canvas" ></canvas>
<div bind:this={testDrag} class="test-drag" ></div>

<div style={style} class="mouse-position-display">
   <ol>
    <li>
        <p>Delta: {startPosition[startPosition.length - 1].x}, {startPosition[startPosition.length - 1].y}</p>
    </li>
   </ol>
</div>

{#each dots as dot}
    <div style={`top: ${dot.y}px; left: ${dot.x}px;`} class="dot">
    </div>
{/each}

{#each startPosition as position}
    <div style={`top: ${position.startY}px; left: ${position.startX}px;`} class="drag-pin">
        <div class="drag-pin-header" style={`background-color: ${position.color};`}>
            <h1>Drag Start: {position.pointerId}</h1>
        </div>
        <div class="drag-pin-body">
            <p>Start: {position.startX}, {position.startY}</p>
        </div>
    </div>
{/each}
{#each endPosition as position}
    <div style={`top: ${position.y}px; left: ${position.x}px;`} class="drag-pin">
        <div class="drag-pin-header" style={`background-color: ${position.color};`}>
            <h1>Drag End: {position.pointerId}</h1>
        </div>
        <div class="drag-pin-body">
            <p>End: {position.x}, {position.y}</p>
        </div>
    </div>  
{/each}

{#each Object.values(pinchMarker) as marker (marker.id)}
    <svg   
        width="1"
        height="1"
        style={`top: ${marker.y0}px; left: ${marker.x0}px; `} 
        class="pinch-marker">
        <line x1={0} y1={0} x2={marker.x1 - marker.x0} y2={marker.y1 - marker.y0}/>
    </svg>
{/each}



<style lang="scss">
     li {
        list-style-type: none;
    }

    p {
        line-height: 1;
        margin: 0;
        font-size: 12px;
        font-family: 'IBM Plex Mono', monospace;
        color: #000;
    }

    .canvas {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
     
    }

    .test-drag {
        position: absolute;
        top: 0;
        left: 0;
        width: 100px;
        height: 100px;
        background-color: #000;
        
    }

    .mouse-position-display {
        position: fixed;
        top: 0;
        left: 0;
        pointer-events: none;
       
    }

    .dot {
        width:2px;
        height:2px;
        position: absolute;
        background-color: #989898;
        // border: 2px solid #000;
        border-radius: 1px;
        pointer-events: none;
    }

    .drag-pin {
        position: absolute;
        background-color: #ffffff;
        border: 2px solid #000;
        border-radius: 4px;
        pointer-events: none;

        .drag-pin-header {
            // background-color: #000;
            padding: 4px;
           
            h1 {
                font-size: 12px;
                font-family: 'IBM Plex Mono', monospace;
                color: #fff; 
            }
        }

        .drag-pin-body {
            padding: 4px;
            p {
                font-size: 12px;
            }
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