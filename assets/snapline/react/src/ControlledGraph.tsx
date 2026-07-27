import { useEffect, useRef } from "react";
import {
  attachControlledGraph,
  type ControlledGraphHandle,
  type LineChangeRequest,
  type LineRecord,
  type ReconciliationError,
} from "@snap-engine/snapline";
import { useSnapLineEngine } from "./Engine";

export interface ControlledGraphProps {
  /** The application-owned canonical line records (stable ids). */
  lines: readonly LineRecord[];
  /** One atomic proposal per gesture; accept/normalize/reject by updating
   * the records — adopting a proposed id settles the line in place. */
  onLineChangeRequest: (request: LineChangeRequest) => void;
  onDiagnosticsChanged?: (diagnostics: readonly ReconciliationError[]) => void;
}

export function ControlledGraph({
  lines,
  onLineChangeRequest,
  onDiagnosticsChanged,
}: ControlledGraphProps) {
  const engine = useSnapLineEngine();
  // Written during render so the bridge's closures always read fresh props.
  const propsRef = useRef({ lines, onLineChangeRequest, onDiagnosticsChanged });
  propsRef.current = { lines, onLineChangeRequest, onDiagnosticsChanged };
  const handleRef = useRef<ControlledGraphHandle | null>(null);

  useEffect(() => {
    const handle = attachControlledGraph(engine, {
      onLineChangeRequest: (request) => {
        propsRef.current.onLineChangeRequest(request);
        // Guaranteed post-request push: React flushes the handler's state
        // update (and re-renders propsRef) before this microtask runs, so
        // the decisive pass sees the app's decision — including
        // rejection-by-inaction, where the unchanged records come through.
        queueMicrotask(() =>
          handleRef.current?.setCanonicalGraph({
            lines: propsRef.current.lines,
          }),
        );
      },
      onDiagnosticsChanged: (diagnostics) =>
        propsRef.current.onDiagnosticsChanged?.(diagnostics),
    });
    handleRef.current = handle;
    handle.setCanonicalGraph({ lines: propsRef.current.lines });
    return () => {
      handle.dispose();
      handleRef.current = null;
    };
  }, [engine]);

  useEffect(() => {
    handleRef.current?.setCanonicalGraph({ lines });
  }, [lines]);

  return null;
}
