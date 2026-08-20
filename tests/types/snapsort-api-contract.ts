import {
  Container,
  Item,
  createRenderEntries,
  createRenderEntry,
  createRenderTree,
  createVanillaAdapter,
  defaultAnimations,
  insertionMarkerRect,
  reduceRenderTree,
  stockInsertionMarkerRectOptions,
  toContainerLocalRect,
  type ContainerAnimations,
  type ContainerCallbacks,
  type ContainerConfig,
  type ContainerLocalRect,
  type ContainerOptions,
  type CreateVanillaAdapterOptions,
  type DragSession,
  type GhostInsertEvent,
  type GhostLifecycleEvent,
  type GhostMoveEvent,
  type GhostRemoveEvent,
  type GhostRect,
  type GhostState,
  type InsertionGapSegment,
  type InsertionMarkerNeighbor,
  type InsertionMarkerRectOptions,
  type InsertionMarkerState,
  type ItemInsertEvent,
  type ItemOptions,
  type ItemMoveEvent,
  type ItemRemoveEvent,
  type ItemSwapEvent,
  type RenderEntry,
  type RenderTree,
  type RenderTreeEvent,
  type SnapSortAdapter,
  type SortMode,
} from "@snap-engine/snapsort";
import * as reactBinding from "@snap-engine/snapsort/react";
import type { GhostProps } from "@snap-engine/snapsort/react";

declare const container: Container;
declare const item: Item;
declare const callbacks: ContainerCallbacks;
declare const config: ContainerConfig;
declare const animations: ContainerAnimations;
declare const insertEvent: ItemInsertEvent;
declare const moveEvent: ItemMoveEvent;
declare const removeEvent: ItemRemoveEvent;
declare const swapEvent: ItemSwapEvent;
declare const session: DragSession;
declare const ghost: GhostState;
declare const insertionMarker: InsertionMarkerState;
declare const insertionNeighbor: InsertionMarkerNeighbor;
declare const ghostInsertEvent: GhostInsertEvent;
declare const ghostMoveEvent: GhostMoveEvent;
declare const ghostRemoveEvent: GhostRemoveEvent;
declare const ghostProps: GhostProps;
declare const adapter: SnapSortAdapter;
declare const engine: import("@snap-engine/core").Engine;

const itemOptions: ItemOptions = { itemId: "task-1" };
const constructedItem = new Item(engine, null, itemOptions);
const constructedContainer = new Container(engine, null, {
  itemId: "tasks-root",
});
const reactItemProps: reactBinding.ItemProps = {
  children: null,
  itemId: "task-2",
};
const reactContainerProps: reactBinding.ContainerProps = {
  itemId: "react-root",
};

container.attachItem(item);
const publicConfig: ContainerConfig = container.config;
const mode: SortMode = publicConfig.mode ?? "euclidean";
const moveAnimation = animations.move ?? defaultAnimations.move;
const containerOptions: ContainerOptions = {
  itemId: "adapter-root",
  adapter,
};
const observedAdapter: SnapSortAdapter = container.adapter;
container.callbacks = callbacks;
const leafEntries = createRenderEntries(
  [{ id: "item-a" }],
  (value) => value.id,
);
const childTree = createRenderTree(leafEntries);
const parentEntry = createRenderEntry({ id: "group" }, "group", childTree);
let renderTree: RenderTree<{ id: string }> = createRenderTree([parentEntry]);
const entries: readonly RenderEntry<{ id: string }>[] = renderTree.entries;
const observedRenderItemId: string = entries[0].itemId;
const ghostLifecycleEvent: GhostLifecycleEvent = ghostMoveEvent;
const renderTreeEvent: RenderTreeEvent = ghostLifecycleEvent;
renderTree = reduceRenderTree(renderTree, ghostInsertEvent);
renderTree = reduceRenderTree(renderTree, ghostMoveEvent);
renderTree = reduceRenderTree(renderTree, ghostRemoveEvent);
renderTree = reduceRenderTree(renderTree, moveEvent);
renderTree = reduceRenderTree(renderTree, swapEvent);
renderTree = reduceRenderTree(renderTree, removeEvent);
const observedGhost: GhostState = ghostProps.ghost;
const horizontalGap: InsertionGapSegment = {
  orientation: "horizontal",
  x: 12,
  y: 24,
  length: 180,
};
const markerOptions: InsertionMarkerRectOptions = {
  thickness: 2,
  startInset: 12,
  endInset: 8,
};
const markerRect: ContainerLocalRect = insertionMarkerRect(
  insertionMarker,
  markerOptions,
);
const stockMarkerOptions: InsertionMarkerRectOptions =
  stockInsertionMarkerRectOptions;
const vanillaOptions: CreateVanillaAdapterOptions = {
  insertionMarker: markerOptions,
};
const vanillaAdapter: SnapSortAdapter = createVanillaAdapter(vanillaOptions);
const worldRect: GhostRect = { x: 10, y: 20, width: 30, height: 40 };
const localRect: ContainerLocalRect = toContainerLocalRect(
  worldRect,
  container,
);
const containerNeighbor: InsertionMarkerNeighbor = {
  item: container,
  itemId: "nested-container",
  itemMetadata: {},
  rect: { x: 0, y: 0, width: 120, height: 80 },
};
const observedGap: InsertionGapSegment = insertionMarker.gap;
const observedPrevious: InsertionMarkerNeighbor | null =
  insertionMarker.previous;
const observedNext: InsertionMarkerNeighbor | null = insertionMarker.next;
const observedCurrentPlacement: boolean = insertionMarker.isCurrentPlacement;
const markerGhostProps: GhostProps = {
  ghost: insertionMarker,
  insertionMarker: markerOptions,
};
void [
  mode,
  moveAnimation,
  reactBinding.Container,
  constructedItem,
  constructedContainer,
  reactItemProps,
  reactContainerProps,
  containerOptions,
  observedAdapter,
  entries,
  observedRenderItemId,
  renderTree,
  renderTreeEvent,
  observedGhost,
  ghost,
  horizontalGap,
  markerRect,
  stockMarkerOptions,
  vanillaAdapter,
  localRect,
  containerNeighbor,
  observedGap,
  observedPrevious,
  observedNext,
  observedCurrentPlacement,
  markerGhostProps,
];

// @ts-expect-error Item identity is required at construction.
new Item(engine, null);
// @ts-expect-error Container identity is required at construction.
new Container(engine, null);
// @ts-expect-error React Item identity is required.
const _missingReactItemId: reactBinding.ItemProps = { children: null };
// @ts-expect-error React Container identity is required.
const _missingReactContainerId: reactBinding.ContainerProps = {};
// @ts-expect-error application identity is immutable.
item.itemId = "replacement";
// @ts-expect-error resolvedItemId was replaced by the non-null itemId property.
item.resolvedItemId;

const observedRoot: Container = session.root;
const observedItems: readonly Item[] = session.items;
const observedStatus = session.status;
session.dragVisual = "preview";
session.dropEffect = "none";
session.handoff(observedItems);
void [observedRoot, observedStatus];

// @ts-expect-error the active session handle is installed by SnapSort.
container.dragSession = session;
// @ts-expect-error participant arrays are read-only.
session.items.push(item);
// @ts-expect-error source arrays are read-only.
session.sources.pop();
// @ts-expect-error source locations are read-only.
session.sources[0].index = 2;
// @ts-expect-error session coordinates are read-only.
session.pointer.x = 10;
// @ts-expect-error session coordinates are read-only.
session.start.y = 10;
// @ts-expect-error status is lifecycle-owned.
session.status = "active";
// @ts-expect-error participants are lifecycle-owned.
session.pressedItem = item;
// @ts-expect-error strategies are internal.
session.strategy;
// @ts-expect-error lifecycle cancellation is internal.
session.cancel();
// @ts-expect-error targeting state is internal.
session.dropTarget;
// @ts-expect-error ghost registries are internal.
session.ghosts;
// @ts-expect-error animation bookkeeping is internal.
session.dragVisualStart;

// @ts-expect-error addItem was replaced by attachItem.
container.addItem(item);
// @ts-expect-error configuration was replaced by config.
container.configuration;
// @ts-expect-error custom strategy injection is no longer public configuration.
config.strategy;
// @ts-expect-error clickMove was replaced by move.
animations.clickMove;
// @ts-expect-error awaitMutation is no longer a callback integration seam.
callbacks.awaitMutation;
// @ts-expect-error framework transaction ownership moved to SnapSortAdapter.
callbacks.flushMutation;
// @ts-expect-error renderer adapters are construction-only ContainerOptions.
config.adapter;
// @ts-expect-error the old integration boundary was replaced by SnapSortAdapter.
config.integration;
// @ts-expect-error the old integration property was replaced by Container.adapter.
container.integration;
// @ts-expect-error Ghost accepts current GhostState, not mutation events.
ghostProps.event;
// @ts-expect-error Ghost accepts current GhostState, not presentation models.
ghostProps.presentation;
// @ts-expect-error insertion markers expose a semantic gap, not a render rectangle.
insertionMarker.rect;
// @ts-expect-error insertion geometry conversion always requires explicit presentation options.
insertionMarkerRect(insertionMarker);
// @ts-expect-error all three marker presentation options are required.
const _incompleteMarkerOptions: InsertionMarkerRectOptions = {
  thickness: 3,
  startInset: 0,
};
// @ts-expect-error insertion gap geometry is immutable.
horizontalGap.length = 200;
// @ts-expect-error adjacent geometry is a frozen snapshot.
insertionNeighbor.rect.x = 0;
// @ts-expect-error the stock renderer contract is immutable.
stockInsertionMarkerRectOptions.thickness = 4;
// @ts-expect-error mutation events no longer expose a phase.
insertEvent.phase;
// @ts-expect-error mutation events no longer expose a phase.
moveEvent.phase;
// @ts-expect-error mutation events no longer expose a phase.
removeEvent.phase;
// @ts-expect-error mutation events no longer expose a phase.
swapEvent.phase;
// @ts-expect-error a true insertion cannot materialize an application value.
renderTree = reduceRenderTree(renderTree, insertEvent);
// @ts-expect-error framework reconciliation keys are application-owned.
entries[0].key;
// @ts-expect-error RenderEntry.id was replaced by RenderEntry.itemId.
entries[0].id;

const callbacksWithoutLegacyInsertionGeometry: ContainerCallbacks = {
  // @ts-expect-error insertion targeting geometry is core-owned; this callback was removed.
  getInsertionMarkerRect: () => ({ x: 0, y: 0, width: 1, height: 3 }),
};
void callbacksWithoutLegacyInsertionGeometry;

// @ts-expect-error MutationPhase is no longer exported from the package root.
import type { MutationPhase as _MutationPhase } from "@snap-engine/snapsort";
// @ts-expect-error SortStrategy is an internal implementation detail.
import type { SortStrategy as _SortStrategy } from "@snap-engine/snapsort";
// @ts-expect-error DropTargetStrategy is an internal implementation detail.
import type { DropTargetStrategy as _DropTargetStrategy } from "@snap-engine/snapsort";
// @ts-expect-error DragLifecycleStrategy is an internal implementation detail.
import type { DragLifecycleStrategy as _DragLifecycleStrategy } from "@snap-engine/snapsort";
// @ts-expect-error FrameworkIntegration was replaced by SnapSortAdapter.
import type { FrameworkIntegration as _FrameworkIntegration } from "@snap-engine/snapsort";
// @ts-expect-error GhostPresentation was replaced by GhostState.
import type { GhostPresentation as _GhostPresentation } from "@snap-engine/snapsort";
// @ts-expect-error InsertionMarkerRectEvent was removed with getInsertionMarkerRect.
import type { InsertionMarkerRectEvent as _InsertionMarkerRectEvent } from "@snap-engine/snapsort";
// @ts-expect-error RenderKey is no longer part of the public API.
import type { RenderKey as _RenderKey } from "@snap-engine/snapsort";
// @ts-expect-error renderKey is no longer part of the public API.
import { renderKey as _renderKey } from "@snap-engine/snapsort";
// @ts-expect-error container-local ghost state was replaced by RenderTree.
import { reduceContainerGhosts as _reduceContainerGhosts } from "@snap-engine/snapsort";
// @ts-expect-error render composition was replaced by RenderTree state.
import { composeRenderEntries as _composeRenderEntries } from "@snap-engine/snapsort";
// @ts-expect-error container-local reduction replaced the flat insert reducer.
import { insertGhostState as _insertGhostState } from "@snap-engine/snapsort";
// @ts-expect-error container-local reduction replaced the flat move reducer.
import { moveGhostState as _moveGhostState } from "@snap-engine/snapsort";
// @ts-expect-error container-local reduction replaced the flat remove reducer.
import { removeGhostState as _removeGhostState } from "@snap-engine/snapsort";
// @ts-expect-error the deprecated React helper is no longer exported.
import { useSnapSortAwaitMutation as _useSnapSortAwaitMutation } from "@snap-engine/snapsort/react";
// @ts-expect-error the deprecated React helper has no package subpath.
import { useSnapSortAwaitMutation as _deepHelper } from "@snap-engine/snapsort/react/useSnapSortAwaitMutation";
import { DragSession as DragSessionValue } from "@snap-engine/snapsort";

// @ts-expect-error DragSession is a type-only public handle, not a constructor.
new DragSessionValue();
