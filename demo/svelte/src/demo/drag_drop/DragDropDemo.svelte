<script lang="ts">
    import { Engine } from "@snap-engine/asset-base/svelte";
    import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";
    import {
        createRenderEntries,
        createRenderEntry,
        createRenderTree,
        defaultAnimations,
        reduceRenderTree,
        type ContainerCallbacks,
    } from "@snap-engine/snapsort";
    import { rejectDrop } from "@snap-engine/snapsort/callbacks";
    import type { Engine as EngineClass } from "@snap-engine/core";
    import { renderTreeCallbacks } from "../snapsort-render-tree";

    let engineInstance: EngineClass | null = $state(null);
    let debugMode = $state(false);

    const DEBUG_TAGS = [
        { id: "grid", label: "Grid" },
        { id: "hitboxes", label: "Hitboxes" },
        { id: "dom-read-1", label: "DOM Read 1 (red)" },
        { id: "dom-read-2", label: "DOM Read 2 (green)" },
        { id: "dom-read-3", label: "DOM Read 3 (blue)" },
        { id: "rows", label: "Rows" },
        { id: "item-positions", label: "Item Positions" },
        { id: "containers", label: "Containers" },
        { id: "drop-index", label: "Drop Index" },
        { id: "drop-layout", label: "Drop: Virtual Layout" },
        { id: "drop-snapshot", label: "Drop: Snapshot" },
        { id: "drop-collisions", label: "Drop: Collisions" },
        { id: "drop-candidates", label: "Drop: Candidates" },
        { id: "drop-neighbors", label: "Drop: Neighbors (prev/next)" },
        { id: "drop-tiebreak", label: "Drop: Tie-break (prev vs next)" },
        { id: "drop-zones", label: "Drop: Zones" },
        { id: "collisions", label: "Collisions" },
        { id: "animations", label: "Animations" },
    ] as const;

    let enabledTags = $state<Record<string, boolean>>(
        Object.fromEntries(DEBUG_TAGS.map((t) => [t.id, t.id.startsWith("drop-")])),
    );

    function applyTagFilter() {
        const renderer = engineInstance?.debugRenderer;
        if (!renderer) return;
        const allEnabled = DEBUG_TAGS.every((t) => enabledTags[t.id]);
        if (allEnabled) {
            renderer.enabledTags = null;
        } else {
            renderer.enabledTags = new Set(
                DEBUG_TAGS.filter((t) => enabledTags[t.id]).map((t) => t.id),
            );
        }
    }

    function onTagChange(id: string) {
        enabledTags[id] = !enabledTags[id];
        applyTagFilter();
    }

    function toggleAll(on: boolean) {
        for (const tag of DEBUG_TAGS) {
            enabledTags[tag.id] = on;
        }
        applyTagFilter();
    }

    $effect(() => {
        if (engineInstance) {
            applyTagFilter();
        }
    });

    export function setDebug(enabled: boolean) {
        debugMode = enabled;
    }

    type SizedItem = { label: string; width: number };
    type Area = "area1" | "area2";
    type AreaEntry =
        | { kind: "area"; area: Area }
        | { kind: "item"; label: string };

    let verticalTree = $state.raw(createRenderTree(createRenderEntries([1, 2, 3, 4], (n) => `vertical-${n}`)));
    let horizontalTree = $state.raw(createRenderTree(createRenderEntries([1, 2, 3, 4], (n) => `horizontal-${n}`)));
    let doubleRowTree = $state.raw(createRenderTree(createRenderEntries(Array.from({ length: 28 }, (_, i) => i + 1), (n) => `double-row-${n}`)));
    let sizedTree = $state.raw(createRenderTree(createRenderEntries<SizedItem>([
        { label: "Small", width: 60 },
        { label: "Medium", width: 100 },
        { label: "Large", width: 140 },
        { label: "Tall", width: 60 },
        { label: "Short", width: 30 },
    ], (entry) => entry.label)));

    function createAreaTree(prefix: string) {
        const areas: readonly [Area, readonly string[]][] = [
            ["area1", ["Item A", "Item B", "Item C"]],
            ["area2", ["Item X", "Item Y", "Item Z"]],
        ];
        return createRenderTree<AreaEntry>(areas.map(([area, labels]) =>
            createRenderEntry(
                { kind: "area", area },
                `${prefix}-${area}`,
                createRenderTree(labels.map((label) =>
                    createRenderEntry<AreaEntry>({ kind: "item", label }, label),
                )),
            ),
        ));
    }

    let areaTree = $state.raw(createAreaTree("multi"));
    let rowAreaTree = $state.raw(createAreaTree("multi-row"));

    const verticalCallbacks = renderTreeCallbacks((event) => verticalTree = reduceRenderTree(verticalTree, event));
    const horizontalCallbacks = renderTreeCallbacks((event) => horizontalTree = reduceRenderTree(horizontalTree, event));
    const doubleRowCallbacks = renderTreeCallbacks((event) => doubleRowTree = reduceRenderTree(doubleRowTree, event));
    const sizedCallbacks = renderTreeCallbacks((event) => sizedTree = reduceRenderTree(sizedTree, event));
    const areaCallbacks = {
        ...renderTreeCallbacks((event) => areaTree = reduceRenderTree(areaTree, event)),
        canDrop: rejectDrop,
    } satisfies ContainerCallbacks;
    const rowAreaCallbacks = {
        ...renderTreeCallbacks((event) => rowAreaTree = reduceRenderTree(rowAreaTree, event)),
        canDrop: rejectDrop,
    } satisfies ContainerCallbacks;
</script>

<div class="page-layout">
<div class="engine-area">
<Engine id="drag-drop-demo-canvas" debug={debugMode} bind:engine={engineInstance}>
<div class="gallery">
    <!-- Vertical Column -->
    <div class="demo-box">
        <h3>Vertical Column</h3>
        <div class="container-wrapper">
            <Container
                itemId="drag-drop-vertical-root"
                config={{ animation: defaultAnimations, direction: "column", callbacks: verticalCallbacks }}
            >
                {#each verticalTree.entries as entry (entry.itemId)}
                    {#if entry.isGhost}<Ghost ghost={entry.ghost} />
                    {:else if entry.childTree}<Container itemId={entry.itemId} />
                    {:else}<Item itemId={entry.itemId} className="demo-item"><p>Item {entry.value}</p></Item>{/if}
                {/each}
            </Container>
        </div>
    </div>

    <!-- Horizontal Row -->
    <div class="demo-box">
        <h3>Horizontal Row</h3>
        <div class="container-wrapper" style="min-height: 60px;">
            <Container
                itemId="drag-drop-horizontal-root"
                config={{ animation: defaultAnimations, direction: "row", callbacks: horizontalCallbacks }}
            >
                {#each horizontalTree.entries as entry (entry.itemId)}
                    {#if entry.isGhost}<Ghost ghost={entry.ghost} />
                    {:else if entry.childTree}<Container itemId={entry.itemId} />
                    {:else}<Item itemId={entry.itemId} className="demo-item"><p>Item {entry.value}</p></Item>{/if}
                {/each}
            </Container>
        </div>
    </div>

    <!-- Horizontal Double Row -->
    <div class="demo-box">
        <h3>Horizontal Double Row</h3>
        <div class="container-wrapper">
            <Container
                itemId="drag-drop-double-row-root"
                config={{ animation: defaultAnimations, direction: "row", callbacks: doubleRowCallbacks }}
            >
                {#each doubleRowTree.entries as entry (entry.itemId)}
                    {#if entry.isGhost}<Ghost ghost={entry.ghost} />
                    {:else if entry.childTree}<Container itemId={entry.itemId} />
                    {:else}<Item itemId={entry.itemId} className="demo-item"><p>Item {entry.value}</p></Item>{/if}
                {/each}
            </Container>
        </div>
    </div>

    <!-- Different Sizes -->
    <div class="demo-box">
        <h3>Different Sizes</h3>
        <div class="container-wrapper">
            <Container
                itemId="drag-drop-sizes-root"
                config={{ animation: defaultAnimations, direction: "row", callbacks: sizedCallbacks }}
            >
                {#each sizedTree.entries as entry (entry.itemId)}
                    {#if entry.isGhost}<Ghost ghost={entry.ghost} />
                    {:else if entry.childTree}<Container itemId={entry.itemId} />
                    {:else}<Item itemId={entry.itemId} className="demo-item">
                        <p style="width: {entry.value.width}px;">{entry.value.label}</p>
                    </Item>{/if}
                {/each}
            </Container>
        </div>
    </div>

    <!-- Multiple Drop Areas -->
    <div class="demo-box">
        <h3>Multiple Drop Areas</h3>
        <div class="areas-wrapper">
            <Container
                itemId="drag-drop-multi-root"
                config={{
                    animation: defaultAnimations,
                    direction: "row",
                    name: "multi-root",
                    callbacks: areaCallbacks,
                }}
                locked={true}
            >
                {#each areaTree.entries as entry (entry.itemId)}
                    {#if entry.isGhost}<Ghost ghost={entry.ghost} />
                    {:else if entry.childTree && entry.value.kind === "area"}
                    <Container
                        itemId={entry.itemId}
                        config={{ animation: defaultAnimations, direction: "column", name: entry.itemId }}
                        metadata={{ area: entry.value.area }}
                        locked={true}
                    >
                        <h4>{entry.value.area === "area1" ? "Area 1" : "Area 2"}</h4>
                        {#each entry.childTree.entries as child (child.itemId)}
                            {#if child.isGhost}<Ghost ghost={child.ghost} />
                            {:else if child.childTree}<Container itemId={child.itemId} />
                            {:else if child.value.kind === "item"}<Item itemId={child.itemId} className="demo-item"><p>{child.value.label}</p></Item>{/if}
                        {/each}
                    </Container>
                    {:else}<Item itemId={entry.itemId}>{entry.itemId}</Item>{/if}
                {/each}
            </Container>
        </div>
    </div>

    <!-- Multiple Drop Areas (Row) -->
    <div class="demo-box" style="width: 100%; max-width: 830px;">
        <h3>Multiple Drop Areas (Row)</h3>
        <div class="areas-wrapper-row">
            <Container
                itemId="drag-drop-multi-row-root"
                config={{
                    animation: defaultAnimations,
                    direction: "column",
                    name: "multi-row-root",
                    callbacks: rowAreaCallbacks,
                }}
                locked={true}
            >
                {#each rowAreaTree.entries as entry (entry.itemId)}
                    {#if entry.isGhost}<Ghost ghost={entry.ghost} />
                    {:else if entry.childTree && entry.value.kind === "area"}
                    <Container
                        itemId={entry.itemId}
                        config={{ animation: defaultAnimations, direction: "row", name: entry.itemId }}
                        metadata={{ area: entry.value.area }}
                        locked={true}
                    >
                        <h4>{entry.value.area === "area1" ? "Area 1" : "Area 2"}</h4>
                        {#each entry.childTree.entries as child (child.itemId)}
                            {#if child.isGhost}<Ghost ghost={child.ghost} />
                            {:else if child.childTree}<Container itemId={child.itemId} />
                            {:else if child.value.kind === "item"}<Item itemId={child.itemId} className="demo-item"><p>{child.value.label}</p></Item>{/if}
                        {/each}
                    </Container>
                    {:else}<Item itemId={entry.itemId}>{entry.itemId}</Item>{/if}
                {/each}
            </Container>
        </div>
    </div>
</div>
</Engine>
</div>

{#if debugMode}
<div class="debug-sidebar">
    <div class="debug-sidebar-header">
        <h4>Debug Tags</h4>
        <div class="debug-sidebar-actions">
            <button onclick={() => toggleAll(true)}>All</button>
            <button onclick={() => toggleAll(false)}>None</button>
        </div>
    </div>
    {#each DEBUG_TAGS as tag}
        <label class="debug-tag-item">
            <input type="checkbox" checked={enabledTags[tag.id]} onchange={() => onTagChange(tag.id)} />
            <span></span>
            {tag.label}
        </label>
    {/each}
</div>
{/if}
</div>

<style lang="scss">
    .page-layout {
        display: flex;
        width: 100%;
        height: 100%;
    }

    .engine-area {
        flex: 1;
        min-width: 0;
        height: 100%;
        position: relative;
    }

    .gallery {
      width: 100%;
      height: 100%;
      display: flex;
      flex-wrap: wrap;
      gap: var(--size-16);
      justify-content: center;
      align-content: center;
      overflow-y: auto;
      padding: var(--size-16);
      box-sizing: border-box;
      pointer-events: auto;
    }

    .demo-box {
        border: 1px solid var(--color-border, #ccc);
        padding: 16px;
        border-radius: 8px;
        background: var(--color-surface, #fff);
        width: 400px;
        --item-height: 40px;
    }
    h3 {
        margin-top: 0;
        margin-bottom: 16px;
        font-size: 1.1em;
    }

    .container-wrapper {
        border: 1px dashed var(--color-border, #ccc);
        padding: 8px;
        height: 220px;
        overflow: hidden;
    }

    /* Multiple Drop Areas (column layout): outer container places two
       column sub-containers side by side. Sub-containers get the dashed
       border and act as locked drop zones. */
    .areas-wrapper :global(.snapsort-container) {
        gap: 16px;
    }
    .areas-wrapper :global(.snapsort-container .snapsort-container) {
        flex: 1;
        border: 1px dashed var(--color-border, #ccc);
        padding: 8px;
        min-height: 200px;
        gap: 0;
    }

    /* Multiple Drop Areas (row layout): outer column container stacks the
       row sub-containers and their h4 labels. */
    .areas-wrapper-row :global(.snapsort-container) {
        gap: 8px;
    }
    .areas-wrapper-row :global(.snapsort-container .snapsort-container) {
        border: 1px dashed var(--color-border, #ccc);
        padding: 8px;
        min-height: 60px;
        gap: 0;
    }
    h4 {
        margin: 0 0 8px 0;
        font-size: 0.9em;
        color: #666;
    }

    :global(.demo-item) {
        border: 1px solid var(--color-border, #ccc);
        border-radius: 6px;
        background: var(--color-background, #fff);
        cursor: grab;

        &:active {
            cursor: grabbing;
        }

        p {
            padding: 2px;
            font-size: 0.9em;
            user-select: none;
        }
    }

    /* ---- Debug Sidebar ---- */

    .debug-sidebar {
        width: 200px;
        flex-shrink: 0;
        background: var(--color-surface, #fff);
        border-left: 1px solid var(--color-border, #ccc);
        padding: 68px 12px 12px;
        box-sizing: border-box;
        overflow-y: auto;
        pointer-events: auto;
        font-size: 0.8em;
    }

    .debug-sidebar-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        padding-bottom: 6px;
        border-bottom: 1px solid var(--color-border, #eee);

        h4 {
            margin: 0;
            font-size: 1em;
        }
    }

    .debug-sidebar-actions {
        display: flex;
        gap: 4px;

        button {
            padding: 2px 8px;
            font-size: 0.75em;
            border: 1px solid var(--color-border, #ccc);
            border-radius: 4px;
            background: var(--color-background, #fafafa);
            cursor: pointer;

            &:hover {
                background: var(--color-border, #eee);
            }
        }
    }

    .debug-tag-item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 0;
        cursor: pointer;
        user-select: none;
    }
</style>
