import type { Props } from '@/video/schema'

const API = 'https://api.github.com'

function authHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function gh(path: string, token: string): Promise<Response> {
  const res = await fetch(`${API}${path}`, { headers: authHeaders(token) })
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`
    try {
      const body = (await res.json()) as { message?: string }
      if (body?.message) message = `${res.status} ${body.message}`
    } catch {
      /* 响应不是 JSON */
    }
    throw new Error(message)
  }
  return res
}

/** 从 Link 头解析最后一页；没有分页时返回 1 */
function parseLastPage(link: string | null): number {
  if (!link) return 1
  const last = link.split(',').find((part) => part.includes('rel="last"'))
  const match = last?.match(/[?&]page=(\d+)/)
  return match ? Number(match[1]) : 1
}

/**
 * 下载图片并转成 data URL。
 * 必须内联：Remotion 的 <Img> 会阻塞整帧等图片加载完，远程图片一挂就渲染超时；
 * 而且跨域图片会污染 canvas，导致 renderMediaOnWeb 导出时抛安全错误。
 */
async function toDataUrl(url: string, size = 128): Promise<string | null> {
  try {
    const sized = `${url}${url.includes('?') ? '&' : '?'}s=${size}`
    const res = await fetch(sized, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

/** 分批下载，避免几十个请求同时挤满连接池导致大面积超时 */
async function inlineAll(urls: string[]): Promise<string[]> {
  const result: string[] = []
  const BATCH_SIZE = 8
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE)
    const done = await Promise.all(batch.map((url) => toDataUrl(url)))
    result.push(...done.filter((item): item is string => Boolean(item)))
  }
  return result
}

export function parseRepoInput(raw: string): { owner: string; repo: string } {
  const cleaned = raw
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '')
  const parts = cleaned.split('/')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('仓库路径格式应为 owner/repo，例如 liwenka1/next-web-nav')
  }
  return { owner: parts[0], repo: parts[1] }
}

export async function fetchRepoData(
  rawRepo: string,
  token: string,
  onStep?: (message: string) => void,
): Promise<Props> {
  if (!token.trim()) {
    throw new Error('请先填写 GitHub token（只保存在你的浏览器里）')
  }
  const { owner, repo } = parseRepoInput(rawRepo)

  onStep?.('读取仓库信息…')
  const [userRes, repoRes] = await Promise.all([
    gh(`/users/${owner}`, token),
    gh(`/repos/${owner}/${repo}`, token),
  ])
  const user = (await userRes.json()) as { avatar_url: string }
  const info = (await repoRes.json()) as { stargazers_count: number }

  // 点赞者按时间正序返回，「最新」在最后一页的末尾
  onStep?.('读取点赞者名单…')
  const perPage = 100
  const first = await gh(`/repos/${owner}/${repo}/stargazers?per_page=${perPage}`, token)
  const lastPage = parseLastPage(first.headers.get('link'))
  const pages = lastPage > 1 ? [lastPage - 1, lastPage] : [1]

  const collected: { avatar_url?: string }[] = []
  for (const page of pages) {
    const res =
      page === 1
        ? first
        : await gh(`/repos/${owner}/${repo}/stargazers?per_page=${perPage}&page=${page}`, token)
    collected.push(...((await res.json()) as { avatar_url?: string }[]))
  }
  const avatarUrls = collected
    .slice(-50)
    .map((s) => s.avatar_url)
    .filter((url): url is string => Boolean(url))

  onStep?.(`下载并内联 ${avatarUrls.length + 1} 张头像…`)
  const [ownerAvatar, stargazers] = await Promise.all([
    toDataUrl(user.avatar_url),
    inlineAll(avatarUrls),
  ])

  return {
    user: owner,
    userAvatarUrl: ownerAvatar ?? '',
    repository: repo,
    stars: info.stargazers_count ?? 0,
    stargazers,
  }
}
