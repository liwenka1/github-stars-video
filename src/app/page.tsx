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
import { useEffect, useState } from 'react'

const TOKEN_KEY = 'gsw-token'
const durationInFrames = (animationDurationInSeconds + 1) * fps

type Phase = 'idle' | 'loading' | 'ready' | 'rendering' | 'done'

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

  // token 只存在本机浏览器，不经过任何服务器
  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY)
    if (saved) {
      setToken(saved)
      setRepoInput((current) => current || localStorage.getItem('gsw-repo') || '')
    }
  }, [])

  const load = async () => {
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
      localStorage.setItem('gsw-repo', repoInput)
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
        onProgress: (p) => setProgress(Math.round(p.progress * 100)),
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

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.h1}>GitHub Stars Video</h1>
        <p style={styles.sub}>
          为你的 GitHub 仓库生成一段 star 纪念视频 · 渲染全程在你的浏览器里完成，服务器不参与
        </p>
      </header>

      <section style={styles.card}>
        <label style={styles.label}>GitHub token</label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="github_pat_... 或 ghp_..."
          style={styles.input}
          autoComplete="off"
        />
        <p style={styles.hint}>
          只保存在你自己的浏览器（localStorage），不会发给任何服务器。需要{' '}
          <b>Contents: Read and write</b> 权限才能读取点赞者名单——GitHub 从 2026-06-30
          起只允许仓库的 admin/协作者查看它。
        </p>

        <label style={{ ...styles.label, marginTop: 18 }}>仓库</label>
        <input
          type="text"
          value={repoInput}
          onChange={(e) => setRepoInput(e.target.value)}
          placeholder="owner/repo，例如 liwenka1/next-web-nav"
          style={styles.input}
        />

        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span>在本机记住 token</span>
        </label>

        <button onClick={load} disabled={busy || !repoInput} style={styles.primaryButton}>
          {phase === 'loading' ? step || '读取中…' : '读取仓库数据'}
        </button>

        {error && <pre style={styles.error}>{error}</pre>}
      </section>

      {ready && (
        <section style={styles.card}>
          <div style={styles.statsRow}>
            <span>
              <b>{props.user}</b>/{props.repository}
            </span>
            <span>{props.stars.toLocaleString('en-US')} stars</span>
            <span>{props.stargazers.length} 个头像</span>
          </div>

          <Player
            component={GitHubStarsComposition}
            inputProps={props}
            durationInFrames={durationInFrames}
            fps={fps}
            compositionWidth={width}
            compositionHeight={height}
            style={styles.player}
            controls
            loop
          />

          <button
            onClick={exportVideo}
            disabled={busy}
            style={{ ...styles.primaryButton, marginTop: 16 }}
          >
            {phase === 'rendering' ? `导出中… ${progress}%` : '导出 MP4（浏览器内渲染）'}
          </button>

          {phase === 'rendering' && (
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressBar, width: `${progress}%` }} />
            </div>
          )}

          {videoUrl && (
            <div style={{ marginTop: 16 }}>
              <video src={videoUrl} controls style={styles.video} />
              <a
                href={videoUrl}
                download={`${props.user}-${props.repository}.mp4`}
                style={{
                  ...styles.primaryButton,
                  display: 'block',
                  textAlign: 'center',
                  textDecoration: 'none',
                }}
              >
                下载 MP4{renderSeconds ? `（渲染用了 ${renderSeconds} 秒）` : ''}
              </a>
            </div>
          )}
        </section>
      )}

      <footer style={styles.footer}>
        视频效果与{' '}
        <a href="https://github.com/scastiel/github-stars-video" style={styles.link}>
          scastiel/github-stars-video
        </a>{' '}
        保持一致 · 本版改用浏览器端渲染，可部署在 Vercel 免费版
      </footer>
    </main>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#0b1220',
    color: '#e2e8f0',
    padding: '48px 20px 64px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
  },
  header: { textAlign: 'center', maxWidth: 640 },
  h1: { margin: 0, fontSize: 34, letterSpacing: -0.5 },
  sub: { margin: '10px 0 0', color: '#94a3b8', fontSize: 15, lineHeight: 1.6 },
  card: {
    width: '100%',
    maxWidth: 720,
    background: '#131c2e',
    border: '1px solid #22304a',
    borderRadius: 14,
    padding: 24,
  },
  label: { display: 'block', fontSize: 14, color: '#94a3b8', marginBottom: 8 },
  input: {
    width: '100%',
    padding: '11px 13px',
    borderRadius: 9,
    border: '1px solid #2c3c58',
    background: '#0e1626',
    color: '#e2e8f0',
    fontSize: 15,
    outline: 'none',
  },
  hint: { margin: '10px 0 0', fontSize: 12.5, color: '#7c8aa3', lineHeight: 1.6 },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    fontSize: 13.5,
    color: '#94a3b8',
  },
  primaryButton: {
    width: '100%',
    marginTop: 18,
    padding: '12px 16px',
    borderRadius: 9,
    border: 'none',
    background: '#3b82f6',
    color: 'white',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    marginTop: 16,
    padding: 12,
    borderRadius: 9,
    background: '#3f1d24',
    color: '#fca5a5',
    fontSize: 12.5,
    whiteSpace: 'pre-wrap',
    maxHeight: 240,
    overflow: 'auto',
  },
  statsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 16,
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
  },
  player: { width: '100%', borderRadius: 10, overflow: 'hidden' },
  progressTrack: {
    marginTop: 12,
    height: 6,
    borderRadius: 3,
    background: '#22304a',
    overflow: 'hidden',
  },
  progressBar: { height: '100%', background: '#3b82f6', transition: 'width .2s' },
  video: { width: '100%', borderRadius: 10, marginBottom: 12 },
  footer: { fontSize: 12.5, color: '#64748b', textAlign: 'center', marginTop: 8 },
  link: { color: '#7ba7e0' },
}
