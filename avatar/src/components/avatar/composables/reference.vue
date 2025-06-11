<template>
  <div class="container">
    <div ref="threeContainer" class="three-avatar"></div>
    <div class="controls">
      <button
        @click="resetToRest()"
        :disabled="loading || isTransitioning"
        :class="{ active: !currentAnimationType }"
      >
        Rest
      </button>
      <div v-for="anim in availableAnimations" :key="anim.name" class="button-group">
        <button
          @click="playAnimation(anim.name, false)"
          :disabled="loading || isTransitioning || (currentAnimationType === anim.name && !reverse)"
          :class="{ active: currentAnimationType === anim.name }"
        >
          {{ anim.label }}
        </button>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'



import { cameraPositions } from '@/config/cameraPositions.js'
import { availableAnimationsm,defaultAnimations } from '@/config/animations.js'

const threeContainer = ref(null)
const loading = ref(false)
const error = ref(null)
const currentAnimationType = ref(null)
const isTransitioning = ref(false)
const isReversed = ref(false)

let scene = null
let camera = null
let renderer = null
let controls = null
let model = null
let mixer = null
let animationFrameId = null
let clock = new THREE.Clock()
let currentAnimation = null

let currentTransition = null
let previousPosition = null
let previousTarget = null

const initThree = () => {
  try {
    const container = threeContainer.value
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x666666)

    camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.01,
      1000,
    )
    camera.position.set(0, 1.5, 4)

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
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
    controls.minPolarAngle = 0.1 * Math.PI
    controls.maxPolarAngle = 0.9 * Math.PI
    controls.update()

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(5, 5, 5)
    directionalLight.castShadow = true
    scene.add(directionalLight)

    directionalLight.shadow.mapSize.width = 1024
    directionalLight.shadow.mapSize.height = 1024
    directionalLight.shadow.camera.near = 0.1
    directionalLight.shadow.camera.far = 10

    loadModel()
    animate()

    window.addEventListener('resize', onWindowResize)
  } catch (err) {
    error.value = `Failed to initialize: ${err.message}`
    console.error(err)
  }
}

const loadModel = async () => {
  loading.value = true
  const gltfLoader = new GLTFLoader()
  const fbxLoader = new FBXLoader()

  try {
    const gltf = await gltfLoader.loadAsync(avatarUrl)
    model = gltf.scene

    mixer = new THREE.AnimationMixer(model)

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        if (child.material) {
          const oldMaterial = child.material
          child.material = new THREE.MeshStandardMaterial({
            map: oldMaterial.map,
            color: oldMaterial.color,
            skinning: true,
            roughness: 0.8,
            metalness: 0.0,
          })
        }
      }
    })

    model.position.set(0, 0, 0)
    model.scale.set(1, 1, 1)

    model.rotation.y = 0
    scene.add(model)

    for (const anim of availableAnimations) {
      try {
        const fbx = await fbxLoader.loadAsync(anim.url)
        if (fbx.animations.length > 0) {
          const clip = fbx.animations[0]
          clip.name = anim.name
          animations[anim.name] = clip
        }
      } catch (error) {
        console.error(`Failed to load animation ${anim.name}:`, error)
      }
    }

    resetToRest()

    loading.value = false
  } catch (err) {
    error.value = `Error loading model: ${err.message}`
    loading.value = false
    console.error(err)
  }
}

const moveCamera = (type) => {
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
  const startSpherical = new THREE.Spherical().setFromVector3(startPosition.clone().sub(center))
  const endSpherical = new THREE.Spherical().setFromVector3(endPosition.clone().sub(center))

  if (Math.abs(endSpherical.phi - startSpherical.phi) > Math.PI) {
    if (endSpherical.phi > startSpherical.phi) {
      startSpherical.phi += 2 * Math.PI
    } else {
      endSpherical.phi += 2 * Math.PI
    }
  }
  if (Math.abs(endSpherical.theta - startSpherical.theta) > Math.PI) {
    if (endSpherical.theta > startSpherical.theta) {
      startSpherical.theta += 2 * Math.PI
    } else {
      endSpherical.theta += 2 * Math.PI
    }
  }

  let progress = 0
  const duration = 1000
  const startTime = performance.now()

  const animateCamera = (currentTime) => {
    const elapsed = currentTime - startTime
    progress = Math.min(elapsed / duration, 1)

    const ease = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t)
    const t = ease(progress)

    const currentSpherical = new THREE.Spherical(
      startSpherical.radius * (1 - t) + endSpherical.radius * t,
      startSpherical.phi * (1 - t) + endSpherical.phi * t,
      startSpherical.theta * (1 - t) + endSpherical.theta * t,
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

const playAndWait = (action) => {
  return new Promise((resolve) => {
    const onFinished = () => {
      mixer.removeEventListener('finished', onFinished)
      resolve()
    }
    mixer.addEventListener('finished', onFinished)
    action.play()
  })
}

const playAnimation = async (type, reverse = false) => {
  if (!mixer || !model || !animations[type]) {
    return
  }

  try {
    isTransitioning.value = true
    console.log('Starting animation:', type, reverse ? '(reverse)' : '')

    if (currentAnimation && !reverse) {
      if (currentAnimationType.value === 'climbing') {
        console.log('Reverting climbing animation')
        const currentAction = currentAnimation
        currentAction.reset()
        currentAction.timeScale = -1
        currentAction.loop = THREE.LoopOnce
        currentAction.clampWhenFinished = true

        if (currentAction.time === 0) {
          currentAction.time = currentAction.getClip().duration
        }

        await playAndWait(currentAction)
        await resetToRest()
      } else if (currentAnimationType.value === 'frisbee') {
        console.log('Going to rest from frisbee')
        await resetToRest()
      } else if (currentAnimationType.value === 'gaming') {
        if (type !== 'typing') {
          console.log('Going to rest from gaming')
          await resetToRest()
        }
      } else if (currentAnimationType.value === 'typing') {
        if (type !== 'gaming') {
          console.log('Going to rest from typing')
          await resetToRest()
        }
      }
    }

    if (type === 'climbing' || type === 'frisbee') {
      console.log(`Moving camera to ${type} position`)
      moveCamera(type)

      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    if (reverse) {
      const action = mixer.clipAction(animations[type])
      action.reset()
      action.time = action.getClip().duration
      action.timeScale = -1
      action.loop = THREE.LoopOnce
      action.clampWhenFinished = true

      await playAndWait(action)

      await resetToRest()
    } else {
      const action = mixer.clipAction(animations[type])
      action.reset()
      action.time = 0
      action.timeScale = 1
      action.loop = THREE.LoopOnce
      action.clampWhenFinished = true
      currentAnimation = action
      currentAnimationType.value = type

      if (type !== 'climbing' && type !== 'frisbee') {
        moveCamera(type)
      }

      await playAndWait(action)
    }
  } catch (error) {
    error.value = error.message
  } finally {
    isTransitioning.value = false
  }
}

const resetToRest = async () => {
  if (!mixer) {
    console.log('No mixer available for reset')
    return
  }

  try {
    console.log('Starting reset to rest')
    isTransitioning.value = true

    if (currentAnimation) {
      console.log('Current animation exists, reversing before reset')
      const currentAction = currentAnimation

      mixer.stopAllAction()

      currentAction.reset()
      currentAction.timeScale = -1
      currentAction.loop = THREE.LoopOnce
      currentAction.clampWhenFinished = true

      currentAction.time =
        currentAction.getClip().duration * (currentAction.time / currentAction.getClip().duration)

      await new Promise((resolve) => {
        const onFinished = () => {
          console.log('Reset reverse animation finished')
          mixer.removeEventListener('finished', onFinished)
          resolve()
        }
        mixer.addEventListener('finished', onFinished)
        console.log('Starting reset reverse playback')
        currentAction.play()
      })
    }

    console.log('Moving camera to rest position')
    moveCamera('rest')

    console.log('Stopping all actions')
    mixer.stopAllAction()

    console.log('Resetting model pose')
    model.traverse((child) => {
      if (child.isSkinnedMesh && child.skeleton) {
        const currentPos = child.position.clone()

        child.skeleton.pose()

        child.position.copy(currentPos)
      }
    })

    currentAnimation = null
    currentAnimationType.value = null
  } catch (error) {
    console.error('Reset error:', error)
  } finally {
    console.log('Reset completed')
    isTransitioning.value = false
  }
}

const toggleReverse = () => {
  if (!currentAnimation || !mixer) return

  isReversed.value = !isReversed.value

  playAnimation(currentAnimationType.value)
}

const animate = () => {
  requestAnimationFrame(animate)

  if (mixer) {
    const delta = clock.getDelta()
    mixer.update(delta)
  }

  if (controls) {
    controls.update()
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera)
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

const cleanup = () => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
  }

  if (mixer) {
    mixer.stopAllAction()
  }

  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
    renderer.domElement = null
  }

  if (currentTransition) {
    cancelAnimationFrame(currentTransition)
  }

  window.removeEventListener('resize', onWindowResize)
}

onMounted(() => {
  initThree()
})

onBeforeUnmount(() => {
  cleanup()
})
</script>

<style scoped>
.container {
  position: relative;
  width: 100%;
  height: 100vh;
}

.three-avatar {
  width: 800px;
  height: 800px;
  background: #000;
}

.controls {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  display: flex;
  gap: 10px;
}

.button-group {
  display: flex;
  gap: 4px;
}

button {
  background: #4caf50;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

button.active {
  background: #2e7d32;
}

button:disabled {
  background: #cccccc;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  background: #45a049;
}

.reverse-button {
  padding: 10px;
  min-width: 40px;
  background: #666;
}

.reverse-button:hover:not(:disabled) {
  background: #555;
}

.error-message,
.loading-message {
  position: absolute;
  top: 20px;
  left: 20px;
  padding: 10px 20px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.8);
}

.error-message {
  color: #ff4444;
}

.loading-message {
  color: #ffffff;
}
</style>
