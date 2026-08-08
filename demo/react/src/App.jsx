import {
  Connector,
  ControlledGraph,
  Group,
  Node,
  ResizeRegion,
  Select,
} from "@snap-engine/snapline/react";
import { applyLineChange, RESIZE_HANDLES } from "@snap-engine/snapline";
import { useCallback, useRef, useState } from "react";
import { Engine as SnapEngine } from "@snap-engine/asset-base/react";
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
  // The handler must return the next list synchronously, so the document lives
  // in a ref: a functional setState would not have produced it in time. Nothing
  // here renders the records, so no component state is needed at all.
  const linesRef = useRef([]);
  const applyRequest = useCallback(
    (request) =>
      (linesRef.current = applyLineChange(linesRef.current, request)),
    [],
  );
  return <ControlledGraph onLineChangeRequest={applyRequest} />;
}

function ResizableNode({ title, id = title, x, y }) {
  return (
    <Node
      className="card node"
      x={x}
      y={y}
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
            <Connector
              id={`${id}:input`}
              name="input"
              rules={{
                maxOutgoing: 0,
                maxIncoming: 1,
                onFull: "replace-oldest",
              }}
            />
          </div>
          <span>Input</span>
        </div>
        <div className="output-row">
          <span>Output</span>
          <div className="connector-wrapper">
            <Connector
              id={`${id}:output`}
              name="output"
              rules={{ maxIncoming: 0 }}
            />
          </div>
        </div>
      </div>
      <ResizeRegions />
    </Node>
  );
}

function ResizeRegions({ handles = RESIZE_HANDLES }) {
  const thickness = 14;
  return handles.map((handle) => {
    const north = handle.startsWith("n");
    const south = handle.startsWith("s");
    const east = handle.endsWith("e");
    const west = handle.endsWith("w");
    const corner = handle.length === 2;
    return (
      <ResizeRegion
        key={handle}
        handle={handle}
        style={{
          position: "absolute",
          zIndex: 2,
          ...(handle === "n" || handle === "s"
            ? {
                left: thickness,
                right: thickness,
                height: thickness,
                cursor: "ns-resize",
              }
            : null),
          ...(handle === "e" || handle === "w"
            ? {
                top: thickness,
                bottom: thickness,
                width: thickness,
                cursor: "ew-resize",
              }
            : null),
          ...(corner ? { width: thickness, height: thickness } : null),
          ...(north ? { top: -thickness / 2 } : null),
          ...(south ? { bottom: -thickness / 2 } : null),
          ...(east ? { right: -thickness / 2 } : null),
          ...(west ? { left: -thickness / 2 } : null),
          ...(handle === "ne" || handle === "sw"
            ? { cursor: "nesw-resize" }
            : null),
          ...(handle === "nw" || handle === "se"
            ? { cursor: "nwse-resize" }
            : null),
        }}
      />
    );
  });
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
          >
            <ResizeRegions handles={["se"]} />
          </Group>
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
            <Connector
              id={`${id}:input`}
              name="input"
              rules={{
                maxOutgoing: 0,
                maxIncoming: 1,
                onFull: "replace-oldest",
              }}
            />
          </div>
          <span>Input</span>
        </div>
        <div className="output-row">
          <span>Output</span>
          <div className="connector-wrapper">
            <Connector
              id={`${id}:output`}
              name="output"
              rules={{ maxIncoming: 0 }}
            />
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

  if (path === "/snapsort-insertion" || demo === "snapsort_insertion") {
    return <SnapSortInsertionDemo />;
  }

  if (path === "/snapsort-website-core" || demo === "snapsort_website_core") {
    return <SnapSortWebsiteCoreDemo />;
  }

  if (path === "/snapsort-components" || demo === "snapsort_components") {
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

function GraphNode({ nodeId, title, x, y, maxIncoming = 1 }) {
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
              rules={{
                maxOutgoing: 0,
                maxIncoming: maxIncoming === -1 ? "unlimited" : maxIncoming,
                onFull: "replace-oldest",
              }}
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
  // The document also drives rendering (edge-count), so it is mirrored into a
  // ref the synchronous handler can read.
  const linesRef = useRef(lines);
  const graphRef = useRef(null);

  const commit = useCallback((next) => {
    linesRef.current = next;
    setLines(next);
    return next;
  }, []);

  // No originating request, so this one has to be pushed through the handle.
  const addDocLine = (record) => {
    const current = linesRef.current;
    if (current.some((existing) => existing.id === record.id)) return;
    const next = commit([
      ...current.filter(
        (existing) => existing.toConnectorId !== record.toConnectorId,
      ),
      record,
    ]);
    graphRef.current?.setCanonicalGraph({ lines: next });
  };

  const handleRequest = useCallback(
    (request) => {
      const nodeOf = (connectorId) => connectorId.split(":")[0];
      const current = linesRef.current;
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
            ? label({
                ...byId.get(update.id),
                toConnectorId: update.toConnectorId,
              })
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
      return commit(applyLineChange(current, request));
    },
    [commit],
  );

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
          <ControlledGraph ref={graphRef} onLineChangeRequest={handleRequest} />
          <GraphNode nodeId="a" title="Node A" x={120} y={120} />
          <GraphNode
            nodeId="b"
            title="Node B"
            x={440}
            y={170}
            maxIncoming={1}
          />
          <GraphNode nodeId="c" title="Node C" x={280} y={380} />
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
