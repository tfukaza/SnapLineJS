<script lang="ts">
    import { GroupNodeMirror, DEFAULT_RESIZE_HANDLE_THICKNESS, type GroupCallbacks, type GroupContainEvent, type GroupMembershipEvent, type NodeDragCommitEvent, type NodeResizeEvent, type ResizeHandle, type SnapLineMetadata } from "@snap-engine/snapline";
    import type { Engine } from "@snap-engine/core";
    import { onMount, onDestroy, getContext, tick, untrack, type Snippet } from "svelte";

    let {
        className = "",
        groupObject = null,
        x = 0,
        y = 0,
        width = 400,
        height = 300,
        title = "Group",
        headerContent = undefined,
        // Min sizes default in core (DEFAULT_GROUP_CONFIG); undefined passes through.
        minWidth = undefined,
        minHeight = undefined,
        resizeHandleThickness = undefined,
        resizeHandles = undefined,
        resizeCursors = undefined,
        metadata = {},
        callbacks = {},
        groupCallbacks = {},
        canContain = undefined,
        edgePan = true,
        onMembershipChange = undefined,
        onResizeCommit = undefined,
        onDragCommit = undefined,
        children = undefined,
    }: {
        className?: string;
        groupObject?: GroupNodeMirror | null;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        title?: string;
        /** Consumer-rendered header contents. `title` remains the fallback. */
        headerContent?: Snippet;
        minWidth?: number;
        minHeight?: number;
        resizeHandleThickness?: number;
        resizeHandles?: true | readonly ResizeHandle[];
        resizeCursors?: Partial<Record<ResizeHandle, string>>;
        metadata?: SnapLineMetadata;
        callbacks?: import("@snap-engine/snapline").NodeCallbacks;
        groupCallbacks?: GroupCallbacks;
        canContain?: (event: GroupContainEvent) => boolean;
        edgePan?: boolean;
        onMembershipChange?: (event: GroupMembershipEvent) => void;
        onResizeCommit?: (event: NodeResizeEvent) => void;
        onDragCommit?: (event: NodeDragCommitEvent) => void;
        children?: any;
    } = $props();

    let boxDOM: HTMLDivElement | null = null;
    let headerEl: HTMLElement | null = null;
    let engine: Engine = getContext("engine");
    const ownsGroup = groupObject == null;
    if (!groupObject) {
        groupObject = new GroupNodeMirror(engine, null, { width, height, minWidth, minHeight, resizeHandleThickness, resizeHandles, resizeCursors, metadata, callbacks: {}, groupCallbacks: {}, canContain, edgePan });
    }

    let mounted = $state(false);
    let unregisterHeader: (() => void) | null = null;
    let originalCallbacks: import("@snap-engine/snapline").NodeCallbacks = {};
    let originalGroupCallbacks: GroupCallbacks = {};

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

    onMount(() => {
        mounted = true;
        groupObject!.worldTransform = { x, y };
        groupObject!.element = boxDOM as HTMLElement;
        groupObject!.writeTransform();
        originalCallbacks = { ...groupObject!.callbacks };
        originalGroupCallbacks = { ...groupObject!.groupCallbacks };
        groupObject!.callbacks.canStartDrag = (event) => {
            const handlers = [originalCallbacks.canStartDrag, callbacks.canStartDrag];
            const seen = new Set<Function>();
            for (const handler of handlers) {
                if (!handler || seen.has(handler)) continue;
                seen.add(handler);
                if (handler(event) === false) return false;
            }
            return true;
        };
        groupObject!.callbacks.resolveSelectionMode = (event) =>
            callbacks.resolveSelectionMode?.(event) ??
            originalCallbacks.resolveSelectionMode?.(event) ??
            "replace";
        groupObject!.callbacks.onDragStart = (event) =>
            invoke(event, originalCallbacks.onDragStart, callbacks.onDragStart);
        groupObject!.callbacks.onDrag = (event) =>
            invoke(event, originalCallbacks.onDrag, callbacks.onDrag);
        groupObject!.callbacks.onSelectionChange = (event) =>
            invoke(event, originalCallbacks.onSelectionChange, callbacks.onSelectionChange);
        groupObject!.callbacks.onResizeHandleChange = (event) =>
            invoke(event, originalCallbacks.onResizeHandleChange, callbacks.onResizeHandleChange);
        groupObject!.groupCallbacks.onMembershipChange = (event) =>
            invoke(event, originalGroupCallbacks.onMembershipChange, groupCallbacks.onMembershipChange, onMembershipChange);
        // Resize is handled by the core edge/corner hitboxes and writes live size
        // directly; the consumer persists the committed size.
        groupObject!.callbacks.onSizeChange = (event) => {
            invoke(event, originalCallbacks.onSizeChange, callbacks.onSizeChange);
        };
        groupObject!.callbacks.onResizeCommit = (event) =>
            invoke(event, originalCallbacks.onResizeCommit, callbacks.onResizeCommit, onResizeCommit);
        groupObject!.callbacks.onDragCommit = (event) =>
            invoke(event, originalCallbacks.onDragCommit, callbacks.onDragCommit, onDragCommit);
        // Header is the only move surface; wait a tick so the alias wins over the
        // element registration. setSizeState seeds the collision footprint (the
        // DOM size is already rendered from props above).
        void tick().then(() => {
            if (!mounted || !groupObject!.element) return;
            if (headerEl) unregisterHeader = groupObject!.registerDragHandle(headerEl);
            groupObject!.setSizeState(width, height);
            groupObject!.remeasureDomGeometry();
            // Seed membership once siblings have mounted, positioned, and had their
            // hit boxes measured (a WRITE stage runs after READ_1's measure).
            groupObject!.schedule(() => groupObject!.refreshMembership(true), {
                stage: "WRITE_3",
                queueId: `${groupObject!.id}-seed`,
            });
        });
    });

    onDestroy(() => {
        mounted = false;
        unregisterHeader?.();
        unregisterHeader = null;
        groupObject!.callbacks.canStartDrag = originalCallbacks.canStartDrag;
        groupObject!.callbacks.resolveSelectionMode = originalCallbacks.resolveSelectionMode;
        groupObject!.callbacks.onDragStart = originalCallbacks.onDragStart;
        groupObject!.callbacks.onDrag = originalCallbacks.onDrag;
        groupObject!.callbacks.onDragCommit = originalCallbacks.onDragCommit;
        groupObject!.callbacks.onSelectionChange = originalCallbacks.onSelectionChange;
        groupObject!.callbacks.onResizeHandleChange = originalCallbacks.onResizeHandleChange;
        groupObject!.callbacks.onSizeChange = originalCallbacks.onSizeChange;
        groupObject!.callbacks.onResizeCommit = originalCallbacks.onResizeCommit;
        groupObject!.groupCallbacks.onMembershipChange = originalGroupCallbacks.onMembershipChange;
        if (ownsGroup) groupObject!.destroy(false);
        else if (boxDOM) groupObject!.detachElement(boxDOM);
    });

    $effect(() => {
        const nextX = x;
        const nextY = y;
        if (!mounted) return;
        const object = untrack(() => groupObject!);
        object.worldTransform = { x: nextX, y: nextY };
        object.schedule(() => object.writeTransformAndLines(), {
            stage: "WRITE_2",
            queueId: `${object.id}-transform`,
        });
    });

    $effect(() => {
        const nextWidth = width;
        const nextHeight = height;
        if (!mounted) return;
        const object = untrack(() => groupObject!);
        void tick().then(() => {
            if (!mounted || !object.element) return;
            object.element.style.width = `${nextWidth}px`;
            object.element.style.height = `${nextHeight}px`;
            object.setSizeState(nextWidth, nextHeight);
            object.remeasureDomGeometry();
        });
    });

    export function getNodeObject() {
        return groupObject;
    }
</script>

<div
    bind:this={boxDOM}
    data-snapline-type="group"
    class={`snapline-group ${className}`}
    style="position: absolute; transform-origin: top left; will-change: transform;"
    style:width={`${width}px`}
    style:height={`${height}px`}
>
    <header bind:this={headerEl} class="snapline-group-header" data-snapline-part="group-header">
        {#if headerContent}
        {@render headerContent()}
        {:else}
        <span>{title}</span>
        {/if}
    </header>
    <div class="snapline-group-body">
        {@render children?.()}
    </div>
    {#each groupObject.resizeHandles as handle}
    <div
        class="snapline-group-resize"
        data-snapline-part="group-resize"
        data-handle={handle}
        style:--snapline-resize-thickness={`${resizeHandleThickness ?? DEFAULT_RESIZE_HANDLE_THICKNESS}px`}
    ></div>
    {/each}
</div>

<style>
    /* The box sits behind its members and must not steal their pointer events:
       only the header (move surface) is interactive; the resize hitbox is virtual. */
    .snapline-group {
        box-sizing: border-box;
        pointer-events: none;
    }
    .snapline-group-header {
        pointer-events: auto;
        cursor: grab;
    }
    .snapline-group-body {
        pointer-events: none;
    }
    .snapline-group-resize {
        position: absolute;
        pointer-events: none;
    }
    .snapline-group-resize[data-handle="n"],
    .snapline-group-resize[data-handle="s"] {
        right: var(--snapline-resize-thickness);
        left: var(--snapline-resize-thickness);
        height: var(--snapline-resize-thickness);
    }
    .snapline-group-resize[data-handle="e"],
    .snapline-group-resize[data-handle="w"] {
        top: var(--snapline-resize-thickness);
        bottom: var(--snapline-resize-thickness);
        width: var(--snapline-resize-thickness);
    }
    .snapline-group-resize[data-handle="n"],
    .snapline-group-resize[data-handle^="n"] { top: calc(var(--snapline-resize-thickness) / -2); }
    .snapline-group-resize[data-handle="s"],
    .snapline-group-resize[data-handle^="s"] { bottom: calc(var(--snapline-resize-thickness) / -2); }
    .snapline-group-resize[data-handle="e"],
    .snapline-group-resize[data-handle$="e"] { right: calc(var(--snapline-resize-thickness) / -2); }
    .snapline-group-resize[data-handle="w"],
    .snapline-group-resize[data-handle$="w"] { left: calc(var(--snapline-resize-thickness) / -2); }
    .snapline-group-resize[data-handle="ne"],
    .snapline-group-resize[data-handle="se"],
    .snapline-group-resize[data-handle="sw"],
    .snapline-group-resize[data-handle="nw"] {
        width: var(--snapline-resize-thickness);
        height: var(--snapline-resize-thickness);
    }
</style>
