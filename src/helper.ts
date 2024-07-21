import { lineObject } from "./types";

function isBetween(x: number, a: number, b: number) {
  return (x >= a && x <= b) || (x >= b && x <= a);
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
 * @param includeKey: A boolean that determines whether to include the key in the callback function.
 */
function iterateDict(
  dict: { [key: string]: any },
  callback: (lines: lineObject[], key?: string) => void,
  bind: any,
  includeKey: boolean = false,
) {
  for (const key in dict) {
    if (includeKey) {
      callback.bind(bind)(dict[key], key);
    } else {
      callback.bind(bind)(dict[key]);
    }
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

export { isBetween, returnUpdatedDict, iterateDict, setDomStyle };
