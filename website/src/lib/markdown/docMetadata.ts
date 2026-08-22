import type { ArticleHeading } from "$lib/markdown/articleHeadings";

export type DocMetadata = {
  title?: string;
  order?: number;
  project?: string;
  projectTitle?: string;
  section?: string;
  sectionTitle?: string;
  sectionOrder?: number;
  hidden?: boolean;
  framework?: string;
  frameworkKey?: string;
  parent?: string;
  headings?: ArticleHeading[];
  [key: string]: unknown;
};
