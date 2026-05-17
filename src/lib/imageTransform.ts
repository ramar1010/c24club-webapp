/**
 * Transform Supabase Storage public URLs through the image render endpoint
 * to deliver resized, WebP-encoded images. Saves bandwidth on grids/thumbnails.
 *
 * Public URL:   /storage/v1/object/public/<bucket>/<path>
 * Rendered:     /storage/v1/render/image/public/<bucket>/<path>?width=…&quality=…
 *
 * Non-Supabase URLs (gravatar, external CDNs, etc.) are returned unchanged.
 */
export function transformImage(
  url: string | null | undefined,
  opts: { width?: number; height?: number; quality?: number; resize?: "cover" | "contain" | "fill" } = {},
): string {
  if (!url) return "";
  if (!url.includes("/storage/v1/object/public/")) return url;

  const rendered = url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  const params = new URLSearchParams();
  if (opts.width) params.set("width", String(opts.width));
  if (opts.height) params.set("height", String(opts.height));
  params.set("quality", String(opts.quality ?? 70));
  if (opts.resize) params.set("resize", opts.resize);

  const sep = rendered.includes("?") ? "&" : "?";
  return `${rendered}${sep}${params.toString()}`;
}

/**
 * Build a srcSet for responsive images at 1x/2x densities.
 */
export function transformImageSrcSet(url: string | null | undefined, width: number, quality = 70): string {
  if (!url) return "";
  const x1 = transformImage(url, { width, quality, resize: "cover" });
  const x2 = transformImage(url, { width: width * 2, quality, resize: "cover" });
  return `${x1} 1x, ${x2} 2x`;
}