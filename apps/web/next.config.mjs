/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  transpilePackages: ["@social-platform/shared"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
  async rewrites() {
    const apiUrl = process.env.API_URL ?? "http://localhost:4000";
    // Path-preserving, deliberately: these make the API reachable on the *web* origin, which is
    // what lets the session cookie be first-party when the two are not on sibling subdomains.
    // Better Auth builds its browser-facing URLs from baseURL + basePath ("/api/auth"), so the
    // path has to be identical on both sides — a prefix-rewriting proxy would break it.
    //
    // Only in play when NEXT_PUBLIC_API_URL is empty; with it set, the browser calls the API
    // directly and these rewrites are never exercised.
    return [
      { source: "/api/auth/:path*", destination: `${apiUrl}/api/auth/:path*` },
      { source: "/api/v1/:path*", destination: `${apiUrl}/api/v1/:path*` },
    ];
  },
};

export default nextConfig;
