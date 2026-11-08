'use client'

import { fetchRepoData } from '@/lib/github'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { GitHubStarsComposition } from '@/video/composition'
import { DEFAULT_VIDEO_SETTINGS, emptyProps, type Props, type VideoSettings } from '@/video/schema'
import { Player } from '@remotion/player'
import { renderMediaOnWeb } from '@remotion/web-renderer'
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'

const TOKEN_KEY = 'gsw-token'
const REPO_KEY = 'gsw-repo'
const THEME_KEY = 'gsw-theme'
const CURRENT_REPO_URL = 'https://github.com/liwenka1/github-stars-video'
const CURRENT_REPO_LABEL = 'liwenka1/github-stars-video'

const RESOLUTION_OPTIONS = [
  { label: '1280 × 720', width: 1280, height: 720 },
  { label: '1920 × 1080', width: 1920, height: 1080 },
  { label: '1080 × 1080', width: 1080, height: 1080 },
  { label: '1080 × 1920', width: 1080, height: 1920 },
]
const DURATION_OPTIONS = [2, 4, 6, 8]
const FPS_OPTIONS = [30, 60]
const AVATAR_OPTIONS = [10, 25, 50]

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

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v6h6" />
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
  const [settings, setSettings] = useState<VideoSettings>(DEFAULT_VIDEO_SETTINGS)

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
    document.documentElement.classList.toggle('dark', theme === 'dark')
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
      setProps({ ...data, videoSettings: settings })
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
    const durationInFrames = Math.max(1, Math.round(settings.durationInSeconds * settings.fps))
    const renderProps = {
      ...props,
      videoSettings: settings,
      stargazers: props.stargazers.slice(-settings.avatarLimit),
    }

    try {
      const { getBlob } = await renderMediaOnWeb({
        composition: {
          id: 'GitHubStars',
          component: GitHubStarsComposition,
          durationInFrames,
          fps: settings.fps,
          width: settings.width,
          height: settings.height,
          calculateMetadata: null,
          defaultProps: renderProps,
        },
        inputProps: renderProps,
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
  const previewProps: Props = ready
    ? {
        ...props,
        videoSettings: settings,
        stargazers: props.stargazers.slice(-settings.avatarLimit),
      }
    : props
  const previewDurationInFrames = Math.max(1, Math.round(settings.durationInSeconds * settings.fps))

  const updateSettings = (updates: Partial<VideoSettings>) => {
    setSettings((current) => ({ ...current, ...updates }))
    setVideoUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return null
    })
    setRenderSeconds(null)
    setPhase((current) => (current === 'done' ? 'ready' : current))
  }

  const resetSettings = () => updateSettings(DEFAULT_VIDEO_SETTINGS)

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand-mark-link" href="/" aria-label="GitHub Stars Video">
          <span className="brand-mark">
            <MarkIcon />
          </span>
        </a>

        <div className="site-actions">
          <Button
            variant="ghost"
            size="icon-xs"
            className="icon-link"
            render={
              <a
                href={CURRENT_REPO_URL}
                target="_blank"
                rel="noreferrer"
                aria-label={`打开 ${CURRENT_REPO_LABEL}`}
                title={CURRENT_REPO_LABEL}
              />
            }
          >
            <GitHubIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="theme-toggle"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`切换到${themeLabel}模式`}
            title={`切换到${themeLabel}模式`}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </Button>
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
                  <Input
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
                  <Input
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
                <Checkbox checked={remember} onCheckedChange={(checked) => setRemember(checked)} />
                <span>在这台设备记住 token</span>
              </label>

              <div className="form-actions">
                <Button className="primary-button" type="submit" disabled={busy || !repoInput.trim()}>
                  <span>{phase === 'loading' ? step || '正在读取…' : '读取仓库数据'}</span>
                  {phase === 'loading' ? <span className="button-spinner" /> : <ArrowUpRightIcon />}
                </Button>
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
            <div className="settings-heading">
              <div>
                <p className="section-label">视频设定</p>
                <p className="section-lead">按照你的方式调整</p>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                className="reset-button"
                type="button"
                onClick={resetSettings}
                disabled={busy}
                aria-label="恢复默认视频设定"
                title="恢复默认视频设定"
              >
                <ResetIcon />
              </Button>
            </div>

            <div className="settings-grid">
              <label className="setting-field">
                <span>画布</span>
                <Select
                  value={`${settings.width}x${settings.height}`}
                  options={RESOLUTION_OPTIONS.map((option) => ({
                    label: option.label,
                    value: `${option.width}x${option.height}`,
                  }))}
                  onValueChange={(value) => {
                    const option = RESOLUTION_OPTIONS.find((item) => `${item.width}x${item.height}` === value)
                    if (option) updateSettings({ width: option.width, height: option.height })
                  }}
                  disabled={busy}
                  aria-label="画布尺寸"
                />
              </label>

              <label className="setting-field">
                <span>时长</span>
                <Select
                  value={String(settings.durationInSeconds)}
                  options={DURATION_OPTIONS.map((seconds) => ({
                    label: `约 ${seconds} 秒`,
                    value: String(seconds),
                  }))}
                  onValueChange={(value) => updateSettings({ durationInSeconds: Number(value) })}
                  disabled={busy}
                  aria-label="视频时长"
                />
              </label>

              <label className="setting-field">
                <span>帧率</span>
                <Select
                  value={String(settings.fps)}
                  options={FPS_OPTIONS.map((value) => ({ label: `${value} FPS`, value: String(value) }))}
                  onValueChange={(value) => updateSettings({ fps: Number(value) })}
                  disabled={busy}
                  aria-label="视频帧率"
                />
              </label>

              <label className="setting-field">
                <span>头像数量</span>
                <Select
                  value={String(settings.avatarLimit)}
                  options={AVATAR_OPTIONS.map((value) => ({ label: `最近 ${value} 位`, value: String(value) }))}
                  onValueChange={(value) => updateSettings({ avatarLimit: Number(value) })}
                  disabled={busy}
                  aria-label="头像数量"
                />
              </label>
            </div>

            <p className="privacy-note">
              <LockIcon />
              <span>设置会同步到预览和导出；数据读取和视频渲染都发生在你的浏览器里。</span>
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
                  <strong>{previewProps.stargazers.length}</strong> 个头像
                </span>
                <span>浏览器端渲染</span>
              </div>

              <div className="player-frame">
                <Player
                  key={`${settings.width}x${settings.height}-${settings.durationInSeconds}-${settings.fps}-${settings.avatarLimit}`}
                  component={GitHubStarsComposition}
                  inputProps={previewProps}
                  durationInFrames={previewDurationInFrames}
                  fps={settings.fps}
                  compositionWidth={settings.width}
                  compositionHeight={settings.height}
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
                <Button className="primary-button export-button" type="button" onClick={exportVideo} disabled={busy}>
                  <span>{phase === 'rendering' ? `导出中… ${progress}%` : '导出 MP4'}</span>
                  {phase === 'rendering' ? <span className="button-spinner" /> : <ArrowUpRightIcon />}
                </Button>
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
                  <Button
                    variant="outline"
                    className="secondary-button"
                    render={<a href={videoUrl} download={`${props.user}-${props.repository}.mp4`} />}
                  >
                    下载 MP4
                    <ArrowUpRightIcon />
                  </Button>
                </div>
              )}
            </section>
          )}
        </article>
      </main>

      <footer className="site-footer">
        <span>Made in browser · GitHub Stars Video</span>
        <Button
          variant="ghost"
          size="icon-xs"
          className="icon-link"
          render={
            <a
              href={CURRENT_REPO_URL}
              target="_blank"
              rel="noreferrer"
              aria-label={`打开 ${CURRENT_REPO_LABEL}`}
              title={CURRENT_REPO_LABEL}
            />
          }
        >
          <GitHubIcon />
        </Button>
      </footer>
    </div>
  )
}
