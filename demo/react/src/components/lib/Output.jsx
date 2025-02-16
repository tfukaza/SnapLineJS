import React from "react";
import { useState } from "react";
import { useRef } from "react";
import { useEffect } from "react";
import { ConnectorComponent } from "../../lib/snapline.mjs";

export default function Output({ nodeObject, name }) {
  let node = useRef(nodeObject);
  let outputDOM = useRef(null);

  useEffect(() => {
    let connector = new ConnectorComponent(outputDOM.current, node.current.g, {
      name: name,
      maxConnectors: 1,
      allowDragOut: true,
    });
    node.current.addConnectorObject(connector);
  }, []);

  return <span className="sl-connector right" ref={outputDOM}></span>;
}
