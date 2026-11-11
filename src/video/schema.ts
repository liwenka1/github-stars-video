export type VideoSettings = {
  width: number
  height: number
  durationInSeconds: number
  fps: number
  avatarLimit: number
}

export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  width: 1280,
  height: 720,
  durationInSeconds: 4,
  fps: 60,
  avatarLimit: 50,
}

/** 视频的输入数据。字段名与原作者版本保持一致，方便对照。 */
export type Props = {
  user: string
  /** 作者头像，data URL（内联，渲染时不联网） */
  userAvatarUrl: string
  repository: string
  stars: number
  /** 最近点赞者的头像，data URL 数组 */
  stargazers: string[]
  /** 头像内联结果，读取失败时用于给出可操作的反馈 */
  avatarStats?: {
    requested: number
    loaded: number
    failed: number
    ownerLoaded: boolean
  }
  /** 当前视频的输出设定 */
  videoSettings: VideoSettings
}

export const emptyProps: Props = {
  user: '',
  userAvatarUrl: '',
  repository: '',
  stars: 0,
  stargazers: [],
  videoSettings: DEFAULT_VIDEO_SETTINGS,
}
