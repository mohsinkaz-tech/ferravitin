import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";

const iconsShim = fileURLToPath(new URL("./src/lib/quanta-material-icons.ts", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [{find: /^@higgsfield-ai\/icons(\/.*)?$/, replacement: iconsShim}],
  },
  plugins: [
    tsconfigPaths(),
    nitro({preset: "aws_amplify", awsAmplify: {runtime: "nodejs22.x"}}),
    tanstackStart(),
    react(),
    tailwindcss(),
    svgr(),
  ],
});
