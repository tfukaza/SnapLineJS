import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  DEFAULT_RESIZE_HANDLE_RADIUS,
  GroupNodeComponent,
  NodeComponent,
} from "@snap-engine/snapline";
import { useSnapLineEngine } from "./Engine";

export interface GroupProps {
  children?: ReactNode;
  className?: string;
  groupObject?: GroupNodeComponent | null;
  style?: CSSProperties;
  title?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  onMemberEnter?: (node: NodeComponent) => void;
  onMemberLeave?: (node: NodeComponent) => void;
  onResizeCommit?: (width: number, height: number) => void;
  onDragCommit?: () => void;
}

export const Group = forwardRef<GroupNodeComponent, GroupProps>(function Group(
  {
    children,
    className = "",
    groupObject = null,
    style,
    title = "Group",
    x = 0,
    y = 0,
    width = 400,
    height = 300,
    minWidth,
    minHeight,
    onMemberEnter,
    onMemberLeave,
    onResizeCommit,
    onDragCommit,
  },
  ref,
) {
  const engine = useSnapLineEngine();
  const boxDomRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const ownsGroupRef = useRef(groupObject == null);
  const groupRef = useRef<GroupNodeComponent | null>(groupObject);
  if (!groupRef.current) {
    groupRef.current = new GroupNodeComponent(engine, null, {
      width,
      height,
      minWidth,
      minHeight,
    });
  }
  const group = groupRef.current;

  // The box's width/height are framework-owned: seeded from props, updated
  // live by core's onSizeChange during a resize drag.
  const [box, setBox] = useState<{ w: number; h: number }>({ w: width, h: height });

  useImperativeHandle(ref, () => group, [group]);

  useEffect(() => {
    group.worldTransform = { x, y };
    if (boxDomRef.current) {
      group.element = boxDomRef.current;
      group.writeTransform();
    }
    group.groupCallback.onMemberEnter = (node) => onMemberEnter?.(node);
    group.groupCallback.onMemberLeave = (node) => onMemberLeave?.(node);
    group.groupCallback.onDragCommit = () => onDragCommit?.();
    group.nodeCallback.onSizeChange = (w: number, h: number) => setBox({ w, h });
    group.nodeCallback.onResizeCommit = (w: number, h: number) =>
      onResizeCommit?.(w, h);
    // Header is the only move surface. setSizeState seeds the collision
    // footprint (the DOM size is rendered from state above).
    if (headerRef.current) group.addInputAlias(headerRef.current);
    group.setSizeState(box.w, box.h);
    // Seed membership once siblings have mounted and had hit boxes measured.
    group.schedule(() => group.refreshMembership(true), {
      stage: "WRITE_3",
      queueId: `${group.id}-seed`,
    });

    return () => {
      group.groupCallback.onMemberEnter = null;
      group.groupCallback.onMemberLeave = null;
      group.groupCallback.onDragCommit = null;
      group.nodeCallback.onSizeChange = null;
      group.nodeCallback.onResizeCommit = null;
      if (ownsGroupRef.current) {
        group.destroy();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, x, y]);

  const handleSize =
    group.config.resizeHandleRadius ?? DEFAULT_RESIZE_HANDLE_RADIUS;
  return (
    <div
      ref={boxDomRef}
      data-snapline-type="group"
      className={`snapline-group ${className}`}
      style={{
        position: "absolute",
        transformOrigin: "top left",
        willChange: "transform",
        boxSizing: "border-box",
        pointerEvents: "none",
        width: `${box.w}px`,
        height: `${box.h}px`,
        ...style,
      }}
    >
      <header
        ref={headerRef}
        data-snapline-part="group-header"
        style={{ pointerEvents: "auto", cursor: "grab" }}
      >
        <span>{title}</span>
      </header>
      <div style={{ pointerEvents: "none" }}>{children}</div>
      {/* Visual cue only: the core resize hitbox (a collider straddling the BR
          corner) does the hitting, so this takes no pointer events. */}
      <div
        data-snapline-part="group-resize"
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          width: `${handleSize}px`,
          height: `${handleSize}px`,
          pointerEvents: "none",
          cursor: "nwse-resize",
        }}
      />
    </div>
  );
});
