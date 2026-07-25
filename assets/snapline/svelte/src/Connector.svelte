<script lang="ts">
  import {
    NodeComponent,
    ConnectorComponent,
    type ConnectorCallbacks,
    type SnapLineMetadata,
  } from "@snap-engine/snapline";
  import type { Engine } from "@snap-engine/core";
  import { getContext, onDestroy, onMount } from "svelte";

  let {
    name,
    maxConnectors = 1,
    allowDragOut = true,
    metadata = {},
    callbacks = {},
    edgePan = true,
    connectorObject = null,
    data = {},
  }: {
    name: string;
    maxConnectors?: number;
    allowDragOut?: boolean;
    metadata?: SnapLineMetadata;
    callbacks?: ConnectorCallbacks;
    edgePan?: boolean;
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
  });

  nodeObject.addConnectorObject(connector);
  let connectorDOM: HTMLDivElement | null = null;

  export function object(): ConnectorComponent {
    return connector;
  }

  onMount(() => {
    connector.element = connectorDOM as HTMLElement;
  });

  onDestroy(() => {
    if (ownsConnector) connector.destroy();
  });
</script>

<div
  bind:this={connectorDOM}
  data-snapline-type="connector"
  data-snapline-name={name}
  {...Object.fromEntries(Object.entries(data).map(([key, value]) => [`data-${key}`, value]))}
  class={`connector ${allowDragOut ? "right" : "left"}`}
></div>

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
