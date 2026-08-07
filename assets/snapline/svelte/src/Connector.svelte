<script lang="ts">
  import {
    NodeMirror,
    ConnectorMirror,
    type ConnectorRules,
    type ConnectorCallbacks,
    type ConnectorSurfaceStrategy,
    type SnapLineMetadata,
  } from "@snap-engine/snapline";
  import type { Engine } from "@snap-engine/core";
  import { getContext, onDestroy, type Snippet } from "svelte";

  type ConnectorAction = (
    element: HTMLElement | SVGElement,
  ) => { destroy(): void };

  let {
    id = undefined,
    name,
    rules = undefined,
    metadata = {},
    callbacks = {},
    edgePan = true,
    surfaceStrategies = [],
    children = undefined,
    colliderRadius = undefined,
    connectorObject = null,
    data = {},
  }: {
    /** Stable domain identity; minted when omitted (supply for persistence). */
    id?: string;
    name: string;
    rules?: Partial<ConnectorRules>;
    metadata?: SnapLineMetadata;
    callbacks?: ConnectorCallbacks;
    edgePan?: boolean;
    surfaceStrategies?: readonly ConnectorSurfaceStrategy[];
    /** Custom connector root. Apply the snippet argument with `use:`. */
    children?: Snippet<[ConnectorAction]>;
    colliderRadius?: number;
    connectorObject?: ConnectorMirror | null;
    data?: Record<string, string>;
  } = $props();

  let engine: Engine = getContext("engine");
  let nodeObject: NodeMirror = getContext("nodeObject");
  const ownsConnector = connectorObject == null;
  let connector = connectorObject ?? new ConnectorMirror(engine, nodeObject, {
    id,
    name: name,
    rules,
    metadata,
    callbacks,
    edgePan,
    surfaceStrategies,
    colliderRadius,
  });

  nodeObject.addConnectorObject(connector);

  export function object(): ConnectorMirror {
    return connector;
  }

  function bindConnectorElement(element: HTMLElement | SVGElement) {
    connector.bindElement(element);
    return {
      destroy() {
        if (connector.element === element) connector.bindElement(null);
      },
    };
  }

  $effect(() => {
    connector.updateConfig({
      rules,
      metadata,
      callbacks,
      edgePan,
      surfaceStrategies,
      colliderRadius,
    });
  });

  onDestroy(() => {
    if (ownsConnector) connector.destroy(false);
  });
</script>

{#if children}
  {@render children(bindConnectorElement)}
{:else}
  <div
    use:bindConnectorElement
    data-snapline-type="connector"
    data-snapline-name={name}
    {...Object.fromEntries(Object.entries(data).map(([key, value]) => [`data-${key}`, value]))}
    class={`connector ${(rules?.maxOutgoing ?? "unlimited") !== 0 ? "right" : "left"}`}
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
