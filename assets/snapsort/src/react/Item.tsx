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
import { Item as ItemObject, type ItemMetadata } from "@snap-engine/snapsort";
import { useSnapSortEngine } from "./Engine";
import { ContainerObjectContext } from "./Container";

export const ItemObjectContext = createContext<ItemObject | null>(null);

export interface ItemProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children: ReactNode;
  className?: string;
  item?: ItemObject | null;
  itemId?: string;
  metadata?: ItemMetadata;
  /** Consumer-owned selection flag — see `Item.selected` in `@snap-engine/snapsort`. */
  selected?: boolean;
}

export const Item = forwardRef<ItemObject, ItemProps>(function SnapSortItem(
  {
    children,
    className = "",
    item: providedItem = null,
    itemId,
    metadata,
    selected,
    style,
    ...divProps
  },
  ref,
) {
  const engine = useSnapSortEngine();
  const container = useContext(ContainerObjectContext);
  const itemDomRef = useRef<HTMLDivElement>(null);
  const initialProvidedItemRef = useRef<ItemObject | null>(providedItem);
  const ownsItemRef = useRef(providedItem == null);
  const itemRef = useRef<ItemObject | null>(providedItem);
  if (!container) {
    throw new Error("SnapSort Item: must be rendered inside a Container.");
  }
  if (providedItem !== initialProvidedItemRef.current) {
    throw new Error(
      "SnapSort Item: the `item` prop cannot change after mount.",
    );
  }
  if (metadata && "itemId" in metadata) {
    throw new Error(
      "SnapSort Item: `metadata.itemId` was removed. Pass `itemId` as its own prop instead.",
    );
  }
  if (ownsItemRef.current && !itemId) {
    throw new Error("SnapSort Item: missing required `itemId` prop.");
  }
  if (!itemRef.current) {
    itemRef.current = new ItemObject(engine, null);
  }
  const item = itemRef.current;
  if (item.engine !== engine) {
    throw new Error(
      "SnapSort Item: the supplied `item` belongs to another Engine.",
    );
  }
  if (!ownsItemRef.current && item.parent !== container) {
    throw new Error(
      "SnapSort Item: the supplied `item` must already belong to the surrounding Container.",
    );
  }
  if (itemId !== undefined) {
    item.itemId = itemId;
  }
  if (!item.itemId) {
    throw new Error("SnapSort Item: missing required `itemId` prop.");
  }
  if (metadata !== undefined) {
    item.metadata = metadata;
  }
  if (selected !== undefined) {
    item.selected = selected;
  }

  useImperativeHandle(ref, () => item, [item]);

  const setItemElement = useCallback(
    (element: HTMLDivElement | null) => {
      const previousElement = itemDomRef.current;
      itemDomRef.current = element;
      if (element) {
        item.element = element;
        if (
          !ownsItemRef.current &&
          item.parent === container &&
          !container.itemOrderedList.includes(item)
        ) {
          // Ref attachment runs inside React's synchronous commit. Sync the
          // adopted Item's live ordering here so onDragStart can hand off to
          // a freshly-mounted replacement before passive effects run.
          container.addItem(item);
        }
      } else if (previousElement) {
        item.detachElement(previousElement);
      }
    },
    [container, item],
  );

  useEffect(() => {
    if (ownsItemRef.current && item.parent !== container) {
      container.addItem(item);
    } else if (
      item.parent === container &&
      !container.itemOrderedList.includes(item)
    ) {
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
