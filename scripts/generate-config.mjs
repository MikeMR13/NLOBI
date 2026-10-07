import fs from "node:fs";
import path from "node:path";

const outDir = process.argv[2] || "dist";
const supabaseUrl = process.env.NLOBI_SUPABASE_URL || "https://hfbpsizgwzvvznrktiuq.supabase.co";
const supabasePublishableKey = process.env.NLOBI_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_1vVSZAEZ7QN_Mh00BAq2UA_oHdLbANd";

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl)) {
  throw new Error("NLOBI_SUPABASE_URL no tiene un formato válido.");
}
if (!supabasePublishableKey.startsWith("sb_publishable_")) {
  throw new Error("NLOBI_SUPABASE_PUBLISHABLE_KEY debe ser una publishable key.");
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "runtime-config.js"),
  `window.__NLOBI_CONFIG__=${JSON.stringify({ supabaseUrl, supabasePublishableKey })};\n`,
  "utf8",
);