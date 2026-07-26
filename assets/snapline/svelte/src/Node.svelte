<script lang="ts">
    import { NodeMirror, LineMirror, DEFAULT_RESIZE_HANDLE_THICKNESS, type NodeCallbacks, type GeometryChangeEvent, type NodeResizeEvent, type ResizeHandle, type SnapLineMetadata } from "@snap-engine/snapline";
    import type { Engine } from "@snap-engine/core";
    import Line from "./Line.svelte";
    import { onMount, setContext, getContext, onDestroy, tick, untrack } from "svelte";
    import type { HTMLAttributes } from "svelte/elements";
    import { blur } from "svelte/transition";

    let {
        className = "",
        LineSvelteComponent = Line,
        nodeObject = null,
        x = 0,
        y = 0,
        width = undefined,
        height = undefined,
        resizable = false,
        minWidth = undefined,
        minHeight = undefined,
        resizeHandleThickness = undefined,
        resizeHandles = undefined,
        resizeCursors = undefined,
        metadata = {},
        callbacks = {},
        edgePan = true,
        onGeometryChanged = undefined,
        onSizeChange = undefined,
        elementProps = {},
        children,
    }: {
        className?: string;
        LineSvelteComponent?: typeof Line;
        nodeObject?: NodeMirror | null;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        resizable?: boolean;
        minWidth?: number;
        minHeight?: number;
        resizeHandleThickness?: number;
        resizeHandles?: true | readonly ResizeHandle[];
        resizeCursors?: Partial<Record<ResizeHandle, string>>;
        metadata?: SnapLineMetadata;
        callbacks?: NodeCallbacks;
        edgePan?: boolean;
        onGeometryChanged?: (event: GeometryChangeEvent) => void;
        onSizeChange?: (event: NodeResizeEvent) => void;
        /** Framework-native attributes and events for the outer node element. */
        elementProps?: HTMLAttributes<HTMLDivElement>;
        children: any;
    } = $props();
    let nodeDOM: HTMLDivElement | null = null;
    let engine: Engine = getContext("engine");
    const ownsNode = nodeObject == null;
    if (!nodeObject) {
         nodeObject = new NodeMirror(engine, null, { resizable, minWidth, minHeight, resizeHandleThickness, resizeHandles, resizeCursors, metadata, callbacks: {}, edgePan });
    }
    let lineList: LineMirror[] = $state(nodeObject.getAllOutgoingLines());

    let mounted = $state(false);
    let originalCallbacks: NodeCallbacks = {};

    function invoke<Event>(
        event: Event,
        ...handlers: Array<((value: Event) => unknown) | undefined>
    ) {
        const seen = new Set<Function>();
        for (const handler of handlers) {
            if (!handler || seen.has(handler)) continue;
            seen.add(handler);
            handler(event);
        }
    }

    setContext("nodeObject", nodeObject);

    onMount(() => {
        mounted = true;
        nodeObject.worldTransform = { x, y };
        nodeObject.element = nodeDOM as HTMLElement;
        nodeObject.writeTransform();
        originalCallbacks = { ...nodeObject.callbacks };
        nodeObject.callbacks.canStartDrag = (event) => {
            const handlers = [originalCallbacks.canStartDrag, callbacks.canStartDrag];
            const seen = new Set<Function>();
            for (const handler of handlers) {
                if (!handler || seen.has(handler)) continue;
                seen.add(handler);
                if (handler(event) === false) return false;
            }
            return true;
        };
        nodeObject.callbacks.resolveDragPosition = (event) =>
            callbacks.resolveDragPosition?.(event) ??
            originalCallbacks.resolveDragPosition?.(event) ??
            { x: event.x, y: event.y };
        nodeObject.callbacks.resolveSelectionMode = (event) =>
            callbacks.resolveSelectionMode?.(event) ??
            originalCallbacks.resolveSelectionMode?.(event) ??
            "replace";
        nodeObject.callbacks.onDragStart = (event) =>
            invoke(event, originalCallbacks.onDragStart, callbacks.onDragStart);
        nodeObject.callbacks.onDrag = (event) =>
            invoke(event, originalCallbacks.onDrag, callbacks.onDrag);
        nodeObject.callbacks.onSelectionChange = (event) =>
            invoke(event, originalCallbacks.onSelectionChange, callbacks.onSelectionChange);
        nodeObject.callbacks.onResizeHandleChange = (event) =>
            invoke(event, originalCallbacks.onResizeHandleChange, callbacks.onResizeHandleChange);
        nodeObject.callbacks.onGeometryChanged = (event) =>
            invoke(event, originalCallbacks.onGeometryChanged, callbacks.onGeometryChanged, onGeometryChanged);
        nodeObject.callbacks.onSizeChange = (event) => {
            invoke(event, originalCallbacks.onSizeChange, callbacks.onSizeChange, onSizeChange);
        };
        nodeObject.callbacks.onLinesChanged = (event) => {
            invoke(event, originalCallbacks.onLinesChanged, callbacks.onLinesChanged);
            lineList = [...event.lines];
        };
        lineList = nodeObject.getAllOutgoingLines();
        void tick().then(() => {
            if (mounted && nodeObject!.element) nodeObject!.remeasureDomGeometry();
        });
    });

    onDestroy(() => {
        mounted = false;
        nodeObject.callbacks.canStartDrag = originalCallbacks.canStartDrag;
        nodeObject.callbacks.resolveDragPosition = originalCallbacks.resolveDragPosition;
        nodeObject.callbacks.resolveSelectionMode = originalCallbacks.resolveSelectionMode;
        nodeObject.callbacks.onDragStart = originalCallbacks.onDragStart;
        nodeObject.callbacks.onDrag = originalCallbacks.onDrag;
        nodeObject.callbacks.onGeometryChanged = originalCallbacks.onGeometryChanged;
        nodeObject.callbacks.onSelectionChange = originalCallbacks.onSelectionChange;
        nodeObject.callbacks.onResizeHandleChange = originalCallbacks.onResizeHandleChange;
        nodeObject.callbacks.onLinesChanged = originalCallbacks.onLinesChanged;
        nodeObject.callbacks.onSizeChange = originalCallbacks.onSizeChange;
        if (ownsNode) {
            nodeObject.destroy(false);
        } else if (nodeDOM) {
            nodeObject.detachElement(nodeDOM);
        }
    });

    $effect(() => {
        const nextX = x;
        const nextY = y;
        if (!mounted) return;
        untrack(() => {
            nodeObject!.worldTransform = { x: nextX, y: nextY };
            nodeObject!.writeTransformAndLines();
        });
    });

    $effect(() => {
        const nextWidth = width;
        const nextHeight = height;
        if (!mounted) return;
        const object = untrack(() => nodeObject!);
        void tick().then(() => {
            if (!mounted || !object.element) return;
            if (nextWidth != null) object.element.style.width = `${nextWidth}px`;
            if (nextHeight != null) object.element.style.height = `${nextHeight}px`;
            if (nextWidth != null || nextHeight != null) {
                object.setSizeState(
                    nextWidth ?? object.hitBox.width,
                    nextHeight ?? object.hitBox.height,
                );
            }
            object.remeasureDomGeometry();
        });
    });

    export function getNodeObject() {
        return nodeObject;
    }
</script>


{#each lineList as line (line.id)}
    <LineSvelteComponent {line} />
{/each}
<div
    {...elementProps}
    bind:this={nodeDOM}
    data-snapline-type="node"
    class={className}
    style="position: absolute; transform-origin: top left; will-change: transform;"
    style:width={width != null ? `${width}px` : undefined}
    style:height={height != null ? `${height}px` : undefined}
    transition:blur|global={{duration: 200}}
>
    {@render children()}
    {#each nodeObject.resizeHandles as handle}
        <div
            class="snapline-node-resize"
            data-snapline-part="node-resize"
            data-handle={handle}
            style:--snapline-resize-thickness={`${resizeHandleThickness ?? DEFAULT_RESIZE_HANDLE_THICKNESS}px`}
        ></div>
    {/each}
</div>


<style>
    .snapline-node-resize {
        position: absolute;
        pointer-events: none;
    }
    .snapline-node-resize[data-handle="n"],
    .snapline-node-resize[data-handle="s"] {
        right: var(--snapline-resize-thickness);
        left: var(--snapline-resize-thickness);
        height: var(--snapline-resize-thickness);
    }
    .snapline-node-resize[data-handle="e"],
    .snapline-node-resize[data-handle="w"] {
        top: var(--snapline-resize-thickness);
        bottom: var(--snapline-resize-thickness);
        width: var(--snapline-resize-thickness);
    }
    .snapline-node-resize[data-handle="n"],
    .snapline-node-resize[data-handle^="n"] { top: calc(var(--snapline-resize-thickness) / -2); }
    .snapline-node-resize[data-handle="s"],
    .snapline-node-resize[data-handle^="s"] { bottom: calc(var(--snapline-resize-thickness) / -2); }
    .snapline-node-resize[data-handle="e"],
    .snapline-node-resize[data-handle$="e"] { right: calc(var(--snapline-resize-thickness) / -2); }
    .snapline-node-resize[data-handle="w"],
    .snapline-node-resize[data-handle$="w"] { left: calc(var(--snapline-resize-thickness) / -2); }
    .snapline-node-resize[data-handle="ne"],
    .snapline-node-resize[data-handle="se"],
    .snapline-node-resize[data-handle="sw"],
    .snapline-node-resize[data-handle="nw"] {
        width: var(--snapline-resize-thickness);
        height: var(--snapline-resize-thickness);
    }
</style>
