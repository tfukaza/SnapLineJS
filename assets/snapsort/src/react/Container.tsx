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
  Container as ContainerObject,
  defaultCallbacks,
  type ContainerCallbacks,
  type ContainerConfig,
  type GhostCreateEvent,
  type Item,
} from "@snap-engine/snapsort";
import { flushSync } from "react-dom";
import { useSnapSortEngine } from "./Engine";
import { useSnapSortAwaitMutation } from "./useSnapSortAwaitMutation";

export const ContainerObjectContext = createContext<ContainerObject | null>(
  null,
);

export interface ContainerProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children?: ReactNode;
  className?: string;
  config: ContainerConfig;
  containerObject?: ContainerObject | null;
  itemId?: string;
  locked?: boolean;
  /** Consumer-owned selection flag — see `Item.selected` in `@snap-engine/snapsort`. Only meaningful when `locked` is `false`. */
  selected?: boolean;
  metadata?: Record<string, unknown>;
}

function frameworkCallbacks(
  inheritedCallbacks: ContainerCallbacks | undefined,
  configuredCallbacks: ContainerCallbacks | undefined,
  flushMutation: (mutation: () => void) => void,
): ContainerCallbacks {
  const callbacks: ContainerCallbacks = {
    ...inheritedCallbacks,
    ...configuredCallbacks,
  };

  // An injected core container may still carry the Vanilla defaults. Strip
  // only those exact functions so legitimate preconfigured framework
  // callbacks survive adoption by the React adapter.
  if (callbacks.onItemInsert === defaultCallbacks.onItemInsert) {
    delete callbacks.onItemInsert;
  }
  if (callbacks.onItemRemove === defaultCallbacks.onItemRemove) {
    delete callbacks.onItemRemove;
  }
  if (callbacks.onGhostInsert === defaultCallbacks.onGhostInsert) {
    delete callbacks.onGhostInsert;
  }
  if (callbacks.onGhostRemove === defaultCallbacks.onGhostRemove) {
    delete callbacks.onGhostRemove;
  }
  if (callbacks.createGhost === defaultCallbacks.createGhost) {
    delete callbacks.createGhost;
  }

  const createGhost = callbacks.createGhost;
  return {
    ...callbacks,
    // React always owns ghost DOM. Preserve the documented notification
    // callback, but never pass a returned HTMLElement back to core.
    createGhost: (event: GhostCreateEvent) => {
      createGhost?.(event);
    },
    flushMutation,
  };
}

export const Container = forwardRef<ContainerObject, ContainerProps>(
  function SnapSortContainer(
    {
      children,
      className = "",
      config,
      containerObject = null,
      itemId,
      locked = true,
      selected = false,
      metadata = {},
      style,
      ...divProps
    },
    ref,
  ) {
    const engine = useSnapSortEngine();
    const parentContainer = useContext(ContainerObjectContext);
    const containerDomRef = useRef<HTMLDivElement>(null);
    const ownsContainerRef = useRef(containerObject == null);
    const containerRef = useRef<ContainerObject | null>(containerObject);
    const inheritedCallbacksRef = useRef<ContainerCallbacks | undefined>(
      containerObject?.callbacks,
    );
    const flushCommittedMutation = useSnapSortAwaitMutation();
    const flushMutation = useCallback(
      (mutation: () => void) => {
        flushSync(mutation);
        // A state mutation can mount new Item/Container adapters. Flush once
        // more so their attachment effects run before core resumes its layout
        // reads, while remaining in the same pre-paint transaction.
        flushCommittedMutation();
      },
      [flushCommittedMutation],
    );
    const callbacks = frameworkCallbacks(
      inheritedCallbacksRef.current,
      config.callbacks,
      flushMutation,
    );
    const resolvedMode = config.mode ?? containerObject?.mode ?? "euclidean";
    if (resolvedMode === "swap" && !callbacks.onItemSwap) {
      throw new Error(
        "SnapSort Container: swap mode in the React adapter requires callbacks.onItemSwap so React state can commit the pairwise exchange atomically.",
      );
    }
    if (!containerRef.current) {
      containerRef.current = new ContainerObject(engine, parentContainer, {
        ...config,
        domOwnership: "framework",
        callbacks,
      });
    }
    const container = containerRef.current;
    const resolvedItemId =
      itemId ?? (typeof metadata.itemId === "string" ? metadata.itemId : undefined);
    const direction = config.direction ?? "column";
    const mainAxisAlign = config.mainAxisAlign ?? "start";
    container.itemId = resolvedItemId;
    container.locked = locked;
    container.selected = selected;
    container.metadata = metadata;
    container.config.mode = config.mode ?? container.config.mode;
    container.config.strategy = config.strategy ?? container.config.strategy;
    container.config.groupID = config.groupID ?? container.config.groupID;
    container.config.name = config.name ?? container.config.name;
    container.config.animation = config.animation ?? container.config.animation;
    container.config.disableFlip =
      config.disableFlip ?? container.config.disableFlip;
    container.config.domOwnership = "framework";
    container.config.callbacks = callbacks;
    container.direction = direction;
    container.mainAxisAlign = mainAxisAlign;
    container.wrap = config.wrap ?? "auto";
    container.stretchItems = config.stretchItems ?? false;
    container.dropArea = config.dropArea ?? false;
    container.noDrop = config.noDrop ?? false;

    useImperativeHandle(ref, () => container, [container]);

    const setContainerElement = useCallback(
      (element: HTMLDivElement | null) => {
        containerDomRef.current = element;
        if (element) {
          container.element = element;
        }
      },
      [container],
    );

    useEffect(() => {
      if (parentContainer && container.parent !== parentContainer) {
        parentContainer.addItem(container as unknown as Item);
      }
      return () => {
        if (ownsContainerRef.current) {
          container.destroy(false);
        }
      };
    }, [container, parentContainer]);

    return (
      <ContainerObjectContext.Provider value={container}>
        <div
          {...divProps}
          ref={setContainerElement}
          className={`snapsort-container snapsort-mode-${container.mode} ${className}`.trim()}
          style={{
            alignItems: "flex-start",
            display: "flex",
            flexDirection: direction,
            flexWrap: "wrap",
            justifyContent:
              mainAxisAlign === "center" ? "center" : "flex-start",
            position: "relative",
            ...style,
          }}
        >
          {children}
        </div>
      </ContainerObjectContext.Provider>
    );
  },
);
