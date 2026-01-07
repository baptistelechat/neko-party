import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { defineConfig } from "vite";
import { qrcode } from "vite-plugin-qrcode";
import { viteStaticCopy } from "vite-plugin-static-copy";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    qrcode(),
    basicSsl(),
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/onnxruntime-web/dist/*.wasm",
          dest: "models/detection",
        },
        {
          src: "node_modules/onnxruntime-web/dist/*.mjs",
          dest: "models/detection",
        },
      ],
    }),
    {
      name: "upload-dataset-server",
      configureServer(server) {
        server.middlewares.use("/upload-dataset", (req, res, next) => {
          if (req.method === "POST") {
            const urlObj = new URL(req.url || "", `http://${req.headers.host}`);
            const filename = urlObj.searchParams.get("filename");

            if (!filename) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "Missing filename" }));
              return;
            }

            const targetDir = path.resolve(__dirname, "public/dataset");
            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true });
            }

            const targetPath = path.join(targetDir, filename);
            const writeStream = fs.createWriteStream(targetPath);

            req.pipe(writeStream);

            writeStream.on("finish", () => {
              console.log(`[Upload] Saved ${filename} to ${targetPath}`);

              // Update manifest using existing script
              exec(
                "node scripts/generate-manifest.js",
                (err, stdout, stderr) => {
                  if (err) {
                    console.error(
                      "[Upload] Failed to update manifest:",
                      stderr || err.message
                    );
                  } else {
                    console.log("[Upload] Manifest updated:", stdout.trim());
                  }
                }
              );

              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true, path: targetPath }));
            });

            writeStream.on("error", (err) => {
              console.error(`[Upload] Error writing file: ${err.message}`);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "Upload failed" }));
            });
          } else {
            next();
          }
        });
      },
    },
  ],
  server: {
    host: true, // Expose to network
    watch: {
      ignored: ["**/public/dataset/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
