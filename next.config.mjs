/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "oldschool.runescape.wiki",
        port: "",
        pathname: "/images/**"
      },
      {
        protocol: "https",
        hostname: "runescape.wiki",
        port: "",
        pathname: "/images/**"
      },
      {
        protocol: "https",
        hostname: "chisel.weirdgloop.org",
        port: "",
        pathname: "/static/img/**"
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**"
      }
    ]
  }
};

export default nextConfig;

