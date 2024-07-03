import React from 'react';
import { useState } from 'react';
import { useRef } from 'react';
import { useEffect } from 'react';
export default function Output({nodeObject, setLineList, name}) {

    let [node, setNode] = useState(nodeObject);
    let outputDOM = useRef(null);

    useEffect(() => {
        node.addOutputConnector(outputDOM.current, name).setRenderLineCallback((l) => setLineList([...l]));
    }, []);

    return (
        <span className="sl-output-connector" ref={outputDOM}></span>
    );

}


