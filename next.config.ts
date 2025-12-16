import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  reactCompiler: true,
  serverExternalPackages: ["java"],
  output: "standalone",
};

export default nextConfig;
