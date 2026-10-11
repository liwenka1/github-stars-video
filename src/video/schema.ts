/**
 * 视频的输入数据。字段名与原作者版本保持一致，方便对照。
 */
export type Props = {
  user: string
  /** 作者头像，data URL（内联，渲染时不联网） */
  userAvatarUrl: string
  repository: string
  stars: number
  /** 最近点赞者的头像，data URL 数组 */
  stargazers: string[]
}

export const emptyProps: Props = {
  user: '',
  userAvatarUrl: '',
  repository: '',
  stars: 0,
  stargazers: [],
}
