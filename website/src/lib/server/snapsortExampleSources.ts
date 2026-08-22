import adoptedItemRowSource from "$lib/components/docs/AdoptedItemRow.svelte?raw";
import containerIntroBasicSource from "$lib/components/docs/ContainerIntroBasicDemo.svelte?raw";
import containerIntroMixedSource from "$lib/components/docs/ContainerIntroMixedDemo.svelte?raw";
import containerIntroSortableSource from "$lib/components/docs/ContainerIntroSortableDemo.svelte?raw";
import containerPropertyBeforeAfterSource from "$lib/components/docs/ContainerPropertyBeforeAfterDemo.svelte?raw";
import containerPropertyCollectionSource from "$lib/components/docs/ContainerPropertyCollectionDemo.svelte?raw";
import containerPropertyConfigSource from "$lib/components/docs/ContainerPropertyConfigDemo.svelte?raw";
import containerPropertyGhostSource from "$lib/components/docs/ContainerPropertyGhostDemo.svelte?raw";
import containerPropertyMetadataSource from "$lib/components/docs/ContainerPropertyMetadataDemo.svelte?raw";
import containerPropertyNestedSource from "$lib/components/docs/ContainerPropertyNestedDemo.svelte?raw";
import containerPropertyPresentationSource from "$lib/components/docs/ContainerPropertyPresentationDemo.svelte?raw";
import itemBasicSource from "$lib/components/docs/ItemBasicDemo.svelte?raw";
import itemHandleSource from "$lib/components/docs/ItemHandleDemo.svelte?raw";
import itemInstanceSource from "$lib/components/docs/ItemInstanceDemo.svelte?raw";
import itemMetadataSource from "$lib/components/docs/ItemMetadataDemo.svelte?raw";
import itemSelectionSource from "$lib/components/docs/ItemSelectionDemo.svelte?raw";
import snapSortContextBoundarySource from "$lib/components/SnapSortContextBoundary.svelte?raw";
import clonePaletteSource from "$lib/components/docs/examples/ClonePaletteExample.svelte?raw";
import fileExplorerNodeSource from "$lib/components/docs/examples/FileExplorerNode.svelte?raw";
import fileExplorerSource from "$lib/components/docs/examples/FileExplorerExample.svelte?raw";
import formEditorSource from "$lib/components/docs/examples/FormEditorExample.svelte?raw";
import kanbanBoardSource from "$lib/components/docs/examples/KanbanBoardExample.svelte?raw";
import sentenceBuilderSource from "$lib/components/docs/examples/SentenceBuilderExample.svelte?raw";
import swapGridSource from "$lib/components/docs/examples/SwapGridExample.svelte?raw";
import todoListSource from "$lib/components/docs/examples/TodoListExample.svelte?raw";
import trashItSource from "$lib/components/docs/examples/TrashItExample.svelte?raw";
import {
  isSnapSortExampleId,
  type SnapSortExampleId,
} from "$lib/components/docs/snapsortExampleCatalog";

export type SnapSortExampleSource = Readonly<{
  code: string;
  language: "svelte";
}>;

type SvelteSourceFile = Readonly<{
  filename: string;
  source: string;
}>;

function combineSvelteSourceFiles(files: readonly SvelteSourceFile[]): string {
  return files
    .flatMap(({ filename, source }, index) => [
      ...(index === 0 ? [] : [""]),
      `<!-- ${filename} -->`,
      source.trimEnd(),
    ])
    .join("\n");
}

function svelteSource(code: string): SnapSortExampleSource {
  return { code, language: "svelte" };
}

const itemInstanceWithHelper = combineSvelteSourceFiles([
  { filename: "ItemInstanceDemo.svelte", source: itemInstanceSource },
  { filename: "AdoptedItemRow.svelte", source: adoptedItemRowSource },
]);

const fileExplorerWithNode = combineSvelteSourceFiles([
  { filename: "FileExplorerExample.svelte", source: fileExplorerSource },
  { filename: "FileExplorerNode.svelte", source: fileExplorerNodeSource },
]);

const formEditorWithContextBoundary = combineSvelteSourceFiles([
  { filename: "FormEditorExample.svelte", source: formEditorSource },
  {
    filename: "SnapSortContextBoundary.svelte",
    source: snapSortContextBoundarySource,
  },
]);

const snapSortExampleSources = {
  "container-intro-basic": svelteSource(containerIntroBasicSource),
  "container-intro-sortable": svelteSource(containerIntroSortableSource),
  "container-intro-mixed": svelteSource(containerIntroMixedSource),
  "container-property-collection": svelteSource(
    containerPropertyCollectionSource,
  ),
  "container-property-config": svelteSource(containerPropertyConfigSource),
  "container-property-before-after": svelteSource(
    containerPropertyBeforeAfterSource,
  ),
  "container-property-metadata": svelteSource(containerPropertyMetadataSource),
  "container-property-nested": svelteSource(containerPropertyNestedSource),
  "container-property-ghost": svelteSource(containerPropertyGhostSource),
  "container-property-presentation": svelteSource(
    containerPropertyPresentationSource,
  ),
  "item-example-basic": svelteSource(itemBasicSource),
  "item-example-metadata": svelteSource(itemMetadataSource),
  "item-example-selection": svelteSource(itemSelectionSource),
  "item-example-item-instance": svelteSource(itemInstanceWithHelper),
  "item-example-handle": svelteSource(itemHandleSource),
  "todo-list": svelteSource(todoListSource),
  "kanban-board": svelteSource(kanbanBoardSource),
  "sentence-builder": svelteSource(sentenceBuilderSource),
  "file-explorer": svelteSource(fileExplorerWithNode),
  "clone-palette": svelteSource(clonePaletteSource),
  "trash-it": svelteSource(trashItSource),
  "swap-grid": svelteSource(swapGridSource),
  "form-editor": svelteSource(formEditorWithContextBoundary),
} satisfies Record<SnapSortExampleId, SnapSortExampleSource>;

export function findSnapSortExampleSource(
  id: string,
): SnapSortExampleSource | null {
  return isSnapSortExampleId(id) ? snapSortExampleSources[id] : null;
}
