# GitHub Stars Video

为你的 GitHub 仓库生成一段 star 纪念视频。**渲染全程在你的浏览器里完成**，服务器只发静态文件——所以可以直接部署在 Vercel 免费版上，不需要任何云服务。

## 和原版的区别

原项目 [scastiel/github-stars-video](https://github.com/scastiel/github-stars-video) 用 Remotion Lambda（AWS）在服务端渲染。这个版本改用 Remotion 的 [Client-side rendering](https://www.remotion.dev/docs/client-side-rendering)（`@remotion/web-renderer`）：

- 不需要 AWS / Lambda / 任何付费服务
- 服务器不参与渲染，也接触不到你的 token
- 视频在浏览器里渲染完成后直接下载，不经过服务器中转

## 用法

```bash
pnpm i
pnpm dev
```

打开 http://localhost:3000，然后：

1. **填 GitHub token** —— fine-grained token，需要 `Contents: Read and write` 权限
   - 只存在你自己的浏览器 localStorage 里，不会发给任何服务器
   - 为什么需要 Contents 写权限：GitHub 从 2026-06-30 起把 `/repos/{owner}/{repo}/stargazers` 限制为**仓库的 admin/协作者**，而它判定"你是不是协作者"用的就是 `contents=write`（响应头 `X-Accepted-GitHub-Permissions: metadata=read; contents=write`）
2. **填仓库路径** `owner/repo`，点「读取仓库数据」
3. **预览**，点「导出 MP4」—— 浏览器开始渲染，完成后直接下载

## 限制

- **只能出你自己的仓库**（或你是 admin/协作者的仓库）。看别人的仓库必然 404/403，这是 GitHub 的规则，换任何 token 都没用。
- 需要 **Chrome 94+ / Firefox 130+ / Safari 26+**（浏览器端渲染依赖 WebCodecs）。
- 渲染速度取决于你的设备，240 帧在桌面 Chrome 上通常 1~3 分钟。

## 部署到 Vercel

推到 GitHub 后在 Vercel 导入即可，**不需要配置任何环境变量**：

- 构建命令用默认的 `next build`
- 所有 API 调用都发生在访客浏览器里，服务端只提供静态资源

## 实现上踩过的三个坑

1. **头像必须内联成 data URL**。Remotion 的 `<Img>` 会阻塞整帧等待图片加载完成（`delayRender`，28 秒超时），远程图片一挂就渲染失败；而且跨域图片会**污染 canvas**，导致 `getBlob()` 直接抛安全错误。
2. **头像要缩到 128px**。GitHub 头像支持 `?s=128` 参数；用原图（有些 300KB+）会让内联后的 props 膨胀到几 MB，拖慢每帧渲染。
3. **头像下载要分批 + 重试**。同时开 50 个请求会把连接池挤爆，导致大面积超时。

## 技术栈

Next.js 14 · React 18 · Remotion 4.0.534 · `@remotion/player` · `@remotion/web-renderer`

## 致谢

视频创意与原始实现来自 [Sebastien Castiel](https://github.com/scastiel) 的 [github-stars-video](https://github.com/scastiel/github-stars-video)（MIT）。
