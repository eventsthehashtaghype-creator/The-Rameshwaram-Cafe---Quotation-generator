import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/supabase-proxy/:path*',
        // Route through the unblocked Vercel Edge back to the v3 database in Singapore
        destination: 'https://ziqghnksxqgsrqxmmexe.supabase.co/:path*',
      },
    ]
  },
};

export default nextConfig;
