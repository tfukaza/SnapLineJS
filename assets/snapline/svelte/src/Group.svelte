<script lang="ts">
    import { GroupNodeMirror, type GroupCallbacks, type GroupContainEvent, type GroupMembershipEvent, type GeometryChangeEvent, type SnapLineMetadata } from "@snap-engine/snapline";
    import type { Engine } from "@snap-engine/core";
    import { onMount, onDestroy, getContext, setContext, tick, untrack, type Snippet } from "svelte";
    import { resizeRegionOwnerContext } from "./resize-region-context";

    let {
        id = undefined,
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
        metadata = {},
        callbacks = {},
        groupCallbacks = {},
        canContain = undefined,
        edgePan = true,
        onMembershipChange = undefined,
        onGeometryCommit = undefined,
        children = undefined,
    }: {
        /** Stable domain identity; minted when omitted (supply for persistence). */
        id?: string;
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
        metadata?: SnapLineMetadata;
        callbacks?: import("@snap-engine/snapline").NodeCallbacks;
        groupCallbacks?: GroupCallbacks;
        canContain?: (event: GroupContainEvent) => boolean;
        edgePan?: boolean;
        onMembershipChange?: (event: GroupMembershipEvent) => void;
        onGeometryCommit?: (event: GeometryChangeEvent) => void;
        children?: any;
    } = $props();

    let boxDOM: HTMLDivElement | null = null;
    let headerEl: HTMLElement | null = null;
    let engine: Engine = getContext("engine");
    const ownsGroup = groupObject == null;
    if (!groupObject) {
        groupObject = new GroupNodeMirror(engine, null, { id, width, height, minWidth, minHeight, metadata, callbacks: {}, groupCallbacks: {}, canContain, edgePan });
    }
    setContext(resizeRegionOwnerContext, groupObject);

    // Snapshot, not a reactive binding: after mount the engine owns the size, and
    // a second writer on the same property is what splits it from the transform.
    // Rendering it once keeps SSR and the first client paint correctly sized.
    const initialWidth = width;
    const initialHeight = height;

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
        groupObject!.groupCallbacks.onMembershipChange = (event) =>
            invoke(event, originalGroupCallbacks.onMembershipChange, groupCallbacks.onMembershipChange, onMembershipChange);
        // Resize is handled by the core edge/corner hitboxes and writes live size
        // directly; the consumer persists the committed size.
        groupObject!.callbacks.onSizeChange = (event) => {
            invoke(event, originalCallbacks.onSizeChange, callbacks.onSizeChange);
        };
        groupObject!.callbacks.onGeometryCommit = (event) =>
            invoke(event, originalCallbacks.onGeometryCommit, callbacks.onGeometryCommit, onGeometryCommit);
        // Header is the only move surface; wait a tick so the alias wins over the
        // element registration. The geometry effect seeds the collision footprint
        // and schedules the first paint once `mounted` flips.
        void tick().then(() => {
            if (!mounted || !groupObject!.element) return;
            if (headerEl) unregisterHeader = groupObject!.registerDragHandle(headerEl);
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
        groupObject!.callbacks.onGeometryCommit = originalCallbacks.onGeometryCommit;
        groupObject!.callbacks.onSelectionChange = originalCallbacks.onSelectionChange;
        groupObject!.callbacks.onSizeChange = originalCallbacks.onSizeChange;
        groupObject!.groupCallbacks.onMembershipChange = originalGroupCallbacks.onMembershipChange;
        if (ownsGroup) groupObject!.destroy(false);
        else if (boxDOM) groupObject!.detachElement(boxDOM);
    });

    // One effect for all four geometry props, committed through one engine task.
    // Splitting position and size across two writers — Svelte's renderer for the
    // size, the engine's queue for the transform — lets them land in different
    // frames, which paints the new size at the old position for one frame.
    $effect(() => {
        const nextX = x;
        const nextY = y;
        const nextWidth = width;
        const nextHeight = height;
        if (!mounted) return;
        const object = untrack(() => groupObject!);
        object.worldTransform = { x: nextX, y: nextY };
        object.setSizeState(nextWidth, nextHeight);
        object.scheduleGeometryWrite();
    });

    export function getNodeObject() {
        return groupObject;
    }
</script>

<div
    bind:this={boxDOM}
    data-snapline-type="group"
    class={`snapline-group ${className}`}
    style={`position: absolute; transform-origin: top left; will-change: transform; width: ${initialWidth}px; height: ${initialHeight}px;`}
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
</div>

<style>
    /* The box sits behind its members and must not steal their pointer events. */
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
</style>
