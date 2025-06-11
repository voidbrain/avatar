import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { cameraPositions } from '../constants/cameraPositions'

export function useCamera(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls
) {
  let currentTransition: number | null = null

  const normalizeAngles = (start: THREE.Spherical, end: THREE.Spherical): void => {
    if (Math.abs(end.phi - start.phi) > Math.PI) {
      if (end.phi > start.phi) {
        start.phi += 2 * Math.PI
      } else {
        end.phi += 2 * Math.PI
      }
    }
    if (Math.abs(end.theta - start.theta) > Math.PI) {
      if (end.theta > start.theta) {
        start.theta += 2 * Math.PI
      } else {
        end.theta += 2 * Math.PI
      }
    }
  }

  const moveCamera = (type: keyof typeof cameraPositions): void => {
    if (!controls || !camera) return

    const targetPosition = cameraPositions[type]?.position || cameraPositions.rest.position
    const targetLookAt = cameraPositions[type]?.target || cameraPositions.rest.target

    if (currentTransition) {
      cancelAnimationFrame(currentTransition)
      currentTransition = null
    }

    const startPosition = camera.position.clone()
    const startTarget = controls.target.clone()
    const endPosition = new THREE.Vector3(...targetPosition)
    const endTarget = new THREE.Vector3(...targetLookAt)

    const center = new THREE.Vector3(0, 1, 0)
    const startSpherical = new THREE.Spherical().setFromVector3(
      startPosition.clone().sub(center)
    )
    const endSpherical = new THREE.Spherical().setFromVector3(
      endPosition.clone().sub(center)
    )

    normalizeAngles(startSpherical, endSpherical)

    const duration = 1000
    const startTime = performance.now()
    let progress = 0

    const animateCamera = (currentTime: number): void => {
      const elapsed = currentTime - startTime
      progress = Math.min(elapsed / duration, 1)

      const ease = (t: number): number =>
        t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t

      const t = ease(progress)

      const currentSpherical = new THREE.Spherical(
        THREE.MathUtils.lerp(startSpherical.radius, endSpherical.radius, t),
        THREE.MathUtils.lerp(startSpherical.phi, endSpherical.phi, t),
        THREE.MathUtils.lerp(startSpherical.theta, endSpherical.theta, t)
      )

      const currentPosition = new THREE.Vector3().setFromSpherical(currentSpherical)
      camera.position.copy(currentPosition.add(center))
      controls.target.lerpVectors(startTarget, endTarget, t)
      controls.update()

      if (progress < 1) {
        currentTransition = requestAnimationFrame(animateCamera)
      } else {
        currentTransition = null
      }
    }

    currentTransition = requestAnimationFrame(animateCamera)
  }

  return {
    moveCamera
  }
}
