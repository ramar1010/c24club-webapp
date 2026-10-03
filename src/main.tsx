import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// After a new version is published, old page files are replaced. A tab still
// running the previous version then fails to load a page. Reload once to get
// the latest version instead of showing a blank screen.
const RELOAD_KEY = "c24-chunk-reload-at";
const reloadForNewVersion = () => {
  const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
  if (Date.now() - last < 10_000) return; // avoid reload loops
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  window.location.reload();
};

window.addEventListener("vite:preloadError", (e) => {
  e.preventDefault();
  reloadForNewVersion();
});
window.addEventListener("unhandledrejection", (e) => {
  const msg = String((e.reason as any)?.message || e.reason || "");
  if (/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(msg)) {
    reloadForNewVersion();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
