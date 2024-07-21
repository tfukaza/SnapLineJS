import { ComponentConfig } from "./types";
import { lineObject } from "./types";

function isBetween(x: number, a: number, b: number) {
  return (x >= a && x <= b) || (x >= b && x <= a);
}

// function worldToCamera(x: number, y: number, g: GlobalStats) {
//   const s1 = g.zoom;
//   const s2 = g.zoom;
//   const t1 = -x * g.zoom + g.cameraWidth / 2;
//   const t2 = -y * g.zoom + g.cameraHeight / 2;
//   return `${s1},0,0,0,0,${s2},0,0,0,0,1,0,${t1},${t2},0,1`;
// }

function addLabel(dom: HTMLElement, config: ComponentConfig) {
  if (config.class === "") {
    return;
  }
  const label = document.createElement("span");
  label.classList.add("sl-label");
  label.innerText = config.class;
  label.style.zIndex = "99";

  dom.appendChild(label);

  return label;
}

/**
 * Helper function that takes a dictionary, and updates it with key and values from another dictionary.
 * This returns a new dictionary instead of modifying the original dictionary, which can be
 * useful when using this library with reactive front-end frameworks.
 * @param currentDict: The dictionary to be updated.
 * @param newDict: The dictionary containing the new key value pairs.
 * @returns A new dictionary containing the updated key value pairs.
 */
function returnUpdatedDict(
  currentDict: { [key: string]: string },
  newDict: { [key: string]: string },
) {
  const updatedDict = Object.assign({}, currentDict, newDict);
  updatedDict._requestUpdate = "true";
  return updatedDict;
}

/**
 * Helper function that iterates through a dictionary and calls a callback function on each value.
 * @param dict: The dictionary to iterate through.
 * @param callback: The callback function to call on each value.
 * @param bind: The object to bind to the callback function.
 */
function iterateDict(
  dict: { [key: string]: any },
  callback: (lines: lineObject[]) => void,
  bind: any,
) {
  for (const key in dict) {
    callback.bind(bind)(dict[key]);
  }
}

/**
 * Helper function that sets the style of a DOM element.
 * @param dom The DOM element to be styled.
 * @param newStyle The new style to be added to the DOM element.
 */
function setDomStyle(
  dom: HTMLElement | SVGElement,
  newStyle: { [key: string]: string },
) {
  for (const key in newStyle) {
    if (key[0] == "_") {
      continue;
    }
    dom.style[key as any] = newStyle[key];
  }
}

export { isBetween, addLabel, returnUpdatedDict, iterateDict, setDomStyle };
