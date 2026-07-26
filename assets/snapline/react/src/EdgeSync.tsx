import {
  EdgeSyncController,
  type ConnectorMirror,
  type EdgeConnectIntentEvent,
  type EdgeDisconnectIntentEvent,
  type EdgeEndpoint,
  type EdgeLike,
} from "@snap-engine/snapline";
import { useEffect, useRef } from "react";
import { useSnapLineEngine } from "./Engine";

export interface EdgeSyncProps {
  /** The consumer's edge document — the single source of truth. */
  edges: readonly EdgeLike[];
  /** Maps a connector to its semantic endpoint, or null for unmanaged connectors. */
  identity: (connector: ConnectorMirror) => EdgeEndpoint | null;
  onEdgeConnect?: (event: EdgeConnectIntentEvent) => void;
  onEdgeDisconnect?: (event: EdgeDisconnectIntentEvent) => void;
}

export function EdgeSync({
  edges,
  identity,
  onEdgeConnect,
  onEdgeDisconnect,
}: EdgeSyncProps) {
  const engine = useSnapLineEngine();
  const propsRef = useRef({ edges, identity, onEdgeConnect, onEdgeDisconnect });
  propsRef.current = { edges, identity, onEdgeConnect, onEdgeDisconnect };
  const controllerRef = useRef<EdgeSyncController | null>(null);

  useEffect(() => {
    const controller = new EdgeSyncController({
      engine,
      identity: (connector) => propsRef.current.identity(connector),
      getEdges: () => propsRef.current.edges,
      callbacks: {
        // For same-frame reconciliation of gesture intents, write the edge
        // document inside flushSync in the handler; the microtask sync then
        // sees the fresh document before paint. Deferred stores degrade to a
        // one-frame pending state, never an inconsistent one.
        onEdgeConnect: (event) => {
          propsRef.current.onEdgeConnect?.(event);
          queueMicrotask(() => controller.sync());
        },
        onEdgeDisconnect: (event) => {
          propsRef.current.onEdgeDisconnect?.(event);
          queueMicrotask(() => controller.sync());
        },
      },
    });
    controllerRef.current = controller;
    controller.sync();
    return () => {
      controller.dispose();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [engine]);

  useEffect(() => {
    controllerRef.current?.sync();
  }, [edges]);

  return null;
}
