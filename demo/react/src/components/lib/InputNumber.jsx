import React from "react";
import { useRef } from "react";
import { useEffect } from "react";
import Input from "./Input";

export default function InputNumber({ nodeObject, name, updateText, setProp }) {
  let node = useRef(nodeObject);
  let formDom = useRef(null);

  if (!setProp) {
    setProp = () => {};
  }
  useEffect(() => {
    node.current.addInputForm(formDom.current, name);
  }, []);

  return (
    <>
      <Input nodeObject={node.current} name={name} setProp={setProp} />
      <span className="sl-label">{name}</span>
      <input
        className="sl-input"
        type="number"
        // value={node.current.getProp(name) || 0}
        onChange={(e) => updateText(e, name)}
        ref={formDom}
      />
    </>
  );
}
