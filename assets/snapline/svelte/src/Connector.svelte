<script lang="ts">
  import {
    NodeComponent,
    ConnectorComponent,
    LineComponent,
    type ConnectorCapabilities,
    type ConnectorCallbacks,
    type ConnectorSurfaceStrategy,
    type SnapLineMetadata,
  } from "@snap-engine/snapline";
  import type { Engine } from "@snap-engine/core";
  import { getContext, onDestroy } from "svelte";

  let {
    name,
    maxConnectors = 1,
    allowDragOut = true,
    metadata = {},
    callbacks = {},
    edgePan = true,
    capabilities = undefined,
    surfaceStrategies = [],
    virtual = false,
    colliderRadius = undefined,
    lineClass = undefined,
    connectorObject = null,
    data = {},
  }: {
    name: string;
    maxConnectors?: number;
    allowDragOut?: boolean;
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
  } = $props();

  let engine: Engine = getContext("engine");
  let nodeObject: NodeComponent = getContext("nodeObject");
  const ownsConnector = connectorObject == null;
  let connector = connectorObject ?? new ConnectorComponent(engine, nodeObject, {
    name: name,
    maxConnectors: maxConnectors,
    allowDragOut: allowDragOut,
    metadata,
    callbacks,
    edgePan,
    capabilities,
    surfaceStrategies,
    colliderRadius,
    lineClass,
  });

  nodeObject.addConnectorObject(connector);

  export function object(): ConnectorComponent {
    return connector;
  }

  function bindConnectorElement(element: HTMLDivElement) {
    connector.bindElement(element);
    return {
      destroy() {
        connector.bindElement(null);
      },
    };
  }

  $effect(() => {
    connector.updateConfig({
      maxConnectors,
      allowDragOut,
      metadata,
      callbacks,
      edgePan,
      capabilities,
      surfaceStrategies,
      colliderRadius,
      lineClass,
    });
  });

  onDestroy(() => {
    if (ownsConnector) connector.destroy();
  });
</script>

{#if !virtual}
  <div
    use:bindConnectorElement
    data-snapline-type="connector"
    data-snapline-name={name}
    {...Object.fromEntries(Object.entries(data).map(([key, value]) => [`data-${key}`, value]))}
    class={`connector ${(capabilities?.source ?? allowDragOut) ? "right" : "left"}`}
  ></div>
{/if}

<style>
  .connector {
    width: 14px;
    height: 14px;
    border: 2px solid #ffffff;
    border-radius: 999px;
    background: #4f46e5;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.25);
    cursor: crosshair;
    pointer-events: auto;
  }
</style>
