import type { DomProperty } from "@snap-engine/core";

export type ItemId = string;
export type LayoutDirection = "column" | "row";
export type LayoutMainAxisAlign = "start" | "center";
/**
 * How a container arranges its children, and therefore how the drop
 * simulation predicts positions:
 *
 * - `"flow"` (default): flexbox-like — children take their own measured
 *   size and wrap when the accumulated main-axis extent exceeds capacity.
 * - `"slots"`: CSS-grid-like — position is a function of *index*. The
 *   pristine snapshot's measured child boxes are the slots; a simulated
 *   entry adopts the geometry of the slot at its index. Requires the
 *   main-axis track geometry to be independent of which items occupy it
 *   (fixed/fr/percent templates); see `slotLayoutPositions` for the full
 *   contract.
 */
export type LayoutModel = "flow" | "slots";
/**
 * Whether a flow container's lines may wrap:
 *
 * - `"auto"` (default): inferred from measurements — row containers may
 *   wrap; column containers wrap only when the measured layout already
 *   shows multiple lines.
 * - `"nowrap"`: the list never wraps and simply keeps growing along its
 *   main axis (todo lists, file explorers). Declaring it makes zero-slack
 *   lists immune to spurious wrap flips from measurement noise.
 */
export type LayoutWrap = "auto" | "nowrap";

/** Read-only application data associated with an item. */
export type ItemMetadata = Readonly<Record<string, unknown>>;

export interface ItemSnapshot<T> {
  value: T;
  itemId: ItemId;
  metadata: ItemMetadata;
  direction: LayoutDirection;
  mainAxisAlign: LayoutMainAxisAlign;
  layoutModel: LayoutModel;
  wrap: LayoutWrap;
  /**
   * Entries in this container fill its cross axis (width in column lists,
   * height in row lists) up to the content box minus the entry's own
   * margins — the CSS `align-items: stretch` analogy. The drop simulation
   * re-sizes an inserted entry to the *destination* container, so ghost
   * rects and center points stay correct when dragging between containers
   * of different sizes (e.g. into a narrower nested list).
   */
  stretchItems: boolean;
  locked: boolean;
  box: DomProperty;
  children: ItemSnapshot<T>[];
}
