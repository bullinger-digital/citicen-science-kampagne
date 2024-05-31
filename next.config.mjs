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
  redirects() {
    // Redirect old insider page to home
    return [
      {
        source: "/insider",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
