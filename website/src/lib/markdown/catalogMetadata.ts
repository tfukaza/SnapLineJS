import type { DocMetadata } from "./docMetadata";

export function parseCatalogMetadata(source: string): DocMetadata {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  if (lines[0]?.trim() !== "---") return {};

  const metadata: DocMetadata = {};
  for (const line of lines.slice(1)) {
    if (line.trim() === "---") break;

    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();

    switch (key) {
      case "title":
        metadata.title = value;
        break;
      case "order":
        metadata.order = Number(value);
        break;
      case "project":
        metadata.project = value;
        break;
      case "projectTitle":
        metadata.projectTitle = value;
        break;
      case "section":
        metadata.section = value;
        break;
      case "sectionTitle":
        metadata.sectionTitle = value;
        break;
      case "sectionOrder":
        metadata.sectionOrder = Number(value);
        break;
      case "hidden":
        metadata.hidden = value === "true";
        break;
      case "framework":
        metadata.framework = value;
        break;
      case "frameworkKey":
        metadata.frameworkKey = value;
        break;
      case "parent":
        metadata.parent = value;
        break;
    }
  }

  return metadata;
}
