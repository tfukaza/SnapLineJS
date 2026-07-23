import {
  createContext,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  DEFAULT_RESIZE_HANDLE_RADIUS,
  LineComponent,
  NodeComponent,
  type ResizeAnchor,
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
  resizable?: boolean;
  minWidth?: number;
  minHeight?: number;
  resizeHandleRadius?: number;
  resizeAnchor?: ResizeAnchor;
  onResizeCommit?: (width: number, height: number) => void;
  onSizeChange?: (width: number, height: number) => void;
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
    resizable = false,
    minWidth,
    minHeight,
    resizeHandleRadius,
    resizeAnchor,
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
      resizeHandleRadius,
      resizeAnchor,
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

  useImperativeHandle(ref, () => node, [node]);

  useEffect(() => {
    node.worldTransform = { x, y };
    if (nodeDomRef.current) {
      node.element = nodeDomRef.current;
      node.writeTransform();
    }
    node.nodeCallback.onLinesChanged = (lines: LineComponent[]) => {
      setLineList([...lines]);
    };
    node.nodeCallback.onSizeChange = (w: number, h: number) => {
      setBox({ w, h });
      onSizeChange?.(w, h);
    };
    node.nodeCallback.onResizeCommit = (w: number, h: number) => {
      onResizeCommit?.(w, h);
    };
    setLineList([...node.getAllOutgoingLines()]);

    return () => {
      node.nodeCallback.onLinesChanged = null;
      node.nodeCallback.onSizeChange = null;
      node.nodeCallback.onResizeCommit = null;
      if (ownsNodeRef.current) {
        node.destroy();
      }
    };
  }, [node, x, y, onResizeCommit, onSizeChange]);

  const handleSize = resizeHandleRadius ?? DEFAULT_RESIZE_HANDLE_RADIUS;
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
        {resizable ? (
          /* Purely visual: the collision hitbox (which straddles the corner and
             spreads beyond it) does the hitting, so this takes no pointer events. */
          <div
            data-snapline-part="node-resize"
            data-anchor={resizeAnchor ?? "br"}
            style={{
              position: "absolute",
              width: `${handleSize}px`,
              height: `${handleSize}px`,
              pointerEvents: "none",
              ...(resizeAnchor === "tl" || resizeAnchor === "bl"
                ? { left: 0 }
                : { right: 0 }),
              ...(resizeAnchor === "tl" || resizeAnchor === "tr"
                ? { top: 0 }
                : { bottom: 0 }),
              cursor:
                resizeAnchor === "tr" || resizeAnchor === "bl"
                  ? "nesw-resize"
                  : "nwse-resize",
            }}
          />
        ) : null}
      </div>
    </NodeObjectContext.Provider>
  );
});
