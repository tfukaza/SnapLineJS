import {
  Connector,
  EdgeSync,
  Group,
  Node,
  Select,
} from "@snap-engine/snapline-react";
import { useState } from "react";
import { Engine as SnapEngine } from "@snap-engine/asset-base-react";
import {
  DropSnapNestedDemo,
  SnapSortComponentsDemo,
  SnapSortDuolingoDemo,
  SnapSortInsertionDemo,
  SnapSortWebsiteCoreDemo,
} from "./snapsort/SnapSortFixtures";
import "../demo.css";
import AssetBaseReactDemo from "./AssetBaseReactDemo";

function ResizableNode({ title, x, y }) {
  return (
    <Node
      className="card node"
      x={x}
      y={y}
      resizable
      minWidth={140}
      minHeight={90}
      style={{ display: "flex", flexDirection: "column" }}
    >
      <div className="node-header">
        <h3>{title}</h3>
      </div>
      <div className="node-body" style={{ flex: 1 }}>
        <div className="input-row">
          <div className="connector-wrapper">
            <Connector name="input" maxConnectors={1} allowDragOut={false} />
          </div>
          <span>Input</span>
        </div>
        <div className="output-row">
          <span>Output</span>
          <div className="connector-wrapper">
            <Connector name="output" maxConnectors={-1} allowDragOut={true} />
          </div>
        </div>
      </div>
    </Node>
  );
}

function SnapLineResizeDemo() {
  return (
    <main className="snapline-demo">
      <SnapEngine id="node-ui-resize-canvas" className="snapline-canvas">
        <div id="node-ui-demo">
          <div id="sl-background" />
          <ResizableNode title="Resizable A" x={120} y={140} />
          <SimpleNode title="Fixed B" x={560} y={200} />
        </div>
      </SnapEngine>
    </main>
  );
}

function SnapLineGroupDemo() {
  const updateMembers = ({ added, removed }) => {
    for (const node of added) {
      node.element?.setAttribute("data-member", "true");
    }
    for (const node of removed) {
      node.element?.removeAttribute("data-member");
    }
  };
  return (
    <main className="snapline-demo">
      <SnapEngine id="node-ui-group-canvas" className="snapline-canvas">
        <div id="node-ui-demo">
          <div id="sl-background" />
          <Group
            title="Group A"
            x={60}
            y={60}
            width={520}
            height={460}
            style={{
              background: "rgba(120, 160, 255, 0.12)",
              border: "1px solid rgba(120, 160, 255, 0.6)",
              borderRadius: "8px",
            }}
            onMembershipChange={updateMembers}
          />
          <SimpleNode title="Node A" x={100} y={110} />
          <SimpleNode title="Node C" x={100} y={300} />
          <SimpleNode title="Node B" x={640} y={120} />
        </div>
      </SnapEngine>
    </main>
  );
}

function SimpleNode({ title, x, y }) {
  return (
    <Node className="card node" x={x} y={y}>
      <div className="node-header">
        <h3>{title}</h3>
      </div>
      <div className="node-body">
        <div className="input-row">
          <div className="connector-wrapper">
            <Connector name="input" maxConnectors={1} allowDragOut={false} />
          </div>
          <span>Input</span>
        </div>
        <div className="output-row">
          <span>Output</span>
          <div className="connector-wrapper">
            <Connector name="output" maxConnectors={-1} allowDragOut={true} />
          </div>
        </div>
      </div>
    </Node>
  );
}

export default function App() {
  const path = window.location.pathname;
  const demo = new URLSearchParams(window.location.search).get("demo");

  if (demo === "camera_control" || demo === "asset_base_react") {
    return <AssetBaseReactDemo />;
  }

  if (
    path === "/snapsort-insertion" ||
    demo === "snapsort_insertion"
  ) {
    return <SnapSortInsertionDemo />;
  }

  if (
    path === "/snapsort-website-core" ||
    demo === "snapsort_website_core"
  ) {
    return <SnapSortWebsiteCoreDemo />;
  }

  if (
    path === "/snapsort-components" ||
    demo === "snapsort_components"
  ) {
    return <SnapSortComponentsDemo />;
  }

  if (demo === "snapsort_duolingo") {
    return <SnapSortDuolingoDemo />;
  }

  if (
    path === "/snapsort" ||
    path === "/drop-snap-nested" ||
    demo === "snapsort" ||
    demo === "drop_snap_nested" ||
    demo === "drag_drop" ||
    demo === "nested_items"
  ) {
    return <DropSnapNestedDemo />;
  }

  if (path === "/snapline-resize" || demo === "snapline_resize") {
    return <SnapLineResizeDemo />;
  }

  if (path === "/snapline-group" || demo === "snapline_group") {
    return <SnapLineGroupDemo />;
  }

  if (path === "/snapline-edges" || demo === "snapline_edges") {
    return <SnapLineEdgesDemo />;
  }

  return <SnapLineDemo />;
}

function EdgeSyncNode({ nodeId, title, x, y, maxIncoming = 1 }) {
  return (
    <Node className="card node" x={x} y={y}>
      <div className="node-header">
        <h3>{title}</h3>
      </div>
      <div className="node-body">
        <div className="input-row">
          <div className="connector-wrapper">
            <Connector
              name="input"
              maxConnectors={maxIncoming}
              allowDragOut={false}
              metadata={{ node: nodeId, port: "input" }}
            />
          </div>
          <span>Input</span>
        </div>
        <div className="output-row">
          <span>Output</span>
          <div className="connector-wrapper">
            <Connector
              name="output"
              maxConnectors={-1}
              allowDragOut={true}
              metadata={{ node: nodeId, port: "output" }}
            />
          </div>
        </div>
      </div>
    </Node>
  );
}

function SnapLineEdgesDemo() {
  const [edges, setEdges] = useState([]);
  const [connectIntents, setConnectIntents] = useState(0);
  const [intentLog, setIntentLog] = useState([]);

  const sameEdge = (a, b) =>
    a.from.node === b.from.node &&
    a.from.port === b.from.port &&
    a.to.node === b.to.node &&
    a.to.port === b.to.port;

  const addEdge = (edge) =>
    setEdges((current) =>
      current.some((existing) => sameEdge(existing, edge))
        ? current
        : [
            ...current.filter(
              (existing) =>
                !(existing.to.node === edge.to.node && existing.to.port === edge.to.port),
            ),
            edge,
          ],
    );

  const identity = (connector) => {
    const metadata = connector.metadata;
    return typeof metadata.node === "string" && typeof metadata.port === "string"
      ? { node: metadata.node, port: metadata.port }
      : null;
  };

  return (
    <main className="snapline-demo">
      <div style={{ position: "absolute", top: 4, left: 4, zIndex: 10 }}>
        <button
          data-testid="add-edge"
          onClick={() =>
            addEdge({ from: { node: "a", port: "output" }, to: { node: "c", port: "input" } })
          }
        >
          Add A→C
        </button>
        <span data-testid="connect-intents">{connectIntents}</span>
        <span data-testid="edge-count">{edges.length}</span>
        <span data-testid="intent-log">{intentLog.join("|")}</span>
      </div>
      <SnapEngine id="node-ui-edges-canvas" className="snapline-canvas">
        <div id="node-ui-demo">
          <div id="sl-background" />
          <Select />
          <EdgeSync
            edges={edges}
            identity={identity}
            onEdgeConnect={({ from, to }) => {
              setConnectIntents((count) => count + 1);
              setIntentLog((log) => [...log, `connect:${from.node}->${to.node}`]);
              addEdge({ from, to });
            }}
            onEdgeDisconnect={({ from, to, reason }) => {
              setIntentLog((log) => [
                ...log,
                `disconnect(${reason}):${from.node}->${to.node}`,
              ]);
              setEdges((current) =>
                current.filter((existing) => !sameEdge(existing, { from, to })),
              );
            }}
          />
          <EdgeSyncNode nodeId="a" title="Node A" x={120} y={120} />
          <EdgeSyncNode nodeId="b" title="Node B" x={440} y={170} maxIncoming={1} />
          <EdgeSyncNode nodeId="c" title="Node C" x={280} y={380} />
        </div>
      </SnapEngine>
    </main>
  );
}

function SnapLineDemo() {
  return (
    <main className="snapline-demo">
      <SnapEngine id="node-ui-demo-canvas" className="snapline-canvas">
        <div id="node-ui-demo">
          <div id="sl-background" />
          <Select />
          <SimpleNode title="Node A" x={120} y={120} />
          <SimpleNode title="Node B" x={440} y={170} />
          <SimpleNode title="Node C" x={280} y={360} />
        </div>
      </SnapEngine>
    </main>
  );
}
