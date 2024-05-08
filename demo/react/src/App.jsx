import React from "react";
import { useState } from "react";
import { useRef } from "react";
import Button from "./components/Button";
import SnapLine from "./lib/snapline.js";
import { useEffect } from "react";
import MathNode from "./components/Math";


export default function App() {

    const [nodes, setNodes] = useState([]);
    const snapLine = useRef(null);
    const slCanvasContainer = useRef(null);
    const slCanvas = useRef(null);
    const slBackground = useRef(null);
    const slSelection = useRef(null);

    //let nodeList = [];

    let canvasContainerStyle = {
        overflow: 'hidden',
        position: 'relative',
    };

    const [slCanvasStyle, setSlCanvasStyle] = useState(null);
    const [slBackgroundStyle, setSlBackgroundStyle] = useState(null);
    const [slSelectionStyle, setSlSelectionStyle] = useState(null);

    useEffect(() => {
        snapLine.current = new SnapLine();
        //snapLine.current.setCanvasContainerStyle = setSlCanvasContainerStyle;
        snapLine.current.renderCanvasElement = function (type, style) {
            switch (type) {
                case 0:
                    //console.error("Invalid dom type: " + type);
                    break;
                case 1:
                    setSlCanvasStyle(style);
                    break;
                case 2:
                    setSlBackgroundStyle(style);
                    break;
                case 3:
                    setSlSelectionStyle(style);
                    break;
                default:
                    console.error("Invalid dom type: " + type);
                    return;
            }
        };

        snapLine.current.initSnapLine(
            slCanvasContainer.current,
            slCanvas.current,
            slBackground.current,
            slSelection.current
        );
        setNodes(snapLine.current.g.globalNodeTabel);
    }, []);

    function typeToNode(node) {
        let type = node.nodeType;
        if (type === "math") {
            return <MathNode {...node} />;
        } else if (type === "print") {
            return <Button buttonText="Print" />;
        } else if (type === "lerp") {
            return <Button buttonText="Lerp" />;
        } else if (type === "const") {
            return <Button buttonText="Constant" />;
        }
    }

    function handleClick(e, type) {
        console.log("Button Clicked");
        let [node, newNodeDict] = snapLine.current.addNodeObject();
        node.nodeType = type;
        let newNodeList = Object.values(newNodeDict);
        console.log(newNodeList);
        setNodes([...newNodeList]);
    }


    return (
        <main>
            <div ref={slCanvasContainer} style={canvasContainerStyle} id="sl-canvas-container">
                <div ref={slCanvas} id="slCanvas" style={slCanvasStyle}>
                    <div ref={slBackground} id="slBackground" style={slBackgroundStyle}></div>
                    {nodes?.map((node, index) => { return typeToNode(node) })}
                </div>
                <div ref={slSelection} id="slSelection" style={slSelectionStyle}></div>
            </div>

            <nav className="navbar">
                <div className="sl-dropdown">
                    <div id="addNodeButton" className="menu-button hide" onClick={e => e.target.classList.toggle("hide")}>
                        Add Node
                        <ul className="hide" id="addNodeMenu">
                            <li><button className="sl-btn" onClick={e => handleClick(e, "math")}>Math</button></li>
                            <li><button className="sl-btn" onClick={e => handleClick(e, "print")}>Print</button></li>
                            <li><button className="sl-btn" onClick={e => handleClick(e, "lerp")}>Constant</button></li>
                            <li><button className="sl-btn" onClick={e => handleClick(e, "const")}>Lerp</button></li>
                        </ul>
                    </div>
                </div>
                <div className="sl-dropdown">
                    <div id="themeButton" className="menu-button">
                        Theme
                        <ul className="hide" id="themeMenu">
                            <li><button id="standardButton" className="sl-btn">Standard</button>
                            </li>
                            <li><button id="darkButton" className="sl-btn">Standard (Dark)</button>
                            </li>
                            <li><button id="retroButton" className="sl-btn">Retro</button></li>
                        </ul>
                    </div>
                </div>
            </nav>
        </main>
    );

}

