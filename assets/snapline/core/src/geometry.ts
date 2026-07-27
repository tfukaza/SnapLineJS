/** Imperative presentation sink for high-frequency geometry. */
export type GeometryWriter<T> = (geometry: Readonly<T>) => void;
