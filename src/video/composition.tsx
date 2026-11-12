import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { getAvatarMotion, getVideoLayout, type VideoLayout } from './layout'
import { DEFAULT_VIDEO_SETTINGS, type Props } from './schema'

export const animationDurationInSeconds = DEFAULT_VIDEO_SETTINGS.durationInSeconds - 1
export const width = DEFAULT_VIDEO_SETTINGS.width
export const height = DEFAULT_VIDEO_SETTINGS.height
export const fps = DEFAULT_VIDEO_SETTINGS.fps

export function GitHubStarsComposition({
  user,
  userAvatarUrl,
  repository,
  stargazers,
  stars,
  videoSettings,
}: Props) {
  const { width, height } = useVideoConfig()
  const animationSeconds = Math.max(1, videoSettings.durationInSeconds - 1)
  const visibleStargazers = stargazers.slice(-videoSettings.avatarLimit)
  const layout = getVideoLayout(width, height, user, repository, stars)

  return (
    <AbsoluteFill style={{ backgroundColor: '#fff', color: '#111', fontFamily: 'Arial, sans-serif' }}>
      <RepositoryInformation user={user} userAvatarUrl={userAvatarUrl} repository={repository} layout={layout} />
      <UserAvatars stargazers={visibleStargazers} durationInSeconds={animationSeconds} layout={layout} />
      <StarCount stars={stars} durationInSeconds={animationSeconds} layout={layout} />
    </AbsoluteFill>
  )
}

function StarCount({
  stars,
  durationInSeconds,
  layout,
}: {
  stars: number
  durationInSeconds: number
  layout: VideoLayout
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const starsToDisplay = Math.round(
    interpolate(frame, [0, durationInSeconds * fps], [0, stars], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.bezier(0.5, 1, 0.5, 1),
    }),
  )

  return (
    <div
      style={{
        position: 'absolute',
        top: layout.countTop,
        left: layout.padding,
        width: layout.contentWidth,
        height: layout.countHeight,
        display: 'flex',
        flexDirection: layout.countStacked ? 'column' : 'row',
        alignItems: layout.countStacked ? 'center' : 'baseline',
        justifyContent: layout.countStacked ? 'flex-start' : 'flex-end',
        gap: layout.countStacked ? layout.countLabelSize * 0.2 : layout.countFontSize * 0.2,
        lineHeight: 1.1,
        whiteSpace: 'nowrap',
      }}
    >
      <strong style={{ fontSize: layout.countFontSize, fontVariantNumeric: 'tabular-nums' }}>
        {starsToDisplay.toLocaleString('en-US', { useGrouping: true })}
      </strong>
      <span style={{ fontSize: layout.countStacked ? layout.countLabelSize : layout.countFontSize }}>stars</span>
    </div>
  )
}

function UserAvatars({
  stargazers,
  durationInSeconds,
  layout,
}: {
  stargazers: Props['stargazers']
  durationInSeconds: number
  layout: VideoLayout
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const progress = frame / (durationInSeconds * fps)

  return (
    <div
      style={{
        position: 'absolute',
        top: layout.avatarTop,
        left: layout.padding,
        width: layout.contentWidth,
        height: layout.avatarHeight,
        overflow: 'hidden',
      }}
    >
      {stargazers.map((avatarUrl, index) => {
        const motion = getAvatarMotion(layout, stargazers.length, index, progress)
        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: 0,
              left: motion.left,
              width: layout.avatarSize,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: layout.avatarGap,
              opacity: motion.opacity,
              transform: `translateY(${motion.translateY}px)`,
            }}
          >
            <Img
              src={avatarUrl}
              alt=""
              width={layout.avatarSize}
              height={layout.avatarSize}
              style={{ borderRadius: '50%' }}
            />
            <Star starSize={layout.starSize} />
          </div>
        )
      })}
    </div>
  )
}

function RepositoryInformation({
  user,
  userAvatarUrl,
  repository,
  layout,
}: {
  user: string
  userAvatarUrl: string
  repository: string
  layout: VideoLayout
}) {
  const avatarStyle = {
    width: layout.ownerAvatarSize,
    height: layout.ownerAvatarSize,
    flexShrink: 0,
    borderRadius: '50%',
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: layout.headerTop,
        left: layout.padding,
        width: layout.contentWidth,
        display: 'flex',
        alignItems: 'flex-start',
        gap: layout.headerGap,
      }}
    >
      {userAvatarUrl ? (
        <Img src={userAvatarUrl} alt={user} style={avatarStyle} />
      ) : (
        <div
          aria-label={`${user} 的头像`}
          style={{
            ...avatarStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#eeeeef',
            color: '#737378',
            fontSize: layout.ownerAvatarSize * 0.45,
            fontWeight: 700,
          }}
        >
          {user.slice(0, 1).toUpperCase() || '★'}
        </div>
      )}
      <div style={{ width: layout.titleWidth, minWidth: 0 }}>
        <div style={{ fontSize: layout.ownerFontSize, lineHeight: 1.3, color: '#737378', marginBottom: layout.headerGap * 0.5 }}>
          {user} /
        </div>
        <strong style={{ display: 'block', fontSize: layout.repositoryFontSize, lineHeight: 1.15, overflowWrap: 'anywhere' }}>
          {repository}
        </strong>
      </div>
    </div>
  )
}

function Star({ starSize }: { starSize: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={starSize}
      height={starSize}
      viewBox="0 0 24 24"
      fill="#fde047"
      stroke="#eab308"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}
