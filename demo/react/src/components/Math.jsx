import React from 'react';
import { useState } from 'react';
import { useRef } from 'react';
import { useEffect } from 'react';
import Lines from './Lines';

export default function MathNode(nodeObject) {

    let [node, setNode] = useState(nodeObject);   // Node object
    let [nodeStyle, setNodeStyle] = useState(node.nodeStyle);   // Style of the node


    let nodeDom = useRef(null);     // Reference to the node div
    let input1Dom = useRef(null);
    let form1Dom = useRef(null);
    let input2Dom = useRef(null);
    let form2Dom = useRef(null);
    let resultDom = useRef(null);

    // List of lines emanating from output connector(s) of this node
    let [lineList, setLineList] = useState(node.svgLines || []);

    useEffect(() => {
        node.setRenderNodeCallback(setNodeStyle);
        node.addInputConnector(input1Dom.current, "input_1");
        node.addInputForm(form1Dom.current, "input_1");
        node.addInputConnector(input2Dom.current, "input_2");
        node.addInputForm(form2Dom.current, "input_2");
        node.addOutputConnector(resultDom.current, "result").setRenderLineCallback((l) => setLineList([...l]));
        node.initNode(nodeDom.current);

    }, []);

    function calculateMath() {
        let input1 = +node.prop.input_1;
        let input2 = +node.prop.input_2;
        let operation = node.prop.operation;

        console.debug(input1, input2, operation);

        let result = 0;

        if (operation == '+') {
            result = input1 + input2;
        } else if (operation == '-') {
            result = input1 - input2;
        } else if (operation == '*') {
            result = input1 * input2;
        } else {
            result = input1 / input2;
        }

        node.prop.result = result;

        console.log("Result: ", result);
    }

    function updateText(e, name) {
        node.prop[name] = e.target.value;
        calculateMath();
    }

    function updateOperation(e) {
        node.prop.operation = e.target.value;
        calculateMath();
    }

    return (
        <>
            <Lines lineList={lineList} />

            <div className="sl-node" ref={nodeDom} style={nodeStyle}>
                <div className="sl-row right">
                    <span className="sl-label right">Result</span>
                    <span className="sl-output-connector" ref={resultDom}></span>
                </div>
                <div className="sl-row">
                    <select className="sl-input" onChange={updateOperation}>
                        <option value="+">Add</option>
                        <option value="-">Subtract</option>
                        <option value="*">Multiply</option>
                        <option value="/">Divide</option>
                    </select>
                </div>
                <div className="sl-row">
                    <span className="sl-input-connector" ref={input1Dom}></span>
                    <span className="sl-label">Input 1</span>
                    <input className="sl-input" type="number" value={node.prop.input_1 || 0} onChange={e => updateText(e, "input_1")} ref={form1Dom} />
                </div>
                <div className="sl-row">
                    <span className="sl-input-connector" ref={input2Dom}></span>
                    <span className="sl-label">Input 2</span>
                    <input className="sl-input" type="number" value={node.prop.input_2 || 0} onChange={e => updateText(e, "input_2")} ref={form2Dom} />
                </div>
            </div>
        </>
    );

}


