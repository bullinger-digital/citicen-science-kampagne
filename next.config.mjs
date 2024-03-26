/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  webpack: (config, { isServer, nextRuntime }) => {
    if (isServer && nextRuntime === "nodejs") {
      return {
        ...config,
        entry() {
          return config.entry().then((entry) => {
            return Object.assign({}, entry, {
              migrate: "./src/lib/migrate.ts",
            });
          });
        },
      };
    }
    return config;
  },
};

export default nextConfig;
