const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    typedRoutes: false,
  },
  webpack: (config) => {
    config.resolve.alias['@'] = path.join(__dirname, '');
    return config;
  },
};

module.exports = nextConfig;
