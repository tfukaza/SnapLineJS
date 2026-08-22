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
    type RenderTree,
    type RenderTreeEvent,
  } from "@snap-engine/snapsort";
  import { Container, Ghost, Handle, Item } from "@snap-engine/snapsort/svelte";
  import SnapSortContextBoundary from "$lib/components/SnapSortContextBoundary.svelte";

  type FieldType =
    | "shortText"
    | "longText"
    | "multipleChoice"
    | "checkboxes"
    | "dropdown"
    | "date"
    | "rating";

  type PaletteItem = {
    type: FieldType;
    label: string;
    icon: string;
  };

  type EditorOption = {
    id: string;
    label: string;
  };

  type EditorField = {
    id: string;
    type: FieldType;
    label: string;
    options?: RenderTree<EditorOption>;
  };

  const palette: PaletteItem[] = [
    { type: "shortText", label: "Short text", icon: "short_text" },
    { type: "longText", label: "Long text", icon: "notes" },
    { type: "multipleChoice", label: "Multiple choice", icon: "radio_button_checked" },
    { type: "checkboxes", label: "Checkboxes", icon: "checklist" },
    { type: "dropdown", label: "Dropdown", icon: "arrow_drop_down_circle" },
    { type: "date", label: "Date", icon: "event" },
    { type: "rating", label: "Rating", icon: "star" },
  ];

  let engine: SnapEngine | null = $state(null);
  let optionCount = 7;
  let fieldCount = 3;

  function createOption(label: string): EditorOption {
    optionCount += 1;
    return { id: `editor-option-${optionCount}`, label };
  }

  function createOptions(options: readonly EditorOption[]) {
    return createRenderTree(createRenderEntries(options, (option) => option.id));
  }

  function defaultOptions(type: FieldType): RenderTree<EditorOption> | undefined {
    if (type === "multipleChoice" || type === "checkboxes") {
      return createOptions([createOption("Option 1"), createOption("Option 2")]);
    }
    if (type === "dropdown") {
      return createOptions([
        createOption("Option 1"),
        createOption("Option 2"),
        createOption("Option 3"),
      ]);
    }
    return undefined;
  }

  let fields = $state.raw(
    createRenderTree(
      createRenderEntries<EditorField>(
        [
          { id: "editor-field-1", type: "shortText", label: "Question 1" },
          {
            id: "editor-field-2",
            type: "multipleChoice",
            label: "Question 2",
            options: createOptions([
              { id: "editor-option-1", label: "Option 1" },
              { id: "editor-option-2", label: "Option 2" },
            ]),
          },
          { id: "editor-field-3", type: "rating", label: "Question 3" },
        ],
        (field) => field.id,
      ),
    ),
  );

  $effect(() => {
    if (engine) engine.input.config.maxSimultaneousDrags = 1;
  });

  function ordinaryValues<T>(tree: RenderTree<T>): T[] {
    return tree.entries.flatMap((entry) => entry.isGhost ? [] : [entry.value]);
  }

  function structuralCallbacks(
    handler: (event: RenderTreeEvent) => void,
  ): ContainerCallbacks {
    return {
      onItemMove: handler,
      onGhostInsert: handler,
      onGhostMove: handler,
      onGhostRemove: handler,
    };
  }

  function addField(type: FieldType) {
    fieldCount += 1;
    const field: EditorField = {
      id: `editor-field-${fieldCount}`,
      type,
      label: `Question ${fieldCount}`,
      options: defaultOptions(type),
    };
    fields = {
      ...fields,
      entries: [...fields.entries, createRenderEntry(field, field.id)],
    };
  }

  function updateFieldLabel(itemId: string, label: string) {
    fields = {
      ...fields,
      entries: fields.entries.map((entry) =>
        !entry.isGhost && entry.itemId === itemId
          ? { ...entry, value: { ...entry.value, label } }
          : entry,
      ),
    };
  }

  function updateOptions(
    fieldId: string,
    update: (options: RenderTree<EditorOption>) => RenderTree<EditorOption>,
  ) {
    fields = {
      ...fields,
      entries: fields.entries.map((entry) =>
        !entry.isGhost && entry.itemId === fieldId
          ? {
              ...entry,
              value: {
                ...entry.value,
                options: update(entry.value.options ?? createRenderTree()),
              },
            }
          : entry,
      ),
    };
  }

  function updateOptionLabel(fieldId: string, optionId: string, label: string) {
    updateOptions(fieldId, (options) => ({
      ...options,
      entries: options.entries.map((entry) =>
        !entry.isGhost && entry.itemId === optionId
          ? { ...entry, value: { ...entry.value, label } }
          : entry,
      ),
    }));
  }

  function addOption(fieldId: string) {
    const field = fields.entries.find(
      (entry) => !entry.isGhost && entry.itemId === fieldId,
    );
    const count = field && !field.isGhost && field.value.options
      ? ordinaryValues(field.value.options).length
      : 0;
    const option = createOption(`Option ${count + 1}`);
    updateOptions(fieldId, (options) => ({
      ...options,
      entries: [...options.entries, createRenderEntry(option, option.id)],
    }));
  }

  function removeOption(fieldId: string, optionId: string) {
    updateOptions(fieldId, (options) => {
      if (ordinaryValues(options).length <= 1) return options;
      return {
        ...options,
        entries: options.entries.filter(
          (entry) => entry.isGhost || entry.itemId !== optionId,
        ),
      };
    });
  }

  function handleOptionEvent(fieldId: string, event: RenderTreeEvent) {
    updateOptions(fieldId, (options) => reduceRenderTree(options, event));
  }

  function handleFieldEvent(event: RenderTreeEvent) {
    fields = reduceRenderTree(fields, event);
  }

  const fieldCallbacks = structuralCallbacks(handleFieldEvent);
</script>

{#snippet editorOptions(field: EditorField)}
  {@const options = field.options ?? createRenderTree<EditorOption>()}
  {@const firstOptionId = options.entries.find((entry) => !entry.isGhost)?.itemId}
  <SnapSortContextBoundary>
    <Container
      itemId={`example-${field.id}-options-root`}
      className="editor-option-stack"
      config={{
        animation: defaultAnimations,
        mode: "progressive",
        direction: "column",
        name: `editor-options-${field.id}`,
        callbacks: structuralCallbacks((event) => handleOptionEvent(field.id, event)),
      }}
      locked={true}
      metadata={{ fieldId: field.id }}
    >
      {#each options.entries as entry (entry.itemId)}
        {#if entry.isGhost}
          <Ghost ghost={entry.ghost} />
        {:else}
          <Item itemId={entry.itemId} className="editor-option-item">
            <div class="editor-option-row">
              <Handle className="editor-option-handle">
                <i class="material-symbols-rounded editor-option-grip" aria-hidden="true">drag_indicator</i>
              </Handle>
              {#if field.type === "multipleChoice"}
                <label class="radio-label">
                  <input type="radio" name={`${field.id}-choice`} checked={entry.itemId === firstOptionId} tabindex="-1" />
                  <span></span>
                </label>
              {:else if field.type === "checkboxes"}
                <label class="checkbox-label">
                  <input type="checkbox" checked={entry.itemId === firstOptionId} tabindex="-1" />
                  <span></span>
                </label>
              {:else}
                <i class="material-symbols-rounded editor-option-type-icon" aria-hidden="true">arrow_drop_down</i>
              {/if}
              <input
                class="editor-option-input"
                type="text"
                value={entry.value.label}
                aria-label="Option text"
                oninput={(event) => updateOptionLabel(field.id, entry.itemId, event.currentTarget.value)}
                onpointerdown={(event) => event.stopPropagation()}
                onclick={(event) => event.stopPropagation()}
              />
              <button
                class="editor-option-action"
                type="button"
                aria-label="Remove option"
                disabled={ordinaryValues(options).length <= 1}
                onpointerdown={(event) => event.stopPropagation()}
                onclick={(event) => {
                  event.stopPropagation();
                  removeOption(field.id, entry.itemId);
                }}
              ><i class="material-symbols-rounded" aria-hidden="true">delete</i></button>
            </div>
          </Item>
        {/if}
      {/each}
    </Container>
  </SnapSortContextBoundary>
  <button
    class="editor-add-option"
    type="button"
    onpointerdown={(event) => event.stopPropagation()}
    onclick={(event) => {
      event.stopPropagation();
      addOption(field.id);
    }}
  ><i class="material-symbols-rounded" aria-hidden="true">add</i>Add option</button>
{/snippet}

<div class="editor-example" data-snapsort-example="form-editor">
  <Engine id="snapsort-form-editor-example" bind:engine>
    <div class="editor-builder">
      <div class="editor-palette" aria-label="Click a field type to add it to the form">
        {#each palette as item (item.type)}
          <button type="button" class="editor-tool" onclick={() => addField(item.type)}>
            <i class="material-symbols-rounded" aria-hidden="true">{item.icon}</i>
            <span>{item.label}</span>
          </button>
        {/each}
      </div>
      <div class="editor-canvas card form-control-group" aria-label="Form canvas">
        <h4>My Form</h4>
        <Container
          itemId="example-editor-fields-root"
          className="editor-field-list"
          config={{ animation: defaultAnimations, direction: "column", callbacks: fieldCallbacks }}
        >
          {#each fields.entries as entry (entry.itemId)}
            {#if entry.isGhost}
              <Ghost ghost={entry.ghost} />
            {:else}
              <Item itemId={entry.itemId}>
                <div class="editor-field">
                  <Handle className="editor-field-handle">
                    <i class="material-symbols-rounded editor-field-grip" aria-hidden="true">drag_indicator</i>
                  </Handle>
                  <div class="editor-field-main">
                    <input
                      class="editor-question-input"
                      type="text"
                      value={entry.value.label}
                      aria-label="Question text"
                      oninput={(event) => updateFieldLabel(entry.itemId, event.currentTarget.value)}
                      onpointerdown={(event) => event.stopPropagation()}
                      onclick={(event) => event.stopPropagation()}
                    />
                    {#if entry.value.type === "shortText"}
                      <input type="text" value="Short answer" readonly tabindex="-1" />
                    {:else if entry.value.type === "longText"}
                      <textarea rows="3" readonly tabindex="-1">Long answer response</textarea>
                    {:else if entry.value.type === "multipleChoice" || entry.value.type === "checkboxes" || entry.value.type === "dropdown"}
                      {@render editorOptions(entry.value)}
                    {:else if entry.value.type === "date"}
                      <input type="date" tabindex="-1" />
                    {:else}
                      <div class="editor-rating-preview" aria-label="5 star rating">
                        {#each Array(5) as _, index}
                          <i class="material-symbols-rounded" class:filled={index < 4} aria-hidden="true">star</i>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </div>
              </Item>
            {/if}
          {/each}
        </Container>
      </div>
    </div>
  </Engine>
</div>

<style>
  .editor-example {
    width: 100%;
    min-width: 0;
    user-select: none;
  }

  .editor-example :global(.snap-engine-canvas) {
    overflow: visible !important;
  }

  .editor-builder {
    display: grid;
    grid-template-columns: minmax(180px, 240px) minmax(0, 1fr);
    gap: var(--size-24);
    min-height: 406px;
  }

  .editor-palette {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-content: start;
    gap: 0.65rem;
    padding: var(--size-16);
  }

  .editor-tool {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    min-height: 74px;
    padding: 0.75rem 0.55rem;
    border: 1px solid #d5d8dc;
    border-radius: var(--ui-radius);
    background: white;
    box-shadow: none;
    color: #232526;
    cursor: pointer;
  }

  .editor-tool:hover {
    border-color: var(--color-primary);
  }

  .editor-tool :global(.material-symbols-rounded),
  .editor-option-action :global(.material-symbols-rounded),
  .editor-add-option :global(.material-symbols-rounded),
  .editor-option-type-icon,
  .editor-option-grip,
  .editor-field-grip {
    font-family: "Material Symbols Rounded";
    font-style: normal;
    line-height: 1;
  }

  .editor-tool :global(.material-symbols-rounded) {
    font-size: 1.25rem;
  }

  .editor-tool span {
    font-size: 0.82rem;
  }

  .editor-canvas {
    --card-color: #f2f2f3;
    display: flex;
    flex-direction: column;
    align-self: stretch;
    justify-self: center;
    width: min(calc(100% - 3rem), 640px);
    min-width: 0;
    margin-inline: 1.5rem;
    padding: var(--size-32);
    background: var(--card-color);
    box-sizing: border-box;
  }

  .editor-canvas h4 {
    margin: 0 0 2rem;
    color: #232526;
    font-family: "Bitcount Grid Single", monospace;
    font-size: 2.8rem;
    font-weight: 300;
    line-height: 1;
    text-align: center;
  }

  .editor-canvas :global(.editor-field-list) {
    align-items: stretch;
    width: 100%;
    gap: 1.25rem;
  }

  .editor-canvas :global(.editor-field-list .snapsort-item),
  .editor-canvas :global(.editor-option-item) {
    align-items: stretch;
    width: 100%;
    padding: 0;
  }

  .editor-field {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: stretch;
    gap: 0.85rem;
    padding: 1rem;
    border: 1px solid #d5d8dc;
    border-radius: var(--ui-radius);
    background: white;
  }

  .editor-field-main {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
    gap: 0.85rem;
    min-width: 0;
  }

  .editor-question-input {
    min-width: 0;
    font-weight: 600;
  }

  .editor-field input:not([type="checkbox"]):not([type="radio"]),
  .editor-field textarea {
    width: 100%;
    min-width: 0;
    padding: 0.55rem 0.8rem;
    box-sizing: border-box;
  }

  .editor-field textarea {
    resize: none;
    border: 1px solid #d5d8dc;
    border-radius: var(--ui-radius);
    background: white;
    box-shadow: none;
    font: inherit;
  }

  .editor-field input:not(.editor-question-input):not(.editor-option-input),
  .editor-field textarea {
    pointer-events: none;
  }

  .editor-canvas :global(.editor-option-stack) {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.45rem;
    width: 100%;
    min-width: 0;
  }

  .editor-option-row {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.55rem;
    width: 100%;
  }

  .editor-option-row :global(label) {
    margin: 0;
  }

  .editor-option-action,
  .editor-add-option {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    width: fit-content;
    min-height: 0;
    padding: 0.25rem 0.45rem;
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    font-size: 0.78rem;
  }

  .editor-option-action {
    padding: 0.25rem;
    color: #c7472f;
  }

  .editor-add-option {
    justify-self: start;
    margin-top: 0.1rem;
    color: var(--color-primary);
    font-weight: 500;
    pointer-events: auto;
  }

  :global(.editor-option-handle),
  :global(.editor-field-handle) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #7c8387;
    cursor: grab;
    touch-action: none;
  }

  :global(.editor-field-handle) {
    align-self: stretch;
    width: 1.35rem;
    border: 1px solid #d5d8dc;
    border-radius: calc(var(--ui-radius) - 2px);
    background: #f3f5f6;
  }

  :global(.editor-option-handle) {
    width: 1.25rem;
    min-height: 2rem;
  }

  .editor-rating-preview {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.2rem;
    width: 100%;
    padding: 0.3rem 0;
    color: #b8bec2;
  }

  .editor-rating-preview :global(.material-symbols-rounded) {
    font-family: "Material Symbols Rounded";
    font-size: 1.7rem;
    font-style: normal;
  }

  .editor-rating-preview :global(.filled) {
    color: var(--color-primary);
    font-variation-settings: "FILL" 1;
  }

  @media (max-width: 760px) {
    .editor-builder {
      grid-template-columns: 1fr;
    }

    .editor-palette {
      grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
      padding: 0;
    }

    .editor-canvas {
      width: 100%;
      margin-inline: 0;
      padding: var(--size-16);
    }

    .editor-canvas h4 {
      font-size: 2.2rem;
    }
  }
</style>
