import {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
} from "react";
import {
  ConnectorMirror,
  LineMirror,
  type ConnectorRules,
  type ConnectorCallbacks,
  type ConnectorSurfaceStrategy,
  type SnapLineMetadata,
} from "@snap-engine/snapline";
import { useSnapLineEngine } from "./Engine";
import { NodeMirrorContext } from "./Node";

export interface ConnectorProps {
  /** Stable domain identity; minted when omitted (supply for persistence). */
  id?: string;
  className?: string;
  name: string;
  style?: CSSProperties;
  metadata?: SnapLineMetadata;
  callbacks?: ConnectorCallbacks;
  edgePan?: boolean;
  rules?: Partial<ConnectorRules>;
  surfaceStrategies?: readonly ConnectorSurfaceStrategy[];
  /** Keep the logical connector without rendering a visible port element. */
  virtual?: boolean;
  colliderRadius?: number;
  lineClass?: typeof LineMirror;
  connectorObject?: ConnectorMirror | null;
  data?: Record<string, string>;
}

export interface ConnectorRef {
  object(): ConnectorMirror;
}

export const Connector = forwardRef<ConnectorRef, ConnectorProps>(
  (
    {
      id,
      className = "",
      name,
      style,
      metadata = {},
      callbacks = {},
      edgePan = true,
      rules,
      surfaceStrategies = [],
      virtual = false,
      colliderRadius,
      lineClass,
      connectorObject = null,
      data = {},
    },
    ref,
  ) => {
    const engine = useSnapLineEngine();
    const nodeObject = useContext(NodeMirrorContext);
    if (!nodeObject) {
      throw new Error("<Connector> must be rendered inside <Node>.");
    }

    const ownsConnectorRef = useRef(connectorObject == null);
    const connectorRef = useRef<ConnectorMirror | null>(connectorObject);
    if (!connectorRef.current) {
      connectorRef.current = new ConnectorMirror(engine, nodeObject, {
        id,
        name,
        rules,
        metadata,
        callbacks,
        edgePan,
        surfaceStrategies,
        colliderRadius,
        lineClass,
      });
      nodeObject.addConnectorObject(connectorRef.current);
    }
    const connector = connectorRef.current;

    useImperativeHandle(ref, () => ({
      object: () => connector,
    }));

    useEffect(() => {
      connector.updateConfig({
        rules,
        metadata,
        callbacks,
        edgePan,
        surfaceStrategies,
        colliderRadius,
        lineClass,
      });
    }, [
      callbacks,
      colliderRadius,
      connector,
      edgePan,
      lineClass,
      metadata,
      rules,
      surfaceStrategies,
    ]);

    const bindConnectorElement = useCallback(
      (element: HTMLDivElement | null) => {
        connector.bindElement(element);
      },
      [connector],
    );

    useEffect(() => {
      return () => {
        if (ownsConnectorRef.current) connector.destroy(false);
      };
    }, [connector]);

    if (virtual) return null;

    return (
      <div
        ref={bindConnectorElement}
        data-snapline-name={name}
        data-snapline-type="connector"
        {...Object.fromEntries(
          Object.entries(data).map(([key, value]) => [`data-${key}`, value]),
        )}
        className={`connector ${(rules?.maxOutgoing ?? "unlimited") !== 0 ? "right" : "left"} ${className}`.trim()}
        style={{
          background: "#4f46e5",
          border: "2px solid #ffffff",
          borderRadius: 999,
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.25)",
          cursor: "crosshair",
          height: 14,
          pointerEvents: "auto",
          width: 14,
          ...style,
        }}
      />
    );
  },
);
