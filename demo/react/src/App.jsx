import React from "react";
import { useState } from "react";

import SnapLineReact from "./SnapLineReact";
import NodeSelect from "./NodeSelect";
import MathNode from "./components/nodes/Math";
import ConstantNode from "./components/nodes/Constant";
import LerpNode from "./components/nodes/Lerp";
import PrintNode from "./components/nodes/Print";

export default function App() {
  const [nodes, setNodes] = useState([]);
  const [chooseNodeToggle, setChooseNodeToggle] = useState(false);

  function menuClick(e, type) {
    if (type === "nodeMenu") {
      setChooseNodeToggle(() => !chooseNodeToggle);
    }
  }

  return (
    <main>
      <link rel="stylesheet" href={`lib/style.css`} />

      <SnapLineReact>{nodes}</SnapLineReact>

      <nav className="navbar">
        <div className="sl-dropdown">
          <div
            id="addNodeButton"
            className={`menu-button${chooseNodeToggle ? "" : " hide"}`}
            onClick={(e) => menuClick(e, "nodeMenu")}
          >
            Add Node
            <ul className="hide" id="addNodeMenu">
              <NodeSelect
                name="Math"
                component={MathNode}
                setNodes={setNodes}
              />

              <NodeSelect
                name="Constant"
                component={ConstantNode}
                setNodes={setNodes}
              />

              <NodeSelect
                name="Lerp"
                component={LerpNode}
                setNodes={setNodes}
              />

              <NodeSelect
                name="Print"
                component={PrintNode}
                setNodes={setNodes}
              />
            </ul>
          </div>
        </div>
      </nav>
    </main>
  );
}
