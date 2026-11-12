import { DEFAULT_VIDEO_SETTINGS, type Props } from '@/video/schema'

const API = 'https://api.github.com'
const DEFAULT_TIMEOUT_MS = 30_000
const AVATAR_BATCH_SIZE = 8
const AVATAR_RETRY_ATTEMPTS = 3
const AVATAR_RETRY_DELAY_MS = 150

export type GithubErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limit'
  | 'timeout'
  | 'aborted'
  | 'network'
  | 'unknown'

export class GithubError extends Error {
  readonly code: GithubErrorCode
  readonly status?: number
  readonly retryAfterSeconds?: number

  constructor(
    code: GithubErrorCode,
    message: string,
    options?: { status?: number; retryAfterSeconds?: number },
  ) {
    super(message)
    this.name = 'GithubError'
    this.code = code
    this.status = options?.status
    this.retryAfterSeconds = options?.retryAfterSeconds
  }
}

export type AvatarStats = {
  requested: number
  loaded: number
  failed: number
  ownerLoaded: boolean
}

export type RepoData = Props & {
  avatarStats: AvatarStats
}

export type FetchRepoDataOptions = {
  onStep?: (message: string) => void
  signal?: AbortSignal
  timeoutMs?: number
}

function authHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function abortError(message: string): GithubError {
  return new GithubError('aborted', message)
}

function timeoutError(): GithubError {
  return new GithubError('timeout', 'GitHub 请求超时，请检查网络后重试。')
}

async function fetchWithTimeout<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  signal: AbortSignal | undefined,
  consume: (response: Response, signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (signal?.aborted) throw abortError('已取消读取。')
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })

  // Keep the timeout and cancellation linked until the body and any FileReader work finish.
  let rejectOnAbort: (() => void) | undefined
  const cancelled = new Promise<never>((_, reject) => {
    rejectOnAbort = () => reject(timedOut ? timeoutError() : abortError('已取消读取。'))
    controller.signal.addEventListener('abort', rejectOnAbort, { once: true })
  })

  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(input, { ...init, signal: controller.signal })
        return consume(response, controller.signal)
      })(),
      cancelled,
    ])
  } catch (error) {
    if (signal?.aborted) throw abortError('已取消读取。')
    if (timedOut) throw timeoutError()
    if (error instanceof GithubError) throw error
    throw new GithubError('network', '无法连接 GitHub，请检查网络后重试。')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
    if (rejectOnAbort) controller.signal.removeEventListener('abort', rejectOnAbort)
  }
}

function errorCodeForResponse(status: number, message: string, remaining: string | null): GithubErrorCode {
  if (status === 401) return 'unauthorized'
  if (status === 404) return 'not_found'
  if (status === 429 || remaining === '0' || /rate limit/i.test(message)) return 'rate_limit'
  if (status === 403) return 'forbidden'
  return 'unknown'
}

function errorMessageForResponse(code: GithubErrorCode, status: number, message: string): string {
  switch (code) {
    case 'unauthorized':
      return 'GitHub token 无效或已过期，请检查 token。'
    case 'forbidden':
      return 'GitHub 拒绝了请求，请确认 token 具有 Contents: Read and write 权限，且你有该仓库的访问权限。'
    case 'not_found':
      return '找不到这个仓库，或当前 token 没有访问权限。请检查 owner/repository 是否正确。'
    case 'rate_limit':
      return 'GitHub API 请求次数已达上限，请稍后再试。'
    default:
      return `${status} ${message || 'GitHub 请求失败'}`
  }
}

async function gh<T>(
  path: string,
  token: string,
  options: Pick<FetchRepoDataOptions, 'signal' | 'timeoutMs'> = {},
): Promise<{ data: T; headers: Headers }> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  return fetchWithTimeout(
    `${API}${path}`,
    { headers: authHeaders(token) },
    timeoutMs,
    options.signal,
    async (res) => {
      const text = await res.text()
      if (!res.ok) {
        let message = res.statusText
        try {
          const body = JSON.parse(text) as { message?: string }
          if (body?.message) message = body.message
        } catch {
          /* 响应不是 JSON */
        }
        const code = errorCodeForResponse(res.status, message, res.headers.get('x-ratelimit-remaining'))
        const retryAfter = Number(res.headers.get('retry-after'))
        throw new GithubError(code, errorMessageForResponse(code, res.status, message), {
          status: res.status,
          retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
        })
      }
      return { data: JSON.parse(text) as T, headers: res.headers }
    },
  )
}

/** 从 Link 头解析最后一页；没有分页时返回 1 */
function parseLastPage(link: string | null): number {
  if (!link) return 1
  const last = link.split(',').find((part) => part.includes('rel="last"'))
  const match = last?.match(/[?&]page=(\d+)/)
  return match ? Number(match[1]) : 1
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError('已取消读取。'))
      return
    }
    let timer: ReturnType<typeof setTimeout>
    const onAbort = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      reject(abortError('已取消读取。'))
    }
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function readDataUrl(blob: Blob, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError('已取消读取。'))
      return
    }
    const reader = new FileReader()
    const cleanup = () => signal.removeEventListener('abort', onAbort)
    const onAbort = () => {
      reader.abort()
      cleanup()
      reject(abortError('已取消读取。'))
    }
    reader.onload = () => {
      cleanup()
      resolve(String(reader.result))
    }
    reader.onerror = () => {
      cleanup()
      reject(reader.error)
    }
    signal.addEventListener('abort', onAbort, { once: true })
    try {
      reader.readAsDataURL(blob)
    } catch (error) {
      cleanup()
      reject(error)
    }
  })
}

/**
 * 下载图片并转成 data URL。
 * 必须内联：Remotion 的 <Img> 会阻塞整帧等图片加载完，远程图片一挂就渲染超时；
 * 而且跨域图片会污染 canvas，导致 renderMediaOnWeb 导出时抛安全错误。
 */
async function toDataUrl(url: string, size = 128, options: FetchRepoDataOptions = {}): Promise<string | null> {
  const sized = `${url}${url.includes('?') ? '&' : '?'}s=${size}`
  for (let attempt = 0; attempt < AVATAR_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await fetchWithTimeout(
        sized,
        { mode: 'cors' },
        Math.min(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 12_000),
        options.signal,
        async (res, signal) => {
          if (!res.ok) {
            await res.body?.cancel()
            if (res.status < 500 && res.status !== 429) return null
            throw new Error(`头像请求失败：${res.status}`)
          }
          return readDataUrl(await res.blob(), signal)
        },
      )
    } catch (error) {
      if (error instanceof GithubError && error.code === 'aborted') throw error
      if (attempt === AVATAR_RETRY_ATTEMPTS - 1) return null
      await wait(AVATAR_RETRY_DELAY_MS * (attempt + 1), options.signal)
    }
  }
  return null
}

/** 分批下载，避免几十个请求同时挤满连接池导致大面积超时 */
async function inlineAll(
  urls: string[],
  options: FetchRepoDataOptions = {},
): Promise<{ dataUrls: string[]; failed: number }> {
  const result: string[] = []
  let failed = 0
  for (let i = 0; i < urls.length; i += AVATAR_BATCH_SIZE) {
    const batch = urls.slice(i, i + AVATAR_BATCH_SIZE)
    const done = await Promise.all(batch.map((url) => toDataUrl(url, 128, options)))
    result.push(...done.filter((item): item is string => Boolean(item)))
    failed += done.filter((item) => !item).length
    options.onStep?.(`已处理 ${Math.min(i + batch.length, urls.length)}/${urls.length} 张头像…`)
  }
  return { dataUrls: result, failed }
}

export function parseRepoInput(raw: string): { owner: string; repo: string } {
  let value = raw.trim()
  if (!value) {
    throw new Error('仓库路径格式应为 owner/repo，例如 liwenka1/next-web-nav')
  }

  if (/^git@github\.com:/i.test(value)) {
    value = value.replace(/^git@github\.com:/i, '')
  } else if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value)
      if (!['github.com', 'www.github.com'].includes(parsed.hostname.toLowerCase())) {
        throw new Error('仓库地址必须来自 github.com')
      }
      value = parsed.pathname
    } catch (error) {
      if (error instanceof Error && error.message === '仓库地址必须来自 github.com') throw error
      throw new Error('仓库路径格式应为 owner/repo，例如 liwenka1/next-web-nav')
    }
  } else {
    value = value.replace(/^github\.com\//i, '')
    value = value.split(/[?#]/, 1)[0]
  }

  const parts = value
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.git$/i, '')
    .split('/')
    .filter(Boolean)
  if (parts.length !== 2 || parts.some((part) => !/^[A-Za-z0-9_.-]+$/.test(part))) {
    throw new Error('仓库路径格式应为 owner/repo，例如 liwenka1/next-web-nav')
  }
  return { owner: parts[0], repo: parts[1] }
}

function normalizeOptions(
  onStepOrOptions?: ((message: string) => void) | FetchRepoDataOptions,
  options?: FetchRepoDataOptions,
): FetchRepoDataOptions {
  if (typeof onStepOrOptions === 'function') return { ...options, onStep: onStepOrOptions }
  return onStepOrOptions ?? options ?? {}
}

export async function fetchRepoData(
  rawRepo: string,
  token: string,
  onStepOrOptions?: ((message: string) => void) | FetchRepoDataOptions,
  options?: FetchRepoDataOptions,
): Promise<RepoData> {
  const requestOptions = normalizeOptions(onStepOrOptions, options)
  if (!token.trim()) {
    throw new Error('请先填写 GitHub token（只保存在你的浏览器里）')
  }
  const { owner, repo } = parseRepoInput(rawRepo)

  // A failed API call must not leave sibling requests downloading in the background.
  const controller = new AbortController()
  const onAbort = () => controller.abort()
  requestOptions.signal?.addEventListener('abort', onAbort, { once: true })
  if (requestOptions.signal?.aborted) controller.abort()

  try {
    return await loadRepoData(owner, repo, token.trim(), { ...requestOptions, signal: controller.signal })
  } catch (error) {
    controller.abort()
    throw error
  } finally {
    requestOptions.signal?.removeEventListener('abort', onAbort)
  }
}

async function loadRepoData(
  owner: string,
  repo: string,
  token: string,
  requestOptions: FetchRepoDataOptions,
): Promise<RepoData> {
  const onStep = requestOptions.onStep

  onStep?.('读取仓库信息…')
  const [{ data: user }, { data: info }] = await Promise.all([
    gh<{ avatar_url: string }>(`/users/${owner}`, token, requestOptions),
    gh<{ stargazers_count: number }>(`/repos/${owner}/${repo}`, token, requestOptions),
  ])

  // 点赞者按时间正序返回，「最新」在最后一页的末尾
  onStep?.('读取点赞者名单…')
  const perPage = 100
  const first = await gh<{ avatar_url?: string }[]>(
    `/repos/${owner}/${repo}/stargazers?per_page=${perPage}`,
    token,
    requestOptions,
  )
  const lastPage = parseLastPage(first.headers.get('link'))
  const pages = lastPage > 1 ? [lastPage - 1, lastPage] : [1]

  const collected: { avatar_url?: string }[] = []
  for (const page of pages) {
    const res =
      page === 1
        ? first
        : await gh<{ avatar_url?: string }[]>(
            `/repos/${owner}/${repo}/stargazers?per_page=${perPage}&page=${page}`,
            token,
            requestOptions,
          )
    collected.push(...res.data)
  }
  const avatarUrls = collected
    .slice(-50)
    .map((s) => s.avatar_url)
    .filter((url): url is string => Boolean(url))

  onStep?.(`下载并内联 ${avatarUrls.length + 1} 张头像…`)
  const [ownerAvatar, stargazersResult] = await Promise.all([
    toDataUrl(user.avatar_url, 128, requestOptions),
    inlineAll(avatarUrls, requestOptions),
  ])

  return {
    user: owner,
    userAvatarUrl: ownerAvatar ?? '',
    repository: repo,
    stars: info.stargazers_count ?? 0,
    stargazers: stargazersResult.dataUrls,
    avatarStats: {
      requested: avatarUrls.length,
      loaded: stargazersResult.dataUrls.length,
      failed: stargazersResult.failed,
      ownerLoaded: Boolean(ownerAvatar),
    },
    videoSettings: DEFAULT_VIDEO_SETTINGS,
  }
}
