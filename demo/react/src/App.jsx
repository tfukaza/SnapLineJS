import React from "react";
import { useState } from "react";
import { useRef } from "react";
import SnapLine from "./lib/snapline.mjs";
import { useEffect } from "react";
import MathNode from "./components/Math";


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
            return <Button buttonText="Print" />;
        } else if (type === "lerp") {
            return <Button buttonText="Lerp" />;
        } else if (type === "const") {
            return <Button buttonText="Constant" />;
        }
    }

    const [chooseNodeToggle, setChooseNodeToggle] = useState(false);
    const [chooseThemeToggle, setChooseThemeToggle] = useState(false);

    function menuClick(e, type) {
        if (type === "nodeMenu") {
            setChooseNodeToggle(() => !chooseNodeToggle);
            setChooseThemeToggle(false);
        } else if (type === "themeMenu") {
            setChooseThemeToggle(() => !chooseThemeToggle);
            setChooseNodeToggle(false);
        }
    }

    function handleSelectNode(e, type) {
        let [node, newNodeDict] = snapLine.addNodeObject();
        node.nodeType = type;
        let newNodeList = Object.values(newNodeDict);
        setNodes([...newNodeList]);
    }

    const [theme, setTheme] = useState("standard_light");

    function handleSelectTheme(e, theme) {
        setTheme(theme);
        setChooseThemeToggle(false);
    }

    return (
        <main>
            <link rel="stylesheet" href={`lib/${theme}.css`} />

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
                            <li><button className="sl-btn" onClick={e => handleSelectNode(e, "lerp")}>Constant</button></li>
                            <li><button className="sl-btn" onClick={e => handleSelectNode(e, "const")}>Lerp</button></li>
                        </ul>
                    </div>
                </div>
                <div className="sl-dropdown">
                    <div
                        id="addNodeButton"
                        className={`menu-button${chooseThemeToggle ? "" : " hide"}`}
                        onClick={e => menuClick(e, "themeMenu")}
                    >
                        Theme
                        <ul className="hide" id="themeMenu">
                            <li><button id="standardButton" className="sl-btn" onClick={e => handleSelectTheme(e, "standard_light")}>Standard (Light)</button> </li>
                            <li><button id="darkButton" className="sl-btn" onClick={e => handleSelectTheme(e, "standard_dark")}>Standard (Dark)</button> </li>
                            < li > <button id="retroButton" className="sl-btn" onClick={e => handleSelectTheme(e, "retro")}>Retro</button></li>
                        </ul>
                    </div>
                </div>
            </nav>
        </main >
    );

}

