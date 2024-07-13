import React from "react";
import { useState } from "react";
import { useRef } from "react";
import { useEffect } from "react";
export default function Output({ nodeObject, name }) {
  let [node, setNode] = useState(nodeObject);
  let outputDOM = useRef(null);

  useEffect(() => {
    node.addConnector(outputDOM.current, name, 0, true);
  }, []);

  return <span className="sl-connector right" ref={outputDOM}></span>;
}
