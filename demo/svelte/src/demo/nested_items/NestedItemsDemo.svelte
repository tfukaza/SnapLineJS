<script lang="ts">
    import { Engine } from "@snap-engine/asset-base/svelte";
    import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";
    import {
        createRenderEntry,
        createRenderTree,
        defaultAnimations,
        reduceRenderTree,
        type RenderTree,
    } from "@snap-engine/snapsort";
    import type { Engine as EngineClass } from "@snap-engine/core";
    import { renderTreeCallbacks } from "../snapsort-render-tree";

    let engineInstance: EngineClass | null = $state(null);
    let debugMode = $state(true);

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
        Object.fromEntries(DEBUG_TAGS.map(t => [t.id, t.id.startsWith("drop-")]))
    );

    function applyTagFilter() {
        const renderer = engineInstance?.debugRenderer;
        if (!renderer) return;
        const allEnabled = DEBUG_TAGS.every(t => enabledTags[t.id]);
        if (allEnabled) {
            renderer.enabledTags = null;
        } else {
            renderer.enabledTags = new Set(
                DEBUG_TAGS.filter(t => enabledTags[t.id]).map(t => t.id)
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

    // Apply tag filter once the engine is ready
    $effect(() => {
        if (engineInstance) {
            applyTagFilter();
        }
    });

    export function setDebug(enabled: boolean) {
        debugMode = enabled;
    }

    function stringTree(values: readonly string[]): RenderTree<string> {
        return createRenderTree(values.map((value) => createRenderEntry(value, value)));
    }

    type GroupValue = { kind: "item"; label: string } | { kind: "group"; label: string };
    type LayerValue =
        | { kind: "leaf"; id: string; icon: string; name: string }
        | { kind: "group"; id: string; label: string };

    let flatTree = $state.raw(stringTree(["Item A", "Item B", "Item C", "Item D"]));
    let nestedGroupTree = $state.raw(createRenderTree<GroupValue>([
        createRenderEntry({ kind: "item", label: "Item 1" }, "Item 1"),
        createRenderEntry({ kind: "item", label: "Item 1.5" }, "Item 1.5"),
        createRenderEntry(
            { kind: "group", label: "Nested group" },
            "nested-sub-group",
            createRenderTree(["Sub A1", "Sub A2", "Sub A3"].map((label) =>
                createRenderEntry<GroupValue>({ kind: "item", label }, label),
            )),
        ),
        createRenderEntry({ kind: "item", label: "Item 2" }, "Item 2"),
        createRenderEntry({ kind: "item", label: "Item 3" }, "Item 3"),
    ]));
    let dragNestedTree = $state.raw(createRenderTree<GroupValue>([
        createRenderEntry(
            { kind: "group", label: "Group 1" },
            "group-1",
            createRenderTree(["Group 1 - A", "Group 1 - B"].map((label) =>
                createRenderEntry<GroupValue>({ kind: "item", label }, label),
            )),
        ),
        createRenderEntry(
            { kind: "group", label: "Group 2" },
            "group-2",
            createRenderTree(["Group 2 - A", "Group 2 - B", "Group 2 - C"].map((label) =>
                createRenderEntry<GroupValue>({ kind: "item", label }, label),
            )),
        ),
        createRenderEntry({ kind: "item", label: "Loose Item" }, "Loose Item"),
    ]));
    let rowTree = $state.raw(stringTree(["R1", "R2", "R3", "R4"]));
    let nestedRowTree = $state.raw(createRenderTree<GroupValue>([
        createRenderEntry({ kind: "item", label: "R1" }, "R1"),
        createRenderEntry(
            { kind: "group", label: "Nested row" },
            "nested-row-sub-group",
            createRenderTree(["S1", "S2", "S3"].map((label) =>
                createRenderEntry<GroupValue>({ kind: "item", label }, label),
            )),
        ),
        createRenderEntry({ kind: "item", label: "R2" }, "R2"),
        createRenderEntry({ kind: "item", label: "R3" }, "R3"),
    ]));
    let wrapTree = $state.raw(stringTree(Array.from({ length: 12 }, (_, i) => `W${i + 1}`)));
    let layerTree = $state.raw(createRenderTree<LayerValue>([
        createRenderEntry({ kind: "leaf", id: "header", icon: "◻", name: "Header" }, "header"),
        createRenderEntry(
            { kind: "group", id: "hero-section", label: "Hero Section" },
            "hero-section",
            createRenderTree([
                { id: "Avatar", icon: "○", name: "Avatar" },
                { id: "Title", icon: "T", name: "Title" },
                { id: "Subtitle", icon: "T", name: "Subtitle" },
            ].map((value) => createRenderEntry<LayerValue>({ kind: "leaf", ...value }, value.id))),
        ),
        createRenderEntry({ kind: "leaf", id: "card-grid", icon: "◻", name: "Card Grid" }, "card-grid"),
        createRenderEntry({ kind: "leaf", id: "footer", icon: "◻", name: "Footer" }, "footer"),
    ]));

    const flatCallbacks = renderTreeCallbacks((event) => flatTree = reduceRenderTree(flatTree, event));
    const nestedGroupCallbacks = renderTreeCallbacks((event) => nestedGroupTree = reduceRenderTree(nestedGroupTree, event));
    const dragNestedCallbacks = renderTreeCallbacks((event) => dragNestedTree = reduceRenderTree(dragNestedTree, event));
    const rowCallbacks = renderTreeCallbacks((event) => rowTree = reduceRenderTree(rowTree, event));
    const nestedRowCallbacks = renderTreeCallbacks((event) => nestedRowTree = reduceRenderTree(nestedRowTree, event));
    const wrapCallbacks = renderTreeCallbacks((event) => wrapTree = reduceRenderTree(wrapTree, event));
    const layerCallbacks = renderTreeCallbacks((event) => layerTree = reduceRenderTree(layerTree, event));
</script>

<div class="page-layout">
<div class="engine-area">
<Engine id="nested-items-demo-canvas" debug={debugMode} bind:engine={engineInstance}>
<div class="demos-layout">

    <!-- Demo 1: Flat list -->
    <div class="demo-panel">
        <div class="demo-header">
            <h3>Flat List</h3>
            <p class="demo-description">Regular items in a snapsort container.</p>
        </div>
        <div class="demo-body">
            <Container
                itemId="nested-items-flat-root"
                config={{ animation: defaultAnimations, direction: "column", callbacks: flatCallbacks }}
                metadata={{ frameworkList: "flat" }}
                locked={true}
            >
                {#each flatTree.entries as entry (entry.itemId)}
                    {#if entry.isGhost}<Ghost ghost={entry.ghost} />
                    {:else if entry.childTree}<Container itemId={entry.itemId} />
                    {:else}<Item itemId={entry.itemId} className="demo-item"><p>{entry.value}</p></Item>
                    {/if}
                {/each}
            </Container>
        </div>
    </div>

    <!-- Demo 2: Nested containers -->
    <div class="demo-panel">
        <div class="demo-header">
            <h3>Nested Container</h3>
            <p class="demo-description">A container with nested sub-containers and items.</p>
        </div>
        <div class="demo-body">
            <Container
                itemId="nested-items-column-root"
                config={{ animation: defaultAnimations, direction: "column", callbacks: nestedGroupCallbacks }}
                metadata={{ frameworkList: "nested-outer" }}
                locked={true}
            >
                {#each nestedGroupTree.entries as entry (entry.itemId)}
                    {#if entry.isGhost}
                        <Ghost ghost={entry.ghost} />
                    {:else if entry.childTree}
                        <Container
                            itemId={entry.itemId}
                            config={{ animation: defaultAnimations, direction: "column" }}
                            metadata={{ frameworkList: "nested-inner" }}
                            locked={false}
                        >
                            {#each entry.childTree.entries as child (child.itemId)}
                                {#if child.isGhost}<Ghost ghost={child.ghost} />
                                {:else if child.childTree}<Container itemId={child.itemId} />
                                {:else}<Item itemId={child.itemId} className="demo-item sub-item"><p>{child.value.label}</p></Item>
                                {/if}
                            {/each}
                        </Container>
                    {:else}
                        <Item itemId={entry.itemId} className="demo-item"><p>{entry.value.label}</p></Item>
                    {/if}
                {/each}
            </Container>
        </div>
    </div>

    <!-- Demo 3: Draggable sub-containers -->
    <div class="demo-panel">
        <div class="demo-header">
            <h3>Draggable Sub-Containers</h3>
            <p class="demo-description">Nested containers that can be dragged and reordered.</p>
        </div>
        <div class="demo-body">
            <Container
                itemId="nested-items-draggable-root"
                config={{ animation: defaultAnimations, direction: "column", callbacks: dragNestedCallbacks }}
                metadata={{ frameworkList: "drag-outer" }}
                locked={true}
            >
                {#each dragNestedTree.entries as entry (entry.itemId)}
                    {#if entry.isGhost}
                        <Ghost ghost={entry.ghost} />
                    {:else if entry.childTree}
                        <Container
                            itemId={entry.itemId}
                            config={{ animation: defaultAnimations, direction: "column" }}
                            metadata={{ frameworkList: `drag-${entry.itemId}` }}
                            locked={false}
                        >
                            {#each entry.childTree.entries as child (child.itemId)}
                                {#if child.isGhost}<Ghost ghost={child.ghost} />
                                {:else if child.childTree}<Container itemId={child.itemId} />
                                {:else}<Item itemId={child.itemId} className="demo-item sub-item"><p>{child.value.label}</p></Item>
                                {/if}
                            {/each}
                        </Container>
                    {:else}
                        <Item itemId={entry.itemId} className="demo-item"><p>{entry.value.label}</p></Item>
                    {/if}
                {/each}
            </Container>
        </div>
    </div>

    <!-- Demo 4: Horizontal row list -->
    <div class="demo-panel" style="width: 400px;">
        <div class="demo-header">
            <h3>Row Layout</h3>
            <p class="demo-description">Items arranged horizontally in a row container.</p>
        </div>
        <div class="demo-body">
            <Container
                itemId="nested-items-row-root"
                config={{ animation: defaultAnimations, direction: "row", callbacks: rowCallbacks }}
                metadata={{ frameworkList: "row" }}
                locked={true}
            >
                {#each rowTree.entries as entry (entry.itemId)}
                    {#if entry.isGhost}<Ghost ghost={entry.ghost} />
                    {:else if entry.childTree}<Container itemId={entry.itemId} />
                    {:else}<Item itemId={entry.itemId} className="demo-item row-item"><p>{entry.value}</p></Item>
                    {/if}
                {/each}
            </Container>
        </div>
    </div>

    <!-- Demo 5: Nested row groups -->
    <div class="demo-panel" style="width: 400px;">
        <div class="demo-header">
            <h3>Nested Row Groups</h3>
            <p class="demo-description">Row items with a nested row sub-group that can be reordered.</p>
        </div>
        <div class="demo-body">
            <Container
                itemId="nested-items-nested-row-root"
                config={{ animation: defaultAnimations, direction: "row", callbacks: nestedRowCallbacks }}
                metadata={{ frameworkList: "nested-row-outer" }}
                locked={true}
            >
                {#each nestedRowTree.entries as entry (entry.itemId)}
                    {#if entry.isGhost}
                        <Ghost ghost={entry.ghost} />
                    {:else if entry.childTree}
                        <Container
                            itemId={entry.itemId}
                            config={{ animation: defaultAnimations, direction: "row" }}
                            metadata={{ frameworkList: "nested-row-inner" }}
                            locked={false}
                        >
                            {#each entry.childTree.entries as child (child.itemId)}
                                {#if child.isGhost}<Ghost ghost={child.ghost} />
                                {:else if child.childTree}<Container itemId={child.itemId} />
                                {:else}<Item itemId={child.itemId} className="demo-item row-item sub-item"><p>{child.value.label}</p></Item>
                                {/if}
                            {/each}
                        </Container>
                    {:else}
                        <Item itemId={entry.itemId} className="demo-item row-item"><p>{entry.value.label}</p></Item>
                    {/if}
                {/each}
            </Container>
        </div>
    </div>

    <!-- Demo 6: Wrapping row -->
    <div class="demo-panel" style="width: 280px;">
        <div class="demo-header">
            <h3>Wrapping Row</h3>
            <p class="demo-description">Many row items that wrap into multiple lines.</p>
        </div>
        <div class="demo-body">
            <Container
                itemId="nested-items-wrap-root"
                config={{ animation: defaultAnimations, direction: "row", callbacks: wrapCallbacks }}
                metadata={{ frameworkList: "wrap" }}
                locked={true}
            >
                {#each wrapTree.entries as entry (entry.itemId)}
                    {#if entry.isGhost}<Ghost ghost={entry.ghost} />
                    {:else if entry.childTree}<Container itemId={entry.itemId} />
                    {:else}<Item itemId={entry.itemId} className="demo-item row-item"><p>{entry.value}</p></Item>
                    {/if}
                {/each}
            </Container>
        </div>
    </div>

    <!-- Demo 6: Layers panel style -->
    <div class="demo-panel">
        <div class="demo-header">
            <h3>Layers Panel</h3>
            <p class="demo-description">Figma-style layers. Groups are nested containers that can be reordered alongside regular layers.</p>
        </div>
        <div class="layers-panel">
            <Container
                itemId="nested-items-layers-root"
                config={{ animation: defaultAnimations, direction: "column", callbacks: layerCallbacks }}
                metadata={{ frameworkList: "layers-outer" }}
                locked={true}
            >
                {#each layerTree.entries as entry (entry.itemId)}
                    {#if entry.isGhost}
                        <Ghost ghost={entry.ghost} />
                    {:else if entry.childTree && entry.value.kind === "group"}
                        <Container
                            itemId={entry.itemId}
                            config={{ animation: defaultAnimations, direction: "column" }}
                            metadata={{ frameworkList: `layers-${entry.value.id}` }}
                            locked={false}
                        >
                            <div class="group-label">{entry.value.label}</div>
                            {#each entry.childTree.entries as child (child.itemId)}
                                {#if child.isGhost}
                                    <Ghost ghost={child.ghost} />
                                {:else if child.childTree}
                                    <Container itemId={child.itemId} />
                                {:else if child.value.kind === "leaf"}
                                    <Item itemId={child.itemId} className="layer-item">
                                        <div class="layer-row">
                                            <span class="layer-icon">{child.value.icon}</span>
                                            <span class="layer-name">{child.value.name}</span>
                                        </div>
                                    </Item>
                                {/if}
                            {/each}
                        </Container>
                    {:else if entry.value.kind === "leaf"}
                        <Item itemId={entry.itemId} className="layer-item">
                            <div class="layer-row">
                                <span class="layer-icon">{entry.value.icon}</span>
                                <span class="layer-name">{entry.value.name}</span>
                            </div>
                        </Item>
                    {/if}
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

    .demos-layout {
        width: 100%;
        height: 100%;
        display: flex;
        gap: 24px;
        justify-content: center;
        align-items: flex-start;
        padding: 60px 24px 24px;
        box-sizing: border-box;
        overflow-y: auto;
        pointer-events: auto;
        flex-wrap: wrap;
    }

    .demo-panel {
        width: 280px;
        border: 1px solid var(--color-border, #ccc);
        border-radius: 8px;
        background: var(--color-surface, #fff);
        overflow: hidden;
    }

    .demo-header {
        padding: 12px 16px;
        border-bottom: 1px solid var(--color-border, #ccc);

        h3 {
            margin: 0 0 4px;
            font-size: 1em;
        }
    }

    .demo-description {
        margin: 0;
        font-size: 0.75em;
        color: var(--color-text-muted, #888);
    }

    .demo-body {
        padding: 8px;
        min-height: 250px;
    }

    :global(.demo-item) {
        border: 1px solid var(--color-border, #ccc);
        border-radius: 6px;
        background: transparent;
        cursor: grab;

        &:active {
            cursor: grabbing;
        }

        p {
            padding: 6px 12px;
            margin: 0;
            font-size: 0.85em;
            user-select: none;
        }
    }

    :global(.ghost) {
        background: rgba(0, 0, 0, 0.06);
        border-radius: 6px;
    }

    :global(.demo-item.sub-item) {
        border-color: var(--color-accent, #5856D6);
        background: transparent;
        opacity: 0.5;
    }

    :global(.demo-item.row-item) {
        min-width: 50px;
        text-align: center;
    }

    :global(.snapsort-container .snapsort-container) {
        padding-left: 12px;
    }

    /* ---- Layers Panel ---- */

    .layers-panel {
        background: var(--color-background, #fafafa);
        min-height: 300px;
        padding: 4px 0;
    }

    :global(.layer-item) {
        cursor: grab;
        border-bottom: 1px solid var(--color-border, #eee);

        &:active {
            cursor: grabbing;
        }
    }

    .layer-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        user-select: none;
        font-size: 0.85em;
    }

    .layer-icon {
        width: 16px;
        text-align: center;
        opacity: 0.5;
        font-size: 14px;
    }

    .layer-name {
        flex: 1;
    }

    .group-label {
        padding: 4px 12px;
        font-size: 0.75em;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--color-text-muted, #888);
        letter-spacing: 0.05em;
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
