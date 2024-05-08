import React from 'react';
import { useState } from 'react';
import { useRef } from 'react';
import { useEffect } from 'react';

export default function MathNode(nodeObject) {

    let nodeProp = useRef({
        input_1: 0,
        input_2: 0,
        operation: '+',
        result: 0
    });
    let nodeDom = useRef(null);
    let input1Dom = useRef(null);
    let form1Dom = useRef(null);
    let input2Dom = useRef(null);
    let form2Dom = useRef(null);
    let resultDom = useRef(null);

    let [nodeStyle, setNodeStyle] = useState({});
    // let [tmpLineStyle, setTmpLineStyle] = useState({
    //     position: 'absolute',
    //     overflow: 'visible',
    //     pointerEvents: 'none',
    //     willChange: 'transform',
    // });

    let node = useRef(nodeObject);
    let [lineList, setLineList] = useState(node.current.svgLines);



    node.current.renderNode = setNodeStyle;

    // node.current.createTmpSvgLineDOM = function (x, y) {
    //     let tmpDom = <svg className="sl-svg-line" width="100%" height="100%" style={tmpLineStyle}>
    //         <line x1="0" y1="0" x2={x} y2={y} stroke-width="2" stroke="black" />
    //     </svg>;
    //     setTmpLine(tmpDom);
    //     return tmpDom;
    // }
    // node.current.deleteTmpSvgLine = function () {
    //     setTmpLine(null);
    // }


    useEffect(() => {
        node.current.setNodeStyle = setNodeStyle;
        node.current.initNode(nodeDom.current);
        node.current.addInputConnector(input1Dom.current, "input_1");
        node.current.addInputForm(form1Dom.current, "input_1");
        node.current.addInputConnector(input2Dom.current, "input_2");
        node.current.addInputForm(form2Dom.current, "input_2");
        node.current.addOutputConnector(resultDom.current, "result").renderAllLines = function (l) {
            console.log("Render All Lines", l);
            setLineList([...l]);
        }

    }, []);

    function calculateMath() {
        let input1 = +nodeProp.input_1;
        let input2 = +nodeProp.input_2;
        let operation = nodeProp.operation;

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

        console.debug("Result", result)
        nodeProp.current.result = result;
    }

    function updateText(e, name) {
        console.log(`Name: ${name}, Value: ${e.target.value}`);
        nodeProp[name] = e.target.value;
        calculateMath();
    }

    function updateOperation(e) {
        console.log(`Operation: ${e.target.value}`);
        nodeProp.operation = e.target.value;
        calculateMath();
    }

    function initMath() {
        calculateMath();
    }



    return (
        <>
            {lineList?.map((line, index) => {
                let style = {
                    position: 'absolute',
                    overflow: 'visible',
                    pointerEvents: 'none',
                    willChange: 'transform',
                    transform: `translate3d(${line.connector_x}px, ${line.connector_y}px, 0)`
                };
                return <svg className="sl-svg-line" key={index} width="4" height="4" style={style}>
                    <line x1='0' y1='0' x2={line.x2} y2={line.y2} stroke-width="2" stroke="black" />
                </svg>
            })}

            <div className="sl-node" ref={nodeDom} style={nodeStyle}>
                <div className="sl-row right">
                    <span className="sl-label right">Result</span>
                    <span className="sl-output-connector" ref={resultDom}></span>
                </div>
                <div className="sl-row">
                    <select className="sl-input" onChange={updateOperation}>
                        <option value="+">Add!</option>
                        <option value="-">Subtract</option>
                        <option value="*">Multiply</option>
                        <option value="/">Divide</option>
                    </select>
                </div>
                <div className="sl-row">
                    <span className="sl-input-connector" ref={input1Dom}></span>
                    <span className="sl-label">Input 1</span>
                    <input className="sl-input" type="number" value="0" onChange={e => updateText(e, "whopper_1")} ref={form1Dom} />
                </div>
                <div className="sl-row">
                    <span className="sl-input-connector" ref={input2Dom}></span>
                    <span className="sl-label">Input 2</span>
                    <input className="sl-input" type="number" value="0" onChange={e => updateText(e, "whopper_2")} ref={form2Dom} />
                </div>
            </div>
        </>
    );

}


