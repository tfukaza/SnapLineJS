import {
  createContext,
  forwardRef,
  useLayoutEffect,
  useContext,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type RefCallback,
  type ReactNode,
} from "react";
import {
  DEFAULT_RESIZE_HANDLE_THICKNESS,
  LineComponent,
  NodeComponent,
  type ResizeHandle,
  type NodeCallbacks,
  type NodeDragCommitEvent,
  type NodeResizeEvent,
  type SnapLineMetadata,
} from "@snap-engine/snapline";
import { useSnapLineEngine } from "./Engine";
import { Line } from "./Line";

export const NodeObjectContext = createContext<NodeComponent | null>(null);

export interface NodeProps {
  children: ReactNode;
  className?: string;
  lineComponent?: ComponentType<{ line: LineComponent }>;
  nodeObject?: NodeComponent | null;
  style?: CSSProperties;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  resizable?: boolean;
  minWidth?: number;
  minHeight?: number;
  resizeHandleThickness?: number;
  resizeHandles?: true | readonly ResizeHandle[];
  resizeCursors?: Partial<Record<ResizeHandle, string>>;
  metadata?: SnapLineMetadata;
  callbacks?: NodeCallbacks;
  edgePan?: boolean;
  onDragCommit?: (event: NodeDragCommitEvent) => void;
  onResizeCommit?: (event: NodeResizeEvent) => void;
  onSizeChange?: (event: NodeResizeEvent) => void;
}

export const Node = forwardRef<NodeComponent, NodeProps>(function Node(
  {
    children,
    className = "",
    lineComponent: LineRenderer = Line,
    nodeObject = null,
    style,
    x = 0,
    y = 0,
    width,
    height,
    resizable = false,
    minWidth,
    minHeight,
    resizeHandleThickness,
    resizeHandles,
    resizeCursors,
    metadata = {},
    callbacks = {},
    edgePan = true,
    onDragCommit,
    onResizeCommit,
    onSizeChange,
  },
  ref,
) {
  const engine = useSnapLineEngine();
  const nodeDomRef = useRef<HTMLDivElement>(null);
  const ownsNodeRef = useRef(nodeObject == null);
  const nodeRef = useRef<NodeComponent | null>(nodeObject);
  if (!nodeRef.current) {
    nodeRef.current = new NodeComponent(engine, null, {
      resizable,
      minWidth,
      minHeight,
      resizeHandleThickness,
      resizeHandles,
      resizeCursors,
      metadata,
      callbacks: {},
      edgePan,
    });
  }
  const node = nodeRef.current;
  const [lineList, setLineList] = useState<LineComponent[]>(
    node.getAllOutgoingLines(),
  );
  // The element's width/height are framework-owned: core reports size changes
  // (resize drag) via onSizeChange and this state renders them. Null until the
  // first resize so CSS-declared sizes keep applying to non-resized nodes.
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const latestRef = useRef({
    callbacks,
    onDragCommit,
    onResizeCommit,
    onSizeChange,
  });
  latestRef.current = {
    callbacks,
    onDragCommit,
    onResizeCommit,
    onSizeChange,
  };

  useImperativeHandle(ref, () => node, [node]);

  useLayoutEffect(() => {
    if (nodeDomRef.current) {
      node.element = nodeDomRef.current;
      node.syncDomGeometry();
    }
    const original = { ...node.callbacks };
    const invoke = <Event,>(
      event: Event,
      ...handlers: Array<((value: Event) => unknown) | undefined>
    ): void => {
      const seen = new Set<Function>();
      for (const handler of handlers) {
        if (!handler || seen.has(handler)) continue;
        seen.add(handler);
        handler(event);
      }
    };
    node.callbacks.canStartDrag = (event) => {
      const handlers = [
        original.canStartDrag,
        latestRef.current.callbacks.canStartDrag,
      ];
      const seen = new Set<Function>();
      for (const handler of handlers) {
        if (!handler || seen.has(handler)) continue;
        seen.add(handler);
        if (handler(event) === false) return false;
      }
      return true;
    };
    node.callbacks.resolveSelectionMode = (event) =>
      latestRef.current.callbacks.resolveSelectionMode?.(event) ??
      original.resolveSelectionMode?.(event) ??
      "replace";
    node.callbacks.onDragStart = (event) =>
      invoke(
        event,
        original.onDragStart,
        latestRef.current.callbacks.onDragStart,
      );
    node.callbacks.onDrag = (event) =>
      invoke(event, original.onDrag, latestRef.current.callbacks.onDrag);
    node.callbacks.onSelectionChange = (event) =>
      invoke(
        event,
        original.onSelectionChange,
        latestRef.current.callbacks.onSelectionChange,
      );
    node.callbacks.onResizeHandleChange = (event) =>
      invoke(
        event,
        original.onResizeHandleChange,
        latestRef.current.callbacks.onResizeHandleChange,
      );
    node.callbacks.onLinesChanged = (event) => {
      invoke(
        event,
        original.onLinesChanged,
        latestRef.current.callbacks.onLinesChanged,
      );
      setLineList([...event.lines]);
    };
    node.callbacks.onSizeChange = (event) => {
      invoke(
        event,
        original.onSizeChange,
        latestRef.current.callbacks.onSizeChange,
        latestRef.current.onSizeChange,
      );
      setBox({ w: event.width, h: event.height });
    };
    node.callbacks.onResizeCommit = (event) =>
      invoke(
        event,
        original.onResizeCommit,
        latestRef.current.callbacks.onResizeCommit,
        latestRef.current.onResizeCommit,
      );
    node.callbacks.onDragCommit = (event) =>
      invoke(
        event,
        original.onDragCommit,
        latestRef.current.callbacks.onDragCommit,
        latestRef.current.onDragCommit,
      );
    setLineList([...node.getAllOutgoingLines()]);

    return () => {
      node.callbacks.canStartDrag = original.canStartDrag;
      node.callbacks.resolveSelectionMode = original.resolveSelectionMode;
      node.callbacks.onDragStart = original.onDragStart;
      node.callbacks.onDrag = original.onDrag;
      node.callbacks.onDragCommit = original.onDragCommit;
      node.callbacks.onSelectionChange = original.onSelectionChange;
      node.callbacks.onResizeHandleChange = original.onResizeHandleChange;
      node.callbacks.onLinesChanged = original.onLinesChanged;
      node.callbacks.onSizeChange = original.onSizeChange;
      node.callbacks.onResizeCommit = original.onResizeCommit;
      if (ownsNodeRef.current) {
        node.destroy();
      }
    };
  }, [node]);

  useLayoutEffect(() => {
    node.worldTransform = { x, y };
    node.writeTransformAndLines();
  }, [node, x, y]);

  useLayoutEffect(() => {
    setBox(
      width == null && height == null
        ? null
        : { w: width ?? node.hitBox.width, h: height ?? node.hitBox.height },
    );
  }, [node, width, height]);

  useLayoutEffect(() => {
    if (!node.element || !box) return;
    node.setSizeState(box.w, box.h);
    node.syncDomGeometry();
  }, [node, box]);

  const handleSize =
    resizeHandleThickness ?? DEFAULT_RESIZE_HANDLE_THICKNESS;
  return (
    <NodeObjectContext.Provider value={node}>
      {lineList.map((line) => (
        <LineRenderer key={line.id} line={line} />
      ))}
      <div
        ref={nodeDomRef}
        data-snapline-type="node"
        className={className}
        style={{
          position: "absolute",
          transformOrigin: "top left",
          willChange: "transform",
          ...(box ? { width: `${box.w}px`, height: `${box.h}px` } : null),
          ...style,
        }}
      >
        {children}
        {node.resizeHandles.map((handle) => (
          <div
            key={handle}
            data-snapline-part="node-resize"
            data-handle={handle}
            style={{
              position: "absolute",
              pointerEvents: "none",
              ...(handle === "n" || handle === "s"
                ? { left: handleSize, right: handleSize, height: handleSize }
                : null),
              ...(handle === "e" || handle === "w"
                ? { top: handleSize, bottom: handleSize, width: handleSize }
                : null),
              ...(handle.length === 2
                ? { width: handleSize, height: handleSize }
                : null),
              ...(handle.startsWith("n") ? { top: -handleSize / 2 } : null),
              ...(handle.startsWith("s") ? { bottom: -handleSize / 2 } : null),
              ...(handle.endsWith("e") ? { right: -handleSize / 2 } : null),
              ...(handle.endsWith("w") ? { left: -handleSize / 2 } : null),
            }}
          />
        ))}
      </div>
    </NodeObjectContext.Provider>
  );
});

/** Callback ref for declaring any descendant as a node drag surface. */
export function useNodeHandle(): RefCallback<HTMLElement> {
  const node = useContext(NodeObjectContext);
  const cleanup = useRef<(() => void) | null>(null);
  return (element) => {
    cleanup.current?.();
    cleanup.current = element && node ? node.registerDragHandle(element) : null;
  };
}
