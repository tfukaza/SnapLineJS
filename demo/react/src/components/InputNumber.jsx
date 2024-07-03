import React from 'react';
import { useState } from 'react';
import { useRef } from 'react';
import { useEffect } from 'react';
import Input from './Input';

export default function InputNumber({nodeObject, name, updateText, setProp}) {

    let [node, setNode] = useState(nodeObject);
    let formDom = useRef(null);

    if (!setProp) {
        setProp = () => {};
    }
    useEffect(() => {
        node.addInputForm(formDom.current, name);
    }, []);

    return (
        <>
            <Input nodeObject={node} name={name} setProp={setProp} />
            <span className="sl-label">{name}</span>
            <input className="sl-input" type="number" value={node.prop[name] || 0} onChange={e => updateText(e, name)} ref={formDom} />
        </>
    );

}


