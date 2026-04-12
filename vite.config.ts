import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { Buffer } from "buffer";
import { componentTagger } from "lovable-tagger";

const SITEMAP_URL = "https://ncpbiymnafxdfsvpxirb.supabase.co/functions/v1/sitemap";

function sitemapProxy(): Plugin {
  return {
    name: "sitemap-proxy",
    configureServer(server) {
      server.middlewares.use("/sitemap.xml", async (_req, res) => {
        try {
          const response = await fetch(SITEMAP_URL);
          const xml = await response.text();
          res.setHeader("Content-Type", "application/xml; charset=utf-8");
          res.end(xml);
        } catch {
          res.statusCode = 502;
          res.end("Sitemap unavailable");
        }
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use("/sitemap.xml", async (_req, res) => {
        try {
          const response = await fetch(SITEMAP_URL);
          const xml = await response.text();
          res.setHeader("Content-Type", "application/xml; charset=utf-8");
          res.end(xml);
        } catch {
          res.statusCode = 502;
          res.end("Sitemap unavailable");
        }
      });
    },
    async writeBundle() {
      const fs = await import("fs");
      try {
        const response = await fetch(SITEMAP_URL);
        const xml = await response.text();
        fs.writeFileSync(path.resolve(__dirname, "dist/sitemap.xml"), xml);
        console.log("✅ sitemap.xml written to dist/");
      } catch (e) {
        console.warn("⚠️ Could not fetch sitemap for static build:", e);
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  define: {
    global: "globalThis",
  },
  plugins: [react(), sitemapProxy(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      buffer: "buffer/",
    },
  },
  optimizeDeps: {
    include: ["buffer"],
  },
}));
