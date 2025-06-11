export type AnimationType = 'rest' | 'climbing' | 'frisbee' | 'gaming' | 'typing'

export interface CameraPosition {
  position: [number, number, number]
  target: [number, number, number]
}

export type CameraPositions = Record<AnimationType, CameraPosition>
