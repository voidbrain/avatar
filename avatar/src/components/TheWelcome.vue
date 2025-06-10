<template>
  <div class="container">
    <div ref="threeContainer" class="three-avatar"></div>
    <div class="controls">
      <button
        @click="resetToRest()"
        :disabled="loading"
        :class="{ active: !currentAnimationType }"
      >
        Rest
      </button>
      <button
        v-for="anim in availableAnimations"
        :key="anim.name"
        @click="playAnimation(anim.name)"
        :disabled="loading"
        :class="{ active: currentAnimationType === anim.name }"
      >
        {{ anim.label }}
      </button>
      <button
        v-if="currentAnimation"
        @click="toggleReverse()"
        :disabled="loading"
        :class="{ active: isReversed }"
      >
        {{ isReversed ? '⏩ Forward' : '⏪ Reverse' }}
      </button>
    </div>
    <div v-if="error" class="error-message">{{ error }}</div>
    <div v-if="loading" class="loading-message">Loading model...</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

// Import avatar file
import avatarUrl from '@/assets/untitled.glb'
// import avatarUrl from '@/assets/avatar.obj'

import climbingUrl from '@/assets/Climbing Up Wall.fbx'
import frisbeeUrl from '@/assets/Frisbee Throw.fbx'
import gamingUrl from '@/assets/Gaming.fbx'
import typingUrl from '@/assets/Typing.fbx'

const threeContainer = ref(null)
const loading = ref(false)
const error = ref(null)
const currentAnimationType = ref(null)
const isTransitioning = ref(false) // New state for transition
const isReversed = ref(false) // New state for reverse

let scene = null
let camera = null
let renderer = null
let controls = null
let model = null
let mixer = null
let animationFrameId = null
let clock = new THREE.Clock()
let currentAnimation = null

// Add these variables after your other state variables
let currentTransition = null
let previousPosition = null
let previousTarget = null

const availableAnimations = [
  { name: 'climbing', label: 'Climbing', url: climbingUrl },
  { name: 'frisbee', label: 'Frisbee', url: frisbeeUrl },
  { name: 'gaming', label: 'Gaming', url: gamingUrl },
  { name: 'typing', label: 'Typing', url: typingUrl }
]

// Update the animations object to include rest
let animations = {
  rest: null,
  climbing: null,
  frisbee: null,
  gaming: null,
  typing: null
}

// Add camera positions for each animation
const cameraPositions = {
  rest: {
    position: [0, 1, 3],     // [x, y, z] - Front view, slightly elevated
    target: [0, 1, 0]        // Looking at center of model
  },
  climbing: {
    position: [5, 2, 2],     // [x, y, z] - Diagonal view from top-right
    target: [0, 1, 0]        // Looking at center
  },
  frisbee: {
    position: [-5, 1, 2],    // [x, y, z] - Left side view
    target: [0, 1, 0]        // Looking at center
  },
  gaming: {
    position: [0, 1.5, 3],   // [x, y, z] - Front view, slightly higher
    target: [0, 1, 0]        // Looking at center
  },
  typing: {
    position: [0, 3, -4],    // [x, y, z] - Behind and above (increased y to 3)
    target: [0, 0.8, 0]      // Looking slightly down at the typing hands
  }
}

const initThree = () => {
  try {
    const container = threeContainer.value
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x666666)

    // Initialize camera first
    camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.01,  // Reduced near plane for closer viewing
      1000
    )
    camera.position.set(0, 1, 3)

    // Initialize renderer
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

    // Initialize controls after camera and renderer
    controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 1, 0)
    controls.enableDamping = true
    controls.minDistance = 2    // Increased minimum distance
    controls.maxDistance = 10   // Keep maximum distance
    controls.minPolarAngle = 0.1 * Math.PI  // Prevent camera going under model
    controls.maxPolarAngle = 0.9 * Math.PI  // Prevent camera going over model
    controls.update()

    // Lighting setup
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

// Update the loadModel function for better animation handling
const loadModel = async () => {
  loading.value = true
  const gltfLoader = new GLTFLoader()
  const fbxLoader = new FBXLoader()

  try {
    // Load main model
    const gltf = await gltfLoader.loadAsync(avatarUrl)
    model = gltf.scene

    // Setup animation mixer first
    mixer = new THREE.AnimationMixer(model)

    // Store the bind pose
    const bindPose = new THREE.AnimationClip('bindPose', 0, [])
    animations.rest = bindPose

    // Update materials and setup skinning
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        if (child.material) {
          const oldMaterial = child.material
          child.material = new THREE.MeshStandardMaterial({
            map: oldMaterial.map,
            color: oldMaterial.color,
            skinning: true, // Enable skinning for animations
            roughness: 0.8,
            metalness: 0.0
          })
        }
      }
    })

    model.position.set(0, 0, 0)
    model.scale.set(1, 1, 1)
    scene.add(model)

    // Load all FBX animations
    for (const anim of availableAnimations) {
      try {
        const fbx = await fbxLoader.loadAsync(anim.url)
        if (fbx.animations.length > 0) {
          const clip = fbx.animations[0]
          clip.name = anim.name // Ensure animation name matches
          animations[anim.name] = clip
        }
      } catch (error) {
        console.error(`Failed to load animation ${anim.name}:`, error)
      }
    }

    // Start with bind pose
    resetToRest()

    loading.value = false
  } catch (err) {
    error.value = `Error loading model: ${err.message}`
    loading.value = false
    console.error(err)
  }
}

// Add a camera transition function
const moveCamera = (type) => {
  if (!controls || !camera) return

  const targetPosition = cameraPositions[type]?.position || cameraPositions.rest.position
  const targetLookAt = cameraPositions[type]?.target || cameraPositions.rest.target

  // Cancel any ongoing transition
  if (currentTransition) {
    cancelAnimationFrame(currentTransition)
    currentTransition = null
  }

  const startPosition = camera.position.clone()
  const startTarget = controls.target.clone()
  const endPosition = new THREE.Vector3(...targetPosition)
  const endTarget = new THREE.Vector3(...targetLookAt)

  // Calculate angles for spherical interpolation
  const center = new THREE.Vector3(0, 1, 0)
  const startSpherical = new THREE.Spherical().setFromVector3(
    startPosition.clone().sub(center)
  )
  const endSpherical = new THREE.Spherical().setFromVector3(
    endPosition.clone().sub(center)
  )

  // Ensure we take the shortest path around the model
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
  const duration = 1000 // 1 second transition
  const startTime = performance.now()

  const animateCamera = (currentTime) => {
    const elapsed = currentTime - startTime
    progress = Math.min(elapsed / duration, 1)

    // Smooth easing
    const ease = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    const t = ease(progress)

    // Interpolate spherical coordinates
    const currentSpherical = new THREE.Spherical(
      startSpherical.radius * (1 - t) + endSpherical.radius * t,
      startSpherical.phi * (1 - t) + endSpherical.phi * t,
      startSpherical.theta * (1 - t) + endSpherical.theta * t
    )

    // Convert back to Cartesian coordinates
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

// Update playAnimation function to handle reverse initial state
const playAnimation = (type) => {
  if (!mixer || !model || !animations[type]) {
    console.error(`Cannot play animation: ${type}`)
    return
  }

  moveCamera(type)
  mixer.stopAllAction()

  const action = mixer.clipAction(animations[type])
  action.reset()
  action.setEffectiveWeight(1)

  // Configure looping behavior
  action.clampWhenFinished = true  // Stop at end of animation
  action.loop = isReversed.value ? THREE.LoopOnce : THREE.LoopRepeat

  // Set up animation direction and starting point
  if (isReversed.value) {
    action.timeScale = -1
    action.time = action.getClip().duration  // Start from end

    // Add finished callback for reverse
    action.getMixer().addEventListener('finished', () => {
      action.stop()  // Stop when reaching start
      resetToRest()  // Return to rest pose
    })
  } else {
    action.timeScale = 1
    action.time = 0
  }

  action.fadeIn(0.5)
  action.play()

  currentAnimation = action
  currentAnimationType.value = type
}

// Update toggleReverse to handle animation reset
const toggleReverse = () => {
  if (!currentAnimation || !mixer) return

  isReversed.value = !isReversed.value

  // Restart animation in new direction
  playAnimation(currentAnimationType.value)
}

// Update the resetToRest function
const resetToRest = async () => {
  if (!mixer) return

  try {
    isTransitioning.value = true

    if (currentAnimation) {
      const currentAction = currentAnimation
      currentAction.timeScale = -1
      currentAction.loop = THREE.LoopOnce
      currentAction.clampWhenFinished = true

      await new Promise(resolve => {
        const onFinished = () => {
          currentAction.getMixer().removeEventListener('finished', onFinished)
          resolve()
        }
        currentAction.getMixer().addEventListener('finished', onFinished)
      })

      moveCamera('rest')
      mixer.stopAllAction()

      model.traverse((child) => {
        if (child.isSkinnedMesh && child.skeleton) {
          child.skeleton.pose()
        }
      })

      currentAnimation = null
      currentAnimationType.value = null
    }
  } finally {
    isTransitioning.value = false
  }
}

// Update the animate function
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

// Update cleanup to include transition cleanup
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

button {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

button.active {
  background: #2E7D32;
}

button:disabled {
  background: #cccccc;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  background: #45a049;
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
