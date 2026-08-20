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
  type ContainerCallbacks,
  type ContainerConfig,
  type ItemMetadata,
  type SnapSortAdapter,
} from "@snap-engine/snapsort";
import { flushSync } from "react-dom";
import { useSnapSortEngine } from "./Engine";
import { useFlushSnapSortAttachments } from "./useFlushSnapSortAttachments";

export const ContainerObjectContext = createContext<ContainerObject | null>(
  null,
);
const AdapterContext = createContext<SnapSortAdapter | null>(null);

export interface ContainerProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children?: ReactNode;
  className?: string;
  config?: ContainerConfig;
  containerObject?: ContainerObject | null;
  itemId: string;
  locked?: boolean;
  /** Consumer-owned selection flag — see `Item.selected` in `@snap-engine/snapsort`. Only meaningful when `locked` is `false`. */
  selected?: boolean;
  metadata?: ItemMetadata;
}

export const Container = forwardRef<ContainerObject, ContainerProps>(
  function SnapSortContainer(
    {
      children,
      className = "",
      config = {},
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
    const parentAdapter = useContext(AdapterContext);
    const containerDomRef = useRef<HTMLDivElement>(null);
    const ownsContainerRef = useRef(containerObject == null);
    const initialContainerObjectRef = useRef(containerObject);
    const initialItemIdRef = useRef(itemId);
    const containerRef = useRef<ContainerObject | null>(containerObject);
    const inheritedCallbacksRef = useRef<ContainerCallbacks | undefined>(
      containerObject?.callbacks,
    );
    if (containerObject !== initialContainerObjectRef.current) {
      throw new Error(
        "SnapSort Container: the `containerObject` prop cannot change after mount.",
      );
    }
    if (!initialItemIdRef.current) {
      throw new Error("SnapSort Container: missing required `itemId` prop.");
    }
    if (itemId !== initialItemIdRef.current) {
      throw new Error(
        "SnapSort Container: the `itemId` prop cannot change after mount. Remount the Container with a new key.",
      );
    }
    if (
      containerObject &&
      containerObject.itemId !== initialItemIdRef.current
    ) {
      throw new Error(
        "SnapSort Container: the supplied `containerObject` ID must exactly match the `itemId` prop.",
      );
    }
    const flushSnapSortAttachments = useFlushSnapSortAttachments();
    const commitFrameworkMutation = useCallback(
      (mutation: () => void) => {
        flushSync(mutation);
        // A state mutation can mount new Item/Container adapters. Flush once
        // more so their attachment effects run before core resumes its layout
        // reads, while remaining in the same pre-paint transaction.
        flushSnapSortAttachments();
      },
      [flushSnapSortAttachments],
    );
    const commitRef = useRef(commitFrameworkMutation);
    commitRef.current = commitFrameworkMutation;
    const adapterRef = useRef<SnapSortAdapter | null>(null);
    if (!adapterRef.current) {
      adapterRef.current = parentAdapter ?? {
        callbacks: {},
        commit: (mutation) => commitRef.current(mutation),
      };
    }
    const adapter = adapterRef.current;
    if (!parentAdapter && containerObject) {
      throw new Error(
        "SnapSort Container: adopting a root `containerObject` is unsupported because React must own the root adapter. Let the component create the root Container instead.",
      );
    }
    if (parentAdapter && adapter !== parentAdapter) {
      throw new Error(
        "SnapSort Container: every nested Container must use this React root's adapter.",
      );
    }
    if (containerObject && containerObject.adapter !== adapter) {
      throw new Error(
        "SnapSort Container: an adopted Container must already use this React root's adapter.",
      );
    }
    const callbacks: ContainerCallbacks = {
      ...inheritedCallbacksRef.current,
      ...config.callbacks,
    };
    const resolvedMode = config.mode ?? containerObject?.mode ?? "euclidean";
    if (!parentContainer && resolvedMode === "swap" && !callbacks.onItemSwap) {
      throw new Error(
        "SnapSort Container: swap mode in the React adapter requires callbacks.onItemSwap so React state can commit the pairwise exchange atomically.",
      );
    }
    if ("itemId" in metadata) {
      throw new Error(
        "SnapSort Container: `metadata.itemId` was removed. Pass `itemId` as its own prop instead.",
      );
    }
    if (!containerRef.current) {
      containerRef.current = new ContainerObject(engine, parentContainer, {
        ...config,
        itemId: initialItemIdRef.current,
        adapter,
        callbacks,
      });
    }
    const container = containerRef.current;
    const direction = config.direction ?? "column";
    const mainAxisAlign = config.mainAxisAlign ?? "start";
    container.locked = locked;
    container.selected = selected;
    container.metadata = metadata;
    container.mode = config.mode ?? container.mode;
    container.config.name = config.name ?? container.config.name;
    container.config.animation = config.animation;
    container.callbacks = callbacks;
    container.direction = direction;
    container.mainAxisAlign = mainAxisAlign;
    container.wrap = config.wrap ?? "auto";
    container.stretchItems = config.stretchItems ?? false;
    container.dropPriority = config.dropPriority ?? 0;

    useImperativeHandle(ref, () => container, [container]);

    const setContainerElement = useCallback(
      (element: HTMLDivElement | null) => {
        const previousElement = containerDomRef.current;
        containerDomRef.current = element;
        if (element) {
          container.element = element;
        } else if (previousElement) {
          container.detachElement(previousElement);
        }
      },
      [container],
    );

    useEffect(() => {
      if (parentContainer && container.parent !== parentContainer) {
        parentContainer.attachItem(container);
      }
      return () => {
        if (ownsContainerRef.current) {
          container.destroy(false);
        }
      };
    }, [container, parentContainer]);

    return (
      <AdapterContext.Provider value={adapter}>
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
      </AdapterContext.Provider>
    );
  },
);
