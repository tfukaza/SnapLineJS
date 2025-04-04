import { GlobalManager } from "./global";

function getDomProperty(global: GlobalManager, dom: HTMLElement) {
  const rect = dom.getBoundingClientRect();
  if (global.camera == null) {
    return {
      height: rect.height,
      width: rect.width,
      worldX: rect.left,
      worldY: rect.top,
      cameraX: rect.left,
      cameraY: rect.top,
      screenX: rect.left,
      screenY: rect.top,
    };
  }
  const [cameraX, cameraY] = global.camera.getCameraFromScreen(
    rect.left,
    rect.top,
  );
  const [worldX, worldY] = global.camera.getWorldFromCamera(cameraX, cameraY);
  const [cameraWidth, cameraHeight] =
    global.camera.getCameraDeltaFromWorldDelta(rect.width, rect.height);
  const [worldWidth, worldHeight] = global.camera.getWorldDeltaFromCameraDelta(
    cameraWidth,
    cameraHeight,
  );

  return {
    height: worldHeight,
    width: worldWidth,
    worldX: worldX,
    worldY: worldY,
    cameraX: cameraX,
    cameraY: cameraY,
    screenX: rect.left,
    screenY: rect.top,
  };
}

/**
 * Converts a string from camelCase to kebab-case.
 * @param str The string to be converted.
 * @returns The converted string.
 */
function camelCaseToKebab(str: string) {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/**
 * Sets the style of a DOM element.
 * @param dom The DOM element to be styled.
 * @param style The new style to be added to the DOM element.
 */
function setDomStyle(
  dom: HTMLElement | SVGElement,
  style: { [key: string]: string },
) {
  // if there is existing style, extract the existing style
  let existingStyleDict = {};
  const existingStyleString = dom.style.cssText;
  if (existingStyleString) {
    existingStyleDict = existingStyleString
      .split(";")
      .map((item) => {
        const [key, value] = item.split(":");
        return { [key]: value };
      })
      .reduce((acc, curr) => {
        return { ...acc, ...curr };
      }, {});
    style = {
      ...existingStyleDict,
      ...style,
    };
  }
  // Convert the dict to a single string to reduce the number of DOM calls
  const styleString = Object.entries(style)
    .map(([key, value]) => `${camelCaseToKebab(key)}: ${value}`)
    .join(";");
  dom.style.cssText = styleString;
}

interface CallbackInterface extends Record<KeyType, Function | null> {}

function EventProxyFactory<BindObject, Callback extends object>(
  object: BindObject,
  dict: Callback,
  secondary: Callback | null = null,
): Callback {
  return new Proxy(dict, {
    set: (
      target: Callback,
      prop: keyof Callback & KeyType,
      value: Function | null,
    ) => {
      if (value == null) {
        target[prop] = null as any;
      } else {
        target[prop] = value.bind(object);
      }
      return true;
    },
    get: (
      target: Callback & CallbackInterface,
      prop: keyof Callback & KeyType,
    ) => {
      return (...args: any[]) => {
        target[prop]?.(...args);
        (secondary as Callback & CallbackInterface)?.[prop]?.(...args);
      };
    },
  });
}

export { setDomStyle, EventProxyFactory, getDomProperty };
