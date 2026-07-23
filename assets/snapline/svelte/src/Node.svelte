<script lang="ts">
    import { NodeComponent, LineComponent, DEFAULT_RESIZE_HANDLE_RADIUS, type ResizeAnchor } from "@snap-engine/snapline";
    import type { Engine } from "@snap-engine/core";
    import Line from "./Line.svelte";
    import { onMount, setContext, getContext, onDestroy } from "svelte";
    import { blur } from "svelte/transition";

    let {
        className = "",
        LineSvelteComponent = Line,
        nodeObject = null,
        x = 0,
        y = 0,
        resizable = false,
        minWidth = undefined,
        minHeight = undefined,
        resizeHandleRadius = undefined,
        resizeAnchor = undefined,
        onResizeCommit = undefined,
        onSizeChange = undefined,
        children,
    }: {
        className?: string;
        LineSvelteComponent?: typeof Line;
        nodeObject?: NodeComponent | null;
        x?: number;
        y?: number;
        resizable?: boolean;
        minWidth?: number;
        minHeight?: number;
        resizeHandleRadius?: number;
        resizeAnchor?: ResizeAnchor;
        onResizeCommit?: (width: number, height: number) => void;
        onSizeChange?: (width: number, height: number) => void;
        children: any;
    } = $props();
    let nodeDOM: HTMLDivElement | null = null;
    let engine: Engine = getContext("engine");
    const ownsNode = nodeObject == null;
    if (!nodeObject) {
         nodeObject = new NodeComponent(engine, null, { resizable, minWidth, minHeight, resizeHandleRadius, resizeAnchor });
    }
    let lineList: LineComponent[] = $state(nodeObject.getAllOutgoingLines());

    // The element's width/height are framework-owned: core reports size changes
    // (resize drag) via onSizeChange and this state renders them. Null until the
    // first resize so CSS-declared sizes keep applying to non-resized nodes.
    let boxW = $state<number | null>(null);
    let boxH = $state<number | null>(null);

    setContext("nodeObject", nodeObject);

    onMount(() => {
        nodeObject.worldTransform = { x, y };
        nodeObject.element = nodeDOM as HTMLElement;
        nodeObject.writeTransform();
        nodeObject.nodeCallback.onResizeCommit = (w: number, h: number) => onResizeCommit?.(w, h);
        nodeObject.nodeCallback.onSizeChange = (w: number, h: number) => {
            boxW = w;
            boxH = h;
            onSizeChange?.(w, h);
        };
        nodeObject.nodeCallback.onLinesChanged = (lines: LineComponent[]) => {
            lineList = lines;
        };
        lineList = nodeObject.getAllOutgoingLines();
    });

    onDestroy(() => {
        nodeObject.nodeCallback.onLinesChanged = null;
        if (ownsNode) {
            nodeObject.destroy();
        }
    });

    export function addSetPropCallback(name: string, callback: (prop: any) => void) {
        nodeObject!.addSetPropCallback(callback, name);
    }

    export function getNodeObject() {
        return nodeObject;
    }
</script>


{#each lineList as line (line.id)}
    <LineSvelteComponent {line} />
{/each}
<div
    bind:this={nodeDOM}
    data-snapline-type="node"
    class={className}
    style="position: absolute; transform-origin: top left; will-change: transform;"
    style:width={boxW != null ? `${boxW}px` : undefined}
    style:height={boxH != null ? `${boxH}px` : undefined}
    transition:blur|global={{duration: 200}}
>
    {@render children()}
    {#if resizable}
        {@const anchor = resizeAnchor ?? "br"}
        <!-- Purely visual: the collision hitbox (which straddles the corner and
             spreads beyond it) does the hitting, so this takes no pointer events.
             Sized from the same config value as the hitbox radius. -->
        <div
            class="snapline-node-resize"
            data-snapline-part="node-resize"
            data-anchor={anchor}
            style:width={`${resizeHandleRadius ?? DEFAULT_RESIZE_HANDLE_RADIUS}px`}
            style:height={`${resizeHandleRadius ?? DEFAULT_RESIZE_HANDLE_RADIUS}px`}
            style:left={anchor === "tl" || anchor === "bl" ? "0" : undefined}
            style:right={anchor === "tr" || anchor === "br" ? "0" : undefined}
            style:top={anchor === "tl" || anchor === "tr" ? "0" : undefined}
            style:bottom={anchor === "bl" || anchor === "br" ? "0" : undefined}
            style:cursor={anchor === "tr" || anchor === "bl" ? "nesw-resize" : "nwse-resize"}
        ></div>
    {/if}
</div>


<style>
    .snapline-node-resize {
        position: absolute;
        pointer-events: none;
    }
</style>
