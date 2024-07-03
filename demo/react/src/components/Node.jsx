import React from 'react';
import { useState } from 'react';
import { useRef } from 'react';
import { useEffect } from 'react';
import Lines from './Lines';

export default function Node({nodeObject, lineList, children}) {

    let [node, setNode] = useState(nodeObject); 
    let [nodeStyle, setNodeStyle] = useState(node.nodeStyle); 

    let nodeDom = useRef(null);  

    useEffect(() => {
        node.setRenderNodeCallback(setNodeStyle);
        node.initNode(nodeDom.current);
    }, []);

    return (
        <>
            <Lines lineList={lineList} />
            <div className={'sl-node ' + (nodeStyle['_focus'] ? 'focus' : '')} ref={nodeDom} style={nodeStyle}>
               {children}
            </div>
        </>
    );

}

