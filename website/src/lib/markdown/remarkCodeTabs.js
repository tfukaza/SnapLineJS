// @ts-check

const titlePattern = /(?:^|\s)title=(?:"([^"]+)"|'([^']+)'|([^\s]+))/i;

/** @param {string} value */
function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** @param {string | null | undefined} meta */
function codeTitle(meta) {
  const match = meta?.match(titlePattern);
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim() || null;
}

/** @param {string | null | undefined} meta */
function withoutTitle(meta) {
  const cleaned = meta?.replace(titlePattern, " ").trim().replace(/\s+/g, " ");
  return cleaned || null;
}

/** @param {string} value */
function normalizedTabValue(value) {
  return value.trim().toLowerCase();
}

/** @param {string} value */
function idPart(value) {
  return (
    value
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "code"
  );
}

/**
 * Group adjacent code fences that explicitly provide titles. Untitled fences
 * remain ordinary blocks, so adjacency alone never changes presentation.
 */
export function remarkCodeTabs() {
  /** @param {import("mdast").Nodes} tree */
  return (tree) => {
    let groupIndex = 0;

    /** @param {import("mdast").Nodes} node */
    const transformParent = (node) => {
      if (!("children" in node) || !Array.isArray(node.children)) return;

      for (const child of node.children) transformParent(child);

      // Code fences only occur among block content. Narrowing here keeps the
      // splice contract precise without weakening checks for the full tree.
      const children = /** @type {import("mdast").RootContent[]} */ (
        node.children
      );

      for (let index = 0; index < children.length; index += 1) {
        const first = children[index];
        if (first.type !== "code" || !codeTitle(first.meta)) continue;

        const group = [];
        let cursor = index;
        while (cursor < children.length) {
          const candidate = children[cursor];
          if (candidate.type !== "code") break;
          const title = codeTitle(candidate.meta);
          if (!title) break;
          group.push({ node: candidate, title });
          cursor += 1;
        }

        if (group.length < 2) continue;

        const tabValues = group.map(({ title }) => normalizedTabValue(title));
        if (new Set(tabValues).size !== tabValues.length) {
          throw new Error(
            "Code tab titles in one adjacent group must be unique.",
          );
        }

        const signature = tabValues.join("|");
        const startLine = first.position?.start.line ?? groupIndex + 1;
        const baseId = `code-tabs-${idPart(signature)}-${startLine}-${groupIndex}`;
        groupIndex += 1;

        const buttons = /** @type {import("mdast").Html[]} */ (
          group.map(({ title }, tabIndex) => {
            const tabValue = tabValues[tabIndex];
            const selected = tabIndex === 0;
            return {
              type: "html",
              value: `<button type="button" id="${baseId}-tab-${tabIndex}" role="tab" aria-selected="${selected}" aria-controls="${baseId}-panel-${tabIndex}" tabindex="${selected ? "0" : "-1"}" data-code-tab data-code-tab-value="${escapeHtml(tabValue)}">${escapeHtml(title)}</button>`,
            };
          })
        );

        const panels = /** @type {import("mdast").RootContent[]} */ (
          group.flatMap(({ node: code }, tabIndex) => {
            code.meta = withoutTitle(code.meta);
            const tabValue = tabValues[tabIndex];
            return [
              {
                type: "html",
                value: `<div id="${baseId}-panel-${tabIndex}" class="code-tab-panel" role="tabpanel" aria-labelledby="${baseId}-tab-${tabIndex}" data-code-tab-panel data-code-tab-value="${escapeHtml(tabValue)}"${tabIndex === 0 ? "" : " hidden"}>`,
              },
              code,
              { type: "html", value: "</div>" },
            ];
          })
        );

        const replacement = /** @type {import("mdast").RootContent[]} */ ([
          {
            type: "html",
            value: `<div class="code-tabs" data-code-tabs data-code-tab-group="${escapeHtml(signature)}"><div class="code-tabs-header" role="tablist" aria-label="Code options">`,
          },
          ...buttons,
          { type: "html", value: '</div><div class="code-tabs-content">' },
          ...panels,
          { type: "html", value: "</div></div>" },
        ]);
        children.splice(index, group.length, ...replacement);

        index += buttons.length + panels.length + 2;
      }
    };

    transformParent(tree);
  };
}
