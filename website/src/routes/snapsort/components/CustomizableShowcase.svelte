<script lang="ts">
  import { Container, Ghost, Handle, Item } from "@snap-engine/snapsort/svelte";
  import {
    createRenderEntries,
    createRenderEntry,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
  } from "@snap-engine/snapsort";
  import type {
    ContainerCallbacks,
    ContainerConfig,
    GhostLifecycleEvent,
    ItemMoveEvent,
    RenderTree,
  } from "@snap-engine/snapsort";
  import SnapSortContextBoundary from "../SnapSortContextBoundary.svelte";

  type CustomizableMockupTheme = {
    id: string;
    label: string;
    demoOrder: CustomizableMockupType[];
  };

  type CustomizableMockupType =
    | "list"
    | "words"
    | "tasks"
    | "nested"
    | "editor"
    | "files";

  type CustomizableMockupRow = {
    id: string;
    label: string;
    meta: string;
  };

  type CustomizableMockupWord = {
    id: string;
    label: string;
  };

  type CustomizableMockupTask = {
    id: string;
    title: string;
    tag: string;
    progress: string;
    started: string;
  };

  type CustomizableMockupNestedItem = {
    id: string;
    label: string;
    meta: string;
  };

  type CustomizableMockupField = {
    id: string;
    label: string;
    type: "radio" | "checkbox";
    options: CustomizableMockupOption[];
  };

  type CustomizableMockupOption = {
    id: string;
    label: string;
  };

  type CustomizableMockupFile = {
    id: string;
    label: string;
    kind: "folder" | "file";
    parentId?: string;
    active?: boolean;
  };

  type NestedShowcaseEntry =
    | { kind: "row"; row: CustomizableMockupNestedItem; id: string }
    | { kind: "child-group"; id: "child-group" };

  type CustomizableFieldState = Omit<CustomizableMockupField, "options"> & {
    options: RenderTree<CustomizableMockupOption>;
  };

  type CustomizableThemeState = CustomizableMockupTheme & {
    rows: RenderTree<CustomizableMockupRow>;
    words: RenderTree<CustomizableMockupWord>;
    tasks: RenderTree<CustomizableMockupTask>;
    nestedLists: RenderTree<NestedShowcaseEntry>;
    fields: RenderTree<CustomizableFieldState>;
    files: RenderTree<CustomizableMockupFile>;
  };

  function createList<T>(values: T[], getId: (value: T) => string) {
    return createRenderTree(createRenderEntries(values, getId));
  }

  function valuesOf<T>(tree: RenderTree<T>): T[] {
    const values: T[] = [];
    for (const entry of tree.entries) {
      if (!entry.isGhost) values.push(entry.value);
    }
    return values;
  }

  let customizableScrollScene: HTMLElement | undefined = $state();
  let customizableProgress = $state(0);

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  function updateCustomizableProgress() {
    if (typeof window === "undefined" || !customizableScrollScene) return;

    const rect = customizableScrollScene.getBoundingClientRect();
    const scrollableDistance = Math.max(1, window.innerHeight + rect.height);

    customizableProgress = clamp(
      (window.innerHeight - rect.top) / scrollableDistance,
      0,
      1,
    );
  }

  function getCustomizableThemeOffset(index: number) {
    const offsets = [
      [0, -680],
      [-680, -40],
      [-160, -760],
      [-740, -120],
    ];
    const [start, end] = offsets[index] ?? offsets[0];
    return start + (end - start) * customizableProgress;
  }

  function getCustomizableThemeConfig(
    themeId: string,
  ): Partial<ContainerConfig> {
    return themeId === "retro" || themeId === "terminal"
      ? { animation: null }
      : { animation: defaultAnimations };
  }

  function getFileInsertionMarkerThickness(themeId: string): number {
    if (themeId === "retro") return 2;
    if (themeId === "terminal") return 7;
    return 3;
  }

  $effect(() => {
    customizableScrollScene;
    if (typeof requestAnimationFrame === "undefined") return;

    requestAnimationFrame(updateCustomizableProgress);
  });

  const customizableMockupThemeDefinitions: CustomizableMockupTheme[] = [
    {
      id: "retro",
      label: "Retro",
      demoOrder: ["editor", "list", "files", "words", "nested", "tasks"],
    },
    {
      id: "default",
      label: "SnapDesign",
      demoOrder: ["list", "words", "tasks", "nested", "editor", "files"],
    },
    {
      id: "terminal",
      label: "Terminal",
      demoOrder: ["files", "tasks", "nested", "list", "editor", "words"],
    },
    {
      id: "elegant",
      label: "Elegant",
      demoOrder: ["words", "nested", "editor", "tasks", "files", "list"],
    },
  ];
  const customizableMockupRows: CustomizableMockupRow[] = [
    { id: "row-spec-pass", label: "Spec pass", meta: "01" },
    { id: "row-mockup-qa", label: "Mockup QA", meta: "02" },
    { id: "row-ship-note", label: "Ship note", meta: "03" },
  ];
  const customizableMockupWords: CustomizableMockupWord[] = [
    { id: "word-drag", label: "Drag" },
    { id: "word-words", label: "words" },
    { id: "word-into", label: "into" },
    { id: "word-place", label: "place" },
  ];
  const customizableMockupCards: CustomizableMockupTask[] = [
    {
      id: "task-review-motion",
      title: "Review motion",
      tag: "UX",
      progress: "68%",
      started: "Jul 1",
    },
    {
      id: "task-ship-polish",
      title: "Ship polish",
      tag: "UI",
      progress: "42%",
      started: "Jul 3",
    },
  ];
  const customizableMockupNested: {
    parent: CustomizableMockupNestedItem[];
    child: CustomizableMockupNestedItem[];
  } = {
    parent: [
      { id: "nested-section", label: "Section", meta: "3" },
      { id: "nested-controls", label: "Controls", meta: "5" },
    ],
    child: [
      { id: "nested-text-input", label: "Text input", meta: "Aa" },
      { id: "nested-select-menu", label: "Select menu", meta: "v" },
    ],
  };
  const customizableMockupFields: CustomizableMockupField[] = [
    {
      id: "field-satisfaction",
      label: "Satisfaction",
      type: "radio",
      options: [
        { id: "option-great", label: "Great" },
        { id: "option-okay", label: "Okay" },
        { id: "option-poor", label: "Poor" },
      ],
    },
    {
      id: "field-follow-up",
      label: "Follow up",
      type: "checkbox",
      options: [
        { id: "option-email", label: "Email" },
        { id: "option-phone", label: "Phone" },
      ],
    },
  ];
  const customizableMockupFiles: CustomizableMockupFile[] = [
    { id: "src", label: "src", kind: "folder" },
    { id: "routes", label: "routes", kind: "folder", parentId: "src" },
    {
      id: "page",
      label: "+page.svelte",
      kind: "file",
      parentId: "routes",
      active: true,
    },
    { id: "theme", label: "theme.scss", kind: "file", parentId: "src" },
    { id: "pkg", label: "package.json", kind: "file" },
  ];

  function createFileTree(
    parentId = "root",
  ): RenderTree<CustomizableMockupFile> {
    return createRenderTree(
      customizableMockupFiles
        .filter((file) => (file.parentId ?? "root") === parentId)
        .map((file) =>
          createRenderEntry(
            { ...file },
            file.id,
            file.kind === "folder" ? createFileTree(file.id) : null,
          ),
        ),
    );
  }

  function createThemeState(
    theme: CustomizableMockupTheme,
  ): CustomizableThemeState {
    return {
      ...theme,
      rows: createList(
        customizableMockupRows.map((row) => ({ ...row })),
        (row) => row.id,
      ),
      words: createList(
        customizableMockupWords.map((word) => ({ ...word })),
        (word) => word.id,
      ),
      tasks: createList(
        customizableMockupCards.map((task) => ({ ...task })),
        (task) => task.id,
      ),
      nestedLists: createRenderTree<NestedShowcaseEntry>([
        ...customizableMockupNested.parent.map((row) =>
          createRenderEntry<NestedShowcaseEntry>(
            { kind: "row", row: { ...row }, id: row.id },
            row.id,
          ),
        ),
        createRenderEntry(
          { kind: "child-group", id: "child-group" },
          "child-group",
          createList<NestedShowcaseEntry>(
            customizableMockupNested.child.map((row) => ({
              kind: "row",
              row: { ...row },
              id: row.id,
            })),
            (entry) => entry.id,
          ),
        ),
      ]),
      fields: createList(
        customizableMockupFields.map((field) => ({
          ...field,
          options: createList(
            field.options.map((option) => ({ ...option })),
            (option) => option.id,
          ),
        })),
        (field) => field.id,
      ),
      files: createFileTree(),
    };
  }

  let customizableMockupThemes = $state.raw(
    customizableMockupThemeDefinitions.map(createThemeState),
  );

  function updateTheme(
    themeId: string,
    update: (theme: CustomizableThemeState) => CustomizableThemeState,
  ) {
    customizableMockupThemes = customizableMockupThemes.map((theme) =>
      theme.id === themeId ? update(theme) : theme,
    );
  }

  function handleRowsMove(themeId: string, event: ItemMoveEvent) {
    updateTheme(themeId, (theme) => ({
      ...theme,
      rows: reduceRenderTree(theme.rows, event),
    }));
  }

  function handleWordsMove(themeId: string, event: ItemMoveEvent) {
    updateTheme(themeId, (theme) => ({
      ...theme,
      words: reduceRenderTree(theme.words, event),
    }));
  }

  function handleTasksMove(themeId: string, event: ItemMoveEvent) {
    updateTheme(themeId, (theme) => ({
      ...theme,
      tasks: reduceRenderTree(theme.tasks, event),
    }));
  }

  function handleNestedMove(themeId: string, event: ItemMoveEvent) {
    updateTheme(themeId, (theme) => ({
      ...theme,
      nestedLists: reduceRenderTree(theme.nestedLists, event),
    }));
  }

  function handleFieldsMove(themeId: string, event: ItemMoveEvent) {
    updateTheme(themeId, (theme) => ({
      ...theme,
      fields: reduceRenderTree(theme.fields, event),
    }));
  }

  function handleOptionsMove(
    themeId: string,
    fieldId: string,
    event: ItemMoveEvent,
  ) {
    updateTheme(themeId, (theme) => ({
      ...theme,
      fields: reduceOptions(theme.fields, fieldId, event),
    }));
  }

  function handleFilesMove(themeId: string, event: ItemMoveEvent) {
    updateTheme(themeId, (theme) => ({
      ...theme,
      files: reduceRenderTree(theme.files, event),
    }));
  }

  function handleRowsGhost(themeId: string, event: GhostLifecycleEvent) {
    updateTheme(themeId, (theme) => ({
      ...theme,
      rows: reduceRenderTree(theme.rows, event),
    }));
  }

  function handleWordsGhost(themeId: string, event: GhostLifecycleEvent) {
    updateTheme(themeId, (theme) => ({
      ...theme,
      words: reduceRenderTree(theme.words, event),
    }));
  }

  function handleTasksGhost(themeId: string, event: GhostLifecycleEvent) {
    updateTheme(themeId, (theme) => ({
      ...theme,
      tasks: reduceRenderTree(theme.tasks, event),
    }));
  }

  function handleNestedGhost(themeId: string, event: GhostLifecycleEvent) {
    updateTheme(themeId, (theme) => ({
      ...theme,
      nestedLists: reduceRenderTree(theme.nestedLists, event),
    }));
  }

  function handleFieldsGhost(themeId: string, event: GhostLifecycleEvent) {
    updateTheme(themeId, (theme) => ({
      ...theme,
      fields: reduceRenderTree(theme.fields, event),
    }));
  }

  function handleOptionsGhost(
    themeId: string,
    fieldId: string,
    event: GhostLifecycleEvent,
  ) {
    updateTheme(themeId, (theme) => ({
      ...theme,
      fields: reduceOptions(theme.fields, fieldId, event),
    }));
  }

  function handleFilesGhost(themeId: string, event: GhostLifecycleEvent) {
    updateTheme(themeId, (theme) => ({
      ...theme,
      files: reduceRenderTree(theme.files, event),
    }));
  }

  function reduceOptions(
    fields: RenderTree<CustomizableFieldState>,
    fieldId: string,
    event: ItemMoveEvent | GhostLifecycleEvent,
  ): RenderTree<CustomizableFieldState> {
    return {
      ...fields,
      entries: fields.entries.map((entry) =>
        !entry.isGhost && entry.itemId === fieldId
          ? {
              ...entry,
              value: {
                ...entry.value,
                options: reduceRenderTree(entry.value.options, event),
              },
            }
          : entry,
      ),
    };
  }

  function fileCallbacks(themeId: string, isRoot: boolean): ContainerCallbacks {
    if (!isRoot) return {};
    const handleGhost = (event: GhostLifecycleEvent) =>
      handleFilesGhost(themeId, event);
    return {
      onItemMove: (event) => handleFilesMove(themeId, event),
      onGhostInsert: handleGhost,
      onGhostMove: handleGhost,
      onGhostRemove: handleGhost,
    };
  }
</script>

<svelte:window
  onscroll={updateCustomizableProgress}
  onresize={updateCustomizableProgress}
/>

{#snippet fileTree(
  theme: CustomizableThemeState,
  fileList: RenderTree<CustomizableMockupFile>,
  containerId: string,
  folder: CustomizableMockupFile | null,
  itemId: string,
  depth: number,
)}
  <Container
    className={folder
      ? `customizable-mini-tree-folder depth-${depth}${folder.active ? " active" : ""}`
      : "customizable-mini-files"}
    style={folder
      ? "width:calc(100% - 9px) !important;margin-left:9px !important;box-sizing:border-box;"
      : undefined}
    locked={folder === null}
    {itemId}
    metadata={{
      themeId: theme.id,
      listId: containerId,
    }}
    config={{
      direction: "column",
      name: `customizable-${theme.id}-files-${containerId}`,
      mode: "insertion",
      callbacks: fileCallbacks(theme.id, folder === null),
      ...getCustomizableThemeConfig(theme.id),
    }}
    data-snapsort-demo="customizable-files"
    data-list-id={`customizable-${theme.id}-files-${containerId}`}
    data-order={valuesOf(fileList)
      .map((file) => file.id)
      .join(",")}
  >
    {#if folder}
      <div
        class="customizable-mini-tree-row folder"
        style={`--depth: ${depth};margin-left:-9px !important;width:calc(100% + 9px);padding-left:0.4rem !important;`}
      >
        <span
          class="customizable-mini-indent"
          style={`left:0;opacity:${Math.min(depth, 1)};`}
          aria-hidden="true"
        ></span>
        <span class="customizable-mini-chevron open" aria-hidden="true"></span>
        <span class="customizable-mini-tree-icon folder" aria-hidden="true"
        ></span>
        <strong>{folder.label}</strong>
      </div>
    {/if}
    {#each fileList.entries as entry (entry.itemId)}
      {#if entry.isGhost}
        {#if entry.ghost.type === "insertion-marker"}
          <Ghost
            ghost={entry.ghost}
            insertionMarker={{
              thickness: getFileInsertionMarkerThickness(theme.id),
              startInset: 6,
              endInset: 6,
            }}
          />
        {:else}
          <Ghost ghost={entry.ghost} />
        {/if}
      {:else if entry.childTree}
        {@const file = entry.value}
        {@render fileTree(
          theme,
          entry.childTree,
          file.id,
          file,
          entry.itemId,
          folder ? depth + 1 : 0,
        )}
      {:else}
        {@const file = entry.value}
        <Item
          itemId={entry.itemId}
          className={`customizable-mini-tree-row file depth-${folder ? depth + 1 : 0}${file.active ? " active" : ""}`}
          style={`--depth: ${folder ? depth + 1 : 0};padding-left:0.4rem !important;`}
        >
          <span
            class="customizable-mini-indent"
            style={`left:0;opacity:${Math.min(folder ? depth + 1 : 0, 1)};`}
            aria-hidden="true"
          ></span>
          <span class="customizable-mini-chevron-spacer" aria-hidden="true"
          ></span>
          <span class="customizable-mini-tree-icon file" aria-hidden="true"
          ></span>
          <strong>{file.label}</strong>
        </Item>
      {/if}
    {/each}
  </Container>
{/snippet}

<div class="feature-card-section">
  <div class="feature-card-grid">
    <div class="customizable-scroll-scene" bind:this={customizableScrollScene}>
      <article
        class="customizable-feature-card"
        style={`--customizable-progress: ${customizableProgress};`}
      >
        <div class="feature-card-copy">
          <div class="feature-card-copy-text">
            <h2>Customizable</h2>
            <p class="large">
              SnapSort components are styleless by default. Use our default
              theme or apply your own, including Tailwind. Configuration
              parameters allow adjustment of animation and drag behavior.
            </p>
          </div>
        </div>

        <div
          class="customizable-demo shallow"
          style={`--customizable-progress: ${customizableProgress};`}
        >
          <div class="customizable-demo-scale">
            <div class="customizable-theme-rail">
              {#each customizableMockupThemes as theme, themeIndex (theme.id)}
                <div
                  class="customizable-surface"
                  data-theme={theme.id}
                  data-snapsort-demo="customizable"
                  data-list-id={`customizable-${theme.id}`}
                >
                  <div
                    class="customizable-motion-frame"
                    style={`--theme-offset: ${getCustomizableThemeOffset(themeIndex).toFixed(2)}px;`}
                  >
                    <div class="customizable-mockup-shell">
                      <div class="customizable-mockup-title">{theme.label}</div>

                      <div
                        class="customizable-mockup-card shallow"
                        class:card={theme.id === "default"}
                        style={`order: ${theme.demoOrder.indexOf("list")};`}
                      >
                        {#if theme.id === "retro"}
                          <div class="customizable-retro-window-bar">
                            <span>List</span>
                            <i></i>
                          </div>
                        {/if}
                        <Container
                          itemId={`customizable-${theme.id}-rows-root`}
                          className="customizable-mini-list"
                          metadata={{ themeId: theme.id, listId: "rows" }}
                          config={{
                            direction: "column",
                            callbacks: {
                              onItemMove: (event) =>
                                handleRowsMove(theme.id, event),
                              onGhostInsert: (event) =>
                                handleRowsGhost(theme.id, event),
                              onGhostMove: (event) =>
                                handleRowsGhost(theme.id, event),
                              onGhostRemove: (event) =>
                                handleRowsGhost(theme.id, event),
                            },
                            ...getCustomizableThemeConfig(theme.id),
                          }}
                          data-snapsort-demo="customizable-list"
                          data-list-id={`customizable-${theme.id}-list`}
                          data-order={valuesOf(theme.rows)
                            .map((row) => row.id)
                            .join(",")}
                        >
                          {#each theme.rows.entries as entry (entry.itemId)}
                            {#if entry.isGhost}
                              <Ghost ghost={entry.ghost} />
                            {:else}
                              {@const row = entry.value}
                              <Item itemId={entry.itemId}>
                                <div class="customizable-mini-row">
                                  <span
                                    class="customizable-mini-handle"
                                    aria-hidden="true"
                                  >
                                    <span class="customizable-mini-grip">
                                      <i></i><i></i><i></i><i></i>
                                    </span>
                                  </span>
                                  <span class="customizable-mini-row-main">
                                    <span class="customizable-mini-row-text"
                                      >{row.label}</span
                                    >
                                  </span>
                                  <span class="customizable-mini-meta"
                                    >{row.meta}</span
                                  >
                                </div>
                              </Item>
                            {/if}
                          {/each}
                        </Container>
                      </div>

                      <div
                        class="customizable-mockup-card shallow"
                        class:card={theme.id === "default"}
                        style={`order: ${theme.demoOrder.indexOf("words")};`}
                      >
                        {#if theme.id === "retro"}
                          <div class="customizable-retro-window-bar">
                            <span>Words</span>
                            <i></i>
                          </div>
                        {/if}
                        <Container
                          itemId={`customizable-${theme.id}-words-root`}
                          className="customizable-mini-words"
                          metadata={{ themeId: theme.id, listId: "words" }}
                          config={{
                            direction: "row",
                            mode: "progressive",
                            callbacks: {
                              onItemMove: (event) =>
                                handleWordsMove(theme.id, event),
                              onGhostInsert: (event) =>
                                handleWordsGhost(theme.id, event),
                              onGhostMove: (event) =>
                                handleWordsGhost(theme.id, event),
                              onGhostRemove: (event) =>
                                handleWordsGhost(theme.id, event),
                            },
                            ...getCustomizableThemeConfig(theme.id),
                          }}
                          data-snapsort-demo="customizable-words"
                          data-list-id={`customizable-${theme.id}-words`}
                          data-order={valuesOf(theme.words)
                            .map((word) => word.id)
                            .join(",")}
                        >
                          {#each theme.words.entries as entry (entry.itemId)}
                            {#if entry.isGhost}
                              <Ghost ghost={entry.ghost} />
                            {:else}
                              {@const word = entry.value}
                              <Item itemId={entry.itemId}>
                                <span class="customizable-mini-word"
                                  >{word.label}</span
                                >
                              </Item>
                            {/if}
                          {/each}
                        </Container>
                      </div>

                      <div
                        class="customizable-mockup-card shallow"
                        class:card={theme.id === "default"}
                        style={`order: ${theme.demoOrder.indexOf("tasks")};`}
                      >
                        {#if theme.id === "retro"}
                          <div class="customizable-retro-window-bar">
                            <span>Tasks</span>
                            <i></i>
                          </div>
                        {/if}
                        <Container
                          itemId={`customizable-${theme.id}-tasks-root`}
                          className="customizable-mini-board"
                          metadata={{ themeId: theme.id, listId: "tasks" }}
                          config={{
                            direction: "column",
                            callbacks: {
                              onItemMove: (event) =>
                                handleTasksMove(theme.id, event),
                              onGhostInsert: (event) =>
                                handleTasksGhost(theme.id, event),
                              onGhostMove: (event) =>
                                handleTasksGhost(theme.id, event),
                              onGhostRemove: (event) =>
                                handleTasksGhost(theme.id, event),
                            },
                            ...getCustomizableThemeConfig(theme.id),
                          }}
                          data-snapsort-demo="customizable-tasks"
                          data-list-id={`customizable-${theme.id}-tasks`}
                          data-order={valuesOf(theme.tasks)
                            .map((task) => task.id)
                            .join(",")}
                        >
                          {#each theme.tasks.entries as entry (entry.itemId)}
                            {#if entry.isGhost}
                              <Ghost ghost={entry.ghost} />
                            {:else}
                              {@const card = entry.value}
                              <Item itemId={entry.itemId}>
                                <div class="customizable-mini-card">
                                  <div class="customizable-mini-card-head">
                                    <span
                                      class="customizable-mini-handle task"
                                      aria-hidden="true"
                                    >
                                      <span class="customizable-mini-grip">
                                        <i></i><i></i><i></i><i></i>
                                      </span>
                                    </span>
                                    <strong>{card.title}</strong>
                                    <span>{card.tag}</span>
                                  </div>
                                  <i style={`--progress: ${card.progress};`}
                                  ></i>
                                  <div class="customizable-mini-card-foot">
                                    <span>{card.started}</span>
                                    <em>{card.progress}</em>
                                  </div>
                                </div>
                              </Item>
                            {/if}
                          {/each}
                        </Container>
                      </div>

                      <div
                        class="customizable-mockup-card shallow"
                        class:card={theme.id === "default"}
                        style={`order: ${theme.demoOrder.indexOf("nested")};`}
                      >
                        {#if theme.id === "retro"}
                          <div class="customizable-retro-window-bar">
                            <span>Nested</span>
                            <i></i>
                          </div>
                        {/if}
                        <Container
                          itemId={`customizable-${theme.id}-nested-root`}
                          className="customizable-mini-nested"
                          metadata={{ themeId: theme.id, listId: "root" }}
                          config={{
                            direction: "column",
                            callbacks: {
                              onItemMove: (event) =>
                                handleNestedMove(theme.id, event),
                              onGhostInsert: (event) =>
                                handleNestedGhost(theme.id, event),
                              onGhostMove: (event) =>
                                handleNestedGhost(theme.id, event),
                              onGhostRemove: (event) =>
                                handleNestedGhost(theme.id, event),
                            },
                            ...getCustomizableThemeConfig(theme.id),
                          }}
                          data-snapsort-demo="customizable-nested"
                          data-list-id={`customizable-${theme.id}-nested-root`}
                          data-order={valuesOf(theme.nestedLists)
                            .map((entry) => entry.id)
                            .join(",")}
                        >
                          {#each theme.nestedLists.entries as entry (entry.itemId)}
                            {#if entry.isGhost}
                              <Ghost ghost={entry.ghost} />
                            {:else}
                              {@const e = entry.value}
                              {#if !entry.childTree && e.kind === "row"}
                                <Item itemId={entry.itemId}>
                                  <div class="customizable-mini-row">
                                    <Handle
                                      className="customizable-mini-handle"
                                    >
                                      <span
                                        class="customizable-mini-grip"
                                        aria-hidden="true"
                                      >
                                        <i></i><i></i><i></i><i></i>
                                      </span>
                                    </Handle>
                                    <span class="customizable-mini-row-main">
                                      <span class="customizable-mini-row-text"
                                        >{e.row.label}</span
                                      >
                                      <span class="customizable-mini-row-sub"
                                        >Parent block</span
                                      >
                                    </span>
                                    <span class="customizable-mini-meta"
                                      >{e.row.meta}</span
                                    >
                                  </div>
                                </Item>
                              {:else if entry.childTree}
                                <Container
                                  className="customizable-mini-nested-child"
                                  metadata={{
                                    themeId: theme.id,
                                    listId: "child",
                                  }}
                                  config={{
                                    direction: "column",
                                    ...getCustomizableThemeConfig(theme.id),
                                  }}
                                  itemId={entry.itemId}
                                  data-snapsort-demo="customizable-nested"
                                  data-list-id={`customizable-${theme.id}-nested-child`}
                                  data-order={valuesOf(entry.childTree)
                                    .map((entry) => entry.id)
                                    .join(",")}
                                >
                                  {#each entry.childTree.entries as childEntry (`${childEntry.isGhost ? "ghost" : "item"}:${childEntry.itemId}`)}
                                    {#if childEntry.isGhost}
                                      <Ghost ghost={childEntry.ghost} />
                                    {:else if childEntry.value.kind === "row"}
                                      {@const child = childEntry.value}
                                      <Item itemId={childEntry.itemId}>
                                        <div
                                          class="customizable-mini-row nested"
                                        >
                                          <Handle
                                            className="customizable-mini-handle"
                                          >
                                            <span
                                              class="customizable-mini-grip"
                                              aria-hidden="true"
                                            >
                                              <i></i><i></i><i></i><i></i>
                                            </span>
                                          </Handle>
                                          <span
                                            class="customizable-mini-row-main"
                                          >
                                            <span
                                              class="customizable-mini-row-text"
                                              >{child.row.label}</span
                                            >
                                            <span
                                              class="customizable-mini-row-sub"
                                              >Nested item</span
                                            >
                                          </span>
                                          <span class="customizable-mini-meta"
                                            >{child.row.meta}</span
                                          >
                                        </div>
                                      </Item>
                                    {/if}
                                  {/each}
                                </Container>
                              {/if}
                            {/if}
                          {/each}
                        </Container>
                      </div>

                      <div
                        class="customizable-mockup-card shallow"
                        class:card={theme.id === "default"}
                        style={`order: ${theme.demoOrder.indexOf("editor")};`}
                      >
                        {#if theme.id === "retro"}
                          <div class="customizable-retro-window-bar">
                            <span>Editor</span>
                            <i></i>
                          </div>
                        {/if}
                        <div class="customizable-mini-editor-canvas">
                          <Container
                            itemId={`customizable-${theme.id}-editor-root`}
                            className="customizable-mini-editor"
                            metadata={{ themeId: theme.id, listId: "fields" }}
                            config={{
                              direction: "column",
                              callbacks: {
                                onItemMove: (event) =>
                                  handleFieldsMove(theme.id, event),
                                onGhostInsert: (event) =>
                                  handleFieldsGhost(theme.id, event),
                                onGhostMove: (event) =>
                                  handleFieldsGhost(theme.id, event),
                                onGhostRemove: (event) =>
                                  handleFieldsGhost(theme.id, event),
                              },
                              ...getCustomizableThemeConfig(theme.id),
                            }}
                            data-snapsort-demo="customizable-editor"
                            data-list-id={`customizable-${theme.id}-editor`}
                            data-order={valuesOf(theme.fields)
                              .map((field) => field.id)
                              .join(",")}
                          >
                            {#each theme.fields.entries as entry (entry.itemId)}
                              {#if entry.isGhost}
                                <Ghost ghost={entry.ghost} />
                              {:else}
                                {@const field = entry.value}
                                <Item itemId={entry.itemId}>
                                  <div class="customizable-mini-field">
                                    <Handle
                                      className="customizable-mini-field-handle"
                                    >
                                      <span
                                        class="customizable-mini-grip"
                                        aria-hidden="true"
                                      >
                                        <i></i><i></i><i></i><i></i>
                                      </span>
                                    </Handle>
                                    <div class="customizable-mini-field-main">
                                      <div
                                        class="customizable-mini-question-input"
                                      >
                                        <strong>{field.label}</strong>
                                        <span
                                          >{field.type === "radio"
                                            ? "Multiple choice"
                                            : "Checkboxes"}</span
                                        >
                                      </div>
                                      <SnapSortContextBoundary>
                                        <Container
                                          itemId={`customizable-${theme.id}-${entry.itemId}-options-root`}
                                          className="customizable-mini-options"
                                          metadata={{
                                            themeId: theme.id,
                                            listId: field.id,
                                          }}
                                          config={{
                                            direction: "column",
                                            mode: "progressive",
                                            callbacks: {
                                              onItemMove: (event) =>
                                                handleOptionsMove(
                                                  theme.id,
                                                  field.id,
                                                  event,
                                                ),
                                              onGhostInsert: (event) =>
                                                handleOptionsGhost(
                                                  theme.id,
                                                  field.id,
                                                  event,
                                                ),
                                              onGhostMove: (event) =>
                                                handleOptionsGhost(
                                                  theme.id,
                                                  field.id,
                                                  event,
                                                ),
                                              onGhostRemove: (event) =>
                                                handleOptionsGhost(
                                                  theme.id,
                                                  field.id,
                                                  event,
                                                ),
                                            },
                                            ...getCustomizableThemeConfig(
                                              theme.id,
                                            ),
                                          }}
                                          data-snapsort-demo="customizable-options"
                                          data-list-id={`customizable-${theme.id}-editor-${field.id}`}
                                          data-order={valuesOf(field.options)
                                            .map((option) => option.id)
                                            .join(",")}
                                        >
                                          {#each field.options.entries as optionEntry (`${optionEntry.isGhost ? "ghost" : "item"}:${optionEntry.itemId}`)}
                                            {#if optionEntry.isGhost}
                                              <Ghost
                                                ghost={optionEntry.ghost}
                                              />
                                            {:else}
                                              {@const option =
                                                optionEntry.value}
                                              <Item itemId={optionEntry.itemId}>
                                                <span
                                                  class="customizable-mini-option"
                                                  class:checkbox={field.type ===
                                                    "checkbox"}
                                                >
                                                  <Handle
                                                    className="customizable-mini-option-handle"
                                                  >
                                                    <span
                                                      class="customizable-mini-option-grip"
                                                      aria-hidden="true"
                                                    ></span>
                                                  </Handle>
                                                  <i></i>
                                                  <span>{option.label}</span>
                                                  <button
                                                    type="button"
                                                    tabindex="-1"
                                                    aria-label="Remove option"
                                                    >x</button
                                                  >
                                                </span>
                                              </Item>
                                            {/if}
                                          {/each}
                                        </Container>
                                      </SnapSortContextBoundary>
                                      <button
                                        class="customizable-mini-add-option"
                                        type="button"
                                        tabindex="-1"
                                      >
                                        + Add option
                                      </button>
                                    </div>
                                  </div>
                                </Item>
                              {/if}
                            {/each}
                          </Container>
                        </div>
                      </div>

                      <div
                        class="customizable-mockup-card shallow"
                        class:card={theme.id === "default"}
                        style={`order: ${theme.demoOrder.indexOf("files")};`}
                      >
                        {#if theme.id === "retro"}
                          <div class="customizable-retro-window-bar">
                            <span>Files</span>
                            <i></i>
                          </div>
                        {/if}
                        {@render fileTree(
                          theme,
                          theme.files,
                          "root",
                          null,
                          `customizable-${theme.id}-files-root`,
                          0,
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      </article>
    </div>

    <section class="closing-grid" aria-label="Explore SnapSort examples">
      <div class="closing-card gallery-card">
        <div class="gallery-kanban" aria-hidden="true">
          <div class="gallery-preview-board">
            <div class="gallery-preview-column card">
              <div class="gallery-preview-item card shallow"></div>
              <div class="gallery-preview-item card shallow"></div>
              <div class="gallery-preview-item card shallow"></div>
            </div>
            <div class="gallery-preview-column card">
              <div class="gallery-preview-item card shallow"></div>
              <div class="gallery-preview-item card shallow"></div>
              <div class="gallery-preview-drop-target"></div>
            </div>
          </div>
          <div class="gallery-preview-drag-card card"></div>
          <img
            class="gallery-preview-cursor"
            src="/icon/noun-cursor-740125.svg"
            alt=""
          />
        </div>
        <div class="gallery-copy-panel">
          <div class="closing-copy">
            <h3>Explore the gallery</h3>
            <p>
              File trees, form builders, sentence puzzles, and more — complete
              interactive demos built with SnapSort.
            </p>
          </div>
          <a class="button closing-button" href="/snapsort/gallery">
            Browse the gallery
          </a>
        </div>
      </div>
    </section>
  </div>
</div>
