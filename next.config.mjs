/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hasil build tetap jalan walau lint belum diatur; tipe tetap dicek.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
