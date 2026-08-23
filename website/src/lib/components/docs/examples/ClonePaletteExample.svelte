<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type { Engine as SnapEngine } from "@snap-engine/core";
  import {
    createRenderEntries,
    createRenderEntry,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
    type ContainerCallbacks,
    type DragStartEvent,
    type ItemMoveEvent,
    type RenderTree,
    type RenderTreeEvent,
  } from "@snap-engine/snapsort";
  import { prioritizeIntersectingContainer, rejectDrop } from "@snap-engine/snapsort/callbacks";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";

  type BlockType = "button" | "image" | "divider" | "spacer";

  type BlockTemplate = {
    type: BlockType;
    label: string;
    icon: string;
  };

  type CloneBlock = BlockTemplate & {
    id: string;
    template: boolean;
  };

  type CloneZone = "palette" | "canvas";
  type CloneValue = CloneBlock | { zone: CloneZone };

  const templates: BlockTemplate[] = [
    { type: "button", label: "Button", icon: "smart_button" },
    { type: "image", label: "Image", icon: "image" },
    { type: "divider", label: "Divider", icon: "horizontal_rule" },
    { type: "spacer", label: "Spacer", icon: "space_bar" },
  ];

  const blockIcon: Record<BlockType, string> = {
    button: "smart_button",
    image: "image",
    divider: "horizontal_rule",
    spacer: "space_bar",
  };

  const blockLabel: Record<BlockType, string> = {
    button: "Button",
    image: "Image",
    divider: "Divider",
    spacer: "Spacer",
  };

  let instanceCount = 0;
  const initialBlocks: CloneBlock[] = templates.map((template) => ({
    ...template,
    id: `palette-${template.type}-${instanceCount++}`,
    template: true,
  }));

  let engine: SnapEngine | null = $state(null);
  let workspace = $state.raw(
    createRenderTree<CloneValue>([
      createRenderEntry(
        { zone: "palette" },
        "clone-palette",
        createRenderTree(createRenderEntries<CloneValue>(initialBlocks, (value) => "id" in value ? value.id : `clone-${value.zone}`)),
      ),
      createRenderEntry({ zone: "canvas" }, "clone-canvas", createRenderTree()),
    ]),
  );

  $effect(() => {
    if (engine) engine.input.config.maxSimultaneousDrags = 1;
  });

  function blockType(value: unknown): BlockType | null {
    return value === "button" || value === "image" || value === "divider" || value === "spacer"
      ? value
      : null;
  }

  function zoneTree(zone: CloneZone): RenderTree<CloneValue> | null {
    const entry = workspace.entries.find(
      (candidate) =>
        !candidate.isGhost &&
        "zone" in candidate.value &&
        candidate.value.zone === zone,
    );
    return entry && !entry.isGhost ? entry.childTree : null;
  }

  function updateZone(
    zone: CloneZone,
    update: (tree: RenderTree<CloneValue>) => RenderTree<CloneValue>,
  ) {
    workspace = {
      ...workspace,
      entries: workspace.entries.map((entry) =>
        !entry.isGhost &&
        "zone" in entry.value &&
        entry.value.zone === zone &&
        entry.childTree
          ? { ...entry, childTree: update(entry.childTree) }
          : entry,
      ),
    };
  }

  function handleDragStart(event: DragStartEvent) {
    if (event.itemMetadata.template === true) {
      event.session.dragVisual = "preview";
    }
  }

  function handleMove(event: ItemMoveEvent) {
    const type = blockType(event.itemMetadata.blockType);
    if (!type || event.to.containerMetadata.copyZone !== "canvas") return;

    if (event.itemMetadata.template === true) {
      const original = zoneTree("palette")?.entries.find(
        (entry) => !entry.isGhost && entry.itemId === event.itemId,
      );
      if (!original || original.isGhost || !("template" in original.value)) return;

      workspace = reduceRenderTree(workspace, event);
      const replacement: CloneBlock = {
        ...original.value,
        id: `palette-${type}-${instanceCount++}`,
        template: true,
      };
      updateZone("palette", (tree) => {
        const entries = [...tree.entries];
        entries.splice(
          Math.max(0, Math.min(event.from.index, entries.length)),
          0,
          createRenderEntry<CloneValue>(replacement, replacement.id),
        );
        return { ...tree, entries };
      });
      return;
    }

    workspace = reduceRenderTree(workspace, event);
  }

  function handleGhost(event: RenderTreeEvent) {
    workspace = reduceRenderTree(workspace, event);
  }

  function removeCanvasBlock(itemId: string) {
    updateZone("canvas", (tree) => ({
      ...tree,
      entries: tree.entries.filter(
        (entry) => entry.isGhost || entry.itemId !== itemId,
      ),
    }));
  }

  const callbacks = {
    onItemMove: handleMove,
    onGhostInsert: handleGhost,
    onGhostMove: handleGhost,
    onGhostRemove: handleGhost,
    getDropPriority: rejectDrop,
    onDragStart: handleDragStart,
  } satisfies ContainerCallbacks;
</script>

{#snippet pointerPreview(type: BlockType)}
  <div class="clone-block clone-block-{type} clone-pointer-preview">
    <i class="material-symbols-rounded" aria-hidden="true">{blockIcon[type]}</i>
    <span>{blockLabel[type]}</span>
  </div>
{/snippet}

<div class="clone-example" data-snapsort-example="clone-palette">
  <Engine id="snapsort-clone-palette-example" bind:engine>
    <div class="clone-workspace">
      <Container
        itemId="example-clone-root"
        className="clone-root"
        config={{
          animation: defaultAnimations,
          direction: "row",
          name: "clone-root",
          callbacks,
        }}
        locked={true}
      >
        {#each workspace.entries as entry (entry.itemId)}
          {#if entry.isGhost}
            <Ghost ghost={entry.ghost} className="clone-pointer-ghost">
              {@const type = blockType(entry.ghost.original.metadata.blockType)}
              {#if entry.ghost.type === "pointer-preview" && type}
                {@render pointerPreview(type)}
              {/if}
            </Ghost>
          {:else if entry.childTree && "zone" in entry.value && entry.value.zone === "palette"}
            <Container
              className="clone-palette"
              itemId={entry.itemId}
              config={{
                animation: defaultAnimations,
                direction: "column",
                name: "clone-palette",
                callbacks: { getDropPriority: rejectDrop },
              }}
              locked={true}
              metadata={{ copyZone: "palette" }}
            >
              {#each entry.childTree.entries as child (child.itemId)}
                {#if child.isGhost}
                  <Ghost ghost={child.ghost} className="clone-pointer-ghost">
                    {@const type = blockType(child.ghost.original.metadata.blockType)}
                    {#if child.ghost.type === "pointer-preview" && type}
                      {@render pointerPreview(type)}
                    {/if}
                  </Ghost>
                {:else if child.childTree}
                  <Container itemId={child.itemId} />
                {:else if "template" in child.value}
                  <Item itemId={child.itemId} metadata={{ blockType: child.value.type, template: true }}>
                    <div class="clone-block clone-block-{child.value.type} clone-palette-block">
                      <i class="material-symbols-rounded" aria-hidden="true">{child.value.icon}</i>
                      <span>{child.value.label}</span>
                    </div>
                  </Item>
                {/if}
              {/each}
            </Container>
          {:else if entry.childTree && "zone" in entry.value}
            <Container
              className="clone-canvas"
              itemId={entry.itemId}
              config={{
                animation: defaultAnimations,
                direction: "column",
                name: "clone-canvas",
                callbacks: { getDropPriority: prioritizeIntersectingContainer },
              }}
              locked={true}
              metadata={{ copyZone: "canvas" }}
            >
              {#if !entry.childTree.entries.some((child) => !child.isGhost)}
                <p class="clone-canvas-empty">Drop blocks here</p>
              {/if}
              {#each entry.childTree.entries as child (child.itemId)}
                {#if child.isGhost}
                  <Ghost ghost={child.ghost} className="clone-pointer-ghost">
                    {@const type = blockType(child.ghost.original.metadata.blockType)}
                    {#if child.ghost.type === "pointer-preview" && type}
                      {@render pointerPreview(type)}
                    {/if}
                  </Ghost>
                {:else if child.childTree}
                  <Container itemId={child.itemId} />
                {:else if "template" in child.value}
                  <Item itemId={child.itemId} metadata={{ blockType: child.value.type, template: false }}>
                    <div class="clone-block clone-block-{child.value.type} clone-canvas-block">
                      <i class="material-symbols-rounded" aria-hidden="true">{blockIcon[child.value.type]}</i>
                      <span>{blockLabel[child.value.type]}</span>
                      <button
                        type="button"
                        class="clone-block-remove"
                        aria-label={`Remove ${blockLabel[child.value.type]}`}
                        onpointerdown={(event) => event.stopPropagation()}
                        onclick={(event) => {
                          event.stopPropagation();
                          removeCanvasBlock(child.itemId);
                        }}
                      ><i class="material-symbols-rounded" aria-hidden="true">close</i></button>
                    </div>
                  </Item>
                {/if}
              {/each}
            </Container>
          {/if}
        {/each}
      </Container>
    </div>
  </Engine>
</div>

<style>
  .clone-example {
    width: min(100%, 34rem);
    margin-inline: auto;
    user-select: none;
  }

  .clone-example :global(.snap-engine-canvas) {
    overflow: visible !important;
  }

  .clone-workspace :global(.clone-root) {
    align-items: stretch;
    width: 100%;
    gap: var(--size-24);
    flex-wrap: nowrap;
  }

  .clone-workspace :global(.clone-palette) {
    flex: 0 0 auto;
    align-items: stretch;
    width: 132px;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: var(--ui-radius);
    background: #f3f5f6;
  }

  .clone-workspace :global(.clone-palette .snapsort-item),
  .clone-workspace :global(.clone-canvas .snapsort-item) {
    align-items: stretch;
    width: 100%;
    padding: 0;
  }

  .clone-workspace :global(.clone-canvas) {
    flex: 1;
    align-items: stretch;
    min-height: 220px;
    gap: 0.5rem;
    padding: 0.75rem;
    border: 1px dashed #c7cccf;
    border-radius: var(--ui-radius);
    background: white;
  }

  .clone-canvas-empty {
    margin: auto;
    color: #b3b8bc;
    font-size: 0.85rem;
    text-align: center;
  }

  .clone-workspace :global(.clone-pointer-ghost) {
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: 0 10px 28px rgb(26 31 34 / 18%);
  }

  .clone-pointer-preview {
    width: 132px;
    box-sizing: border-box;
    pointer-events: none;
  }

  .clone-block {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem;
    border: 1px solid #d5d8dc;
    border-radius: calc(var(--ui-radius) - 2px);
    background: white;
    color: #232526;
    cursor: grab;
    font-size: 0.85rem;
    touch-action: none;
  }

  .clone-canvas-block {
    padding-right: 2rem;
    cursor: default;
  }

  .clone-block :global(.material-symbols-rounded) {
    color: var(--color-primary);
    font-family: "Material Symbols Rounded";
    font-size: 1.1rem;
    font-style: normal;
    line-height: 1;
  }

  .clone-block-remove {
    position: absolute;
    top: 50%;
    right: 0.4rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.4rem;
    height: 1.4rem;
    padding: 0;
    transform: translateY(-50%);
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    color: #8f9497;
    cursor: pointer;
  }

  .clone-block-remove:hover {
    color: #c7472f;
  }

  .clone-block-remove :global(.material-symbols-rounded) {
    color: inherit;
    font-size: 1rem;
  }

  @media (max-width: 520px) {
    .clone-workspace :global(.clone-root) {
      flex-direction: column !important;
      gap: var(--size-16);
    }

    .clone-workspace :global(.clone-palette) {
      flex-direction: row !important;
      width: 100%;
      overflow-x: auto;
      box-sizing: border-box;
    }

    .clone-workspace :global(.clone-palette .snapsort-item) {
      min-width: 7rem;
    }
  }
</style>
