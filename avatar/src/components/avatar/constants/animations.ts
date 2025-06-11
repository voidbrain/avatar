import { models } from './models'

export const availableAnimations = [
  { name: 'climbing', label: 'Climbing', url: models.climbing },
  { name: 'frisbee', label: 'Frisbee', url: models.frisbee },
  { name: 'gaming', label: 'Gaming', url: models.gaming },
  { name: 'typing', label: 'Typing', url: models.typing }
] as const

export const defaultAnimations = {
  rest: null,
  climbing: null,
  frisbee: null,
  gaming: null,
  typing: null
} as const
