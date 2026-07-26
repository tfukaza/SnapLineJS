import {
  Connector,
  ControlledGraph,
  Group,
  Node,
  Select,
} from "@snap-engine/snapline-react";
import { useCallback, useState } from "react";
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

// The demo's canonical line document: topology is always controlled, so
// even a sandbox owns its lines and accepts every atomic proposal.
function DemoGraph() {
  const [lines, setLines] = useState([]);
  const applyRequest = useCallback((request) => {
    setLines((current) => [
      ...current
        .filter((record) => !request.remove.includes(record.id))
        .map((record) => {
          const update = request.update.find((u) => u.id === record.id);
          return update
            ? { ...record, toConnectorId: update.toConnectorId }
            : record;
        }),
      ...request.add,
    ]);
  }, []);
  return <ControlledGraph lines={lines} onLineChangeRequest={applyRequest} />;
}

function ResizableNode({ title, id = title, x, y }) {
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
            <Connector id={`${id}:input`} name="input" rules={{ maxOutgoing: 0, maxIncoming: 1, onFull: "replace-oldest" }} />
          </div>
          <span>Input</span>
        </div>
        <div className="output-row">
          <span>Output</span>
          <div className="connector-wrapper">
            <Connector id={`${id}:output`} name="output" rules={{ maxIncoming: 0 }} />
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
          <DemoGraph />
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

function SimpleNode({ title, id = title, x, y }) {
  return (
    <Node className="card node" x={x} y={y}>
      <div className="node-header">
        <h3>{title}</h3>
      </div>
      <div className="node-body">
        <div className="input-row">
          <div className="connector-wrapper">
            <Connector id={`${id}:input`} name="input" rules={{ maxOutgoing: 0, maxIncoming: 1, onFull: "replace-oldest" }} />
          </div>
          <span>Input</span>
        </div>
        <div className="output-row">
          <span>Output</span>
          <div className="connector-wrapper">
            <Connector id={`${id}:output`} name="output" rules={{ maxIncoming: 0 }} />
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
              id={`${nodeId}:input`}
              name="input"
              rules={{ maxOutgoing: 0, maxIncoming: maxIncoming === -1 ? "unlimited" : maxIncoming, onFull: "replace-oldest" }}
            />
          </div>
          <span>Input</span>
        </div>
        <div className="output-row">
          <span>Output</span>
          <div className="connector-wrapper">
            <Connector
              id={`${nodeId}:output`}
              name="output"
              rules={{ maxIncoming: 0 }}
            />
          </div>
        </div>
      </div>
    </Node>
  );
}

function SnapLineEdgesDemo() {
  const [lines, setLines] = useState([]);
  const [connectIntents, setConnectIntents] = useState(0);
  const [intentLog, setIntentLog] = useState([]);

  const addDocLine = (record) =>
    setLines((current) =>
      current.some((existing) => existing.id === record.id)
        ? current
        : [
            ...current.filter(
              (existing) => existing.toConnectorId !== record.toConnectorId,
            ),
            record,
          ],
    );

  const handleRequest = useCallback((request) => {
    const nodeOf = (connectorId) => connectorId.split(":")[0];
    setLines((current) => {
      const byId = new Map(current.map((record) => [record.id, record]));
      const label = (record) =>
        `${nodeOf(record.fromConnectorId)}->${nodeOf(record.toConnectorId)}`;
      const removed = request.remove
        .map((id) => (byId.has(id) ? label(byId.get(id)) : id))
        .join(",");
      const added = request.add.map(label).join(",");
      const updated = request.update
        .map((update) =>
          byId.has(update.id)
            ? label({ ...byId.get(update.id), toConnectorId: update.toConnectorId })
            : update.id,
        )
        .join(",");
      const entry =
        request.intent === "connect"
          ? `connect:${added}`
          : request.intent === "disconnect"
            ? `disconnect:${removed}`
            : request.intent === "reconnect"
              ? `reconnect:${updated}`
              : `replace:-${removed}+${added || updated}`;
      setIntentLog((log) => [...log, entry]);
      if (request.add.length > 0) setConnectIntents((count) => count + 1);
      // Accept the atomic proposal — adopting the proposed ids settles the
      // staged lines in place.
      return [
        ...current
          .filter((record) => !request.remove.includes(record.id))
          .map((record) => {
            const update = request.update.find((u) => u.id === record.id);
            return update
              ? { ...record, toConnectorId: update.toConnectorId }
              : record;
          }),
        ...request.add,
      ];
    });
  }, []);

  return (
    <main className="snapline-demo">
      <div style={{ position: "absolute", top: 4, left: 4, zIndex: 10 }}>
        <button
          data-testid="add-edge"
          onClick={() =>
            addDocLine({
              id: "doc-a-c",
              fromConnectorId: "a:output",
              toConnectorId: "c:input",
            })
          }
        >
          Add A→C
        </button>
        <span data-testid="connect-intents">{connectIntents}</span>
        <span data-testid="edge-count">{lines.length}</span>
        <span data-testid="intent-log">{intentLog.join("|")}</span>
      </div>
      <SnapEngine id="node-ui-edges-canvas" className="snapline-canvas">
        <div id="node-ui-demo">
          <div id="sl-background" />
          <Select />
          <ControlledGraph lines={lines} onLineChangeRequest={handleRequest} />
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
          <DemoGraph />
          <SimpleNode title="Node A" x={120} y={120} />
          <SimpleNode title="Node B" x={440} y={170} />
          <SimpleNode title="Node C" x={280} y={360} />
        </div>
      </SnapEngine>
    </main>
  );
}
