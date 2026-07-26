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
  type HTMLAttributes,
  type RefCallback,
  type ReactNode,
} from "react";
import {
  DEFAULT_RESIZE_HANDLE_THICKNESS,
  LineMirror,
  NodeMirror,
  type ResizeHandle,
  type NodeCallbacks,
  type GeometryChangeEvent,
  type NodeResizeEvent,
  type SnapLineMetadata,
} from "@snap-engine/snapline";
import { useSnapLineEngine } from "./Engine";
import { Line } from "./Line";

export const NodeMirrorContext = createContext<NodeMirror | null>(null);

export interface NodeProps {
  /** Stable domain identity; minted when omitted (supply for persistence). */
  id?: string;
  children: ReactNode;
  className?: string;
  lineComponent?: ComponentType<{ line: LineMirror }>;
  nodeObject?: NodeMirror | null;
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
  onGeometryChanged?: (event: GeometryChangeEvent) => void;
  onSizeChange?: (event: NodeResizeEvent) => void;
  /** Framework-native attributes and events for the outer node element. */
  elementProps?: HTMLAttributes<HTMLDivElement>;
}

export const Node = forwardRef<NodeMirror, NodeProps>(function Node(
  {
    id,
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
    onGeometryChanged,
    onSizeChange,
    elementProps,
  },
  ref,
) {
  const engine = useSnapLineEngine();
  const nodeDomRef = useRef<HTMLDivElement>(null);
  const ownsNodeRef = useRef(nodeObject == null);
  const nodeRef = useRef<NodeMirror | null>(nodeObject);
  if (!nodeRef.current) {
    nodeRef.current = new NodeMirror(engine, null, {
      id,
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
  const [lineList, setLineList] = useState<LineMirror[]>(
    node.getAllOutgoingLines(),
  );
  const latestRef = useRef({
    callbacks,
    onGeometryChanged,
    onSizeChange,
  });
  latestRef.current = {
    callbacks,
    onGeometryChanged,
    onSizeChange,
  };

  useImperativeHandle(ref, () => node, [node]);

  useLayoutEffect(() => {
    if (nodeDomRef.current) {
      node.element = nodeDomRef.current;
      node.remeasureDomGeometry();
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
    node.callbacks.resolveDragPosition = (event) =>
      latestRef.current.callbacks.resolveDragPosition?.(event) ??
      original.resolveDragPosition?.(event) ??
      { x: event.x, y: event.y };
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
    };
    node.callbacks.onGeometryChanged = (event) =>
      invoke(
        event,
        original.onGeometryChanged,
        latestRef.current.callbacks.onGeometryChanged,
        latestRef.current.onGeometryChanged,
      );
    setLineList([...node.getAllOutgoingLines()]);
    const boundElement = nodeDomRef.current;

    return () => {
      node.callbacks.canStartDrag = original.canStartDrag;
      node.callbacks.resolveDragPosition = original.resolveDragPosition;
      node.callbacks.resolveSelectionMode = original.resolveSelectionMode;
      node.callbacks.onDragStart = original.onDragStart;
      node.callbacks.onDrag = original.onDrag;
      node.callbacks.onGeometryChanged = original.onGeometryChanged;
      node.callbacks.onSelectionChange = original.onSelectionChange;
      node.callbacks.onResizeHandleChange = original.onResizeHandleChange;
      node.callbacks.onLinesChanged = original.onLinesChanged;
      node.callbacks.onSizeChange = original.onSizeChange;
      if (ownsNodeRef.current) {
        node.destroy(false);
      } else if (boundElement) {
        node.detachElement(boundElement);
      }
    };
  }, [node]);

  useLayoutEffect(() => {
    node.worldTransform = { x, y };
    node.writeTransformAndLines();
  }, [node, x, y]);

  useLayoutEffect(() => {
    if (!node.element || (width == null && height == null)) return;
    const nextWidth = width ?? node.hitBox.width;
    const nextHeight = height ?? node.hitBox.height;
    if (width != null) node.element.style.width = `${width}px`;
    if (height != null) node.element.style.height = `${height}px`;
    node.setSizeState(nextWidth, nextHeight);
    node.remeasureDomGeometry();
  }, [node, width, height]);

  const handleSize =
    resizeHandleThickness ?? DEFAULT_RESIZE_HANDLE_THICKNESS;
  return (
    <NodeMirrorContext.Provider value={node}>
      {lineList.map((line) => (
        <LineRenderer key={line.lineId} line={line} />
      ))}
      <div
        {...elementProps}
        ref={nodeDomRef}
        data-snapline-type="node"
        className={className}
        style={{
          position: "absolute",
          transformOrigin: "top left",
          willChange: "transform",
          ...(width != null ? { width: `${width}px` } : null),
          ...(height != null ? { height: `${height}px` } : null),
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
    </NodeMirrorContext.Provider>
  );
});

/** Callback ref for declaring any descendant as a node drag surface. */
export function useNodeHandle(): RefCallback<HTMLElement> {
  const node = useContext(NodeMirrorContext);
  const cleanup = useRef<(() => void) | null>(null);
  return (element) => {
    cleanup.current?.();
    cleanup.current = element && node ? node.registerDragHandle(element) : null;
  };
}
