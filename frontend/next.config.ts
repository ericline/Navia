import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["react-simple-maps"],
  async headers() {
    return [
      {
        // Apple Universal Links: must be served as JSON with no extension.
        // Replace TEAMID in public/.well-known/apple-app-site-association once
        // the Apple Developer account exists.
        source: "/.well-known/apple-app-site-association",
        headers: [
          { key: "Content-Type", value: "application/json" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
    ];
  },
};

export default nextConfig;
