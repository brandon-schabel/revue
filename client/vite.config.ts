import { defineConfig } from "vite";
import path from "path";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@ui": path.resolve(__dirname, "./src/components/ui"),
			"@lib": path.resolve(__dirname, "./src/lib"),
		},
	},
  build: {
    // Build to a directory Flask can serve
    outDir: "../backend-python/static",
    emptyOutDir: true,
  },
	server: {
		port: 3000,
	},
});
