import React from 'react';
import { useState } from 'react';
import Node from './Node';
import Output from './Output';
import InputNumber from './InputNumber';

export default function ConstantNode(nodeObject) {

    let [node, setNode] = useState(nodeObject);  
    let [lineList, setLineList] = useState(node.svgLines || []);
    
    function updateText(e, name) {
        node.prop.number_output = e.target.value;
    }

    return (
        <Node nodeObject={node} lineList={lineList}>
            <div className="sl-row right">
                <span className="sl-label right">Output</span>
                <Output nodeObject={node} setLineList={setLineList} name="number_output" />
            </div>
            <div className="sl-row">
                <InputNumber nodeObject={node} name="number_input" updateText={updateText} />
            </div>
        </Node>
    );
}


