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
  ConnectorComponent,
  LineComponent,
  type ConnectorCapabilities,
  type ConnectorCallbacks,
  type ConnectorSurfaceStrategy,
  type SnapLineMetadata,
} from "@snap-engine/snapline";
import { useSnapLineEngine } from "./Engine";
import { NodeObjectContext } from "./Node";

export interface ConnectorProps {
  allowDragOut?: boolean;
  className?: string;
  maxConnectors?: number;
  name: string;
  style?: CSSProperties;
  metadata?: SnapLineMetadata;
  callbacks?: ConnectorCallbacks;
  edgePan?: boolean;
  capabilities?: Partial<ConnectorCapabilities>;
  surfaceStrategies?: readonly ConnectorSurfaceStrategy[];
  /** Keep the logical connector without rendering a visible port element. */
  virtual?: boolean;
  colliderRadius?: number;
  lineClass?: typeof LineComponent;
  connectorObject?: ConnectorComponent | null;
  data?: Record<string, string>;
}

export interface ConnectorRef {
  object(): ConnectorComponent;
}

export const Connector = forwardRef<ConnectorRef, ConnectorProps>(
  (
    {
      allowDragOut = true,
      className = "",
      maxConnectors = 1,
      name,
      style,
      metadata = {},
      callbacks = {},
      edgePan = true,
      capabilities,
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
    const nodeObject = useContext(NodeObjectContext);
    if (!nodeObject) {
      throw new Error("<Connector> must be rendered inside <Node>.");
    }

    const ownsConnectorRef = useRef(connectorObject == null);
    const connectorRef = useRef<ConnectorComponent | null>(connectorObject);
    if (!connectorRef.current) {
      connectorRef.current = new ConnectorComponent(engine, nodeObject, {
        allowDragOut,
        maxConnectors,
        name,
        metadata,
        callbacks,
        edgePan,
        capabilities,
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
        allowDragOut,
        maxConnectors,
        metadata,
        callbacks,
        edgePan,
        capabilities,
        surfaceStrategies,
        colliderRadius,
        lineClass,
      });
    }, [
      allowDragOut,
      callbacks,
      capabilities,
      colliderRadius,
      connector,
      edgePan,
      lineClass,
      maxConnectors,
      metadata,
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
        className={`connector ${capabilities?.source ?? allowDragOut ? "right" : "left"} ${className}`.trim()}
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
