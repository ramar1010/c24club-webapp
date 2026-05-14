import { useEffect } from "react";

interface PageMetaOptions {
  title: string;
  description: string;
  /** Path including leading slash, e.g. "/privacy". Used for canonical + og:url. */
  path: string;
  ogImage?: string;
}

const DOMAIN = "https://c24club.com";

/**
 * Sets per-route <title>, <meta name="description">, canonical link,
 * and Open Graph + Twitter title/description/url tags.
 * Replaces the static homepage values shipped in index.html.
 */
export function usePageMeta({ title, description, path, ogImage }: PageMetaOptions) {
  useEffect(() => {
    document.title = title;

    const setMetaByName = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    const setMetaByProp = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("property", property);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    const url = `${DOMAIN}${path}`;

    setMetaByName("description", description);
    setMetaByProp("og:title", title);
    setMetaByProp("og:description", description);
    setMetaByProp("og:url", url);
    setMetaByName("twitter:title", title);
    setMetaByName("twitter:description", description);
    if (ogImage) {
      setMetaByProp("og:image", ogImage);
      setMetaByName("twitter:image", ogImage);
    }

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", url);
  }, [title, description, path, ogImage]);
}

export default usePageMeta;