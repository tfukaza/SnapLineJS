import {
  Container,
  ContainerObjectContext,
  Engine,
  Ghost,
  Handle,
  Item,
  useSnapSortEngine,
} from "@snap-engine/snapsort/react";
import { defaultAnimations, Item as CoreItem } from "@snap-engine/snapsort";
import {
  prioritizeIntersectingContainer,
  rejectDrop,
} from "@snap-engine/snapsort/callbacks";
import { useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";

function hasMatchingDropGroup(event) {
  const sourceGroup = event.source?.containerMetadata.dropGroup;
  return sourceGroup !== undefined && sourceGroup === event.containerMetadata.dropGroup;
}

const snapSortCubicAnimation = new URLSearchParams(window.location.search).has("slowFlip")
  ? { duration: 800, timing_function: "linear" }
  : { duration: 180, timing_function: "cubic-bezier(0.2, 0, 0, 1)" };

function queryFlag(name) {
  return new URLSearchParams(window.location.search).get(name) === "1";
}

function controlButtonProps(action) {
  return {
    onPointerDown: (event) => event.stopPropagation(),
    onMouseDown: (event) => event.stopPropagation(),
    onMouseUp: (event) => {
      event.preventDefault();
      event.stopPropagation();
      action();
    },
  };
}

function DemoItem({ children, className = "demo-item", itemId, metadata, ...props }) {
  const generatedItemId = useId();
  return (
    <Item className={className} itemId={itemId ?? generatedItemId} metadata={metadata} {...props}>
      {children}
    </Item>
  );
}

function ItemApiEntries() {
  const engine = useSnapSortEngine();
  const container = useContext(ContainerObjectContext);
  const adoptedItemRef = useRef(null);
  const adoptedIdentityRef = useRef(false);
  const generatedItemRef = useRef(null);
  const [showItems, setShowItems] = useState(true);
  const [report, setReport] = useState("ready");
  const [generatedMetadata, setGeneratedMetadata] = useState({ version: 1 });
  const [nativeClicks, setNativeClicks] = useState(0);

  if (!container) {
    throw new Error("Item API fixture must be rendered inside a Container.");
  }
  if (!adoptedItemRef.current) {
    const item = new CoreItem(engine, container);
    item.itemId = "item-api-adopted";
    item.metadata = { origin: "application" };
    item.selected = true;
    adoptedItemRef.current = item;
  }
  const adoptedItem = adoptedItemRef.current;

  const captureGeneratedItem = useCallback((item) => {
    if (item) generatedItemRef.current = item;
  }, []);
  const captureAdoptedItem = useCallback((item) => {
    if (item) adoptedIdentityRef.current = item === adoptedItemRef.current;
  }, []);

  useEffect(
    () => () => {
      adoptedItem.destroy(false);
    },
    [adoptedItem],
  );

  const inspect = () => {
    const generatedItem = generatedItemRef.current;
    setReport(JSON.stringify({
      adoptedBound: adoptedIdentityRef.current && adoptedItem.element !== null,
      adoptedDestroyed: adoptedItem.isDeleteRequested,
      adoptedDetached: adoptedItem.element === null,
      adoptedMetadata: adoptedItem.metadata.origin,
      adoptedParent: adoptedItem.parent === container,
      adoptedSelected: adoptedItem.selected,
      generatedBound: generatedItem !== null && generatedItem.element !== null,
      generatedDestroyed: generatedItem?.isDeleteRequested ?? false,
      generatedMetadata: generatedItem?.metadata.version ?? null,
      generatedParent: generatedItem?.parent === container,
      nativeClicks,
    }));
  };

  return (
    <>
      {showItems && (
        <>
          <Item
            itemId="item-api-generated"
            ref={captureGeneratedItem}
            metadata={generatedMetadata}
            data-testid="item-api-generated"
            aria-label="Generated Item"
            onClick={() => setNativeClicks((count) => count + 1)}
          >
            Generated item
          </Item>
          <Item item={adoptedItem} ref={captureAdoptedItem}>
            Adopted item
          </Item>
        </>
      )}
      <button data-testid="item-api-inspect" onClick={inspect} type="button">
        Inspect items
      </button>
      <button data-testid="item-api-unmount" onClick={() => setShowItems(false)} type="button">
        Unmount items
      </button>
      <button
        data-testid="item-api-replace-metadata"
        onClick={() => setGeneratedMetadata({ version: 2 })}
        type="button"
      >
        Replace metadata
      </button>
      <output data-testid="item-api-report">{report}</output>
    </>
  );
}

function ItemApiFixture() {
  return (
    <section data-testid="item-api-fixture">
      <Engine id="item-api-engine">
        <Container config={{ direction: "column" }}>
          <ItemApiEntries />
        </Container>
      </Engine>
    </section>
  );
}

function useFrameworkGhosts() {
  const [ghosts, setGhosts] = useState([]);

  const onGhostInsert = useCallback((event) => {
    const listId = event.containerMetadata.frameworkList;
    if (typeof listId !== "string") return;
    setGhosts((current) => [
      ...current.filter((entry) => entry.event.ghostItem !== event.ghostItem),
      { event, listId },
    ]);
  }, []);

  const onGhostRemove = useCallback((event) => {
    setGhosts((current) =>
      current.filter((entry) => entry.event.ghostItem !== event.ghostItem),
    );
  }, []);

  const callbacks = useMemo(
    () => ({
      createGhost: () => undefined,
      onGhostInsert,
      onGhostRemove,
    }),
    [onGhostInsert, onGhostRemove],
  );

  const renderWithGhosts = useCallback(
    (listId, items, getItemId, renderItem) => {
      const rendered = items.map((item) => ({
        id: getItemId(item),
        node: renderItem(item),
      }));
      const listGhosts = ghosts
        .filter((entry) => entry.listId === listId)
        .sort((a, b) => a.event.index - b.event.index);

      for (const entry of listGhosts) {
        const draggedIds = new Set(entry.event.itemIds.map(String));
        const coreIndex = Math.max(0, entry.event.index);
        let currentCoreIndex = 0;
        let index = rendered.length;
        for (let candidateIndex = 0; candidateIndex < rendered.length; candidateIndex++) {
          const candidate = rendered[candidateIndex];
          if (draggedIds.has(String(candidate.id))) continue;
          if (currentCoreIndex === coreIndex) {
            index = candidateIndex;
            break;
          }
          currentCoreIndex += 1;
        }
        rendered.splice(index, 0, {
          id: `ghost-${entry.event.ghostItem.id}`,
          node: (
            <Ghost
              className={entry.event.kind === "flow" ? "ghost" : ""}
              event={entry.event}
              key={`ghost-${entry.event.ghostItem.id}`}
            />
          ),
        });
      }
      return rendered.map((entry) => entry.node);
    },
    [ghosts],
  );

  return { callbacks, renderWithGhosts };
}

const websiteLogoSliceCount = 6;
const websiteLogoSliceWidth = 30;
const websiteSidewaysItems = [3, 0, 5, 1, 4, 2].map((slice) => ({
  id: `typescript-slice-${slice}`,
  slice,
  x: `${slice * -websiteLogoSliceWidth}px`,
}));
const websiteParentItems = ["Item 1", "Item 2", "Item 3"];
const websiteNestedItems = ["Item 4", "Item 5", "Item 6"];
const websiteGripDots = Array.from({ length: 6 }, (_, index) => index);
const initialWebsiteMultiContainers = [
  {
    id: "left",
    title: "Left",
    direction: "right",
    items: [
      { id: "mc-spec", label: "Spec" },
      { id: "mc-mockup", label: "Mockup" },
      { id: "mc-build", label: "Build" },
    ],
  },
  {
    id: "right",
    title: "Right",
    direction: "left",
    items: [
      { id: "mc-review", label: "Review" },
      { id: "mc-ship", label: "Ship" },
    ],
  },
];

function cloneWebsiteMultiContainers() {
  return initialWebsiteMultiContainers.map((column) => ({
    ...column,
    items: column.items.map((item) => ({ ...item })),
  }));
}

function WebsiteGrip() {
  return (
    <span className="demo-grip" aria-hidden="true">
      {websiteGripDots.map((dot) => (
        <span data-dot={dot} key={dot} />
      ))}
    </span>
  );
}

function WebsiteRowHandle() {
  return (
    <Handle className="demo-row-handle">
      <WebsiteGrip />
    </Handle>
  );
}

function updateWebsiteSidewaysSolved(containerElement) {
  if (!containerElement) return;

  const order = [...containerElement.querySelectorAll(".logo-slice")].map(
    (slice) => Number(slice.dataset.slice),
  );
  const solved =
    order.length === websiteLogoSliceCount &&
    order.every((slice, index) => slice === index);
  containerElement.classList.toggle("solved", solved);
}

export function SnapSortWebsiteCoreDemo() {
  const columnRefs = useRef(new Map());
  const { callbacks: ghostCallbacks, renderWithGhosts } = useFrameworkGhosts();
  const [sidewaysItems, setSidewaysItems] = useState(websiteSidewaysItems);
  const [nestedZones, setNestedZones] = useState({
    outer: [...websiteParentItems, "nested-group"],
    inner: [...websiteNestedItems],
  });
  const [multiContainers, setMultiContainers] = useState(
    cloneWebsiteMultiContainers,
  );

  const handleSidewaysMove = useCallback((event) => {
    setSidewaysItems((current) => {
      const moved = current.find((item) => item.id === event.itemId);
      if (!moved) return current;
      const next = current.filter((item) => item.id !== event.itemId);
      next.splice(Math.max(0, Math.min(event.to.index, next.length)), 0, moved);
      return next;
    });
    requestAnimationFrame(() => updateWebsiteSidewaysSolved(event.to.container.element));
  }, []);

  const handleNestedMove = useCallback((event) => {
    const target = event.to.containerMetadata.zone;
    if (target !== "outer" && target !== "inner") return;
    setNestedZones((current) => {
      const next = {
        outer: current.outer.filter((id) => id !== event.itemId),
        inner: current.inner.filter((id) => id !== event.itemId),
      };
      next[target].splice(
        Math.max(0, Math.min(event.to.index, next[target].length)),
        0,
        event.itemId,
      );
      return next;
    });
  }, []);

  const moveMultiContainerState = useCallback(
    (itemId, targetColumnId, targetIndex) => {
      setMultiContainers((current) => {
        let movedItem = null;
        const withoutMovedItem = current.map((column) => {
          const sourceIndex = column.items.findIndex(
            (item) => item.id === itemId,
          );
          if (sourceIndex === -1) return column;

          const nextItems = column.items.slice();
          const [item] = nextItems.splice(sourceIndex, 1);
          movedItem = item;
          return { ...column, items: nextItems };
        });

        if (!movedItem) return current;

        return withoutMovedItem.map((column) => {
          if (column.id !== targetColumnId) return column;

          const nextItems = column.items.slice();
          nextItems.splice(
            Math.max(0, Math.min(targetIndex, nextItems.length)),
            0,
            movedItem,
          );
          return { ...column, items: nextItems };
        });
      });
    },
    [],
  );

  const handleMultiContainerMove = useCallback(
    (event) => {
      const itemId = event.itemId;
      const targetColumnId = event.to.containerMetadata.columnId;
      if (typeof itemId !== "string" || typeof targetColumnId !== "string") {
        return;
      }

      moveMultiContainerState(itemId, targetColumnId, event.to.index);
    },
    [moveMultiContainerState],
  );

  const moveItemToOppositeColumn = useCallback(
    (itemId) => {
      const sourceColumnIndex = multiContainers.findIndex((column) =>
        column.items.some((item) => item.id === itemId),
      );
      if (sourceColumnIndex === -1) return;

      const targetColumnIndex = sourceColumnIndex === 0 ? 1 : 0;
      const sourceColumn = multiContainers[sourceColumnIndex];
      const targetColumn = multiContainers[targetColumnIndex];
      const sourceItemIndex = sourceColumn.items.findIndex(
        (item) => item.id === itemId,
      );
      const destinationIndex = Math.min(
        sourceItemIndex,
        targetColumn.items.length,
      );
      const sourceContainer = columnRefs.current.get(sourceColumn.id);
      const targetContainer = columnRefs.current.get(targetColumn.id);
      if (
        sourceContainer &&
        targetContainer &&
        sourceContainer.moveItem(itemId, targetContainer, destinationIndex)
      ) {
        return;
      }

      moveMultiContainerState(itemId, targetColumn.id, destinationIndex);
    },
    [moveMultiContainerState, multiContainers],
  );

  return (
    <div className="snapsort-fixture website-core-demo dev-style">
      <div className="website-core-shell">
        <header className="website-core-intro">
          <h1>Versatile and Extensible</h1>
          <p>
            A wide variety of core components are available out of the box to
            provide building blocks for any type of drag and drop UI.
          </p>
        </header>

        <Engine id="snapsort-website-core-demo-canvas">
          <section
            className="core-demo-grid"
            aria-label="SnapSort website core demos"
          >
            <article className="core-demo-card" data-demo="sideways-list">
              <h2>Sideways list</h2>
              <div className="core-demo-surface sideways-demo-surface card">
                <Container
                  className="sideways-list"
                  config={{
                    animation: defaultAnimations,
                    direction: "row",
                    mainAxisAlign: "center",
                    callbacks: {
                      ...ghostCallbacks,
                      onItemMove: handleSidewaysMove,
                    },
                  }}
                  metadata={{ frameworkList: "website-sideways" }}
                >
                  {renderWithGhosts("website-sideways", sidewaysItems, (item) => item.id, (item) => (
                    <Item itemId={item.id} key={item.id}>
                      <div
                        className="logo-slice"
                        data-slice={item.slice}
                        aria-label={`TypeScript logo slice ${item.slice + 1} of ${websiteLogoSliceCount}`}
                        style={{ "--slice-x": item.x }}
                      />
                    </Item>
                  ))}
                </Container>
              </div>
            </article>

            <article className="core-demo-card" data-demo="nested-list">
              <h2>Nested list</h2>
              <div className="core-demo-surface card">
                <Container
                  className="basic-list bounded-demo-list"
                  config={{
                    animation: defaultAnimations,
                    direction: "column",
                    callbacks: { ...ghostCallbacks, onItemMove: handleNestedMove },
                  }}
                  metadata={{ frameworkList: "website-nested-outer", zone: "outer" }}
                >
                  {renderWithGhosts("website-nested-outer", nestedZones.outer, String, (item) =>
                    item === "nested-group" ? (
                      <Container
                        className="nested-list bounded-demo-list card shallow"
                        config={{
                          animation: defaultAnimations,
                          direction: "column",
                          callbacks: { ...ghostCallbacks, onItemMove: handleNestedMove },
                        }}
                        itemId="nested-group"
                        key="nested-group"
                        locked={false}
                        metadata={{ frameworkList: "website-nested-inner", zone: "inner" }}
                      >
                        <Handle className="demo-container-handle">
                          <WebsiteGrip />
                        </Handle>
                        {renderWithGhosts("website-nested-inner", nestedZones.inner, String, (child) => (
                          <Item itemId={child} key={child}>
                            <div className="basic-row nested-row handle-row">
                              <WebsiteRowHandle />
                              <span>{child}</span>
                            </div>
                          </Item>
                        ))}
                      </Container>
                    ) : (
                      <Item itemId={item} key={item}>
                        <div className="basic-row handle-row">
                          <WebsiteRowHandle />
                          <span>{item}</span>
                        </div>
                      </Item>
                    ),
                  )}
                </Container>
              </div>
            </article>

            <article
              className="core-demo-card"
              data-demo="multiple-containers"
            >
              <h2>Multiple containers</h2>
              <div className="core-demo-surface multi-container-surface">
                <Container
                  className="multi-container-board"
                  config={{
                    animation: defaultAnimations,
                    direction: "row",
                    name: "core-multi-root",
                    callbacks: { canDrop: rejectDrop },
                  }}
                  locked
                >
                  {multiContainers.map((column) => (
                    <Container
                      className="basic-column card"
                      config={{
                        animation: defaultAnimations,
                        direction: "column",
                        name: column.id,
                        callbacks: {
                          ...ghostCallbacks,
                          onItemMove: handleMultiContainerMove,
                        },
                      }}
                      key={column.id}
                      locked
                      metadata={{ columnId: column.id, frameworkList: `website-column-${column.id}` }}
                      ref={(container) => {
                        if (container) columnRefs.current.set(column.id, container);
                      }}
                    >
                      <h3>{column.title}</h3>
                      {renderWithGhosts(`website-column-${column.id}`, column.items, (item) => item.id, (item) => (
                        <Item itemId={item.id} key={item.id}>
                          <div className="basic-row compact-row multi-container-row">
                            <span>{item.label}</span>
                            <button
                              aria-label={`Move ${item.label} to the other column`}
                              className="column-move-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                moveItemToOppositeColumn(item.id);
                              }}
                              onPointerDown={(event) => event.stopPropagation()}
                              type="button"
                            >
                              {column.direction === "right" ? ">" : "<"}
                            </button>
                          </div>
                        </Item>
                      ))}
                    </Container>
                  ))}
                </Container>
              </div>
            </article>
          </section>
        </Engine>
      </div>
    </div>
  );
}

export function DropSnapNestedDemo() {
  const disableNestedFlip = queryFlag("disableNestedFlip");
  const slowNestedFlip = queryFlag("slowNestedFlip");
  const lockNestedChild = queryFlag("lockNestedChild");
  const showCompactNested = queryFlag("compactNested");
  const nestedAnimationConfig = disableNestedFlip
    ? { animation: { reorder: null, drop: null } }
    : slowNestedFlip
      ? {
          animation: {
            reorder: { duration: 800, timing_function: "linear" },
            drop: { duration: 800, timing_function: "linear" },
          },
        }
      : { animation: defaultAnimations };

  const { callbacks: ghostCallbacks, renderWithGhosts } = useFrameworkGhosts();
  const [fixtureLists, setFixtureLists] = useState(() => ({
    vertical: ["vertical-1", "vertical-2", "vertical-3", "vertical-4"],
    horizontal: Array.from({ length: 12 }, (_, index) => `horizontal-${index + 1}`),
    double: Array.from({ length: 28 }, (_, index) => `double-${index + 1}`),
    sizes: ["size-small", "size-medium", "size-wide", "size-tall", "size-large", "size-narrow", "size-extra-wide"],
    "multi-area-1": ["multi-a", "multi-b", "multi-c"],
    "multi-area-2": ["multi-x", "multi-y", "multi-z"],
    "nested-outer": ["item-1", "item-1-5", "nested-sub-group", "item-2", "item-3"],
    "nested-inner": ["sub-a1", "sub-a2", "sub-a3"],
    "stretch-outer": ["stretch-task-1", "stretch-task-2", "stretch-sub-group", "stretch-task-3"],
    "stretch-inner": ["stretch-sub-1", "stretch-sub-2", "stretch-sub-3"],
    "compact-outer": ["compact-overview", "compact-components", "compact-usage", "compact-sub-group"],
    "compact-inner": ["compact-container", "compact-item", "compact-handle"],
    "drag-outer": ["drag-group-1", "drag-group-2", "drag-loose"],
    "drag-group-1": ["drag-group-1-a", "drag-group-1-b"],
    "drag-group-2": ["drag-group-2-a", "drag-group-2-b", "drag-group-2-c"],
    "row-outer": ["row-r1", "row-sub-group", "row-r2", "row-r3"],
    "row-inner": ["row-s1", "row-s2", "row-s3"],
    "layers-outer": ["layer-header", "layer-hero", "layer-card-grid", "layer-footer"],
    "layers-hero": ["layer-avatar", "layer-title", "layer-subtitle"],
  }));
  const [selectedVertical, setSelectedVertical] = useState(() => new Set());
  const nestedLabels = {
    "item-1": "Item 1",
    "item-1-5": "Item 1.5",
    "item-2": "Item 2",
    "item-3": "Item 3",
    "sub-a1": "Sub A1",
    "sub-a2": "Sub A2",
    "sub-a3": "Sub A3",
  };
  const itemLabels = {
    "multi-a": "Item A", "multi-b": "Item B", "multi-c": "Item C",
    "multi-x": "Item X", "multi-y": "Item Y", "multi-z": "Item Z",
    "stretch-task-1": "Task 1", "stretch-task-2": "Task 2", "stretch-task-3": "Task 3",
    "stretch-sub-1": "Sub task 1", "stretch-sub-2": "Sub task 2", "stretch-sub-3": "Sub task 3",
    "compact-overview": "Overview", "compact-components": "Components", "compact-usage": "Usage",
    "compact-container": "Container", "compact-item": "Item", "compact-handle": "Handle",
    "drag-group-1-a": "Group 1 - A", "drag-group-1-b": "Group 1 - B",
    "drag-group-2-a": "Group 2 - A", "drag-group-2-b": "Group 2 - B", "drag-group-2-c": "Group 2 - C",
    "drag-loose": "Loose Item",
    "row-r1": "R1", "row-r2": "R2", "row-r3": "R3",
    "row-s1": "S1", "row-s2": "S2", "row-s3": "S3",
    "layer-header": "Header", "layer-avatar": "Avatar", "layer-title": "Title",
    "layer-subtitle": "Subtitle", "layer-card-grid": "Card Grid", "layer-footer": "Footer",
  };
  const sizes = {
    "size-small": { label: "Small", width: 72, minHeight: 48 },
    "size-medium": { label: "Medium", width: 128, minHeight: 72 },
    "size-wide": { label: "Wide", width: 220, minHeight: 96 },
    "size-tall": { label: "Tall", width: 92, minHeight: 156 },
    "size-large": { label: "Large", width: 168, minHeight: 120 },
    "size-narrow": { label: "Narrow", width: 56, minHeight: 64 },
    "size-extra-wide": { label: "Extra Wide", width: 260, minHeight: 72 },
  };

  const handleFixtureMove = useCallback((event) => {
    const target = event.to.containerMetadata.frameworkList;
    if (typeof target !== "string") return;
    setFixtureLists((current) => {
      if (!Array.isArray(current[target])) return current;
      const movedIds = event.itemIds.map(String);
      const movedSet = new Set(movedIds);
      const next = Object.fromEntries(
        Object.entries(current).map(([key, ids]) => [
          key,
          ids.filter((id) => !movedSet.has(id)),
        ]),
      );
      const targetItems = next[target];
      targetItems.splice(
        Math.max(0, Math.min(event.to.index, targetItems.length)),
        0,
        ...movedIds,
      );
      return next;
    });
  }, []);

  const frameworkCallbacks = useMemo(
    () => ({ ...ghostCallbacks, onItemMove: handleFixtureMove }),
    [ghostCallbacks, handleFixtureMove],
  );

  function toggleVerticalSelection(item, event) {
    setSelectedVertical((current) => {
      if (!event.metaKey && !event.ctrlKey) return new Set([item]);
      const next = new Set(current);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }

  function renderDraggableNestedEntry(itemId) {
    if (itemId === "drag-group-1" || itemId === "drag-group-2") {
      return (
        <Container
          config={{
            animation: defaultAnimations,
            direction: "column",
            callbacks: frameworkCallbacks,
          }}
          itemId={itemId}
          key={itemId}
          locked={false}
          metadata={{ frameworkList: itemId }}
        >
          {renderWithGhosts(
            itemId,
            fixtureLists[itemId],
            String,
            renderDraggableNestedEntry,
          )}
        </Container>
      );
    }

    return (
      <DemoItem
        className={itemId.startsWith("drag-group-") ? "demo-item sub-item" : "demo-item"}
        itemId={itemId}
        key={itemId}
      >
        <p>{itemLabels[itemId]}</p>
      </DemoItem>
    );
  }

  return (
    <div className="snapsort-fixture snapsort-demo dev-style">
      <h1>SnapSort</h1>
      <div className="snapsort-shell">
        <div className="engine-area">
          <Engine id="snapsort-combined-demo-canvas">
            <div className="demo-grid">
              <article className="demo-cell wide horizontal-row-demo">
                <h2>Vertical Column</h2>
                <p className="demo-hint">Cmd/ctrl-click to multi-select, then drag any selected item.</p>
                <Container
                  config={{ animation: defaultAnimations, direction: "column", callbacks: frameworkCallbacks }}
                  metadata={{ frameworkList: "vertical" }}
                >
                  {renderWithGhosts("vertical", fixtureLists.vertical, String, (itemId) => (
                    <DemoItem
                      className={selectedVertical.has(itemId) ? "demo-item selected" : "demo-item"}
                      itemId={itemId}
                      key={itemId}
                      onClick={(event) => toggleVerticalSelection(itemId, event)}
                      selected={selectedVertical.has(itemId)}
                    >
                      <p>Item {itemId.replace("vertical-", "")}</p>
                    </DemoItem>
                  ))}
                </Container>
              </article>

              <article className="demo-cell">
                <h2>Horizontal Row</h2>
                <Container
                  config={{ animation: defaultAnimations, direction: "row", callbacks: frameworkCallbacks }}
                  locked
                  metadata={{ frameworkList: "horizontal" }}
                >
                  {renderWithGhosts("horizontal", fixtureLists.horizontal, String, (itemId) => (
                    <DemoItem className="demo-item row-item" itemId={itemId} key={itemId}>
                      <p>Item {itemId.replace("horizontal-", "")}</p>
                    </DemoItem>
                  ))}
                </Container>
              </article>

              <article className="demo-cell wide">
                <h2>Horizontal Double Row</h2>
                <Container
                  config={{ animation: defaultAnimations, direction: "row", callbacks: frameworkCallbacks }}
                  metadata={{ frameworkList: "double" }}
                >
                  {renderWithGhosts("double", fixtureLists.double, String, (itemId) => (
                    <DemoItem className="demo-item row-item" itemId={itemId} key={itemId}>
                      <p>Item {itemId.replace("double-", "")}</p>
                    </DemoItem>
                  ))}
                </Container>
              </article>

              <article className="demo-cell wide size-demo">
                <h2>Different Sizes</h2>
                <Container
                  config={{ animation: defaultAnimations, direction: "row", callbacks: frameworkCallbacks }}
                  metadata={{ frameworkList: "sizes" }}
                >
                  {renderWithGhosts("sizes", fixtureLists.sizes, String, (itemId) => {
                    const entry = sizes[itemId];
                    return (
                      <DemoItem className="demo-item size-item" itemId={itemId} key={itemId}>
                        <p style={{ width: entry.width, minHeight: entry.minHeight }}>{entry.label}</p>
                      </DemoItem>
                    );
                  })}
                </Container>
              </article>

              <article className="demo-cell">
                <h2>Multiple Drop Areas</h2>
                <Container
                  config={{
                    animation: defaultAnimations,
                    direction: "row",
                    name: "multi-root",
                    callbacks: { canDrop: rejectDrop },
                  }}
                  locked
                >
                  <Container
                    config={{ animation: defaultAnimations, direction: "column", name: "multi-area-1", callbacks: frameworkCallbacks }}
                    locked
                    metadata={{ frameworkList: "multi-area-1" }}
                  >
                    <h3>Area 1</h3>
                    {renderWithGhosts("multi-area-1", fixtureLists["multi-area-1"], String, (itemId) => (
                      <DemoItem itemId={itemId} key={itemId}><p>{itemLabels[itemId]}</p></DemoItem>
                    ))}
                  </Container>
                  <Container
                    config={{ animation: defaultAnimations, direction: "column", name: "multi-area-2", callbacks: frameworkCallbacks }}
                    locked
                    metadata={{ frameworkList: "multi-area-2" }}
                  >
                    <h3>Area 2</h3>
                    {renderWithGhosts("multi-area-2", fixtureLists["multi-area-2"], String, (itemId) => (
                      <DemoItem itemId={itemId} key={itemId}><p>{itemLabels[itemId]}</p></DemoItem>
                    ))}
                  </Container>
                </Container>
              </article>

              <article className="demo-cell">
                <h2>Nested Container</h2>
                <Container
                  config={{ direction: "column", callbacks: frameworkCallbacks, ...nestedAnimationConfig }}
                  locked
                  metadata={{ frameworkList: "nested-outer" }}
                >
                  {renderWithGhosts("nested-outer", fixtureLists["nested-outer"], String, (id) =>
                    id === "nested-sub-group" ? (
                      <Container
                        config={{ direction: "column", callbacks: frameworkCallbacks, ...nestedAnimationConfig }}
                        itemId={id}
                        key={id}
                        locked={lockNestedChild}
                        metadata={{ frameworkList: "nested-inner" }}
                      >
                        {renderWithGhosts("nested-inner", fixtureLists["nested-inner"], String, (childId) => (
                          <DemoItem className="demo-item sub-item" itemId={childId} key={childId}>
                            <p>{nestedLabels[childId]}</p>
                          </DemoItem>
                        ))}
                      </Container>
                    ) : (
                      <DemoItem itemId={id} key={id}><p>{nestedLabels[id]}</p></DemoItem>
                    ),
                  )}
                </Container>
              </article>

              <article className="demo-cell stretch-nested-demo">
                <h2>Stretch Nested</h2>
                <p className="demo-hint">Items fill their container (100% width); the nested list is narrower.</p>
                <Container
                  className="stretch-list"
                  config={{ direction: "column", wrap: "nowrap", stretchItems: true, callbacks: frameworkCallbacks, ...nestedAnimationConfig }}
                  locked
                  metadata={{ frameworkList: "stretch-outer" }}
                >
                  {renderWithGhosts("stretch-outer", fixtureLists["stretch-outer"], String, (itemId) =>
                    itemId === "stretch-sub-group" ? (
                      <Container
                        className="stretch-sublist"
                        config={{ direction: "column", wrap: "nowrap", stretchItems: true, callbacks: frameworkCallbacks, ...nestedAnimationConfig }}
                        itemId={itemId}
                        key={itemId}
                        metadata={{ frameworkList: "stretch-inner" }}
                      >
                        {renderWithGhosts("stretch-inner", fixtureLists["stretch-inner"], String, (childId) => (
                          <DemoItem className="demo-item stretch-item" itemId={childId} key={childId}>
                            <p>{itemLabels[childId]}</p>
                          </DemoItem>
                        ))}
                      </Container>
                    ) : (
                      <DemoItem className="demo-item stretch-item" itemId={itemId} key={itemId}>
                        <p>{itemLabels[itemId]}</p>
                      </DemoItem>
                    ),
                  )}
                </Container>
              </article>

              {showCompactNested ? (
                <article className="demo-cell compact-nested-demo">
                  <h2>Compact Nested List</h2>
                  <Container
                    className="compact-basic-list"
                    config={{ direction: "column", callbacks: frameworkCallbacks, ...nestedAnimationConfig }}
                    metadata={{ frameworkList: "compact-outer" }}
                  >
                    {renderWithGhosts("compact-outer", fixtureLists["compact-outer"], String, (itemId) =>
                      itemId === "compact-sub-group" ? (
                        <Container
                          className="compact-nested-list"
                          config={{ direction: "column", callbacks: frameworkCallbacks, ...nestedAnimationConfig }}
                          itemId={itemId}
                          key={itemId}
                          metadata={{ frameworkList: "compact-inner" }}
                        >
                          {renderWithGhosts("compact-inner", fixtureLists["compact-inner"], String, (childId) => (
                            <DemoItem className="compact-item" itemId={childId} key={childId}>
                              <p>{itemLabels[childId]}</p>
                            </DemoItem>
                          ))}
                        </Container>
                      ) : (
                        <DemoItem className="compact-item" itemId={itemId} key={itemId}>
                          <p>{itemLabels[itemId]}</p>
                        </DemoItem>
                      ),
                    )}
                  </Container>
                </article>
              ) : null}

              <article className="demo-cell">
                <h2>Draggable Sub-Containers</h2>
                <Container
                  config={{ animation: defaultAnimations, direction: "column", callbacks: frameworkCallbacks }}
                  locked
                  metadata={{ frameworkList: "drag-outer" }}
                >
                  {renderWithGhosts(
                    "drag-outer",
                    fixtureLists["drag-outer"],
                    String,
                    renderDraggableNestedEntry,
                  )}
                </Container>
              </article>

              <article className="demo-cell">
                <h2>Nested Row Groups</h2>
                <Container
                  config={{ animation: defaultAnimations, direction: "row", callbacks: frameworkCallbacks }}
                  locked
                  metadata={{ frameworkList: "row-outer" }}
                >
                  {renderWithGhosts("row-outer", fixtureLists["row-outer"], String, (itemId) =>
                    itemId === "row-sub-group" ? (
                      <Container
                        config={{ animation: defaultAnimations, direction: "row", callbacks: frameworkCallbacks }}
                        itemId={itemId}
                        key={itemId}
                        locked={false}
                        metadata={{ frameworkList: "row-inner" }}
                      >
                        {renderWithGhosts("row-inner", fixtureLists["row-inner"], String, (childId) => (
                          <DemoItem className="demo-item row-item sub-item" itemId={childId} key={childId}>
                            <p>{itemLabels[childId]}</p>
                          </DemoItem>
                        ))}
                      </Container>
                    ) : (
                      <DemoItem className="demo-item row-item" itemId={itemId} key={itemId}>
                        <p>{itemLabels[itemId]}</p>
                      </DemoItem>
                    ),
                  )}
                </Container>
              </article>

              <article className="demo-cell">
                <h2>Layers Panel</h2>
                <Container
                  config={{ animation: defaultAnimations, direction: "column", callbacks: frameworkCallbacks }}
                  locked
                  metadata={{ frameworkList: "layers-outer" }}
                >
                  {renderWithGhosts("layers-outer", fixtureLists["layers-outer"], String, (itemId) =>
                    itemId === "layer-hero" ? (
                      <Container
                        config={{ animation: defaultAnimations, direction: "column", callbacks: frameworkCallbacks }}
                        itemId={itemId}
                        key={itemId}
                        locked={false}
                        metadata={{ frameworkList: "layers-hero" }}
                      >
                        <div className="group-label">Hero Section</div>
                        {renderWithGhosts("layers-hero", fixtureLists["layers-hero"], String, (childId) => (
                          <DemoItem className="layer-item" itemId={childId} key={childId}>
                            <div className="layer-row">
                              <span className="layer-icon">{childId === "layer-avatar" ? "○" : "T"}</span>
                              <span>{itemLabels[childId]}</span>
                            </div>
                          </DemoItem>
                        ))}
                      </Container>
                    ) : (
                      <DemoItem className="layer-item" itemId={itemId} key={itemId}>
                        <div className="layer-row"><span className="layer-icon">&#x25FB;</span><span>{itemLabels[itemId]}</span></div>
                      </DemoItem>
                    ),
                  )}
                </Container>
              </article>
            </div>
          </Engine>
        </div>
      </div>
    </div>
  );
}

const initialColumns = [
  {
    id: "backlog",
    title: "Backlog",
    items: [
      { id: "item-1", label: "Profile fields", detail: "Account settings" },
      { id: "item-2", label: "Invite flow", detail: "Workspace setup" },
      { id: "item-3", label: "Audit log", detail: "Admin tools" },
      { id: "item-4", label: "Search filters", detail: "Results page" },
    ],
  },
  {
    id: "active",
    title: "Active",
    items: [{ id: "item-5", label: "Board polish", detail: "Column controls" }],
  },
  {
    id: "done",
    title: "Done",
    items: [{ id: "item-6", label: "Audit export", detail: "CSV polish" }],
  },
];

const progressiveExamples = [
  {
    id: "morning-brief",
    prompt: "Build the sentence: The product designer rewrote the onboarding checklist.",
    answerTiles: [
      { id: "morning-brief-answer-the", text: "The" },
      { id: "morning-brief-answer-product-designer", text: "product designer" },
      { id: "morning-brief-answer-rewrote", text: "rewrote" },
    ],
    bankTiles: [
      { id: "morning-brief-bank-checklist", text: "the onboarding checklist" },
      { id: "morning-brief-bank-quietly", text: "quietly" },
      { id: "morning-brief-bank-before-lunch", text: "before lunch" },
    ],
  },
];

function cloneProgressiveExamples() {
  return progressiveExamples.map((example) => ({
    ...example,
    answerTiles: example.answerTiles.map((tile) => ({ ...tile })),
    bankTiles: example.bankTiles.map((tile) => ({ ...tile })),
  }));
}

function cloneColumns() {
  return initialColumns.map((column) => ({
    ...column,
    items: column.items.map((item) => ({ ...item })),
  }));
}

export function SnapSortComponentsDemo() {
  const containerRefs = useRef(new Map());
  const {
    callbacks: progressiveGhostCallbacks,
    renderWithGhosts: renderProgressiveWithGhosts,
  } = useFrameworkGhosts();
  const [columns, setColumns] = useState(cloneColumns);
  const [progressiveExampleState, setProgressiveExampleState] = useState(
    cloneProgressiveExamples,
  );
  const [nextItemNumber, setNextItemNumber] = useState(7);
  const [ghostEntry, setGhostEntry] = useState(null);
  const [boardVersion, setBoardVersion] = useState(0);
  const itemCount = columns.reduce(
    (total, column) => total + column.items.length,
    0,
  );

  const findDemoItem = useCallback(
    (itemId) => {
      for (const column of columns) {
        const item = column.items.find((candidate) => candidate.id === itemId);
        if (item) return item;
      }
      return null;
    },
    [columns],
  );

  const deleteItem = useCallback((itemId) => {
    setGhostEntry(null);
    setColumns((current) =>
      current.map((column) => ({
        ...column,
        items: column.items.filter((item) => item.id !== itemId),
      })),
    );
  }, []);

  const handleMove = useCallback((event) => {
    const itemId = event.itemId;
    const targetColumnId = event.to.containerMetadata.columnId;
    if (typeof itemId !== "string" || typeof targetColumnId !== "string") return;

    setColumns((current) => {
      let movedItem = null;
      const withoutMovedItem = current.map((column) => {
        const sourceIndex = column.items.findIndex((item) => item.id === itemId);
        if (sourceIndex === -1) return column;
        const nextItems = column.items.slice();
        const [item] = nextItems.splice(sourceIndex, 1);
        movedItem = item;
        return { ...column, items: nextItems };
      });

      if (!movedItem) {
        const { label, detail } = event.itemMetadata;
        if (typeof label !== "string" || typeof detail !== "string") {
          return current;
        }
        movedItem = { id: itemId, label, detail };
      }

      return withoutMovedItem.map((column) => {
        if (column.id !== targetColumnId) return column;
        const nextItems = column.items.slice();
        nextItems.splice(
          Math.max(0, Math.min(event.to.index, nextItems.length)),
          0,
          movedItem,
        );
        return { ...column, items: nextItems };
      });
    });
  }, []);

  const handleRemove = useCallback((event) => {
    const itemId = event.itemId;
    if (typeof itemId !== "string") return;
    deleteItem(itemId);
  }, [deleteItem]);

  const handleGhostInsert = useCallback((event) => {
    const itemId = event.originalItemId;
    const targetColumnId = event.containerMetadata.columnId;
    if (typeof itemId !== "string" || typeof targetColumnId !== "string") return;
    const sourceItem = findDemoItem(itemId);
    setGhostEntry({
      event,
      id: `ghost-${event.ghostItem.id}`,
      isGhost: true,
      columnId: targetColumnId,
      index: event.index,
      originalItemId: itemId,
      ghostItem: event.ghostItem,
      label: sourceItem?.label ?? "",
      detail: sourceItem?.detail ?? "",
    });
  }, [findDemoItem]);

  const handleGhostRemove = useCallback((event) => {
    setGhostEntry((current) =>
      current?.ghostItem === event.ghostItem ? null : current,
    );
  }, []);

  const callbacks = useMemo(
    () => ({
      onItemMove: handleMove,
      onItemRemove: handleRemove,
      onGhostInsert: handleGhostInsert,
      onGhostRemove: handleGhostRemove,
      createGhost: () => undefined,
    }),
    [
      handleGhostInsert,
      handleGhostRemove,
      handleMove,
      handleRemove,
    ],
  );

  const handleProgressiveMove = useCallback((event) => {
    const exampleId = event.to.containerMetadata.exampleId;
    const targetZone = event.to.containerMetadata.zone;
    if (
      typeof exampleId !== "string" ||
      (targetZone !== "answer" && targetZone !== "bank")
    ) {
      return;
    }

    setProgressiveExampleState((current) =>
      current.map((example) => {
        if (example.id !== exampleId) return example;

        const movedIds = event.itemIds.map(String);
        const tilesById = new Map(
          [...example.answerTiles, ...example.bankTiles].map((tile) => [
            tile.id,
            tile,
          ]),
        );
        const movedTiles = movedIds
          .map((itemId) => tilesById.get(itemId))
          .filter(Boolean);
        if (movedTiles.length !== movedIds.length) return example;

        const movedIdSet = new Set(movedIds);
        const answerTiles = example.answerTiles.filter(
          (tile) => !movedIdSet.has(tile.id),
        );
        const bankTiles = example.bankTiles.filter(
          (tile) => !movedIdSet.has(tile.id),
        );
        const targetTiles = targetZone === "answer" ? answerTiles : bankTiles;
        targetTiles.splice(
          Math.max(0, Math.min(event.to.index, targetTiles.length)),
          0,
          ...movedTiles,
        );
        return { ...example, answerTiles, bankTiles };
      }),
    );
  }, []);

  const progressiveCallbacks = useMemo(
    () => ({
      ...progressiveGhostCallbacks,
      canDrop: hasMatchingDropGroup,
      getDropPriority: prioritizeIntersectingContainer,
      onItemMove: handleProgressiveMove,
    }),
    [handleProgressiveMove, progressiveGhostCallbacks],
  );

  const renderedColumnItems = useCallback(
    (column) => {
      const rendered = column.items.map((item) => ({ isGhost: false, item }));
      if (ghostEntry?.columnId !== column.id) return rendered;
      const coreIndex = Math.max(0, Math.min(ghostEntry.index, rendered.length));
      const originalIndex = ghostEntry.originalItemId
        ? column.items.findIndex((item) => item.id === ghostEntry.originalItemId)
        : -1;
      rendered.splice(
        originalIndex !== -1 && originalIndex <= coreIndex
          ? coreIndex + 1
          : coreIndex,
        0,
        ghostEntry,
      );
      return rendered;
    },
    [ghostEntry],
  );

  const addItem = useCallback(() => {
    setGhostEntry(null);
    setColumns((current) =>
      current.map((column, index) =>
        index === 0
          ? {
              ...column,
              items: [
                ...column.items,
                {
                  id: `item-${nextItemNumber}`,
                  label: `Task ${nextItemNumber}`,
                  detail: "Added from array state",
                },
              ],
            }
          : column,
      ),
    );
    setNextItemNumber((value) => value + 1);
  }, [nextItemNumber]);

  const resetItems = useCallback(() => {
    containerRefs.current.clear();
    setNextItemNumber(7);
    setGhostEntry(null);
    setColumns(cloneColumns());
    setBoardVersion((version) => version + 1);
  }, []);

  const moveItemAcrossColumns = useCallback(
    (itemId, direction) => {
      const sourceColumnIndex = columns.findIndex((column) =>
        column.items.some((item) => item.id === itemId),
      );
      const targetColumnIndex = sourceColumnIndex + direction;
      if (
        sourceColumnIndex === -1 ||
        targetColumnIndex < 0 ||
        targetColumnIndex >= columns.length
      ) {
        return;
      }

      const sourceItemIndex = columns[sourceColumnIndex].items.findIndex(
        (item) => item.id === itemId,
      );
      const sourceContainer = containerRefs.current.get(
        columns[sourceColumnIndex].id,
      );
      const targetContainer = containerRefs.current.get(
        columns[targetColumnIndex].id,
      );
      const destinationIndex = Math.min(
        sourceItemIndex,
        columns[targetColumnIndex].items.length,
      );
      if (
        sourceContainer &&
        targetContainer &&
        sourceContainer.moveItem(itemId, targetContainer, destinationIndex)
      ) {
        return;
      }

      const movedItem = columns[sourceColumnIndex].items[sourceItemIndex];
      setColumns((current) =>
        current.map((column, columnIndex) => {
          if (columnIndex === sourceColumnIndex) {
            return {
              ...column,
              items: column.items.filter((item) => item.id !== itemId),
            };
          }
          if (columnIndex === targetColumnIndex) {
            const nextItems = column.items.slice();
            nextItems.splice(destinationIndex, 0, movedItem);
            return { ...column, items: nextItems };
          }
          return column;
        }),
      );
    },
    [columns],
  );

  useEffect(() => {
    window.__snapsortMoveComponentItem = moveItemAcrossColumns;
    return () => {
      delete window.__snapsortMoveComponentItem;
    };
  }, [moveItemAcrossColumns]);

  return (
    <div className="snapsort-fixture components-demo">
      {queryFlag("itemApi") && <ItemApiFixture />}
      <header className="demo-header">
        <div>
          <h1>SnapSort Components</h1>
          <p>{itemCount} Euclidean cards plus Progressive sentence demos</p>
        </div>
      </header>

      <section className="algorithm-panel kanban-panel">
        <div className="section-heading">
          <h2>Euclidean drag and drop</h2>
          <p>Array-backed board with column and item reordering.</p>
        </div>
        <div className="kanban-demo-shell">
          <div className="toolbar">
            <button onClick={addItem} type="button">Add Item</button>
            <button onClick={resetItems} type="button">Reset</button>
          </div>
          <div className="engine-area" key={boardVersion}>
            <Engine id="snapsort-components-demo-canvas">
              <div className="board-frame">
                <Container
                  className="board"
                  config={{
                    animation: defaultAnimations,
                    direction: "row",
                    name: "component-kanban-root",
                    callbacks: { canDrop: rejectDrop },
                  }}
                  locked
                  metadata={{ boardId: "component-kanban" }}
                >
                  {columns.map((column) => (
                    <Container
                      className={column.id === "backlog" ? "list-panel array-list" : "list-panel"}
                      config={{
                        direction: "column",
                        name: `component-${column.id}`,
                        animation: {
                          reorder: snapSortCubicAnimation,
                          drop: snapSortCubicAnimation,
                          clickMove: snapSortCubicAnimation,
                        },
                        callbacks,
                      }}
                      key={column.id}
                      locked
                      metadata={{ columnId: column.id }}
                      ref={(container) => {
                        if (container) containerRefs.current.set(column.id, container);
                      }}
                    >
                      <div className="list-header">
                        <h2>{column.title}</h2>
                        <span>{column.items.length}</span>
                      </div>
                      {renderedColumnItems(column).map((entry) =>
                        entry.isGhost ? (
                          <Ghost
                            className="task-card ghost task-ghost"
                            event={entry.event}
                            key={entry.id}
                          >
                            <TaskContent label={entry.label} detail={entry.detail} />
                          </Ghost>
                        ) : (
                          <Item
                            className="task-card"
                            itemId={entry.item.id}
                            key={entry.item.id}
                            metadata={{
                              label: entry.item.label,
                              detail: entry.item.detail,
                            }}
                          >
                            <TaskContent
                              actions={
                                <div className="card-actions">
                                  <button
                                    aria-label={`Delete ${entry.item.label}`}
                                    className="icon-button"
                                    type="button"
                                    {...controlButtonProps(() => deleteItem(entry.item.id))}
                                  >
                                    delete
                                  </button>
                                  <button
                                    aria-label={`Move ${entry.item.label} left`}
                                    className="icon-button"
                                    disabled={columns.findIndex((candidate) => candidate.id === column.id) === 0}
                                    type="button"
                                    {...controlButtonProps(() => moveItemAcrossColumns(entry.item.id, -1))}
                                  >
                                    left
                                  </button>
                                  <button
                                    aria-label={`Move ${entry.item.label} right`}
                                    className="icon-button"
                                    disabled={columns.findIndex((candidate) => candidate.id === column.id) === columns.length - 1}
                                    type="button"
                                    {...controlButtonProps(() => moveItemAcrossColumns(entry.item.id, 1))}
                                  >
                                    right
                                  </button>
                                </div>
                              }
                              detail={entry.item.detail}
                              handle
                              label={entry.item.label}
                            />
                          </Item>
                        ),
                      )}
                    </Container>
                  ))}
                </Container>
              </div>
            </Engine>
          </div>
        </div>
      </section>

      <div className="advanced-demo-grid">
        <section className="algorithm-panel">
          <div className="section-heading">
            <h2>Progressive drag and drop</h2>
            <p>Sentence-builder layouts using varied tile widths and wrapping rows.</p>
          </div>
          <Engine id="snapsort-progressive-components-demo-canvas">
            <Container
              className="progressive-root"
              config={{
                animation: defaultAnimations,
                direction: "column",
                mode: "progressive",
                name: "progressive-components-root",
                callbacks: { canDrop: rejectDrop },
              }}
              locked
              metadata={{ boardId: "progressive-components" }}
            >
              {progressiveExampleState.map((example) => (
                <Container
                  className="progressive-example"
                  config={{
                    animation: defaultAnimations,
                    direction: "column",
                    mode: "progressive",
                    name: `progressive-example-${example.id}`,
                    callbacks: { canDrop: rejectDrop },
                  }}
                  key={example.id}
                  locked
                  metadata={{ exampleId: example.id }}
                >
                  <div className="progressive-prompt"><span>{example.prompt}</span></div>
                  <Container
                    className="sentence-answer-line"
                    config={{
                      direction: "row",
                      mode: "progressive",
                      name: `progressive-answer-${example.id}`,
                      animation: { reorder: snapSortCubicAnimation, drop: snapSortCubicAnimation },
                      callbacks: progressiveCallbacks,
                    }}
                    locked
                    metadata={{
                      zone: "answer",
                      exampleId: example.id,
                      dropGroup: `progressive-${example.id}`,
                      frameworkList: `progressive-${example.id}-answer`,
                    }}
                  >
                    {renderProgressiveWithGhosts(
                      `progressive-${example.id}-answer`,
                      example.answerTiles,
                      (tile) => tile.id,
                      (tile) => (
                        <Item className="sentence-tile-wrapper" itemId={tile.id} key={tile.id}>
                          <button className="sentence-tile" type="button">{tile.text}</button>
                        </Item>
                      ),
                    )}
                  </Container>
                  <Container
                    className="sentence-bank-line"
                    config={{
                      direction: "row",
                      mode: "progressive",
                      name: `progressive-bank-${example.id}`,
                      animation: { reorder: snapSortCubicAnimation, drop: snapSortCubicAnimation },
                      callbacks: progressiveCallbacks,
                    }}
                    locked
                    metadata={{
                      zone: "bank",
                      exampleId: example.id,
                      dropGroup: `progressive-${example.id}`,
                      frameworkList: `progressive-${example.id}-bank`,
                    }}
                  >
                    {renderProgressiveWithGhosts(
                      `progressive-${example.id}-bank`,
                      example.bankTiles,
                      (tile) => tile.id,
                      (tile) => (
                        <Item className="sentence-tile-wrapper" itemId={tile.id} key={tile.id}>
                          <button className="sentence-tile muted" type="button">{tile.text}</button>
                        </Item>
                      ),
                    )}
                  </Container>
                </Container>
              ))}
            </Container>
          </Engine>
        </section>
        <section className="algorithm-panel">
          <div className="section-heading">
            <h2>Progressive sentence builder</h2>
            <p>Interactive Duolingo-style component demo with click moves and validation.</p>
          </div>
          <SnapSortDuolingoDemo embedded />
        </section>
      </div>
    </div>
  );
}

function TaskContent({ actions = null, detail, handle = false, label }) {
  return (
    <div className="task-content">
      {handle ? (
        <Handle className="task-drag-handle">
          <span aria-hidden="true">::</span>
        </Handle>
      ) : null}
      <div className="task-main">
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
      {actions}
    </div>
  );
}

const exercise = {
  english: "I drink water every morning.",
  target: "私は毎朝水を飲みます",
  tiles: ["私", "は", "毎朝", "水", "を", "飲みます"],
};

function toTileData(texts) {
  return texts.map((text, index) => ({
    id: `tile-${index}`,
    text,
    originalIndex: index,
  }));
}

export function SnapSortDuolingoDemo({ embedded = false }) {
  const answerRef = useRef(null);
  const bankRef = useRef(null);
  const pointerStartRef = useRef(null);
  const pendingRemovedTileRef = useRef(null);
  const suppressTileClickRef = useRef(false);
  const [tileState, setTileState] = useState(() => ({
    answerTiles: [],
    bankTiles: toTileData(exercise.tiles),
  }));
  const [ghostEntry, setGhostEntry] = useState(null);
  const [result, setResult] = useState(null);
  const [lookupTarget, setLookupTarget] = useState(null);
  const { answerTiles, bankTiles } = tileState;

  const allTiles = useMemo(
    () => [...answerTiles, ...bankTiles],
    [answerTiles, bankTiles],
  );

  const updateTileZone = useCallback((tileId, targetZone, targetIndex) => {
    setGhostEntry(null);
    setResult(null);
    setTileState((current) => {
      const all = [...current.answerTiles, ...current.bankTiles];
      const movedTile =
        all.find((tile) => tile.id === tileId) ??
        pendingRemovedTileRef.current;
      if (!movedTile) return current;
      pendingRemovedTileRef.current = null;

      const nextAnswer = current.answerTiles.filter((tile) => tile.id !== tileId);
      const nextBank = current.bankTiles.filter((tile) => tile.id !== tileId);
      const targetTiles = targetZone === "answer" ? nextAnswer : nextBank;
      targetTiles.splice(
        Math.max(0, Math.min(targetIndex, targetTiles.length)),
        0,
        movedTile,
      );
      return {
        answerTiles: nextAnswer,
        bankTiles: nextBank,
      };
    });
  }, []);

  const containerForZone = useCallback(
    (zone) => (zone === "answer" ? answerRef.current : bankRef.current),
    [],
  );

  const moveTileToZone = useCallback(
    (tile, targetZone) => {
      const sourceZone = answerTiles.some((candidate) => candidate.id === tile.id)
        ? "answer"
        : "bank";
      const sourceContainer = containerForZone(sourceZone);
      const targetContainer = containerForZone(targetZone);
      const fallbackIndex =
        targetZone === "answer" ? answerTiles.length : bankTiles.length;
      if (
        sourceContainer &&
        targetContainer &&
        sourceContainer.moveItem(tile.id, targetContainer, fallbackIndex)
      ) {
        return;
      }
      updateTileZone(tile.id, targetZone, fallbackIndex);
    },
    [answerTiles, bankTiles, containerForZone, updateTileZone],
  );

  const handleMove = useCallback((event) => {
    const itemId = event.itemId;
    const targetZone = event.to.containerMetadata.zone;
    if (
      typeof itemId !== "string" ||
      (targetZone !== "answer" && targetZone !== "bank")
    ) {
      return;
    }
    updateTileZone(itemId, targetZone, event.to.index);
  }, [updateTileZone]);

  const handleRemove = useCallback((event) => {
    const itemId = event.itemId;
    if (typeof itemId !== "string") return;
    setTileState((current) => {
      pendingRemovedTileRef.current =
        [...current.answerTiles, ...current.bankTiles].find(
          (tile) => tile.id === itemId,
        ) ?? null;
      return {
        answerTiles: current.answerTiles.filter((tile) => tile.id !== itemId),
        bankTiles: current.bankTiles.filter((tile) => tile.id !== itemId),
      };
    });
  }, []);

  const handleGhostInsert = useCallback((event) => {
    const itemId = event.originalItemId;
    const targetZone = event.containerMetadata.zone;
    if (
      typeof itemId !== "string" ||
      (targetZone !== "answer" && targetZone !== "bank")
    ) {
      return;
    }
    const sourceTile = allTiles.find((tile) => tile.id === itemId);
    setGhostEntry({
      event,
      id: `ghost-${event.ghostItem.id}`,
      isGhost: true,
      zone: targetZone,
      index: event.index,
      originalItemId: itemId,
      ghostItem: event.ghostItem,
      text: sourceTile?.text ?? "",
    });
  }, [allTiles]);

  const handleGhostRemove = useCallback((event) => {
    setGhostEntry((current) =>
      current?.ghostItem === event.ghostItem ? null : current,
    );
  }, []);

  const callbacks = useMemo(
    () => ({
      getDropPriority: prioritizeIntersectingContainer,
      onItemMove: handleMove,
      onItemRemove: handleRemove,
      onGhostInsert: handleGhostInsert,
      onGhostRemove: handleGhostRemove,
      createGhost: () => undefined,
    }),
    [
      handleGhostInsert,
      handleGhostRemove,
      handleMove,
      handleRemove,
    ],
  );

  const renderedTiles = useCallback(
    (zone) => {
      const sourceTiles = zone === "answer" ? answerTiles : bankTiles;
      const rendered = sourceTiles.map((tile) => ({ isGhost: false, tile }));
      if (ghostEntry?.zone !== zone) return rendered;
      const coreIndex = Math.max(0, Math.min(ghostEntry.index, rendered.length));
      const originalIndex = ghostEntry.originalItemId
        ? sourceTiles.findIndex((tile) => tile.id === ghostEntry.originalItemId)
        : -1;
      rendered.splice(
        originalIndex !== -1 && originalIndex <= coreIndex
          ? coreIndex + 1
          : coreIndex,
        0,
        ghostEntry,
      );
      return rendered;
    },
    [answerTiles, bankTiles, ghostEntry],
  );

  const tilePointerDown = (event) => {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    suppressTileClickRef.current = false;
  };
  const tilePointerMove = (event) => {
    const start = pointerStartRef.current;
    if (!start) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 3) {
      suppressTileClickRef.current = true;
    }
  };
  const tileClick = (event, action) => {
    if (suppressTileClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressTileClickRef.current = false;
      pointerStartRef.current = null;
      return;
    }
    action();
    suppressTileClickRef.current = false;
    pointerStartRef.current = null;
  };

  const resetTiles = () => {
    setGhostEntry(null);
    pendingRemovedTileRef.current = null;
    setTileState({
      answerTiles: [],
      bankTiles: toTileData(exercise.tiles),
    });
    setResult(null);
  };

  const checkAnswer = () => {
    if (answerTiles.length === 0) return;
    const answer = answerTiles.map((tile) => tile.text).join("");
    setResult({ correct: answer === exercise.target, expected: exercise.target });
  };

  const tileButtonProps = (entry, targetZone, selected = false) => ({
    "aria-label": entry.tile.text,
    className: selected ? "tile selected" : "tile",
    onClick: (event) =>
      tileClick(event, () => moveTileToZone(entry.tile, targetZone)),
    onDoubleClick: () =>
      setLookupTarget(entry.tile.text.replace(/[.,!?]/g, "").trim()),
    onKeyDown: (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      moveTileToZone(entry.tile, targetZone);
    },
    onPointerDown: tilePointerDown,
    onPointerMove: tilePointerMove,
    title: targetZone === "answer" ? "Click to add" : "Click to remove",
    type: "button",
  });

  return (
    <div className={`snapsort-fixture game-demo${embedded ? " embedded" : ""}`}>
      <main>
        <section className="prompt">
          <p className="label">Translate this sentence:</p>
          <p className="english">{exercise.english}</p>
        </section>
        <div className="snapsort-engine" data-lang="ja">
          <Engine id="sentence-builder-snapsort-demo">
            <Container
              className="sentence-builder-root"
              config={{
                animation: defaultAnimations,
                direction: "column",
                mode: "progressive",
                name: "sentence-builder-root",
                callbacks: { canDrop: rejectDrop },
              }}
              locked
              metadata={{ purpose: "sentence-builder" }}
            >
              <Container
                className="answer-area answer-box"
                config={{
                  direction: "row",
                  mode: "progressive",
                  name: "sentence-answer",
                  animation: {
                    reorder: snapSortCubicAnimation,
                    drop: snapSortCubicAnimation,
                    clickMove: snapSortCubicAnimation,
                  },
                  callbacks,
                }}
                itemId="sentence-zone-answer"
                locked
                metadata={{ zone: "answer" }}
                ref={answerRef}
              >
                {renderedTiles("answer").map((entry) =>
                  entry.isGhost ? (
                    <Ghost className="tile-wrapper ghost tile-ghost" event={entry.event} key={entry.id}>
                      <button className="tile selected" tabIndex={-1} type="button">{entry.text}</button>
                    </Ghost>
                  ) : (
                    <Item className="tile-wrapper" itemId={entry.tile.id} key={entry.tile.id}>
                      <button {...tileButtonProps(entry, "bank", true)}>{entry.tile.text}</button>
                    </Item>
                  ),
                )}
                {answerTiles.length === 0 && ghostEntry?.zone !== "answer" ? (
                  <span className="placeholder">Drag tiles here or click to add</span>
                ) : null}
              </Container>

              <Container
                className="tile-bank-container tile-bank"
                config={{
                  direction: "row",
                  mainAxisAlign: "center",
                  mode: "progressive",
                  name: "sentence-bank",
                  animation: {
                    reorder: snapSortCubicAnimation,
                    drop: snapSortCubicAnimation,
                    clickMove: snapSortCubicAnimation,
                  },
                  callbacks,
                }}
                itemId="sentence-zone-bank"
                locked
                metadata={{ zone: "bank" }}
                ref={bankRef}
              >
                {renderedTiles("bank").map((entry) =>
                  entry.isGhost ? (
                    <Ghost className="tile-wrapper ghost tile-ghost" event={entry.event} key={entry.id}>
                      <button className="tile" tabIndex={-1} type="button">{entry.text}</button>
                    </Ghost>
                  ) : (
                    <Item className="tile-wrapper" itemId={entry.tile.id} key={entry.tile.id}>
                      <button {...tileButtonProps(entry, "answer")}>{entry.tile.text}</button>
                    </Item>
                  ),
                )}
              </Container>
            </Container>
          </Engine>
        </div>
        <section className="actions">
          <button className="btn secondary" disabled={answerTiles.length === 0} onClick={resetTiles} type="button">Reset</button>
          <button className="btn primary" disabled={answerTiles.length === 0} onClick={checkAnswer} type="button">Check</button>
        </section>
        {result ? (
          <section className={`result ${result.correct ? "correct" : "incorrect"}`}>
            <div className="result-icon">{result.correct ? "OK" : "No"}</div>
            <p className="result-text">{result.correct ? "Correct" : "Not quite right"}</p>
            {!result.correct ? <p className="expected">Expected: {result.expected}</p> : null}
            <button className="btn next" onClick={resetTiles} type="button">Try Again</button>
          </section>
        ) : null}
        {lookupTarget ? (
          <section className="lookup-panel">
            <div>
              <p className="label">Lookup</p>
              <p className="lookup-word">{lookupTarget}</p>
            </div>
            <button onClick={() => setLookupTarget(null)} type="button">Close</button>
          </section>
        ) : null}
      </main>
    </div>
  );
}

const initialInsertionColumns = [
  {
    id: "today",
    title: "Project",
    items: [
      { id: "task-1", kind: "folder", title: "src", detail: "Folder" },
      { id: "task-2", kind: "folder", title: "assets", detail: "Folder" },
      { id: "task-3", kind: "file", title: "package.json", detail: "3 KB" },
      { id: "task-4", kind: "file", title: "README.md", detail: "8 KB" },
    ],
  },
  {
    id: "next",
    title: "Source",
    items: [
      { id: "task-5", kind: "file", title: "Container.svelte", detail: "6 KB" },
      { id: "task-6", kind: "file", title: "Item.svelte", detail: "4 KB" },
      { id: "task-7", kind: "file", title: "Handle.svelte", detail: "1 KB" },
    ],
  },
  { id: "empty", title: "Archive", items: [] },
];

function cloneInsertionColumns() {
  return initialInsertionColumns.map((column) => ({
    ...column,
    items: column.items.map((item) => ({ ...item })),
  }));
}

export function SnapSortInsertionDemo() {
  const { callbacks: ghostCallbacks, renderWithGhosts } = useFrameworkGhosts();
  const [columns, setColumns] = useState(cloneInsertionColumns);
  const pendingRemovedItem = useRef(null);
  const itemCount = columns.reduce(
    (total, column) => total + column.items.length,
    0,
  );

  const removeItemById = useCallback((itemId, sourceColumns) => {
    let removedItem = null;
    const columnsWithoutItem = sourceColumns.map((column) => {
      const itemIndex = column.items.findIndex((item) => item.id === itemId);
      if (itemIndex === -1) return column;
      const nextItems = column.items.slice();
      const [item] = nextItems.splice(itemIndex, 1);
      removedItem = item;
      return { ...column, items: nextItems };
    });
    return { removedItem, columnsWithoutItem };
  }, []);

  const callbacks = useMemo(
    () => ({
      ...ghostCallbacks,
      onItemMove: (event) => {
        const itemId = event.itemId;
        const targetColumnId = event.to.containerMetadata.columnId;
        if (typeof itemId !== "string" || typeof targetColumnId !== "string") return;
        setColumns((current) => {
          let removed = pendingRemovedItem.current;
          let columnsWithoutItem = current;
          if (!removed) {
            const result = removeItemById(itemId, current);
            removed = result.removedItem;
            columnsWithoutItem = result.columnsWithoutItem;
          }
          pendingRemovedItem.current = null;
          if (!removed) return current;
          return columnsWithoutItem.map((column) => {
            if (column.id !== targetColumnId) return column;
            const nextItems = column.items.slice();
            nextItems.splice(Math.max(0, Math.min(event.to.index, nextItems.length)), 0, removed);
            return { ...column, items: nextItems };
          });
        });
      },
      onItemRemove: (event) => {
        const itemId = event.itemId;
        if (typeof itemId !== "string") return;
        setColumns((current) => {
          const { removedItem, columnsWithoutItem } = removeItemById(itemId, current);
          pendingRemovedItem.current = removedItem;
          return columnsWithoutItem;
        });
      },
    }),
    [ghostCallbacks, removeItemById],
  );

  const reset = () => {
    pendingRemovedItem.current = null;
    setColumns(cloneInsertionColumns());
  };

  const addItem = () => {
    setColumns((current) =>
      current.map((column, index) =>
        index === 0
          ? {
              ...column,
              items: [
                ...column.items,
                {
                  id: `task-${itemCount + 1}`,
                  kind: "file",
                  title: `new-file-${itemCount + 1}.md`,
                  detail: "1 KB",
                },
              ],
            }
          : column,
      ),
    );
  };

  return (
    <div className="snapsort-fixture insertion-demo">
      <header className="demo-header">
        <div>
          <h1>SnapSort Insertion</h1>
          <p>{itemCount} files and folders - original row stays still until drop</p>
        </div>
        <div className="toolbar">
          <button onClick={addItem} type="button">Add</button>
          <button onClick={reset} type="button">Reset</button>
        </div>
      </header>
      <Engine id="snapsort-insertion-demo-canvas">
        <Container
          className="insertion-board"
          config={{
            animation: defaultAnimations,
            direction: "row",
            mode: "insertion",
            name: "insertion-board-root",
            callbacks: { canDrop: rejectDrop },
          }}
          locked
          metadata={{ boardId: "insertion-demo" }}
        >
          {columns.map((column) => (
            <Container
              className="insertion-list"
              config={{
                animation: defaultAnimations,
                direction: "column",
                mode: "insertion",
                name: `insertion-${column.id}`,
                callbacks,
              }}
              key={column.id}
              locked
              metadata={{
                columnId: column.id,
                frameworkList: `insertion-${column.id}`,
              }}
            >
              <div className="list-header">
                <h2>{column.title}</h2>
                <span>{column.items.length}</span>
              </div>
              {renderWithGhosts(
                `insertion-${column.id}`,
                column.items,
                (item) => item.id,
                (item) => (
                  <Item className="insertion-card" itemId={item.id} key={item.id}>
                    <span className={`file-icon ${item.kind === "folder" ? "folder-icon" : ""}`} aria-hidden="true">
                      {item.kind === "folder" ? "folder" : "description"}
                    </span>
                    <div className="card-copy">
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </div>
                  </Item>
                ),
              )}
            </Container>
          ))}
        </Container>
      </Engine>
    </div>
  );
}
