import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const buildId = randomUUID();

// https://vite.dev/config/
export default defineConfig({
  define: { __APP_BUILD_ID__: JSON.stringify(buildId) },
  plugins: [react(), tailwindcss(), {
    name: "release-identity",
    transformIndexHtml() {
      return [{ tag: "meta", attrs: { name: "pundad-build", content: buildId }, injectTo: "head" }];
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "__build.json", source: JSON.stringify({ buildId }) });
    },
    async writeBundle(options, bundle) {
      const entryAssets = new Set<string>();
      const visit = (name: string) => {
        if (entryAssets.has(`/${name}`)) return;
        entryAssets.add(`/${name}`);
        const chunk = bundle[name];
        if (chunk?.type === "chunk") {
          chunk.imports.forEach(visit);
          chunk.viteMetadata?.importedCss.forEach(visit);
        }
      };
      Object.values(bundle).filter((item) => item.type === "chunk" && item.isEntry).forEach((item) => visit(item.fileName));
      const worker = await readFile(new URL("./public/sw.js", import.meta.url), "utf8");
      await writeFile(resolve(options.dir ?? "dist", "sw.js"), worker
        .replaceAll("__PUNDAD_BUILD_ID__", buildId)
        .replace('"__PUNDAD_ENTRY_ASSETS__"', JSON.stringify(JSON.stringify([...entryAssets]))));
    },
  }],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:4001",
      "/uploads": "http://127.0.0.1:4001",
    },
  },
});
