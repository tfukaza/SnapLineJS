import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  attachControlledGraph,
  type ControlledGraphHandle,
  type LineChangeRequest,
  type LineRecord,
  type ReconciliationError,
} from "@snap-engine/snapline";
import { useSnapLineEngine } from "./Engine";

export interface ControlledGraphProps {
  /** One atomic proposal per gesture. Return the list that should now be
   * canonical — adopting a proposed id settles the line in place; returning
   * the list unchanged rejects. Must be synchronous. */
  onLineChangeRequest: (request: LineChangeRequest) => readonly LineRecord[];
  onDiagnosticsChanged?: (diagnostics: readonly ReconciliationError[]) => void;
}

/**
 * The app↔SnapLine bridge. Renders nothing.
 *
 * Gesture-driven changes flow through `onLineChangeRequest`'s return value.
 * For records no request asked for — hydration/load, undo/redo, a
 * collaborator's edit — take a ref and call `setLines`.
 */
export const ControlledGraph = forwardRef<
  ControlledGraphHandle,
  ControlledGraphProps
>(function ControlledGraph({ onLineChangeRequest, onDiagnosticsChanged }, ref) {
  const engine = useSnapLineEngine();
  // Written during render so the bridge's closures always read fresh props.
  const propsRef = useRef({ onLineChangeRequest, onDiagnosticsChanged });
  propsRef.current = { onLineChangeRequest, onDiagnosticsChanged };
  const handleRef = useRef<ControlledGraphHandle | null>(null);

  useEffect(() => {
    const handle = attachControlledGraph(engine, {
      onLineChangeRequest: (request) =>
        propsRef.current.onLineChangeRequest(request),
      onDiagnosticsChanged: (diagnostics) =>
        propsRef.current.onDiagnosticsChanged?.(diagnostics),
    });
    handleRef.current = handle;
    return () => {
      handle.dispose();
      handleRef.current = null;
    };
  }, [engine]);

  useImperativeHandle(
    ref,
    () => ({
      setCanonicalGraph: (snapshot) =>
        handleRef.current?.setCanonicalGraph(snapshot),
      flush: () => handleRef.current?.flush(),
      dispose: () => handleRef.current?.dispose(),
    }),
    [],
  );

  return null;
});
