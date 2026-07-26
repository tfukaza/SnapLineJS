import React from "react";
import { useRef } from "react";
import { useEffect } from "react";
import { ConnectorMirror } from "../../lib/snapline.mjs";
export default function Input({ nodeObject, name, setProp }) {
  let node = useRef(nodeObject);
  let inputDom = useRef(null);

  useEffect(() => {
    let connector = new ConnectorMirror(inputDom.current, node.current.g, {
      name: name,
      maxConnectors: 1,
      allowDragOut: false,
    });
    node.current.addConnectorObject(connector);
    node.current.addSetPropCallback(setProp, name);
  }, []);

  return <span className="sl-connector left" ref={inputDom}></span>;
}
