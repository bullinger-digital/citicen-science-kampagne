/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/admin-content",
        destination: "/admin-content/index.html",
      },
    ];
  },
};

export default nextConfig;
