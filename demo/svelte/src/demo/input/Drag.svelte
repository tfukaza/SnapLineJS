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
    // import { GLOBAL_GID } from "../../../../../src/input";
    import { onMount, getContext } from "svelte";

    let engine:SnapLine = getContext("engine");

    // let startPosition: any = $state([]);
    // let endPosition: any = $state([]);
    // let dragCount: number = $state(0);
    // startPosition.push({id: dragCount, startX: 0, startY: 0});
    // dragCount++;
    // let style = $derived(`top: ${startPosition[startPosition.length - 1].startY - 10}px; left: ${startPosition[startPosition.length - 1].startX}px;`);

    // let dots: any = $state([]);
    interface pointerDot {
        x: number;
        y: number;
        createdAt: number;
        color: string;
    }

    interface memberProp {
        name: string;
        color: string;
    }

    interface pointerProp {
        pointerId: string;
        x: number;
        y: number;
        memberList: memberProp[];
    }

    interface dragGestureProp {
        pointerId: string;
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
        endX: number | null;
        endY: number | null;
        memberList: memberProp[];
        needDelete: boolean;
    }

    interface pinchGesture {
        id: string;
        x0: number;
        y0: number;
        x1: number;
        y1: number;
        object: ElementObject;
    }

    let pointerDots: pointerDot[] = [];
    
    let pointerList: Record<string, pointerProp> = $state({});
    let dragGesture: Record<string, dragGestureProp> = $state({});
    let pinchMarker: Record<string, pinchGesture> = $state({});
    

    function round(value: number) {
        return Math.round(value * 100) / 100;
    }

    function pointerDown(_: pointerDownProp, __: string, ___: string) {
    }

    function pointerMove(prop: pointerMoveProp, color: string, caller: string) {
        if (pointerList[prop.event!.pointerId]) {
            Object.assign(pointerList[prop.event!.pointerId], {
                x: round(prop.position.x), 
                y: round(prop.position.y),
            });
            if (!pointerList[prop.event!.pointerId].memberList.find(member => member.name === caller)) {
                pointerList[prop.event!.pointerId].memberList.push({name: caller, color: color});
            };
        } else {
            pointerList[prop.event!.pointerId] = {
                pointerId: prop.event!.pointerId.toString(),
                x: round(prop.position.x), 
                y: round(prop.position.y),
                memberList: [{name: caller, color: color}]
            };
        }
        
    }

    function pointerUp(prop: pointerUpProp) {
        delete pointerList[prop.event!.pointerId];
    }

    function dragStart(prop: dragStartProp, color: string, caller: string) {
        const startX = round(prop.start.x);
        const startY = round(prop.start.y);
        if (dragGesture[prop.pointerId] && dragGesture[prop.pointerId].needDelete) {
            delete dragGesture[prop.pointerId];
        } 

        if (dragGesture[prop.pointerId]) {
            dragGesture[prop.pointerId].memberList.push({name: caller, color: color});
        } else {
            dragGesture[prop.pointerId] = {
                pointerId: prop.pointerId.toString(),
                startX: startX,
                startY: startY,
                currentX: startX,
                currentY: startY,
                endX: null,
                endY: null,
                memberList: [{name: caller, color: color}],
                needDelete: false
            }
        }
    }

    function drag(prop: dragProp) {
        
        let pointer = dragGesture[prop.pointerId];
        pointer.currentX = prop.position.x;
        pointer.currentY = prop.position.y;

        pointerDots.push({
            x: round(prop.position.x), 
            y: round(prop.position.y),
            createdAt: Date.now(),
            color: "#000"
        });
    }

    function dragEnd(prop: dragEndProp) {
        let pointer = dragGesture[prop.pointerId];
        pointer.endX = round(prop.end.x);
        pointer.endY = round(prop.end.y);
        pointer.needDelete = true;
    }


    function pinchStart(prop: pinchStartProp) {
        pinchMarker[prop.gestureID] = {
            id: prop.gestureID,
            x0: prop.start.pointerList[0].x,
            y0: prop.start.pointerList[0].y, 
            x1: prop.start.pointerList[1].x, 
            y1: prop.start.pointerList[1].y, 
            object: new ElementObject(engine.global, null)
        }
    }

    function pinch(prop: pinchProp) {
        Object.assign(pinchMarker[prop.gestureID], {
            x0: prop.pointerList[0].x, 
            y0: prop.pointerList[0].y, 
            x1: prop.pointerList[1].x, 
            y1: prop.pointerList[1].y, 
        });
    }
    function pinchEnd(prop: pinchEndProp) {
        delete pinchMarker[prop.gestureID];
    }


    let testDrag: HTMLDivElement | null = $state(null);
    let testObject = new ElementObject(engine.global, null);

    let canvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;
    const dotRadius = 1;
    const dotFadeTime = 500;

    function drawCircle(
        x: number, y: number, 
        radius: number, 
        fillColor: string | null = null, 
        strokeColor: string | null = null) {
        ctx!.beginPath();
        ctx!.arc(x, y, radius, 0, Math.PI * 2);
        if (fillColor) {
            ctx!.fillStyle = fillColor;
            ctx!.fill();
        }
        if (strokeColor) {
            ctx!.strokeStyle = strokeColor;
            ctx!.stroke();
        }
    }

    function drawLine(
        x1: number, 
        y1: number, 
        x2: number, 
        y2: number, 
        width: number, 
        offset: number, 
        color: string) {

        const rotation = Math.atan2(y2 - y1, x2 - x1);
        const offsetY = Math.cos(rotation) * offset;
        const offsetX = Math.sin(rotation) * offset;

        ctx!.beginPath();
        ctx!.moveTo(x1 + offsetX, y1 + offsetY);
        ctx!.lineTo(x2 + offsetX, y2 + offsetY);
        ctx!.strokeStyle = color;
        ctx!.lineWidth = width;
        ctx!.stroke();
    }

    const memberOffset = 4;

    function renderFrame() {
        ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
        for (const dot of pointerDots) {
            drawCircle(dot.x, dot.y, dotRadius, dot.color);
        }
        for (const pointer of Object.values(pointerList)) {
            for (const [index, member] of pointer.memberList.entries()) {
                const offset = (index * memberOffset)
                // console.log(member.color);
                drawCircle(pointer.x, pointer.y, 4 + offset, null, member.color);
            }
        }
        for (const gesture of Object.values(dragGesture)) {
            const numMembers = gesture.memberList.length;
            for (let i = 0; i < numMembers; i++) {
                const member = gesture.memberList[i];
                const offset = (i * memberOffset) - (numMembers * memberOffset / 2);
                drawLine(
                    gesture.startX, 
                    gesture.startY, 
                    gesture.currentX, 
                    gesture.currentY, 
                    2, 
                    offset, 
                    member.color);
            }
        }
        for (const marker of Object.values(pinchMarker)) {
            drawLine(marker.x0, marker.y0, marker.x1, marker.y1, 2, 0, "#AAAAAA");
        }
        window.requestAnimationFrame(renderFrame);
        // Remove dots that are older than 1 second
        const now = Date.now();
        pointerDots = pointerDots.filter(dot => now - dot.createdAt < dotFadeTime);
        // Adjust color to gradually fade out
        for (const dot of pointerDots) {
            dot.color = `rgba(0, 0, 0, ${1 - (now - dot.createdAt) / dotFadeTime})`;
        }

    }

    window.requestAnimationFrame(renderFrame);

    onMount(() => {
        if (engine.global.inputEngine) {
            engine.global.inputEngine.event.pointerDown = (prop: pointerDownProp) => {
                pointerDown(prop, "#000", "Global");
            };
            engine.global.inputEngine.event.pointerUp = (prop: pointerUpProp) => {
                pointerUp(prop);
            };
            engine.global.inputEngine.event.pointerMove = (prop: pointerMoveProp) => {
                pointerMove(prop, "#000", "Global");
            };
            engine.global.inputEngine.event.dragStart = (prop: any) => {
                dragStart(prop, "#000", "Global");
            };
            engine.global.inputEngine.event.drag = (prop: any) => {
                drag(prop);
            };
            engine.global.inputEngine.event.dragEnd = (prop: any) => {
                dragEnd(prop);
            };
            engine.global.inputEngine.event.pinchStart = (prop: pinchStartProp) => {
                pinchStart(prop);
            };
            engine.global.inputEngine.event.pinch = (prop: pinchProp) => {
                pinch(prop);
            };
            engine.global.inputEngine.event.pinchEnd = (prop: pinchEndProp) => {
                pinchEnd(prop);
            };
        
        }
            
        testObject.element = testDrag!;
        testObject.event.input.dragStart = (prop: dragStartProp) => {
            dragStart(prop, "#FF0000", "Test");
        }
        testObject.event.input.drag = (prop: dragProp) => {
            drag(prop);
        }
        testObject.event.input.dragEnd = (prop: dragEndProp) => {
            dragEnd(prop);
        }
        testObject.event.input.pointerDown = (prop: pointerDownProp) => {
            pointerDown(prop, "#FF0000", "Test");
        }
        testObject.event.input.pointerUp = (prop: pointerUpProp) => {
            pointerUp(prop);
        }
        testObject.event.input.pointerMove = (prop: pointerMoveProp) => {
            pointerMove(prop, "#FF0000", "Test");
        }

        ctx = canvas!.getContext("2d");
    });

    engine.event.containerElementAssigned = (containerElement: HTMLElement) => {
        canvas!.width = containerElement.clientWidth;
        canvas!.height = containerElement.clientHeight;
    }
</script>

<canvas bind:this={canvas} class="canvas" ></canvas>

<div bind:this={testDrag} class="test-drag" ></div>

{#each Object.values(pointerList) as pointer (pointer.pointerId)}
<div style={`top: ${pointer.y}px; left: ${pointer.x}px;`} class="mouse-position-display">
   <ol>
    <li>
        <p>Pointer ID: {pointer.pointerId}</p>
        <p>X: {pointer.x}</p>
        <p>Y: {pointer.y}</p>
        <p>Member List: {pointer.memberList.map(member => member.name).join(", ")}</p>
    </li>
   </ol>
</div>
{/each}
<!-- {#each dots as dot}
    <div style={`top: ${dot.y}px; left: ${dot.x}px;`} class="dot">
    </div>
{/each} -->

{#each Object.values(dragGesture) as gesture (gesture.pointerId)}
    <div style={`top: ${gesture.startY}px; left: ${gesture.startX}px;`} class="drag-pin">
        {#each gesture.memberList as member}
            <div class="drag-pin-member" style={`background-color: ${member.color};`}>
                <p>{gesture.pointerId} - {member.name}</p>
            </div>
        {/each}
        <div class="drag-pin-body">
            <p>Start: {gesture.startX}, {gesture.startY}</p>
            <!-- <p>Member List: {gesture.memberList.join(", ")}</p> -->
        </div>
    </div>
    {#if gesture.endX && gesture.endY}
        <div style={`top: ${gesture.endY}px; left: ${gesture.endX}px;`} class="drag-pin">
            {#each gesture.memberList as member}
                <div class="drag-pin-member" style={`background-color: ${member.color};`}>
                    <p>{gesture.pointerId} - {member.name}</p>
                </div>
            {/each}
            <div class="drag-pin-body">
                <p>End: {gesture.endX}, {gesture.endY}</p>
            </div>
        </div>
    {/if}
{/each}

<!-- {#each Object.values(pinchMarker) as marker (marker.id)}
    <svg   
        width="1"
        height="1"
        style={`top: ${marker.y0}px; left: ${marker.x0}px; `} 
        class="pinch-marker">
        <line x1={0} y1={0} x2={marker.x1 - marker.x0} y2={marker.y1 - marker.y0}/>
    </svg>
{/each} -->



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
        background-color: #87878769;
        
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

        .drag-pin-member {
            // background-color: #000;
            padding: 4px;
           
            p {
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