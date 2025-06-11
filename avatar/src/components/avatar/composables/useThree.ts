import { ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

interface ThreeContext {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
  animate: () => void  // Add animate function to interface
}

export function useThree() {
  const threeContainer = ref<HTMLDivElement | null>(null)
  const threeLoading = ref(false)
  const error = ref<string | null>(null)

  let scene: THREE.Scene | null = null
  let camera: THREE.PerspectiveCamera | null = null
  let renderer: THREE.WebGLRenderer | null = null
  let controls: OrbitControls | null = null
  let animationFrameId: number | null = null

  console.log('🔧 useThree composable initialized')

  // Define animate as a function declaration instead of arrow function
  function animate(): void {
    if (!scene || !camera || !renderer) {
      console.warn('Cannot animate: Three.js components not initialized')
      return
    }

    console.log('Requesting animation frame')
    animationFrameId = requestAnimationFrame(animate)

    if (controls) {
      controls.update()
    }

    renderer.render(scene, camera)
  }

  const initThree = async (): Promise<ThreeContext> => {
    try {
      threeLoading.value = true
      console.log('🎬 Starting Three.js initialization')

      const container = threeContainer.value
      if (!container) {
        throw new Error('Container element not found')
      }
      console.log('✓ Container found:', container)

      // Initialize scene
      scene = new THREE.Scene()
      scene.background = new THREE.Color(0x666666)
      console.log('✓ Scene created')

      // Initialize camera
      camera = new THREE.PerspectiveCamera(
        45,
        container.clientWidth / container.clientHeight,
        0.01,
        1000
      )
      camera.position.set(0, 1.5, 4)
      console.log('✓ Camera initialized')

      // Initialize renderer
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
      })
      renderer.setSize(container.clientWidth, container.clientHeight)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      container.appendChild(renderer.domElement)
      console.log('✓ Renderer configured')

      // Initialize controls
      controls = new OrbitControls(camera, renderer.domElement)
      controls.target.set(0, 1, 0)
      controls.update()
      console.log('✓ Controls setup complete')

      if (!scene || !camera || !renderer || !controls) {
        throw new Error('Component initialization failed')
      }

      // Add window resize listener after components are initialized
      window.addEventListener('resize', onWindowResize)

      const context: ThreeContext = {
        scene,
        camera,
        renderer,
        controls,
        animate // Include animate function in context
      }

      console.log('✅ Three.js context created successfully')
      return context
    } catch (err) {
      console.error('❌ Three.js initialization failed:', err)
      throw err
    } finally {
      threeLoading.value = false
    }
  }

  const onWindowResize = () => {
    if (camera && renderer && threeContainer.value) {
      const container = threeContainer.value
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    }
  }

  // Update cleanup to handle animation frame
  const cleanup = () => {
    console.log('Cleaning up Three.js...')
    if (animationFrameId !== null) {
      console.log('Canceling animation frame:', animationFrameId)
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    window.removeEventListener('resize', onWindowResize)
    if (renderer) {
      renderer.dispose()
      renderer.forceContextLoss()
    }
  }

  return {
    threeContainer,
    threeLoading,
    error,
    scene,
    camera,
    renderer,
    controls,
    initThree,
    animate, // Export animate function
    cleanup
  }
}
