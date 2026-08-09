<script lang="ts">
  import { Container, Handle, Item } from "@snap-engine/snapsort/svelte";
  import { defaultAnimations, type ContainerConfig, type ItemMoveEvent } from "@snap-engine/snapsort";
  import SnapSortContextBoundary from "../SnapSortContextBoundary.svelte";
  import { moveEntries, moveEntriesAcrossLists } from "./listState";

  type CustomizableMockupTheme = {
    id: string;
    label: string;
    demoOrder: CustomizableMockupType[];
  };

  type CustomizableMockupType = "list" | "words" | "tasks" | "nested" | "editor" | "files";

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

  type CustomizableThemeState = CustomizableMockupTheme & {
    rows: CustomizableMockupRow[];
    words: CustomizableMockupWord[];
    tasks: CustomizableMockupTask[];
    nestedLists: { root: NestedShowcaseEntry[]; child: NestedShowcaseEntry[] };
    fields: CustomizableMockupField[];
    fileLists: Record<string, CustomizableMockupFile[]>;
  };

  let customizableScrollScene: HTMLElement | undefined = $state();
  let customizableProgress = $state(0);

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  function updateCustomizableProgress() {
    if (typeof window === "undefined" || !customizableScrollScene) return;

    const rect = customizableScrollScene.getBoundingClientRect();
    const scrollableDistance = Math.max(1, window.innerHeight + rect.height);

    customizableProgress = clamp((window.innerHeight - rect.top) / scrollableDistance, 0, 1);
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

  function getCustomizableThemeConfig(themeId: string): Partial<ContainerConfig> {
    return themeId === "retro" || themeId === "terminal"
      ? { animation: null }
      : { animation: defaultAnimations };
  }

  $effect(() => {
    customizableScrollScene;
    if (typeof requestAnimationFrame === "undefined") return;

    requestAnimationFrame(updateCustomizableProgress);
  });

  const customizableMockupThemeDefinitions: CustomizableMockupTheme[] = [
    { id: "retro", label: "Retro", demoOrder: ["editor", "list", "files", "words", "nested", "tasks"] },
    { id: "default", label: "SnapDesign", demoOrder: ["list", "words", "tasks", "nested", "editor", "files"] },
    { id: "terminal", label: "Terminal", demoOrder: ["files", "tasks", "nested", "list", "editor", "words"] },
    { id: "elegant", label: "Elegant", demoOrder: ["words", "nested", "editor", "tasks", "files", "list"] },
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
    { id: "task-review-motion", title: "Review motion", tag: "UX", progress: "68%", started: "Jul 1" },
    { id: "task-ship-polish", title: "Ship polish", tag: "UI", progress: "42%", started: "Jul 3" },
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
  const nestedShowcaseEntries: NestedShowcaseEntry[] = [
    ...customizableMockupNested.parent.map((row): NestedShowcaseEntry => ({
      kind: "row",
      row,
      id: row.id,
    })),
    { kind: "child-group", id: "child-group" },
  ];
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
    { id: "page", label: "+page.svelte", kind: "file", parentId: "routes", active: true },
    { id: "theme", label: "theme.scss", kind: "file", parentId: "src" },
    { id: "pkg", label: "package.json", kind: "file" },
  ];

  function createThemeState(theme: CustomizableMockupTheme): CustomizableThemeState {
    const fileContainerIds = [
      "root",
      ...customizableMockupFiles
        .filter((file) => file.kind === "folder")
        .map((file) => file.id),
    ];

    return {
      ...theme,
      rows: customizableMockupRows.map((row) => ({ ...row })),
      words: customizableMockupWords.map((word) => ({ ...word })),
      tasks: customizableMockupCards.map((task) => ({ ...task })),
      nestedLists: {
        root: nestedShowcaseEntries.map((entry) =>
          entry.kind === "row" ? { ...entry, row: { ...entry.row } } : { ...entry },
        ),
        child: customizableMockupNested.child.map((row) => ({
          kind: "row" as const,
          row: { ...row },
          id: row.id,
        })),
      },
      fields: customizableMockupFields.map((field) => ({
        ...field,
        options: field.options.map((option) => ({ ...option })),
      })),
      fileLists: Object.fromEntries(fileContainerIds.map((containerId) => [
        containerId,
        customizableMockupFiles
          .filter((file) => (file.parentId ?? "root") === containerId)
          .map((file) => ({ ...file })),
      ])),
    };
  }

  let customizableMockupThemes = $state(
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
      rows: moveEntries(theme.rows, event, (row) => row.id),
    }));
  }

  function handleWordsMove(themeId: string, event: ItemMoveEvent) {
    updateTheme(themeId, (theme) => ({
      ...theme,
      words: moveEntries(theme.words, event, (word) => word.id),
    }));
  }

  function handleTasksMove(themeId: string, event: ItemMoveEvent) {
    updateTheme(themeId, (theme) => ({
      ...theme,
      tasks: moveEntries(theme.tasks, event, (task) => task.id),
    }));
  }

  function handleNestedMove(themeId: string, event: ItemMoveEvent) {
    const targetListId = event.to.containerMetadata.listId;
    if (targetListId !== "root" && targetListId !== "child") return;
    updateTheme(themeId, (theme) => ({
      ...theme,
      nestedLists: moveEntriesAcrossLists(
        theme.nestedLists,
        event,
        targetListId,
        (entry: NestedShowcaseEntry) => entry.id,
      ),
    }));
  }

  function handleFieldsMove(themeId: string, event: ItemMoveEvent) {
    updateTheme(themeId, (theme) => ({
      ...theme,
      fields: moveEntries(theme.fields, event, (field) => field.id),
    }));
  }

  function handleOptionsMove(themeId: string, fieldId: string, event: ItemMoveEvent) {
    updateTheme(themeId, (theme) => ({
      ...theme,
      fields: theme.fields.map((field) =>
        field.id === fieldId
          ? { ...field, options: moveEntries(field.options, event, (option) => option.id) }
          : field,
      ),
    }));
  }

  function handleFilesMove(themeId: string, event: ItemMoveEvent) {
    const targetListId = event.to.containerMetadata.listId;
    if (typeof targetListId !== "string") return;
    updateTheme(themeId, (theme) => {
      if (!Object.hasOwn(theme.fileLists, targetListId)) return theme;
      return {
        ...theme,
        fileLists: moveEntriesAcrossLists(
          theme.fileLists,
          event,
          targetListId,
          (file: CustomizableMockupFile) => file.id,
        ),
      };
    });
  }

</script>

<svelte:window onscroll={updateCustomizableProgress} onresize={updateCustomizableProgress} />

{#snippet fileTree(
  theme: CustomizableThemeState,
  containerId: string,
  folder: CustomizableMockupFile | null,
  depth: number,
)}
  <Container
    className={folder
      ? `customizable-mini-tree-folder depth-${depth}${folder.active ? " active" : ""}`
      : "customizable-mini-files"}
    locked={folder === null}
    itemId={folder?.id}
    metadata={{
      themeId: theme.id,
      listId: containerId,
      insertionDepth: folder ? depth + 1 : 0,
    }}
    config={{
      direction: "column",
      name: `customizable-${theme.id}-files-${containerId}`,
      mode: "insertion",
      callbacks: {
        onItemMove: (event) => handleFilesMove(theme.id, event),
        getInsertionMarkerRect: ({ containerMetadata, defaultRect }) => {
          const markerDepth = Number(containerMetadata.insertionDepth ?? 0);
          const left = 6 + markerDepth * 9;
          return {
            ...defaultRect,
            x: defaultRect.x + left,
            width: Math.max(0, defaultRect.width - left - 6),
          };
        },
      },
      ...getCustomizableThemeConfig(theme.id),
    }}
    items={theme.fileLists[containerId] ?? []}
    getItemId={(file) => file.id}
    data-snapsort-demo="customizable-files"
    data-list-id={`customizable-${theme.id}-files-${containerId}`}
    data-order={(theme.fileLists[containerId] ?? []).map((file) => file.id).join(",")}
  >
    {#snippet before()}
      {#if folder}
        <div
          class="customizable-mini-tree-row folder"
          style={`--depth: ${depth};`}
        >
          <span class="customizable-mini-indent" aria-hidden="true"></span>
          <span class="customizable-mini-chevron open" aria-hidden="true"></span>
          <span class="customizable-mini-tree-icon folder" aria-hidden="true"></span>
          <strong>{folder.label}</strong>
        </div>
      {/if}
    {/snippet}
    {#snippet entry(file)}
      {#if file.kind === "folder"}
        {@render fileTree(theme, file.id, file, folder ? depth + 1 : 0)}
      {:else}
        <Item
          itemId={file.id}
          className={`customizable-mini-tree-row file depth-${folder ? depth + 1 : 0}${file.active ? " active" : ""}`}
          style={`--depth: ${folder ? depth + 1 : 0};`}
        >
          <span class="customizable-mini-indent" aria-hidden="true"></span>
          <span class="customizable-mini-chevron-spacer" aria-hidden="true"></span>
          <span class="customizable-mini-tree-icon file" aria-hidden="true"></span>
          <strong>{file.label}</strong>
        </Item>
      {/if}
    {/snippet}
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
                  SnapSort components are styleless by default. Use our default theme or
                  apply your own, including Tailwind. Configuration parameters allow
                  adjustment of animation and drag behavior.
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
                        className="customizable-mini-list"
                        metadata={{ themeId: theme.id, listId: "rows" }}
                        config={{
                          direction: "column",
                          callbacks: { onItemMove: (event) => handleRowsMove(theme.id, event) },
                          ...getCustomizableThemeConfig(theme.id),
                        }}
                        items={theme.rows}
                        getItemId={(row) => row.id}
                        data-snapsort-demo="customizable-list"
                        data-list-id={`customizable-${theme.id}-list`}
                        data-order={theme.rows.map((row) => row.id).join(",")}
                      >
                        {#snippet entry(row)}
                          <Item itemId={row.id}>
                            <div class="customizable-mini-row">
                              <span class="customizable-mini-handle" aria-hidden="true">
                                <span class="customizable-mini-grip">
                                  <i></i><i></i><i></i><i></i>
                                </span>
                              </span>
                              <span class="customizable-mini-row-main">
                                <span class="customizable-mini-row-text">{row.label}</span>
                              </span>
                              <span class="customizable-mini-meta">{row.meta}</span>
                            </div>
                          </Item>
                        {/snippet}
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
                        className="customizable-mini-words"
                        metadata={{ themeId: theme.id, listId: "words" }}
                        config={{
                          direction: "row",
                          mode: "progressive",
                          callbacks: { onItemMove: (event) => handleWordsMove(theme.id, event) },
                          ...getCustomizableThemeConfig(theme.id),
                        }}
                        items={theme.words}
                        getItemId={(word) => word.id}
                        data-snapsort-demo="customizable-words"
                        data-list-id={`customizable-${theme.id}-words`}
                        data-order={theme.words.map((word) => word.id).join(",")}
                      >
                        {#snippet entry(word)}
                          <Item itemId={word.id}>
                            <span class="customizable-mini-word">{word.label}</span>
                          </Item>
                        {/snippet}
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
                        className="customizable-mini-board"
                        metadata={{ themeId: theme.id, listId: "tasks" }}
                        config={{
                          direction: "column",
                          callbacks: { onItemMove: (event) => handleTasksMove(theme.id, event) },
                          ...getCustomizableThemeConfig(theme.id),
                        }}
                        items={theme.tasks}
                        getItemId={(card) => card.id}
                        data-snapsort-demo="customizable-tasks"
                        data-list-id={`customizable-${theme.id}-tasks`}
                        data-order={theme.tasks.map((task) => task.id).join(",")}
                      >
                        {#snippet entry(card)}
                          <Item itemId={card.id}>
                            <div class="customizable-mini-card">
                              <div class="customizable-mini-card-head">
                                <span class="customizable-mini-handle task" aria-hidden="true">
                                  <span class="customizable-mini-grip">
                                    <i></i><i></i><i></i><i></i>
                                  </span>
                                </span>
                                <strong>{card.title}</strong>
                                <span>{card.tag}</span>
                              </div>
                              <i style={`--progress: ${card.progress};`}></i>
                              <div class="customizable-mini-card-foot">
                                <span>{card.started}</span>
                                <em>{card.progress}</em>
                              </div>
                            </div>
                          </Item>
                        {/snippet}
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
                        className="customizable-mini-nested"
                        metadata={{ themeId: theme.id, listId: "root" }}
                        config={{
                          direction: "column",
                          callbacks: { onItemMove: (event) => handleNestedMove(theme.id, event) },
                          ...getCustomizableThemeConfig(theme.id),
                        }}
                        items={theme.nestedLists.root}
                        getItemId={(entry) => entry.id}
                        data-snapsort-demo="customizable-nested"
                        data-list-id={`customizable-${theme.id}-nested-root`}
                        data-order={theme.nestedLists.root.map((entry) => entry.id).join(",")}
                      >
                        {#snippet entry(e)}
                          {#if e.kind === "row"}
                            <Item itemId={e.id}>
                              <div class="customizable-mini-row">
                                <Handle className="customizable-mini-handle">
                                  <span class="customizable-mini-grip" aria-hidden="true">
                                    <i></i><i></i><i></i><i></i>
                                  </span>
                                </Handle>
                                <span class="customizable-mini-row-main">
                                  <span class="customizable-mini-row-text">{e.row.label}</span>
                                  <span class="customizable-mini-row-sub">Parent block</span>
                                </span>
                                <span class="customizable-mini-meta">{e.row.meta}</span>
                              </div>
                            </Item>
                          {:else}
                            <Container
                              className="customizable-mini-nested-child"
                              metadata={{ themeId: theme.id, listId: "child" }}
                              config={{
                                direction: "column",
                                callbacks: { onItemMove: (event) => handleNestedMove(theme.id, event) },
                                ...getCustomizableThemeConfig(theme.id),
                              }}
                              itemId={e.id}
                              items={theme.nestedLists.child}
                              getItemId={(entry) => entry.id}
                              data-snapsort-demo="customizable-nested"
                              data-list-id={`customizable-${theme.id}-nested-child`}
                              data-order={theme.nestedLists.child.map((entry) => entry.id).join(",")}
                            >
                              {#snippet entry(child)}
                                {#if child.kind === "row"}
                                  <Item itemId={child.id}>
                                    <div class="customizable-mini-row nested">
                                      <Handle className="customizable-mini-handle">
                                        <span class="customizable-mini-grip" aria-hidden="true">
                                          <i></i><i></i><i></i><i></i>
                                        </span>
                                      </Handle>
                                      <span class="customizable-mini-row-main">
                                        <span class="customizable-mini-row-text">{child.row.label}</span>
                                        <span class="customizable-mini-row-sub">Nested item</span>
                                      </span>
                                      <span class="customizable-mini-meta">{child.row.meta}</span>
                                    </div>
                                  </Item>
                                {/if}
                              {/snippet}
                            </Container>
                          {/if}
                        {/snippet}
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
                          className="customizable-mini-editor"
                          metadata={{ themeId: theme.id, listId: "fields" }}
                          config={{
                            direction: "column",
                            callbacks: { onItemMove: (event) => handleFieldsMove(theme.id, event) },
                            ...getCustomizableThemeConfig(theme.id),
                          }}
                          items={theme.fields}
                          getItemId={(field) => field.id}
                          data-snapsort-demo="customizable-editor"
                          data-list-id={`customizable-${theme.id}-editor`}
                          data-order={theme.fields.map((field) => field.id).join(",")}
                        >
                          {#snippet entry(field)}
                            <Item itemId={field.id}>
                              <div class="customizable-mini-field">
                                <Handle className="customizable-mini-field-handle">
                                  <span class="customizable-mini-grip" aria-hidden="true">
                                    <i></i><i></i><i></i><i></i>
                                  </span>
                                </Handle>
                                <div class="customizable-mini-field-main">
                                  <div class="customizable-mini-question-input">
                                    <strong>{field.label}</strong>
                                    <span>{field.type === "radio" ? "Multiple choice" : "Checkboxes"}</span>
                                  </div>
                                  <SnapSortContextBoundary>
                                    <Container
                                      className="customizable-mini-options"
                                      metadata={{ themeId: theme.id, listId: field.id }}
                                      config={{
                                        direction: "column",
                                        mode: "progressive",
                                        callbacks: {
                                          onItemMove: (event) => handleOptionsMove(theme.id, field.id, event),
                                        },
                                        ...getCustomizableThemeConfig(theme.id),
                                      }}
                                      items={field.options}
                                      getItemId={(option) => option.id}
                                      data-snapsort-demo="customizable-options"
                                      data-list-id={`customizable-${theme.id}-editor-${field.id}`}
                                      data-order={field.options.map((option) => option.id).join(",")}
                                    >
                                      {#snippet entry(option)}
                                        <Item itemId={option.id}>
                                          <span class="customizable-mini-option" class:checkbox={field.type === "checkbox"}>
                                            <Handle className="customizable-mini-option-handle">
                                              <span class="customizable-mini-option-grip" aria-hidden="true"></span>
                                            </Handle>
                                            <i></i>
                                            <span>{option.label}</span>
                                            <button type="button" tabindex="-1" aria-label="Remove option">x</button>
                                          </span>
                                        </Item>
                                      {/snippet}
                                    </Container>
                                  </SnapSortContextBoundary>
                                  <button class="customizable-mini-add-option" type="button" tabindex="-1">
                                    + Add option
                                  </button>
                                </div>
                              </div>
                            </Item>
                          {/snippet}
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
                      {@render fileTree(theme, "root", null, 0)}
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
                    File trees, form builders, sentence puzzles, and more —
                    complete interactive demos built with SnapSort.
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
