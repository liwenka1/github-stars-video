import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'GitHub Stars Video',
  description: '在浏览器里为你的 GitHub 仓库生成一段 star 纪念视频，不需要任何服务端渲染。',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
