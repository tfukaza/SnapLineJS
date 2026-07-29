import {
  forwardRef,
  useLayoutEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  GroupNodeMirror,
  type GroupCallbacks,
  type GroupContainEvent,
  type GroupMembershipEvent,
  type NodeCallbacks,
  type GeometryChangeEvent,
  type SnapLineMetadata,
} from "@snap-engine/snapline";
import { useSnapLineEngine } from "./Engine";
import { NodeMirrorContext } from "./Node";

export interface GroupProps {
  /** Stable domain identity; minted when omitted (supply for persistence). */
  id?: string;
  children?: ReactNode;
  className?: string;
  groupObject?: GroupNodeMirror | null;
  style?: CSSProperties;
  title?: string;
  /** Consumer-rendered header contents. `title` remains the fallback. */
  headerContent?: ReactNode;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  metadata?: SnapLineMetadata;
  callbacks?: NodeCallbacks;
  groupCallbacks?: GroupCallbacks;
  canContain?: (event: GroupContainEvent) => boolean;
  edgePan?: boolean;
  onMembershipChange?: (event: GroupMembershipEvent) => void;
  onGeometryCommit?: (event: GeometryChangeEvent) => void;
}

export const Group = forwardRef<GroupNodeMirror, GroupProps>(function Group(
  {
    id,
    children,
    className = "",
    groupObject = null,
    style,
    title = "Group",
    headerContent,
    x = 0,
    y = 0,
    width = 400,
    height = 300,
    minWidth,
    minHeight,
    metadata = {},
    callbacks = {},
    groupCallbacks = {},
    canContain,
    edgePan = true,
    onMembershipChange,
    onGeometryCommit,
  },
  ref,
) {
  const engine = useSnapLineEngine();
  const boxDomRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const ownsGroupRef = useRef(groupObject == null);
  const groupRef = useRef<GroupNodeMirror | null>(groupObject);
  if (!groupRef.current) {
    groupRef.current = new GroupNodeMirror(engine, null, {
      id,
      width,
      height,
      minWidth,
      minHeight,
      metadata,
      callbacks: {},
      groupCallbacks: {},
      canContain,
      edgePan,
    });
  }
  const group = groupRef.current;
  // Snapshot, not a live binding: after mount the engine owns the size, and a
  // second writer on the same property is what splits it from the transform.
  // Rendering it once keeps SSR and the first client paint correctly sized.
  const initialSize = useRef({ width, height }).current;

  const latestRef = useRef({
    callbacks,
    groupCallbacks,
    onMembershipChange,
    onGeometryCommit,
  });
  latestRef.current = {
    callbacks,
    groupCallbacks,
    onMembershipChange,
    onGeometryCommit,
  };

  useImperativeHandle(ref, () => group, [group]);

  useLayoutEffect(() => {
    if (boxDomRef.current) {
      group.element = boxDomRef.current;
      group.remeasureDomGeometry();
    }
    const originalCallbacks = { ...group.callbacks };
    const originalGroupCallbacks = { ...group.groupCallbacks };
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
    group.callbacks.canStartDrag = (event) => {
      const handlers = [
        originalCallbacks.canStartDrag,
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
    group.callbacks.resolveSelectionMode = (event) =>
      latestRef.current.callbacks.resolveSelectionMode?.(event) ??
      originalCallbacks.resolveSelectionMode?.(event) ??
      "replace";
    group.callbacks.onDragStart = (event) =>
      invoke(
        event,
        originalCallbacks.onDragStart,
        latestRef.current.callbacks.onDragStart,
      );
    group.callbacks.onDrag = (event) =>
      invoke(
        event,
        originalCallbacks.onDrag,
        latestRef.current.callbacks.onDrag,
      );
    group.callbacks.onSelectionChange = (event) =>
      invoke(
        event,
        originalCallbacks.onSelectionChange,
        latestRef.current.callbacks.onSelectionChange,
      );
    group.groupCallbacks.onMembershipChange = (event) =>
      invoke(
        event,
        originalGroupCallbacks.onMembershipChange,
        latestRef.current.groupCallbacks.onMembershipChange,
        latestRef.current.onMembershipChange,
      );
    group.callbacks.onGeometryCommit = (event) =>
      invoke(
        event,
        originalCallbacks.onGeometryCommit,
        latestRef.current.callbacks.onGeometryCommit,
        latestRef.current.onGeometryCommit,
      );
    group.callbacks.onSizeChange = (event) => {
      invoke(
        event,
        originalCallbacks.onSizeChange,
        latestRef.current.callbacks.onSizeChange,
      );
    };
    // Header is the only move surface. setSizeState seeds the collision
    // footprint; core writes live resize geometry directly to this element.
    const unregisterHandle = headerRef.current
      ? group.registerDragHandle(headerRef.current)
      : undefined;
    // Seed membership once siblings have mounted and had hit boxes measured.
    group.schedule(() => group.refreshMembership(true), {
      stage: "WRITE_3",
      queueId: `${group.id}-seed`,
    });
    const boundElement = boxDomRef.current;

    return () => {
      unregisterHandle?.();
      group.callbacks.canStartDrag = originalCallbacks.canStartDrag;
      group.callbacks.resolveSelectionMode =
        originalCallbacks.resolveSelectionMode;
      group.callbacks.onDragStart = originalCallbacks.onDragStart;
      group.callbacks.onDrag = originalCallbacks.onDrag;
      group.callbacks.onGeometryCommit = originalCallbacks.onGeometryCommit;
      group.callbacks.onSelectionChange = originalCallbacks.onSelectionChange;
      group.callbacks.onSizeChange = originalCallbacks.onSizeChange;
      group.groupCallbacks.onMembershipChange =
        originalGroupCallbacks.onMembershipChange;
      if (ownsGroupRef.current) {
        group.destroy(false);
      } else if (boundElement) {
        group.detachElement(boundElement);
      }
    };
  }, [group]);

  // One effect for all four geometry props, committed through one engine task.
  // Splitting position and size across two writers — React's renderer for the
  // size, the engine's queue for the transform — lets them land in different
  // frames, which paints the new size at the old position for one frame.
  useLayoutEffect(() => {
    group.worldTransform = { x, y };
    group.setSizeState(width, height);
    group.scheduleGeometryWrite();
  }, [group, x, y, width, height]);

  return (
    <NodeMirrorContext.Provider value={group}>
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
          width: `${initialSize.width}px`,
          height: `${initialSize.height}px`,
          ...style,
        }}
      >
        <header
          ref={headerRef}
          data-snapline-part="group-header"
          style={{ pointerEvents: "auto", cursor: "grab" }}
        >
          {headerContent ?? <span>{title}</span>}
        </header>
        <div style={{ pointerEvents: "none" }}>{children}</div>
      </div>
    </NodeMirrorContext.Provider>
  );
});
