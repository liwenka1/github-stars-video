const assert = require('node:assert/strict')
const http = require('node:http')
const { once } = require('node:events')
const nodeTest = require('node:test')
const { loadTs } = require('./helpers/load-ts.cjs')

const test = (name, run) => nodeTest(name, { timeout: 5_000 }, run)

class DataUrlReader {
  readAsDataURL(blob) {
    blob.arrayBuffer().then((bytes) => {
      if (this.aborted) return
      this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`
      this.onload?.()
    }, (error) => {
      this.error = error
      this.onerror?.()
    })
  }

  abort() {
    this.aborted = true
  }
}

async function fixture(t, intercept = () => false, FileReader = DataUrlReader) {
  let origin
  const timers = new Set()
  const server = http.createServer((req, res) => {
    const delayedBody = (body, delay = 600, contentType = 'application/json') => {
      res.writeHead(200, { 'Content-Type': contentType })
      res.flushHeaders()
      const timer = setTimeout(() => res.end(body), delay)
      timers.add(timer)
      res.on('close', () => clearTimeout(timer))
    }
    if (intercept(req, res, delayedBody)) return
    res.setHeader('Content-Type', 'application/json')
    if (req.url === '/users/example') {
      res.end(JSON.stringify({ avatar_url: `${origin}/avatar/owner` }))
    } else if (req.url === '/repos/example/project') {
      res.end(JSON.stringify({ stargazers_count: 1 }))
    } else if (req.url.startsWith('/repos/example/project/stargazers')) {
      res.end(JSON.stringify([{ avatar_url: `${origin}/avatar/star` }]))
    } else {
      res.setHeader('Content-Type', 'image/png')
      res.end(Buffer.from('avatar'))
    }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  origin = `http://127.0.0.1:${server.address().port}`
  t.after(() => {
    for (const timer of timers) clearTimeout(timer)
    server.closeAllConnections()
    return new Promise((resolve) => server.close(resolve))
  })
  const { fetchRepoData } = loadTs('src/lib/github.ts', {
    globals: {
      FileReader,
      fetch: (url, init) => fetch(String(url).replace('https://api.github.com', origin), init),
    },
  })
  return (options) => fetchRepoData('example/project', 'test-token', options)
}

test('successful responses preserve stars, avatars and download statistics', async (t) => {
  const load = await fixture(t)
  const result = await load({ timeoutMs: 2_000 })
  assert.equal(result.stars, 1)
  assert.equal(result.avatarStats.loaded, 1)
  assert.equal(result.avatarStats.failed, 0)
  assert.equal(result.avatarStats.ownerLoaded, true)
  assert.match(result.userAvatarUrl, /^data:image\/png;base64,/)
  assert.match(result.stargazers[0], /^data:image\/png;base64,/)
})

test('a previously cancelled signal sends no network requests', async (t) => {
  let requests = 0
  const load = await fixture(t, () => { requests += 1; return false })
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(load({ signal: controller.signal }), (error) => error.code === 'aborted')
  assert.equal(requests, 0)
})

test('timeout covers JSON body download after headers arrive', async (t) => {
  let headersSent = false
  const load = await fixture(t, (req, res, delayedBody) => {
    if (req.url !== '/repos/example/project') return false
    delayedBody(JSON.stringify({ stargazers_count: 1 }))
    headersSent = true
    return true
  })
  await assert.rejects(load({ timeoutMs: 100 }), (error) => error.code === 'timeout')
  assert.equal(headersSent, true)
})

test('cancellation after headers interrupts JSON body download', async (t) => {
  let receivedHeaders
  const headers = new Promise((resolve) => { receivedHeaders = resolve })
  const load = await fixture(t, (req, res, delayedBody) => {
    if (req.url !== '/repos/example/project') return false
    delayedBody(JSON.stringify({ stargazers_count: 1 }))
    receivedHeaders()
    return true
  })
  const controller = new AbortController()
  const result = load({ timeoutMs: 2_000, signal: controller.signal })
  await headers
  controller.abort()
  await assert.rejects(result, (error) => error.code === 'aborted')
})

test('HTTP failures retain actionable error classification', async (t) => {
  for (const [status, code] of [[401, 'unauthorized'], [403, 'forbidden'], [404, 'not_found'], [429, 'rate_limit']]) {
    const load = await fixture(t, (req, res) => {
      if (req.url !== '/repos/example/project') return false
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ message: 'Request rejected' }))
      return true
    })
    await assert.rejects(load(), (error) => error.code === code && error.status === status)
  }
})

test('avatar body timeouts retry finitely and report failure without losing repo data', async (t) => {
  let attempts = 0
  const load = await fixture(t, (req, res, delayedBody) => {
    if (!req.url.startsWith('/avatar/star')) return false
    attempts += 1
    delayedBody('avatar', 600, 'image/png')
    return true
  })
  const result = await load({ timeoutMs: 100 })
  assert.equal(attempts, 3)
  assert.equal(result.stars, 1)
  assert.equal(result.avatarStats.failed, 1)
  assert.equal(result.avatarStats.loaded, 0)
  assert.equal(result.avatarStats.ownerLoaded, true)
})

test('cancellation after avatar headers interrupts blob download and stops retries', async (t) => {
  let receivedHeaders
  const headers = new Promise((resolve) => { receivedHeaders = resolve })
  let attempts = 0
  const load = await fixture(t, (req, res, delayedBody) => {
    if (!req.url.startsWith('/avatar/star')) return false
    attempts += 1
    delayedBody('avatar', 600, 'image/png')
    receivedHeaders()
    return true
  })
  const controller = new AbortController()
  const result = load({ timeoutMs: 2_000, signal: controller.signal })
  await headers
  controller.abort()
  await assert.rejects(result, (error) => error.code === 'aborted')
  assert.equal(attempts, 1)
})

test('cancellation aborts active FileReader work', async (t) => {
  let started
  const reading = new Promise((resolve) => { started = resolve })
  let aborts = 0
  class StalledReader {
    readAsDataURL() { started() }
    abort() { aborts += 1 }
  }
  const load = await fixture(t, undefined, StalledReader)
  const controller = new AbortController()
  const result = load({ timeoutMs: 2_000, signal: controller.signal })
  await reading
  controller.abort()
  await assert.rejects(result, (error) => error.code === 'aborted')
  assert.ok(aborts > 0)
})

test('avatar conversion timeouts abort FileReader and keep retries bounded', async (t) => {
  let starts = 0
  let aborts = 0
  class StalledReader {
    readAsDataURL() { starts += 1 }
    abort() { aborts += 1 }
  }
  const load = await fixture(t, undefined, StalledReader)
  const result = await load({ timeoutMs: 100 })
  assert.equal(starts, 6)
  assert.equal(aborts, starts)
  assert.equal(result.avatarStats.ownerLoaded, false)
  assert.equal(result.avatarStats.failed, 1)
})

test('slow HTTP error bodies remain cancellable after response headers', async (t) => {
  let receivedHeaders
  const headers = new Promise((resolve) => { receivedHeaders = resolve })
  const load = await fixture(t, (req, res) => {
    if (req.url !== '/repos/example/project') return false
    res.writeHead(403, { 'Content-Type': 'application/json' })
    res.flushHeaders()
    receivedHeaders()
    return true
  })
  const controller = new AbortController()
  const result = load({ timeoutMs: 2_000, signal: controller.signal })
  await headers
  controller.abort()
  await assert.rejects(result, (error) => error.code === 'aborted')
})

test('one API failure cancels a sibling request still downloading its body', async (t) => {
  let siblingClosed
  const closed = new Promise((resolve) => { siblingClosed = resolve })
  let siblingStarted
  const started = new Promise((resolve) => { siblingStarted = resolve })
  const load = await fixture(t, (req, res, delayedBody) => {
    if (req.url === '/users/example') {
      delayedBody(JSON.stringify({ avatar_url: '' }))
      res.on('close', () => siblingClosed(!res.writableFinished))
      siblingStarted()
      return true
    }
    if (req.url === '/repos/example/project') {
      started.then(() => {
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: 'Forbidden' }))
      })
      return true
    }
    return false
  })
  await assert.rejects(load({ timeoutMs: 2_000 }), (error) => error.code === 'forbidden')
  assert.equal(await closed, true)
})
