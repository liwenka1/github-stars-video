export type VideoLayout = ReturnType<typeof getVideoLayout>

// Conservative Arial widths keep the font size deterministic in preview and export.
function textWidth(text: string): number {
  return Array.from(text).reduce((width, character) => {
    if (/\s/.test(character)) return width + 0.35
    if (/[MW@%]/.test(character)) return width + 1
    return width + (character.charCodeAt(0) > 255 ? 1 : 0.72)
  }, 0)
}

function fitText(text: string, availableWidth: number, preferredSize: number, lines = 1) {
  // Leave room at line ends when a word wraps onto the next line.
  const capacity = availableWidth * (lines === 1 ? 1 : lines - 0.2)
  return Math.min(preferredSize, capacity / Math.max(1, textWidth(text)))
}

export function getVideoLayout(width: number, height: number, user: string, repository: string, stars: number) {
  const shortSide = Math.min(width, height)
  const landscape = width / height >= 1.4
  const portrait = height / width >= 1.4
  const padding = shortSide * 0.09
  const contentWidth = width - padding * 2
  const ownerAvatarSize = shortSide * 0.1
  const headerGap = shortSide * 0.025
  const titleWidth = contentWidth - ownerAvatarSize - headerGap
  const titleLines = landscape ? 2 : 3
  const ownerFontSize = fitText(`${user} /`, titleWidth, shortSide * 0.034)
  const repositoryFontSize = fitText(repository, titleWidth, shortSide * 0.075, titleLines)
  const repositoryLines = Math.max(1, Math.ceil(textWidth(repository) * repositoryFontSize / titleWidth))
  const headerHeight = ownerFontSize * 1.3 + headerGap * 0.5 + repositoryFontSize * 1.15 * repositoryLines
  const avatarSize = shortSide * (landscape ? 0.177 : portrait ? 0.17 : 0.15)
  const avatarGap = avatarSize * 0.13
  const starSize = avatarSize * 0.25
  const avatarTop = height * (portrait ? 0.45 : landscape ? 0.43 : 0.46)
  const avatarHeight = avatarSize + avatarGap + starSize + avatarSize * 0.12
  const headerTop = landscape
    ? height * 0.085
    : avatarTop - Math.max(headerHeight, ownerAvatarSize) - height * (portrait ? 0.12 : 0.1)
  const countTop = height * (portrait ? 0.66 : landscape ? 0.72 : 0.69)
  const countHeight = height * (portrait ? 0.25 : landscape ? 0.2 : 0.26)
  const countStacked = !landscape
  const finalCount = stars.toLocaleString('en-US', { useGrouping: true })
  const countFontSize = fitText(
    countStacked ? finalCount : `${finalCount} stars`,
    contentWidth,
    shortSide * (countStacked ? 0.18 : 0.16),
  )

  return {
    width, height, padding, contentWidth, headerTop, headerHeight, ownerAvatarSize,
    headerGap, titleWidth, titleLines, ownerFontSize, repositoryFontSize,
    avatarTop, avatarHeight, avatarSize, avatarGap, starSize,
    countTop, countHeight, countStacked, countFontSize, countLabelSize: shortSide * 0.042,
  }
}

export function getAvatarMotion(layout: VideoLayout, count: number, index: number, progress: number) {
  const totalWidth = count * layout.avatarSize + Math.max(0, count - 1) * layout.avatarGap
  const overflow = Math.max(0, totalWidth - layout.contentWidth)
  const clampedProgress = Math.max(0, Math.min(1, progress))
  const scrollProgress = clampedProgress * clampedProgress * (3 - 2 * clampedProgress)
  const entranceDelay = count > 1 ? (index / (count - 1)) * 0.2 : 0
  const entranceProgress = Math.max(0, Math.min(1, (clampedProgress - entranceDelay) / 0.2))
  const entrance = 1 - (1 - entranceProgress) ** 3

  return {
    left: Math.max(0, (layout.contentWidth - totalWidth) / 2) +
      index * (layout.avatarSize + layout.avatarGap) - overflow * scrollProgress,
    opacity: overflow > 0 ? 1 : entrance,
    translateY: overflow > 0 ? 0 : layout.avatarSize * 0.12 * (1 - entrance),
  }
}
