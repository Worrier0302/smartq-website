/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 让 PDF 路由在 Vercel 打包时带上中文字体 + logo 图
    outputFileTracingIncludes: {
      "/api/pdf/[docId]": ["./public/fonts/**", "./public/logo.png"],
    },
    // @react-pdf/renderer 是重型 node 库，避免被 bundler 误处理
    serverComponentsExternalPackages: ["@react-pdf/renderer"],
  },
};

export default nextConfig;
