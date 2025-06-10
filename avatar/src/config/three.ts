export const cameraConfig = {
  fov: 45,
  near: 0.1,
  far: 1000,
  position: [0, 1, 3],
  target: [0, 1, 0]
}

export const lightsConfig = {
  ambient: {
    color: 0xffffff,
    intensity: 0.5
  },
  directional: {
    color: 0xffffff,
    intensity: 1,
    position: [5, 5, 5],
    shadow: {
      mapSize: { width: 1024, height: 1024 },
      camera: { near: 0.1, far: 10 }
    }
  }
}

export const rendererConfig = {
  antialias: true,
  alpha: true,
  shadow: true,
  pixelRatio: 2
}
