export const siteUrl = "https://snapengine.dev";
export const siteName = "SnapEngine";
export const defaultTitle = "SnapEngine | Interaction tools for the web";
export const defaultDescription =
  "SnapEngine is a growing family of DOM-first interaction tools, powered by a shared core for input, motion, collision, and animation.";
export const defaultImage = "/og.png";
export const defaultImageWidth = "1200";
export const defaultImageHeight = "630";

export function absoluteUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl}${normalizedPath}`;
}

export function canonicalPath(path: string) {
  if (!path || path === "/") return "/";

  return path.endsWith("/") ? path.slice(0, -1) : path;
}

export function pageTitle(title: string) {
  return title.includes(siteName) ? title : `${title} | ${siteName}`;
}
