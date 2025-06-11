import { ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export function useThree() {
  const threeContainer = ref(null)
  const loading = ref(false)
  const error = ref(null)

  let scene = null
  let camera = null
  let renderer = null
  let controls = null
  let animationFrameId = null

  const initThree = () => {
    try {
      const container = threeContainer.value
      scene = new THREE.Scene()
      scene.background = new THREE.Color(0x666666)

      camera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / container.clientHeight,
        0.01,
        1000
      )
      camera.position.set(0, 1.5, 4)

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
      })
      renderer.setSize(container.clientWidth, container.clientHeight)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      container.appendChild(renderer.domElement)

      controls = new OrbitControls(camera, renderer.domElement)
      controls.target.set(0, 1, 0)
      controls.enableDamping = true
      controls.minDistance = 2
      controls.maxDistance = 10
      controls.update()

      const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
      directionalLight.position.set(5, 5, 5)
      directionalLight.castShadow = true
      scene.add(directionalLight)

      directionalLight.shadow.mapSize.width = 1024
      directionalLight.shadow.mapSize.height = 1024
      directionalLight.shadow.camera.near = 0.1
      directionalLight.shadow.camera.far = 10

      window.addEventListener('resize', onWindowResize)
    } catch (err) {
      error.value = `Failed to initialize: ${err.message}`
    }
  }

  const onWindowResize = () => {
    const container = threeContainer.value
    camera.aspect = container.clientWidth / container.clientHeight
    camera.updateProjectionMatrix()
    renderer.setSize(container.clientWidth, container.clientHeight)
  }

  const cleanup = () => {
    window.removeEventListener('resize', onWindowResize)
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
    }
    if (renderer) {
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement = null
    }
  }

  return {
    threeContainer,
    loading,
    error,
    scene,
    camera,
    renderer,
    controls,
    initThree,
    cleanup
  }
}
