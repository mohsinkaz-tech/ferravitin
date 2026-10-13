import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";

const iconsShim = fileURLToPath(new URL("./src/lib/quanta-icons.ts", import.meta.url));

export default defineConfig({
  define: {
    __HF_DESIGN_INSPECTOR__: false,
    // Amplify build variables are not automatically SSR runtime variables.
    // Bake this nonsecret safety marker into the preview bundle; never bake credentials.
    'process.env.PURCHASE_ORDER_MODE': JSON.stringify(process.env.PURCHASE_ORDER_MODE || 'disabled'),
  },
  resolve: {
    alias: [{find: /^@higgsfield-ai\/icons(\/.*)?$/, replacement: iconsShim}],
  },
  plugins: [
    nitro({preset: "aws_amplify", awsAmplify: {runtime: "nodejs22.x"}}),
    tanstackStart(),
    react(),
    tailwindcss(),
    svgr(),
  ],
});
