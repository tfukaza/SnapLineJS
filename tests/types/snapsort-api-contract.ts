import {
  Container,
  Item,
  defaultAnimations,
  type ContainerAnimations,
  type ContainerCallbacks,
  type ContainerConfig,
  type DragSession,
  type ItemInsertEvent,
  type ItemMoveEvent,
  type ItemRemoveEvent,
  type ItemSwapEvent,
  type SortMode,
} from "@snap-engine/snapsort";
import * as reactBinding from "@snap-engine/snapsort/react";

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

container.attachItem(item);
const publicConfig: ContainerConfig = container.config;
const mode: SortMode = publicConfig.mode ?? "euclidean";
const moveAnimation = animations.move ?? defaultAnimations.move;
void [callbacks.flushMutation, mode, moveAnimation, reactBinding.Container];

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
// @ts-expect-error mutation events no longer expose a phase.
insertEvent.phase;
// @ts-expect-error mutation events no longer expose a phase.
moveEvent.phase;
// @ts-expect-error mutation events no longer expose a phase.
removeEvent.phase;
// @ts-expect-error mutation events no longer expose a phase.
swapEvent.phase;

// @ts-expect-error MutationPhase is no longer exported from the package root.
import type { MutationPhase } from "@snap-engine/snapsort";
// @ts-expect-error SortStrategy is an internal implementation detail.
import type { SortStrategy } from "@snap-engine/snapsort";
// @ts-expect-error DropTargetStrategy is an internal implementation detail.
import type { DropTargetStrategy } from "@snap-engine/snapsort";
// @ts-expect-error DragLifecycleStrategy is an internal implementation detail.
import type { DragLifecycleStrategy } from "@snap-engine/snapsort";
// @ts-expect-error the deprecated React helper is no longer exported.
import { useSnapSortAwaitMutation } from "@snap-engine/snapsort/react";
// @ts-expect-error the deprecated React helper has no package subpath.
import { useSnapSortAwaitMutation as deepHelper } from "@snap-engine/snapsort/react/useSnapSortAwaitMutation";
import { DragSession as DragSessionValue } from "@snap-engine/snapsort";

// @ts-expect-error DragSession is a type-only public handle, not a constructor.
new DragSessionValue();

void [
  null as MutationPhase,
  null as unknown as SortStrategy,
  null as unknown as DropTargetStrategy,
  null as unknown as DragLifecycleStrategy,
  useSnapSortAwaitMutation,
  deepHelper,
];
