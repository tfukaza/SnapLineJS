import React from "react";
import { useState } from "react";
import { useRef } from "react";
import { useEffect } from "react";

export default function Input({ nodeObject, name, setProp }) {
  let [node, setNode] = useState(nodeObject);
  let inputDom = useRef(null);

  useEffect(() => {
    node.addConnector(inputDom.current, name, 1, false);
    node.addPropSetCallback(setProp, name);
  }, []);

  return <span className="sl-connector left" ref={inputDom}></span>;
}
