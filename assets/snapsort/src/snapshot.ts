import type { DomProperty } from "@snap-engine/core";

export type ItemId = string;
export type LayoutDirection = "column" | "row";
export type LayoutMainAxisAlign = "start" | "center";
export type LayoutModel = "flow" | "slots";
export type LayoutWrap = "auto" | "nowrap";

export type ItemMetadata = Readonly<Record<string, unknown>>;

export interface ItemSnapshot<T> {
  value: T;
  itemId: ItemId;
  metadata: ItemMetadata;
  direction: LayoutDirection;
  mainAxisAlign: LayoutMainAxisAlign;
  layoutModel: LayoutModel;
  wrap: LayoutWrap;
  stretchItems: boolean;
  locked: boolean;
  box: DomProperty;
  children: ItemSnapshot<T>[];
}
