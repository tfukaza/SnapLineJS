import type { Container } from "../container";
import type { ResolvedDropTarget } from "../algorithm";
import type {
  DragSessionController as DragSession,
  DropPlacement,
} from "./session";

/**
 * The drag/ghost lifecycle for a sort mode. Built-ins include a flow-layout
 * spacer ghost that lives in the item list and is FLIP-animated
 * (euclidean/progressive), a floating insertion marker tracked only via
 * `DragSession.pendingPlacement` (insertion), and hover-only targeting
 * (swap). Pointer representation is shared and selected independently through
 * `DragSession.dragVisual`. Drop-target *resolution* (which algorithm picks
 * the candidate) is a separate axis — see `DropTargetStrategy`.
 */
export interface DragLifecycleStrategy {
  readonly placementOccupiesFlowSlots: boolean;

  /**
   * Validate the callbacks/resources required by the initial drag state.
   * Runs after `onDragStart` (so drag options are final) but before the
   * session is marked active or any dragging attributes are written.
   */
  validateStart(session: DragSession): void;

  /** WRITE_1 work specific to starting a drag
   * (ghost creation, detaching the item, styling). */
  dragStart(session: DragSession): void | Promise<void>;

  /** WRITE_1 work specific to a pointer move. */
  dragMove(session: DragSession): void | Promise<void>;

  /** Current container/index the ghost logically occupies,
   * or null when there is none yet. */
  currentPlacement(
    session: DragSession,
  ): { container: Container; index: number } | null;

  /** Translate a resolved drop candidate into an
   * index meaningful for this lifecycle's ghost representation. */
  placementIndexFor(session: DragSession, target: ResolvedDropTarget): number;

  /** Synchronize this lifecycle's representation with the requested placement. */
  syncPlacement(
    session: DragSession,
    placement: DropPlacement,
  ): void | Promise<void>;

  /** Called after the ghost has been synced to
   * the (possibly unchanged) drop target. */
  afterPlacementSync(session: DragSession): void;

  /**
   * Remove the target placement representation, if one currently exists.
   * Safe to call at any point during a drag (e.g. when the pointer leaves
   * every valid drop target) — target feedback can be added, moved, or
   * removed independently from the pointer visual.
   */
  clearPlacement(session: DragSession): void | Promise<void>;

  /** WRITE_1 work for dropping: remove the ghost/marker
   * and move the item to its final position. */
  drop(session: DragSession): void;
}
