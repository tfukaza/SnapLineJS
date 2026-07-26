<script lang="ts">
  import {
    absoluteUrl,
    canonicalPath,
    defaultDescription,
    defaultImage,
    defaultImageHeight,
    defaultImageWidth,
    defaultTitle,
    pageTitle,
    siteName,
  } from "$lib/seo";

  let {
    title = defaultTitle,
    description = defaultDescription,
    path = "/",
    image = defaultImage,
    imageAlt = "SnapEngine website preview",
    type = "website",
  }: {
    title?: string;
    description?: string;
    path?: string;
    image?: string;
    imageAlt?: string;
    type?: string;
  } = $props();

  const resolvedTitle = $derived(pageTitle(title));
  const canonicalUrl = $derived(absoluteUrl(canonicalPath(path)));
  const imageUrl = $derived(absoluteUrl(image));
</script>

<svelte:head>
  <title>{resolvedTitle}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonicalUrl} />

  <meta property="og:site_name" content={siteName} />
  <meta property="og:type" content={type} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:title" content={resolvedTitle} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={imageUrl} />
  <meta property="og:image:secure_url" content={imageUrl} />
  <meta property="og:image:width" content={defaultImageWidth} />
  <meta property="og:image:height" content={defaultImageHeight} />
  <meta property="og:image:alt" content={imageAlt} />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={resolvedTitle} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={imageUrl} />
  <meta name="twitter:image:alt" content={imageAlt} />
</svelte:head>
