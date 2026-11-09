import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
    resolve: {
        alias: {
            "@Turtle": path.resolve(__dirname, "src/Turtle"),
            "@TurtleFinance": path.resolve(__dirname, "src/TurtleFinance"),
        },
    },

    define: {
        __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    },
    plugins: [react()],
    build: {
        outDir: "build",
        target: "es2020",
        chunkSizeWarningLimit: 2000,
    },
    clearScreen: false,
    server: {
        strictPort: true,
        port: 3010,
        host: "0.0.0.0",
        proxy: {
            "/api": "http://127.0.0.1:8095",
        },
    },
});
