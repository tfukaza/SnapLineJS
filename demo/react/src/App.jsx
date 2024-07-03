import React from "react";
import { useState } from "react";
import { useRef } from "react";
import { useEffect } from "react";
import SnapLine from "./lib/snapline.mjs";
import MathNode from "./components/Math";
import PrintNode from "./components/Print";
import LerpNode from "./components/Lerp";
import ConstantNode from "./components/Constant";


export default function App() {

    const [snapLine] = useState(() => new SnapLine());  // SnapLine object
    const slContainer = useRef(null);                   // div to contain the canvas
    const slCanvas = useRef(null);                      // canvas that contains the nodes
    const slBackground = useRef(null);                  // Background of the canvas
    const slSelection = useRef(null);                   // selection box

    const [nodes, setNodes] = useState([]);             // List of nodes

    const [containerStyle, setContainerStyle] = useState(null);
    const [slCanvasStyle, setSlCanvasStyle] = useState(null);
    const [slBackgroundStyle, setSlBackgroundStyle] = useState(null);
    const [slSelectionStyle, setSlSelectionStyle] = useState(null);

    useEffect(() => {
        snapLine.setRenderContainerCallback(setContainerStyle);
        snapLine.setRenderCanvasCallback(setSlCanvasStyle);
        snapLine.setRenderBackgroundCallback(setSlBackgroundStyle);
        snapLine.setRenderSelectionBoxCallback(setSlSelectionStyle);   
        snapLine.initSnapLine(
            slContainer.current,
            slCanvas.current,
            slBackground.current,
            slSelection.current
        );
    }, []);

    function typeToNode(node) {
        let type = node.nodeType;
        if (type === "math") {
            return <MathNode {...node} />;
        } else if (type === "print") {
            return <PrintNode {...node} />;
        } else if (type === "lerp") {
            return <LerpNode {...node} />;
        } else if (type === "constant") {
            return <ConstantNode {...node} />;
        }
    }

    const [chooseNodeToggle, setChooseNodeToggle] = useState(false);

    function menuClick(e, type) {
        if (type === "nodeMenu") {
            setChooseNodeToggle(() => !chooseNodeToggle);
        }
    }

    function handleSelectNode(e, type) {
        let [node, newNodeDict] = snapLine.addNodeObject();
        node.nodeType = type;
        let newNodeList = Object.values(newNodeDict);
        setNodes([...newNodeList]);
    }

    return (
        <main>
            <link rel="stylesheet" href={`lib/style.css`} />

            <div className="sl-container" ref={slContainer} style={containerStyle} id="sl-canvas-container">
                <div ref={slCanvas} id="slCanvas" style={slCanvasStyle}>
                    <div ref={slBackground} id="sl-background" style={slBackgroundStyle}></div>
                    {nodes.map((node, index) => { return typeToNode(node); })}
                </div>
                <div ref={slSelection} id="sl-selection" style={slSelectionStyle}></div>
            </div>

            <nav className="navbar">
                <div className="sl-dropdown">
                    <div
                        id="addNodeButton"
                        className={`menu-button${chooseNodeToggle ? "" : " hide"}`}
                        onClick={e => menuClick(e, "nodeMenu")}
                    >
                        Add Node
                        <ul className="hide" id="addNodeMenu">
                            <li><button className="sl-btn" onClick={e => handleSelectNode(e, "math")}>Math</button></li>
                            <li><button className="sl-btn" onClick={e => handleSelectNode(e, "print")}>Print</button></li>
                            <li><button className="sl-btn" onClick={e => handleSelectNode(e, "constant")}>Constant</button></li>
                            <li><button className="sl-btn" onClick={e => handleSelectNode(e, "lerp")}>Lerp</button></li>
                        </ul>
                    </div>
                </div>
            </nav>
        </main >
    );

}

