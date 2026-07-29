<script lang="ts">
    import { NodeMirror, LineMirror, type NodeCallbacks, type NewLineResolver, type GeometryChangeEvent, type NodeResizeEvent, type SnapLineMetadata } from "@snap-engine/snapline";
    import type { Engine } from "@snap-engine/core";
    import Line from "./Line.svelte";
    import { onMount, setContext, getContext, onDestroy, tick, untrack } from "svelte";
    import type { HTMLAttributes } from "svelte/elements";
    import { blur } from "svelte/transition";
    import { resizeRegionOwnerContext } from "./resize-region-context";

    let {
        id = undefined,
        className = "",
        LineSvelteComponent = Line,
        resolveLineComponent = undefined,
        resolveNewLine = undefined,
        nodeObject = null,
        x = 0,
        y = 0,
        width = undefined,
        height = undefined,
        minWidth = undefined,
        minHeight = undefined,
        metadata = {},
        callbacks = {},
        edgePan = true,
        onGeometryCommit = undefined,
        onSizeChange = undefined,
        elementProps = {},
        children,
    }: {
        /** Stable domain identity; minted when omitted (supply for persistence). */
        id?: string;
        className?: string;
        /** One renderer for every line leaving this node. */
        LineSvelteComponent?: typeof Line;
        /**
         * Picks a renderer per line, so a data edge and a control edge leaving
         * the same node can look different. Falls back to
         * `LineSvelteComponent` when it returns nothing.
         *
         * Resolved at render time, not at line creation: hydration never runs
         * the creation callback (a reloaded graph builds its lines through the
         * reconciler), so resolving from the line is what makes a line you just
         * drew and the same line after a refresh render identically. Branch on
         * serializable data you put in the payload — never store a component
         * reference in a record.
         */
        resolveLineComponent?: (line: LineMirror) => typeof Line | null | undefined;
        /** Seeds application data onto a line a drag from this node creates. */
        resolveNewLine?: NewLineResolver;
        nodeObject?: NodeMirror | null;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        minWidth?: number;
        minHeight?: number;
        metadata?: SnapLineMetadata;
        callbacks?: NodeCallbacks;
        edgePan?: boolean;
        onGeometryCommit?: (event: GeometryChangeEvent) => void;
        onSizeChange?: (event: NodeResizeEvent) => void;
        /** Framework-native attributes and events for the outer node element. */
        elementProps?: HTMLAttributes<HTMLDivElement>;
        children: any;
    } = $props();
    let nodeDOM: HTMLDivElement | null = null;
    let engine: Engine = getContext("engine");
    const ownsNode = nodeObject == null;
    if (!nodeObject) {
         nodeObject = new NodeMirror(engine, null, { id, minWidth, minHeight, metadata, callbacks: {}, edgePan, resolveNewLine });
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
    setContext(resizeRegionOwnerContext, nodeObject);

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
        nodeObject.callbacks.onGeometryCommit = (event) =>
            invoke(event, originalCallbacks.onGeometryCommit, callbacks.onGeometryCommit, onGeometryCommit);
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
        nodeObject.callbacks.onGeometryCommit = originalCallbacks.onGeometryCommit;
        nodeObject.callbacks.onSelectionChange = originalCallbacks.onSelectionChange;
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


{#each lineList as line (line.lineId)}
    {@const LineFor = resolveLineComponent?.(line) ?? LineSvelteComponent}
    <LineFor {line} />
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
</div>
