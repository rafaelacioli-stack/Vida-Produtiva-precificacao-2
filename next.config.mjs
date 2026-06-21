import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const hasNetlifyDatabase = (() => { try { require.resolve("@netlify/database"); return true; } catch { return false; } })();

/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  webpack(config) {
    if (!hasNetlifyDatabase) config.resolve.alias["@netlify/database"] = path.resolve("lib/netlify-database-local.ts");
    return config;
  }
};
export default nextConfig;
