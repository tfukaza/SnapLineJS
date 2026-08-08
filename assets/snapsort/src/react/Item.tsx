import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import {
  Item as ItemObject,
  type ItemSnapshotMetadata,
} from "@snap-engine/snapsort";
import { useSnapSortEngine } from "./Engine";
import { ContainerObjectContext } from "./Container";

export const ItemObjectContext = createContext<ItemObject | null>(null);

export interface ItemProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children: ReactNode;
  className?: string;
  itemId?: string;
  itemObject?: ItemObject | null;
  metadata?: ItemSnapshotMetadata;
  /** Consumer-owned selection flag — see `Item.selected` in `@snap-engine/snapsort`. */
  selected?: boolean;
}

export const Item = forwardRef<ItemObject, ItemProps>(function SnapSortItem(
  { children, className = "", itemId, itemObject = null, metadata = {}, selected = false, style, ...divProps },
  ref,
) {
  const engine = useSnapSortEngine();
  const container = useContext(ContainerObjectContext);
  const itemDomRef = useRef<HTMLDivElement>(null);
  const ownsItemRef = useRef(itemObject == null);
  const itemRef = useRef<ItemObject | null>(itemObject);
  if (!itemRef.current) {
    itemRef.current = new ItemObject(engine, null);
  }
  const item = itemRef.current;
  const resolvedItemId =
    itemId ?? (typeof metadata.itemId === "string" ? metadata.itemId : undefined);
  if (resolvedItemId !== undefined) {
    item.itemId = resolvedItemId;
  }
  item.metadata = metadata;
  item.selected = selected;

  useImperativeHandle(ref, () => item, [item]);

  const setItemElement = useCallback(
    (element: HTMLDivElement | null) => {
      itemDomRef.current = element;
      if (element) {
        item.element = element;
      }
    },
    [item],
  );

  useEffect(() => {
    if (container && item.parent !== container) {
      container.addItem(item);
    }
    return () => {
      if (ownsItemRef.current) {
        item.destroy(false);
      }
    };
  }, [container, item]);

  return (
    <ItemObjectContext.Provider value={item}>
      <div
        {...divProps}
        ref={setItemElement}
        className={`snapsort-item ${className}`.trim()}
        data-snapsort-item-id={item.resolvedItemId}
        style={{
          alignItems: "center",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 4,
          ...style,
        }}
      >
        {children}
      </div>
    </ItemObjectContext.Provider>
  );
});
