'use client'

import { fetchRepoData } from '@/lib/github'
import {
  GitHubStarsComposition,
  animationDurationInSeconds,
  fps,
  height,
  width,
} from '@/video/composition'
import { emptyProps, type Props } from '@/video/schema'
import { Player } from '@remotion/player'
import { renderMediaOnWeb } from '@remotion/web-renderer'
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'

const TOKEN_KEY = 'gsw-token'
const REPO_KEY = 'gsw-repo'
const THEME_KEY = 'gsw-theme'
const CURRENT_REPO_URL = 'https://github.com/liwenka1/github-stars-video'
const CURRENT_REPO_LABEL = 'liwenka1/github-stars-video'
const durationInFrames = (animationDurationInSeconds + 1) * fps

type Phase = 'idle' | 'loading' | 'ready' | 'rendering' | 'done'
type Theme = 'light' | 'dark'

function ArrowUpRightIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon github-icon">
      <path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.8.1-.8.1-.8 1.2.1 1.8 1.3 1.8 1.3 1.1 1.8 2.9 1.3 3.6 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.6-1.3-5.6-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.9 5.6-5.6 5.9.4.3.7 1 .7 2v2.9c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

function MarkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon brand-mark-icon">
      <path d="m12 3 2.2 5.4 5.8.5-4.4 3.8 1.4 5.7-5-3-5 3 1.4-5.7L4 8.9l5.8-.5L12 3Z" />
    </svg>
  )
}

export default function Home() {
  const [token, setToken] = useState('')
  const [remember, setRemember] = useState(true)
  const [repoInput, setRepoInput] = useState('')
  const [props, setProps] = useState<Props>(emptyProps)

  const [phase, setPhase] = useState<Phase>('idle')
  const [step, setStep] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [renderSeconds, setRenderSeconds] = useState<number | null>(null)
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    setToken(localStorage.getItem(TOKEN_KEY) ?? '')
    setRepoInput(localStorage.getItem(REPO_KEY) ?? '')

    const savedTheme = localStorage.getItem(THEME_KEY)
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme)
      return
    }

    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark')
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const load = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPhase('loading')
    setError(null)
    setVideoUrl(null)
    setRenderSeconds(null)
    setProps(emptyProps)

    try {
      const data = await fetchRepoData(repoInput, token, setStep)
      setProps(data)
      setPhase('ready')
      if (remember) {
        localStorage.setItem(TOKEN_KEY, token)
      } else {
        localStorage.removeItem(TOKEN_KEY)
      }
      localStorage.setItem(REPO_KEY, repoInput)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setPhase('idle')
    } finally {
      setStep('')
    }
  }

  const exportVideo = async () => {
    setPhase('rendering')
    setError(null)
    setProgress(0)
    setVideoUrl(null)
    const startedAt = Date.now()

    try {
      const { getBlob } = await renderMediaOnWeb({
        composition: {
          id: 'GitHubStars',
          component: GitHubStarsComposition,
          durationInFrames,
          fps,
          width,
          height,
          calculateMetadata: null,
          defaultProps: props,
        },
        inputProps: props,
        onProgress: (value) => setProgress(Math.round(value.progress * 100)),
      })
      const blob = await getBlob()
      setRenderSeconds(Math.round((Date.now() - startedAt) / 1000))
      setVideoUrl(URL.createObjectURL(blob))
      setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? `${err.name}: ${err.message}` : String(err))
      setPhase('ready')
    }
  }

  const busy = phase === 'loading' || phase === 'rendering'
  const ready = Boolean(props.user && props.repository)
  const themeLabel = theme === 'dark' ? '浅色' : '深色'

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand-mark-link" href="/" aria-label="GitHub Stars Video">
          <span className="brand-mark">
            <MarkIcon />
          </span>
        </a>

        <div className="site-actions">
          <a
            className="icon-link"
            href={CURRENT_REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label={`打开 ${CURRENT_REPO_LABEL}`}
            title={CURRENT_REPO_LABEL}
          >
            <GitHubIcon />
          </a>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`切换到${themeLabel}模式`}
            title={`切换到${themeLabel}模式`}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>

      <main className="main-content">
        <h1 className="page-title">GitHub Stars Video</h1>
        <p className="page-motto">A small celebration for your repository.</p>

        <article className="content-flow">
          <div className="content-block enter" style={{ '--delay': '90ms' } as CSSProperties}>
            <p className="intro-text">
              为你的 GitHub 仓库生成一段 star 纪念视频。输入仓库地址，读取最近的 star 用户，所有渲染都在浏览器里完成。
            </p>
          </div>

          <section className="content-block enter" style={{ '--delay': '180ms' } as CSSProperties}>
            <p className="section-label">开始</p>
            <p className="section-lead">从一个仓库开始</p>

            <form className="form-panel" onSubmit={load}>
              <div className="field-group">
                <label className="field-label" htmlFor="github-token">
                  GitHub token <span>fine-grained</span>
                </label>
                <div className="input-shell">
                  <LockIcon />
                  <input
                    id="github-token"
                    type="password"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    placeholder="github_pat_... 或 ghp_..."
                    autoComplete="off"
                  />
                </div>
                <p className="field-hint">
                  需要 <b>Contents: Read and write</b> 权限，token 只会保存在你的浏览器里。
                </p>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="repository">
                  仓库路径 <span>owner / repository</span>
                </label>
                <div className="input-shell">
                  <span className="input-prefix">github.com/</span>
                  <input
                    id="repository"
                    type="text"
                    value={repoInput}
                    onChange={(event) => setRepoInput(event.target.value)}
                    placeholder={CURRENT_REPO_LABEL}
                    autoComplete="url"
                  />
                </div>
              </div>

              <label className="remember-control">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                <span>在这台设备记住 token</span>
              </label>

              <div className="form-actions">
                <button className="primary-button" type="submit" disabled={busy || !repoInput.trim()}>
                  <span>{phase === 'loading' ? step || '正在读取…' : '读取仓库数据'}</span>
                  {phase === 'loading' ? <span className="button-spinner" /> : <ArrowUpRightIcon />}
                </button>
              </div>

              {error && (
                <div className="error-message" role="alert">
                  <span>读取失败</span>
                  <p>{error}</p>
                </div>
              )}
            </form>
          </section>

          <section className="content-block enter" style={{ '--delay': '270ms' } as CSSProperties}>
            <p className="section-label">视频设定</p>
            <ul className="spec-list">
              <li>1280 × 720</li>
              <li>约 4 秒</li>
              <li>60 FPS</li>
              <li>最近 50 位头像</li>
            </ul>
            <p className="privacy-note">
              <LockIcon />
              <span>数据读取和视频渲染都发生在你的浏览器里。</span>
            </p>
          </section>

          {ready && (
            <section className="content-block result-section enter" style={{ '--delay': '90ms' } as CSSProperties}>
              <div className="result-heading">
                <div>
                  <p className="section-label">预览</p>
                  <p className="section-lead">你的星光已经准备好了</p>
                </div>
                <div className="repo-identity">
                  {props.userAvatarUrl ? <img src={props.userAvatarUrl} alt="" /> : <span className="avatar-fallback" />}
                  <span>
                    <b>{props.user}</b>
                    <span>/{props.repository}</span>
                  </span>
                </div>
              </div>

              <div className="stats-row" aria-label="仓库统计">
                <span>
                  <strong>{props.stars.toLocaleString('en-US')}</strong> stars
                </span>
                <span>
                  <strong>{props.stargazers.length}</strong> 个头像
                </span>
                <span>浏览器端渲染</span>
              </div>

              <div className="player-frame">
                <Player
                  component={GitHubStarsComposition}
                  inputProps={props}
                  durationInFrames={durationInFrames}
                  fps={fps}
                  compositionWidth={width}
                  compositionHeight={height}
                  style={{ width: '100%' }}
                  controls
                  loop
                />
              </div>

              <div className="export-row">
                <div>
                  <p className="export-title">预览满意了吗？</p>
                  <p className="export-copy">视频会在当前设备上编码，不会上传到服务器。</p>
                </div>
                <button className="primary-button export-button" type="button" onClick={exportVideo} disabled={busy}>
                  <span>{phase === 'rendering' ? `导出中… ${progress}%` : '导出 MP4'}</span>
                  {phase === 'rendering' ? <span className="button-spinner" /> : <ArrowUpRightIcon />}
                </button>
              </div>

              {phase === 'rendering' && (
                <div className="progress-track" aria-label={`导出进度 ${progress}%`}>
                  <div className="progress-bar" style={{ width: `${progress}%` }} />
                </div>
              )}

              {videoUrl && (
                <div className="download-panel">
                  <div>
                    <p className="section-label">完成</p>
                    <p className="section-lead">视频已经准备好了</p>
                    <p className="download-copy">
                      {renderSeconds ? `本次渲染用了 ${renderSeconds} 秒。` : '可以先预览，再保存到本地。'}
                    </p>
                  </div>
                  <video src={videoUrl} controls className="result-video" />
                  <a className="secondary-button" href={videoUrl} download={`${props.user}-${props.repository}.mp4`}>
                    下载 MP4
                    <ArrowUpRightIcon />
                  </a>
                </div>
              )}
            </section>
          )}
        </article>
      </main>

      <footer className="site-footer">
        <span>Made in browser · GitHub Stars Video</span>
        <a
          className="icon-link"
          href={CURRENT_REPO_URL}
          target="_blank"
          rel="noreferrer"
          aria-label={`打开 ${CURRENT_REPO_LABEL}`}
          title={CURRENT_REPO_LABEL}
        >
          <GitHubIcon />
        </a>
      </footer>
    </div>
  )
}
