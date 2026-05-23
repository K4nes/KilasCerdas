/** @type {import('next').NextConfig} */
const nextConfig = {
  // Note: do NOT use `output: 'standalone'` — it generates its own server.js
  // that conflicts with our custom Socket.io server in server.js.
};

module.exports = nextConfig;
