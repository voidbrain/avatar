import { ref, type Ref, computed } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { availableAnimations } from '../constants/animations'
import { models } from '../constants/models'

interface ThreeContext {
  scene: THREE.Scene
  controls: OrbitControls
  renderer: THREE.WebGLRenderer
  camera: THREE.PerspectiveCamera
  animate: () => void 
}

type AnimationType = 'rest' | 'climbing' | 'frisbee' | 'gaming' | 'typing'
type AnimationMap = Record<AnimationType, THREE.AnimationClip | null>

export function useAnimations(scene: THREE.Scene | null) {
  const animationLoading = ref(false)
  const error = ref<string | null>(null)
  const currentAnimationType = ref<AnimationType | null>(null)
  const isTransitioning = ref(false)
  let clock = new THREE.Clock()

  let threeContext: ThreeContext | null = null
  let model: THREE.Group | null = null
  let mixer: THREE.AnimationMixer | null = null
  let currentAnimation: THREE.AnimationAction | null = null
  let animations: AnimationMap = {
    rest: null,
    climbing: null,
    frisbee: null,
    gaming: null,
    typing: null
  }

  const isReady = computed(() => {
    return !!mixer && !!model && Object.values(animations).some(anim => anim !== null)
  })

  const initThreeContext = (context: ThreeContext) => {
    threeContext = context
  }

  const animate = () => {
    requestAnimationFrame(animate)

    if (mixer) {
      const delta = clock.getDelta()
      mixer.update(delta)
    }

    if (threeContext?.controls) {
      threeContext.controls.update()
    }

    if (threeContext?.renderer && threeContext?.scene && threeContext?.camera) {
      threeContext.renderer.render(threeContext.scene, threeContext.camera)
    }
  }

  const loadModel = async () => {
    console.log('AnimationLanimationLoading model...')
    scene = new THREE.Scene()
    if (!scene) {
      throw new Error('Scene is not initialized')
    }

    animationLoading.value = true
    error.value = null



    try {
      const gltfLoader = new GLTFLoader()
      const fbxLoader = new FBXLoader()

      const gltf = await gltfLoader.loadAsync(models.avatar)
      model = gltf.scene
      mixer = new THREE.AnimationMixer(model)

      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true
          child.receiveShadow = true
          if (child.material) {
            const oldMaterial = child.material
            child.material = new THREE.MeshPhongMaterial({
              map: oldMaterial.map,
              color: oldMaterial.color,
              specular: 0x666666,
              shininess: 20,
              ...({ skinning: true } as any) // Type assertion for skinning property
            })
          }
        }
      })

      model.position.set(0, 0, 0)
      model.scale.set(1, 1, 1)
      model.rotation.y = 0
      scene.add(model)

      await Promise.all(availableAnimations.map(async (anim) => {
        try {
          const fbx = await fbxLoader.loadAsync(anim.url)
          if (fbx.animations.length > 0) {
            const clip = fbx.animations[0]
            clip.name = anim.name
            animations[anim.name as AnimationType] = clip
          }
        } catch (err) {
          error.value = `Failed to load animation ${anim.name}: ${(err as Error).message}`
        }
      }))

      if (!isReady.value) {
        throw new Error('Failed to initialize all required components')
      }
    } catch (err) {
      error.value = `Error animationLoading model: ${(err as Error).message}`
      throw err
    } finally {
      animationLoading.value = false
    }
  }

  const playAndWait = (action: THREE.AnimationAction): Promise<void> => {
    return new Promise((resolve) => {
      const onFinished = () => {
        mixer?.removeEventListener('finished', onFinished)
        resolve()
      }
      mixer?.addEventListener('finished', onFinished)
      action.play()
    })
  }

  const resetToRest = async (): Promise<void> => {
    if (!mixer || !model) throw new Error('Animation system not initialized')

    try {
      isTransitioning.value = true

      mixer.stopAllAction()
      model.traverse((child) => {
        if (child instanceof THREE.SkinnedMesh && child.skeleton) {
          child.skeleton.pose()
        }
      })

      currentAnimation = null
      currentAnimationType.value = null
    } finally {
      isTransitioning.value = false
    }
  }

  return {
    animationLoading,
    error,
    currentAnimationType,
    isTransitioning,
    model,
    mixer,
    animations,
    initThreeContext,
    loadModel,
    playAndWait,
    resetToRest,
    isReady,
    animate  // Add animate to the return object
  }
}
