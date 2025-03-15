import { GlobalManager } from "../global";

function getDomProperty(global: GlobalManager, dom: HTMLElement) {
  // if (global.camera == null) {
  //   console.error("camera is null");
  //   return {
  //     height: dom.offsetHeight,
  //     width: dom.offsetWidth,
  //     positionX: dom.offsetLeft,
  //     positionY: dom.offsetTop,
  //   };
  // }
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
  // console.debug("rect", rect, dom);
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
  // console.log(
  //   dom,
  //   `x: ${worldX}, y: ${worldY}, width: ${worldWidth}, height: ${worldHeight}`,
  // );
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

export { getDomProperty };
