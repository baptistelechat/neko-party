import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import { defineConfig } from "vite";
import { qrcode } from "vite-plugin-qrcode";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    qrcode(),
    basicSsl(),
    {
      name: "upload-dataset-server",
      configureServer(server) {
        server.middlewares.use("/upload-dataset", (req, res, next) => {
          if (req.method === "POST") {
            const buffers: Buffer[] = [];
            req.on("data", (chunk) => buffers.push(chunk));
            req.on("end", () => {
              const buffer = Buffer.concat(buffers);
              // Parse query for filename
              // req.url includes query string in connect/express
              const urlObj = new URL(
                req.url || "",
                `http://${req.headers.host}`
              );
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
              fs.writeFileSync(targetPath, buffer);
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
