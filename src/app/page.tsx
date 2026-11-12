'use client'

import { fetchRepoData, parseRepoInput } from '@/lib/github'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { GitHubStarsComposition } from '@/video/composition'
import { DEFAULT_VIDEO_SETTINGS, emptyProps, type Props, type VideoSettings } from '@/video/schema'
import { Player } from '@remotion/player'
import { renderMediaOnWeb } from '@remotion/web-renderer'
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'

const TOKEN_KEY = 'gsw-token'
const REPO_KEY = 'gsw-repo'
const THEME_KEY = 'gsw-theme'
const SETTINGS_KEY = 'gsw-settings'
const REMEMBER_KEY = 'gsw-remember-token'
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

type FieldErrors = {
  token?: string
  repository?: string
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* 存储被禁用或空间不足时仍可继续使用应用 */
  }
}

function removeStorage(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* 存储被禁用时忽略 */
  }
}

function loadSavedSettings(): VideoSettings {
  const raw = readStorage(SETTINGS_KEY)
  if (!raw) return DEFAULT_VIDEO_SETTINGS

  try {
    const saved = JSON.parse(raw) as Partial<VideoSettings>
    const validResolution = RESOLUTION_OPTIONS.some(
      (option) => option.width === saved.width && option.height === saved.height,
    )
    const validDuration = DURATION_OPTIONS.includes(saved.durationInSeconds ?? -1)
    const validFps = FPS_OPTIONS.includes(saved.fps ?? -1)
    const validAvatarLimit = AVATAR_OPTIONS.includes(saved.avatarLimit ?? -1)

    return {
      width: validResolution ? Number(saved.width) : DEFAULT_VIDEO_SETTINGS.width,
      height: validResolution ? Number(saved.height) : DEFAULT_VIDEO_SETTINGS.height,
      durationInSeconds: validDuration ? Number(saved.durationInSeconds) : DEFAULT_VIDEO_SETTINGS.durationInSeconds,
      fps: validFps ? Number(saved.fps) : DEFAULT_VIDEO_SETTINGS.fps,
      avatarLimit: validAvatarLimit ? Number(saved.avatarLimit) : DEFAULT_VIDEO_SETTINGS.avatarLimit,
    }
  } catch {
    return DEFAULT_VIDEO_SETTINGS
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' ||
      (error.name === 'GithubError' && (error as Error & { code?: string }).code === 'aborted'))
  )
}

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

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
      <path d="m3 3 18 18" />
      <path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.1 0 9.5 6 9.5 6a16.3 16.3 0 0 1-3 3.7M6.7 6.8C4.1 8.1 2.5 12 2.5 12s3.4 6 9.5 6c1 0 1.9-.2 2.7-.5" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
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
  const [remember, setRemember] = useState(false)
  const [repoInput, setRepoInput] = useState('')
  const [props, setProps] = useState<Props>(emptyProps)

  const [phase, setPhase] = useState<Phase>('idle')
  const [step, setStep] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [progress, setProgress] = useState(0)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [renderSeconds, setRenderSeconds] = useState<number | null>(null)
  const [theme, setTheme] = useState<Theme>('light')
  const [settings, setSettings] = useState<VideoSettings>(DEFAULT_VIDEO_SETTINGS)
  const [showToken, setShowToken] = useState(false)
  const [storageReady, setStorageReady] = useState(false)
  const [webCodecsSupported, setWebCodecsSupported] = useState(true)

  const loadControllerRef = useRef<AbortController | null>(null)
  const renderControllerRef = useRef<AbortController | null>(null)
  const videoUrlRef = useRef<string | null>(null)
  const downloadRef = useRef<HTMLDivElement>(null)
  const tokenInputRef = useRef<HTMLInputElement>(null)
  const repoInputRef = useRef<HTMLInputElement>(null)

  const setVideoObjectUrl = (nextUrl: string | null) => {
    const currentUrl = videoUrlRef.current
    if (currentUrl && currentUrl !== nextUrl) URL.revokeObjectURL(currentUrl)
    videoUrlRef.current = nextUrl
    setVideoUrl(nextUrl)
  }

  useEffect(() => {
    const savedRemember = readStorage(REMEMBER_KEY)
    const savedToken = readStorage(TOKEN_KEY)
    const shouldRemember = savedRemember === 'true' || (savedRemember === null && Boolean(savedToken))
    setRemember(shouldRemember)
    setToken(shouldRemember ? savedToken ?? '' : '')
    setRepoInput(readStorage(REPO_KEY) ?? '')
    setSettings(loadSavedSettings())

    const savedTheme = readStorage(THEME_KEY)
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme)
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark')
    }
    setStorageReady(true)
  }, [])

  useEffect(() => {
    if (!storageReady) return
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.dataset.theme = theme
    writeStorage(THEME_KEY, theme)
  }, [theme, storageReady])

  useEffect(() => {
    setWebCodecsSupported('VideoEncoder' in window)
  }, [])

  useEffect(() => {
    if (!storageReady) return
    writeStorage(REPO_KEY, repoInput)
  }, [repoInput, storageReady])

  useEffect(() => {
    if (!storageReady) return
    writeStorage(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings, storageReady])

  useEffect(() => {
    if (!storageReady) return
    writeStorage(REMEMBER_KEY, String(remember))
    if (remember && token.trim()) writeStorage(TOKEN_KEY, token.trim())
    else removeStorage(TOKEN_KEY)
  }, [remember, token, storageReady])

  useEffect(() => {
    return () => {
      loadControllerRef.current?.abort()
      renderControllerRef.current?.abort()
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current)
    }
  }, [])

  const load = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (phase === 'loading' || phase === 'rendering') return

    const nextFieldErrors: FieldErrors = {}
    if (!token.trim()) nextFieldErrors.token = '请输入 GitHub token。'
    if (!repoInput.trim()) {
      nextFieldErrors.repository = '请输入仓库路径，例如 liwenka1/next-web-nav。'
    } else {
      try {
        parseRepoInput(repoInput)
      } catch (err) {
        nextFieldErrors.repository = err instanceof Error ? err.message : '仓库路径格式不正确。'
      }
    }
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors)
      if (nextFieldErrors.token) tokenInputRef.current?.focus()
      else if (nextFieldErrors.repository) repoInputRef.current?.focus()
      return
    }

    loadControllerRef.current?.abort()
    const controller = new AbortController()
    loadControllerRef.current = controller
    const hadExistingData = Boolean(props.user && props.repository)

    setPhase('loading')
    setLoadError(null)
    setRenderError(null)
    setFieldErrors({})
    setVideoObjectUrl(null)
    setRenderSeconds(null)
    setStep('准备读取…')

    try {
      const data = await fetchRepoData(repoInput.trim(), token, setStep, { signal: controller.signal })
      if (controller.signal.aborted) {
        setPhase(hadExistingData ? 'ready' : 'idle')
        return
      }
      setProps({ ...data, videoSettings: settings })
      setPhase('ready')
    } catch (err) {
      if (!controller.signal.aborted && !isAbortError(err)) {
        setLoadError(err instanceof Error ? err.message : String(err))
      }
      setPhase(hadExistingData ? 'ready' : 'idle')
    } finally {
      if (loadControllerRef.current === controller) loadControllerRef.current = null
      setStep('')
    }
  }

  const cancelLoad = () => {
    loadControllerRef.current?.abort()
    setStep('')
  }

  const exportVideo = async () => {
    if (!ready || phase === 'loading' || phase === 'rendering') return
    if (!webCodecsSupported) {
      setRenderError('当前浏览器不支持 WebCodecs，无法在浏览器中导出视频。请使用较新的 Chrome、Firefox 或 Safari。')
      setPhase('ready')
      return
    }

    const controller = new AbortController()
    renderControllerRef.current = controller
    setPhase('rendering')
    setRenderError(null)
    setProgress(0)
    setVideoObjectUrl(null)
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
        signal: controller.signal,
        onProgress: (value) => setProgress(Math.round(value.progress * 100)),
      })
      const blob = await getBlob()
      if (controller.signal.aborted) {
        setPhase('ready')
        return
      }
      setRenderSeconds(Math.round((Date.now() - startedAt) / 1000))
      setVideoObjectUrl(URL.createObjectURL(blob))
      setPhase('done')
    } catch (err) {
      if (!controller.signal.aborted && !isAbortError(err)) {
        setRenderError(err instanceof Error ? `${err.name}: ${err.message}` : String(err))
      }
      setPhase('ready')
    } finally {
      if (renderControllerRef.current === controller) renderControllerRef.current = null
    }
  }

  const cancelRender = () => {
    renderControllerRef.current?.abort()
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
    setVideoObjectUrl(null)
    setRenderSeconds(null)
    setRenderError(null)
    setPhase((current) => (current === 'done' ? 'ready' : current))
  }

  const resetSettings = () => updateSettings(DEFAULT_VIDEO_SETTINGS)

  useEffect(() => {
    if (phase !== 'done' || !videoUrl) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    downloadRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' })
    downloadRef.current?.focus({ preventScroll: true })
  }, [phase, videoUrl])

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
            suppressHydrationWarning
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

            <form
              id="repository-form"
              className="form-panel"
              onSubmit={load}
              aria-busy={phase === 'loading'}
              noValidate
            >
              <div className="field-group">
                <label className="field-label" htmlFor="github-token">
                  GitHub token <span>fine-grained</span>
                </label>
                <div className="input-shell" data-invalid={Boolean(fieldErrors.token)}>
                  <LockIcon />
                  <Input
                    ref={tokenInputRef}
                    id="github-token"
                    type={showToken ? 'text' : 'password'}
                    value={token}
                    onChange={(event) => {
                      setToken(event.target.value)
                      setFieldErrors((current) => ({ ...current, token: undefined }))
                      setLoadError(null)
                    }}
                    placeholder="github_pat_... 或 ghp_..."
                    autoComplete="new-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    aria-invalid={Boolean(fieldErrors.token)}
                    aria-describedby={fieldErrors.token ? 'github-token-error github-token-hint' : 'github-token-hint'}
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="input-action"
                    type="button"
                    onClick={() => setShowToken((current) => !current)}
                    aria-label={showToken ? '隐藏 token' : '显示 token'}
                    title={showToken ? '隐藏 token' : '显示 token'}
                  >
                    {showToken ? <EyeOffIcon /> : <EyeIcon />}
                  </Button>
                </div>
                {fieldErrors.token && (
                  <p className="field-error" id="github-token-error">
                    {fieldErrors.token}
                  </p>
                )}
                <p className="field-hint" id="github-token-hint">
                  需要 <b>Contents: Read and write</b> 权限；勾选记住后会以明文保存在此浏览器。
                </p>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="repository">
                  仓库路径 <span>owner / repository</span>
                </label>
                <div className="input-shell" data-invalid={Boolean(fieldErrors.repository)}>
                  <span className="input-prefix">github.com/</span>
                  <Input
                    ref={repoInputRef}
                    id="repository"
                    type="text"
                    value={repoInput}
                    onChange={(event) => {
                      const normalized = event.target.value
                        .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
                        .replace(/^git@github\.com:/i, '')
                        .replace(/^github\.com\//i, '')
                      setRepoInput(normalized)
                      setFieldErrors((current) => ({ ...current, repository: undefined }))
                      setLoadError(null)
                    }}
                    placeholder="owner/repository"
                    autoComplete="url"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    aria-invalid={Boolean(fieldErrors.repository)}
                    aria-describedby={fieldErrors.repository ? 'repository-error repository-hint' : 'repository-hint'}
                  />
                </div>
                {fieldErrors.repository && (
                  <p className="field-error" id="repository-error">
                    {fieldErrors.repository}
                  </p>
                )}
                <p className="field-hint" id="repository-hint">
                  支持 owner/repo 或完整的 GitHub 仓库 URL。
                </p>
              </div>

              <label className="remember-control">
                <Checkbox checked={remember} onCheckedChange={(checked) => setRemember(checked)} />
                <span>在这台设备记住 token</span>
              </label>

              <div className="form-actions">
                <Button
                  className="primary-button"
                  type={phase === 'loading' ? 'button' : 'submit'}
                  onClick={phase === 'loading' ? cancelLoad : undefined}
                  disabled={phase === 'rendering'}
                  aria-busy={phase === 'loading'}
                >
                  <span>{phase === 'loading' ? '取消读取' : '读取仓库数据'}</span>
                  {phase === 'loading' ? <span className="button-spinner" /> : <ArrowUpRightIcon />}
                </Button>
                {phase === 'loading' && (
                  <p className="operation-status" role="status" aria-live="polite">
                    {step || '正在读取…'}
                  </p>
                )}
              </div>

              {loadError && (
                <div className="error-message" role="alert">
                  <span>读取失败</span>
                  <p>{loadError}</p>
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
              <label className="setting-field" htmlFor="setting-canvas">
                <span id="setting-canvas-label">画布</span>
                <Select
                  id="setting-canvas"
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
                  aria-labelledby="setting-canvas-label"
                />
              </label>

              <label className="setting-field" htmlFor="setting-duration">
                <span id="setting-duration-label">时长</span>
                <Select
                  id="setting-duration"
                  value={String(settings.durationInSeconds)}
                  options={DURATION_OPTIONS.map((seconds) => ({
                    label: `约 ${seconds} 秒`,
                    value: String(seconds),
                  }))}
                  onValueChange={(value) => updateSettings({ durationInSeconds: Number(value) })}
                  disabled={busy}
                  aria-labelledby="setting-duration-label"
                />
              </label>

              <label className="setting-field" htmlFor="setting-fps">
                <span id="setting-fps-label">帧率</span>
                <Select
                  id="setting-fps"
                  value={String(settings.fps)}
                  options={FPS_OPTIONS.map((value) => ({ label: `${value} FPS`, value: String(value) }))}
                  onValueChange={(value) => updateSettings({ fps: Number(value) })}
                  disabled={busy}
                  aria-labelledby="setting-fps-label"
                />
              </label>

              <label className="setting-field" htmlFor="setting-avatars">
                <span id="setting-avatars-label">头像数量</span>
                <Select
                  id="setting-avatars"
                  value={String(settings.avatarLimit)}
                  options={AVATAR_OPTIONS.map((value) => ({ label: `最近 ${value} 位`, value: String(value) }))}
                  onValueChange={(value) => updateSettings({ avatarLimit: Number(value) })}
                  disabled={busy}
                  aria-labelledby="setting-avatars-label"
                />
              </label>
            </div>

            <p className="privacy-note">
              <LockIcon />
              <span>设置会同步到预览和导出；数据读取和视频渲染都发生在你的浏览器里。</span>
            </p>
          </section>

          {ready && (
            <section
              className="content-block result-section enter"
              style={{ '--delay': '90ms' } as CSSProperties}
              aria-busy={phase === 'loading'}
            >
              <div className="result-heading">
                <div>
                  <p className="section-label">预览</p>
                  <p className="section-lead">你的星光已经准备好了</p>
                </div>
                <div className="repo-identity">
                  {props.userAvatarUrl ? (
                    // 头像已经是内联 data URL，Next Image 优化无法减少请求或体积。
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={props.userAvatarUrl} alt="" width={26} height={26} />
                  ) : (
                    <span className="avatar-fallback" />
                  )}
                  <span>
                    <b>{props.user}</b>
                    <span>/{props.repository}</span>
                  </span>
                </div>
              </div>

              <div className="stats-row" role="group" aria-label="仓库统计">
                <span>
                  <strong>{props.stars.toLocaleString('en-US')}</strong> stars
                </span>
                <span>
                  <strong>{props.avatarStats ? `${props.avatarStats.loaded}/${props.avatarStats.requested}` : previewProps.stargazers.length}</strong>{' '}
                  个头像
                </span>
                {props.avatarStats?.failed ? (
                  <span className="stats-warning">
                    有 {props.avatarStats.failed} 个头像下载失败，
                    <button type="submit" form="repository-form" className="inline-action">
                      重新读取
                    </button>
                  </span>
                ) : null}
                <span>浏览器端渲染</span>
              </div>

              {phase === 'loading' && (
                <p className="operation-status result-operation-status" role="status" aria-live="polite">
                  {step || '正在读取新仓库…'}
                </p>
              )}

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
                  <p className={webCodecsSupported ? 'export-copy' : 'export-copy support-warning'}>
                    {webCodecsSupported
                      ? '视频会在当前设备上编码，不会上传到服务器。'
                      : '当前浏览器不支持本地视频编码，请更换浏览器后再导出。'}
                  </p>
                </div>
                <Button
                  className="primary-button export-button"
                  type="button"
                  onClick={phase === 'rendering' ? cancelRender : exportVideo}
                  disabled={phase === 'loading' || !webCodecsSupported}
                  aria-busy={phase === 'rendering'}
                >
                  <span>{phase === 'rendering' ? '取消导出' : webCodecsSupported ? '导出 MP4' : '浏览器不支持'}</span>
                  {phase === 'rendering' ? <span className="button-spinner" /> : <ArrowUpRightIcon />}
                </Button>
              </div>

              {phase === 'rendering' && (
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label="导出进度"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <div className="progress-bar" style={{ width: `${progress}%` }} />
                </div>
              )}

              {renderError && (
                <div className="error-message render-error" role="alert">
                  <span>导出失败</span>
                  <p>{renderError}</p>
                  <Button variant="outline" type="button" className="error-action" onClick={exportVideo}>
                    重新导出
                  </Button>
                </div>
              )}

              {videoUrl && (
                <div className="download-panel" ref={downloadRef} tabIndex={-1} aria-live="polite">
                  <div>
                    <p className="section-label">完成</p>
                    <p className="section-lead">视频已经准备好了</p>
                    <p className="download-copy">
                      {renderSeconds !== null ? `本次渲染用了 ${renderSeconds} 秒。` : '可以先预览，再保存到本地。'}
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
