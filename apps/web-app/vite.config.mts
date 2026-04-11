/// <reference types='vitest' />
import { readFileSync } from "node:fs"
import path from "node:path"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

const webAppPackageJson = JSON.parse(
    readFileSync(
        new URL("./package.json", import.meta.url),
        "utf-8",
    ),
) as { version: string }

export default defineConfig(() => {
    const base = process.env.VITE_BASE_PATH ?? "/"

    return {
        root: import.meta.dirname,
        /** GitHub project pages: set `VITE_BASE_PATH=/<repo>/` in CI (trailing slash). */
        base,
        define: {
            "import.meta.env.VITE_APP_VERSION": JSON.stringify(
                webAppPackageJson.version,
            ),
        },
        cacheDir: "../../node_modules/.vite/apps/web-app",
        server: {
            port: 4200,
            host: true,
        },
        preview: {
            port: 4200,
            host: true,
        },
        plugins: [
            react(),
            tailwindcss(),
            VitePWA({
                registerType: "autoUpdate",
                injectRegister: "auto",
                includeAssets: ["pwa-icon.svg"],
                manifest: {
                    name: "cryptessage",
                    short_name: "cryptessage",
                    description: "Offline-first encrypted messages and contacts",
                    theme_color: "#09090b",
                    background_color: "#09090b",
                    display: "standalone",
                    orientation: "any",
                    lang: "en",
                    scope: "./",
                    start_url: "./",
                    icons: [
                        {
                            src: "pwa-icon.svg",
                            sizes: "any",
                            type: "image/svg+xml",
                            purpose: "any",
                        },
                        {
                            src: "pwa-icon.svg",
                            sizes: "any",
                            type: "image/svg+xml",
                            purpose: "maskable",
                        },
                    ],
                },
                workbox: {
                    globPatterns: [
                        "**/*.{js,css,html,ico,svg,png,webp,woff2,wasm,webmanifest}",
                    ],
                    maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
                    navigateFallback: "index.html",
                    cleanupOutdatedCaches: true,
                    clientsClaim: true,
                    skipWaiting: true,
                },
                devOptions: {
                    enabled: false,
                },
            }),
        ],
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
        build: {
            outDir: "./dist",
            emptyOutDir: true,
            reportCompressedSize: true,
            commonjsOptions: {
                transformMixedEsModules: true,
            },
        },
        test: {
            environment: "node",
            include: ["src/**/*.spec.ts"],
            passWithNoTests: true,
        },
    }
})
