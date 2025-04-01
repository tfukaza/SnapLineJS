import { BaseObject, frameStats } from "./components/object";

const PRECISION = 0.0001;

function getPointOnCubicBezier(v0: number, v1: number, t: number) {
  return 3 * t * (1 - t) * (1 - t) * v0 + 3 * t * t * (1 - t) * v1 + t * t * t;
}

function cubicBezier(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x: number,
) {
  // Assume t=x as a start point
  let t = x;
  while (true) {
    // Get the actual value of x at t
    let xReal = getPointOnCubicBezier(x0, x1, t);
    // If the distance between xTmp and x is less than the precision, exit the loop
    if (Math.abs(xReal - x) < PRECISION) {
      break;
    }
    // Get the slope at t
    let m =
      3 * t ** 2 * (1 + 3 * x0 - 3 * x1) + 2 * t * (3 * x1 - 6 * x0) + 3 * x0;
    // Get the linear equation x = mt + b
    // First find b
    let b = xReal - m * t;
    // Get the point where the linear equation meets the value of x
    t = (x - b) / m;
  }

  let y = getPointOnCubicBezier(y0, y1, t);

  return y;
}

function easeInOut(progress: number) {
  return cubicBezier(0.5, 0, 0.5, 1, progress);
}

function easeOut(progress: number) {
  return cubicBezier(0, 0, 0.58, 1, progress);
}

class AnimationObject {
  owner: BaseObject;
  duration: number;
  from: number;
  to: number;
  setValue: (value: number) => void;
  startTime: number;
  endTime: number;

  constructor(
    owner: BaseObject,
    duration: number,
    from: number,
    to: number,
    setValue: (value: number) => void,
  ) {
    this.owner = owner;
    this.duration = duration;
    this.from = from;
    this.to = to;
    this.setValue = setValue.bind(owner);

    this.startTime = Date.now();
    this.endTime = this.startTime + this.duration;

    this.setValue(this.from);
  }

  calculateFrame(stats: frameStats | null = null): boolean {
    let currentTime = stats?.timestamp ?? Date.now();
    let progress = (currentTime - this.startTime) / this.duration;
    progress = Math.max(progress, 0);
    progress = Math.min(progress, 1);
    if (progress >= 1 - PRECISION) {
      this.setValue(this.to);
      return true;
    }
    let adjustedProgress = easeOut(progress);
    const value = this.from + (this.to - this.from) * adjustedProgress;
    this.setValue(value);
    return false;
  }
}

export { AnimationObject };
