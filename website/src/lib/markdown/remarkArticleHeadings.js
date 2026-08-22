// @ts-check

import GithubSlugger from "github-slugger";
import { visit } from "unist-util-visit";

/** @typedef {import("./articleHeadings.js").ArticleHeading} ArticleHeading */

/**
 * Extract the readable text from an mdast heading.
 *
 * Link labels and inline code both live in child/value nodes, so walking the
 * heading recursively produces the same title readers see on the page.
 * Images contribute their alt text when they appear inside a heading.
 *
 * @param {import("mdast").Nodes} node
 * @returns {string}
 */
function headingText(node) {
  if (node.type === "text" || node.type === "inlineCode") {
    return node.value ?? "";
  }

  if (node.type === "image" || node.type === "imageReference") {
    return node.alt ?? "";
  }

  if (node.type === "break") {
    return " ";
  }

  if (!("children" in node) || !Array.isArray(node.children)) {
    return "";
  }

  return node.children.map(headingText).join("");
}

/**
 * Add stable fragment IDs to Markdown article headings and expose a compact
 * outline through the MDsveX metadata export.
 *
 * Only mdast heading nodes are considered. Headings rendered internally by an
 * imported Svelte component are therefore excluded by construction.
 */
export function remarkArticleHeadings() {
  /**
   * @param {import("mdast").Root} tree
   * @param {import("vfile").VFile} file
   */
  return (tree, file) => {
    const slugger = new GithubSlugger();
    /** @type {ArticleHeading[]} */
    const headings = [];

    visit(tree, "heading", (node) => {
      if (node.depth !== 2 && node.depth !== 3) return;

      const extractedTitle = headingText(node).replace(/\s+/g, " ").trim();
      const title = extractedTitle || "Section";
      const id = slugger.slug(title);

      const existingProperties = node.data?.hProperties ?? {};
      node.data = {
        ...node.data,
        hProperties: { ...existingProperties, id },
      };

      headings.push({ id, title, depth: node.depth });
    });

    const existingFrontmatter =
      typeof file.data.fm === "object" && file.data.fm !== null
        ? file.data.fm
        : {};
    file.data.fm = { ...existingFrontmatter, headings };
  };
}
