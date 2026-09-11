import type { ElementBox } from "@snap-engine/core";
import type {
  LayoutDirection,
  LayoutMainAxisAlign,
  LayoutModel,
  LayoutNode,
  LayoutWrap,
} from "@snap-engine/core/layout";

export type ItemId = string;

export type ItemMetadata = Readonly<Record<string, unknown>>;

/** A frozen item's measured box and layout, captured at drag start. */
export interface ItemSnapshot<T> extends LayoutNode<ItemSnapshot<T>> {
  value: T;
  itemId: ItemId;
  metadata: ItemMetadata;
  direction: LayoutDirection;
  mainAxisAlign: LayoutMainAxisAlign;
  layoutModel: LayoutModel;
  wrap: LayoutWrap;
  stretchItems: boolean;
  locked: boolean;
  box: ElementBox;
  children: ItemSnapshot<T>[];
}
