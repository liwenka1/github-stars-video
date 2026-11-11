import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'GitHub Stars Video',
  description: '在浏览器里为你的 GitHub 仓库生成一段 star 纪念视频，不需要任何服务端渲染。',
}

const themeScript = `
(() => {
  try {
    const savedTheme = localStorage.getItem('gsw-theme')
    const theme = savedTheme === 'dark' || savedTheme === 'light'
      ? savedTheme
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.dataset.theme = theme
  } catch {
    // Theme initialization is best effort; the client applies the fallback later.
  }
})()
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
