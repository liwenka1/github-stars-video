const test = require('node:test')
const assert = require('node:assert/strict')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const remotion = require('remotion')
const { loadTs } = require('./helpers/load-ts.cjs')

const { getVideoLayout, getAvatarMotion } = loadTs('src/video/layout.ts')
const resolutions = [[1280, 720], [1920, 1080], [1080, 1080], [1080, 1920]]
const epsilon = 0.001

for (const [width, height] of resolutions) {
  test(`${width}×${height}: header, avatars and count stay in separate canvas regions`, () => {
    for (const [user, repository] of [['owner', 'repository'], ['W'.repeat(39), 'W'.repeat(100)]]) {
      for (const stars of [0, 1, 1234567, Number.MAX_SAFE_INTEGER]) {
        const layout = getVideoLayout(width, height, user, repository, stars)
        assert.ok(layout.headerTop >= 0)
        assert.ok(layout.padding + layout.contentWidth <= width)
        assert.ok(layout.headerTop + Math.max(layout.headerHeight, layout.ownerAvatarSize) < layout.avatarTop)
        assert.ok(layout.avatarTop + layout.avatarHeight <= layout.countTop)
        assert.ok(layout.countTop + layout.countHeight <= height)
        const countTextHeight = layout.countFontSize * 1.1 +
          (layout.countStacked ? layout.countLabelSize * 1.3 : 0)
        assert.ok(countTextHeight <= layout.countHeight)
        assert.ok(layout.ownerFontSize > 0 && layout.repositoryFontSize > 0 && layout.countFontSize > 0)
      }
    }
  })

  for (const count of [0, 1, 10, 50]) {
    test(`${width}×${height}, ${count} avatars: fit or scroll left without overlap or overshoot`, () => {
      const layout = getVideoLayout(width, height, 'owner', 'repository', 1234)
      const totalWidth = count * layout.avatarSize + Math.max(0, count - 1) * layout.avatarGap
      for (const progress of [0, 0.1, 0.5, 1, 1.5]) {
        for (let index = 0; index < count; index++) {
          const motion = getAvatarMotion(layout, count, index, progress)
          assert.ok(Number.isFinite(motion.left))
          assert.ok(motion.opacity >= 0 && motion.opacity <= 1)
          assert.ok(motion.translateY >= 0)
          assert.ok(motion.translateY + layout.avatarSize + layout.avatarGap + layout.starSize <= layout.avatarHeight + epsilon)
          if (index > 0) {
            const previous = getAvatarMotion(layout, count, index - 1, progress)
            assert.ok(motion.left >= previous.left + layout.avatarSize)
          }
          if (totalWidth <= layout.contentWidth) {
            assert.ok(motion.left >= 0)
            assert.ok(motion.left + layout.avatarSize <= layout.contentWidth + epsilon)
          } else {
            const previousFrame = getAvatarMotion(layout, count, index, Math.max(0, progress - 0.01))
            assert.ok(motion.left <= previousFrame.left + epsilon)
          }
        }
      }
      if (count > 0) {
        const last = getAvatarMotion(layout, count, count - 1, 1)
        assert.ok(last.left + layout.avatarSize <= layout.contentWidth + epsilon)
        const start = getAvatarMotion(layout, count, 0, 0)
        const middle = getAvatarMotion(layout, count, 0, 0.5)
        assert.notDeepEqual(start, middle, 'the avatars must animate even when the entire row fits')
        assert.deepEqual(last, getAvatarMotion(layout, count, count - 1, 1.5), 'the final second stays still')
      }
    })
  }
}

test('long titles and large counts shrink without truncating their text', () => {
  for (const [width, height] of resolutions) {
    const short = getVideoLayout(width, height, 'owner', 'repo', 100)
    const long = getVideoLayout(width, height, 'W'.repeat(39), 'W'.repeat(100), Number.MAX_SAFE_INTEGER)
    assert.ok(long.repositoryFontSize < short.repositoryFontSize)
    assert.ok(long.countFontSize < short.countFontSize)
  }
})

test('missing author avatar renders a stable initial instead of an empty Remotion image', () => {
  let frame = 0
  const config = { width: 1080, height: 1920, fps: 30 }
  const { GitHubStarsComposition } = loadTs('src/video/composition.tsx', {
    mocks: {
      remotion: {
        ...remotion,
        AbsoluteFill: ({ children, ...props }) => React.createElement('div', props, children),
        Img: (props) => {
          assert.ok(props.src, 'Remotion must never receive an empty image URL')
          return React.createElement('img', props)
        },
        useCurrentFrame: () => frame,
        useVideoConfig: () => config,
      },
    },
  })
  for (const durationInSeconds of [2, 8]) {
    for (const fps of [30, 60]) {
      config.fps = fps
      for (frame of [0, (durationInSeconds - 1) * fps, durationInSeconds * fps - 1]) {
        const html = renderToStaticMarkup(React.createElement(GitHubStarsComposition, {
          user: 'owner', userAvatarUrl: '', repository: 'long-repository-name', stars: 1234567,
          stargazers: [], videoSettings: { ...config, durationInSeconds, avatarLimit: 50 },
        }))
        assert.match(html, /owner 的头像/)
        assert.match(html, />O<\/div>/)
        assert.doesNotMatch(html, /<img/)
        assert.match(html, /long-repository-name/)
        if (frame >= (durationInSeconds - 1) * fps) assert.match(html, /1,234,567/)
      }
    }
  }
})
