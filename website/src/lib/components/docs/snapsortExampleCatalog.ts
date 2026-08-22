export type SnapSortExampleGroup =
  | "container-intro"
  | "container-property"
  | "item"
  | "complete-interface";

export type SnapSortExampleMetadata = Readonly<{
  label: string;
  group: SnapSortExampleGroup;
}>;

export const snapSortExampleMetadata = {
  "container-intro-basic": {
    label: "A basic container",
    group: "container-intro",
  },
  "container-intro-sortable": {
    label: "A sortable container",
    group: "container-intro",
  },
  "container-intro-mixed": {
    label: "Items and nested containers",
    group: "container-intro",
  },
  "container-property-collection": {
    label: "Rendering a collection",
    group: "container-property",
  },
  "container-property-config": {
    label: "Changing container behavior",
    group: "container-property",
  },
  "container-property-before-after": {
    label: "Fixed content around items",
    group: "container-property",
  },
  "container-property-metadata": {
    label: "Programmatic cross-container moves",
    group: "container-property",
  },
  "container-property-nested": {
    label: "Nested containers",
    group: "container-property",
  },
  "container-property-ghost": {
    label: "Custom Ghost Rendering",
    group: "container-property",
  },
  "container-property-presentation": {
    label: "Classes, styles, and HTML attributes",
    group: "container-property",
  },
  "item-example-basic": {
    label: "A basic item",
    group: "item",
  },
  "item-example-metadata": {
    label: "Metadata in callbacks",
    group: "item",
  },
  "item-example-selection": {
    label: "Consumer-owned selection",
    group: "item",
  },
  "item-example-item-instance": {
    label: "Adopting a core item",
    group: "item",
  },
  "item-example-handle": {
    label: "Dragging from a handle",
    group: "item",
  },
  "todo-list": {
    label: "TODO List",
    group: "complete-interface",
  },
  "kanban-board": {
    label: "Kanban Board",
    group: "complete-interface",
  },
  "sentence-builder": {
    label: "Sentence Builder",
    group: "complete-interface",
  },
  "file-explorer": {
    label: "File Explorer",
    group: "complete-interface",
  },
  "clone-palette": {
    label: "Clone Palette",
    group: "complete-interface",
  },
  "trash-it": {
    label: "Trash It",
    group: "complete-interface",
  },
  "swap-grid": {
    label: "Swap Grid",
    group: "complete-interface",
  },
  "form-editor": {
    label: "Form Editor",
    group: "complete-interface",
  },
} satisfies Record<string, SnapSortExampleMetadata>;

export type SnapSortExampleId = keyof typeof snapSortExampleMetadata;

type ExampleIdForGroup<Group extends SnapSortExampleGroup> = {
  [Id in SnapSortExampleId]: (typeof snapSortExampleMetadata)[Id]["group"] extends Group
    ? Id
    : never;
}[SnapSortExampleId];

type KindFor<
  Id extends string,
  Prefix extends string,
> = Id extends `${Prefix}${infer Kind}` ? Kind : never;

export type ContainerIntroExampleId = ExampleIdForGroup<"container-intro">;
export type ContainerIntroExampleKind = KindFor<
  ContainerIntroExampleId,
  "container-intro-"
>;

export type ContainerPropertyExampleId =
  ExampleIdForGroup<"container-property">;
export type ContainerPropertyExampleKind = KindFor<
  ContainerPropertyExampleId,
  "container-property-"
>;

export type ItemExampleId = ExampleIdForGroup<"item">;
export type ItemExampleKind = KindFor<ItemExampleId, "item-example-">;

export type CompleteExampleKind = ExampleIdForGroup<"complete-interface">;

export function containerIntroExampleId(
  kind: ContainerIntroExampleKind,
): ContainerIntroExampleId {
  return `container-intro-${kind}`;
}

export function containerPropertyExampleId(
  kind: ContainerPropertyExampleKind,
): ContainerPropertyExampleId {
  return `container-property-${kind}`;
}

export function itemExampleId(kind: ItemExampleKind): ItemExampleId {
  return `item-example-${kind}`;
}

export function isSnapSortExampleId(value: string): value is SnapSortExampleId {
  return Object.hasOwn(snapSortExampleMetadata, value);
}
