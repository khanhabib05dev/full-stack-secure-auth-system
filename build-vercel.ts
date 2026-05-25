import fs from "fs";
import path from "path";

// Create .vercel/output directory
const outputDir = path.join(process.cwd(), ".vercel/output");
const functionsDir = path.join(outputDir, "functions/api");

// Create directories
fs.mkdirSync(functionsDir, { recursive: true });

// Copy compiled API file
const apiIndex = path.join(process.cwd(), "dist/api/index.js");
fs.copyFileSync(apiIndex, path.join(functionsDir, "index.js"));

// Create function config
const config = {
  runtime: "nodejs20.x",
  handler: "index.handler",
};

fs.writeFileSync(
  path.join(functionsDir, ".vc-config.json"),
  JSON.stringify(config, null, 2)
);

console.log("✅ Vercel build complete!");