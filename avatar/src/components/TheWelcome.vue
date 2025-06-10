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
        :disabled="loading || currentAnimationType === anim.name"
        :class="{ active: currentAnimationType === anim.name }"
      >
        {{ anim.label }}
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

// Import GLB file
import avatarUrl from '@/assets/avatar.glb'

import climbingUrl from '@/assets/Climbing Up Wall.fbx'
import frisbeeUrl from '@/assets/Frisbee Throw.fbx'
import gamingUrl from '@/assets/Gaming.fbx'
import typingUrl from '@/assets/Typing.fbx'

const threeContainer = ref(null)
const loading = ref(false)
const error = ref(null)
const currentAnimationType = ref(null)

let scene = null
let camera = null
let renderer = null
let controls = null
let model = null
let mixer = null
let animationFrameId = null
let clock = new THREE.Clock()
let currentAnimation = null

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

const initThree = () => {
  try {
    const container = threeContainer.value
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x666666)

    // Initialize camera first
    camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
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

const loadModel = async () => {
  loading.value = true
  const gltfLoader = new GLTFLoader()

  try {
    const gltf = await gltfLoader.loadAsync(avatarUrl)
    model = gltf.scene
    // model = await objLoader.loadAsync(avatarUrl)

    // Update materials
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
            metalness: 0.0
          })
        }
      }
    })

    model.position.set(0, 0, 0)
    model.scale.set(1, 1, 1)
    scene.add(model)

    // Setup animation mixer if the model has animations
    if (gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(model)
      const clip = gltf.animations[0]
      const action = mixer.clipAction(clip)
      action.play()
    }

    loading.value = false
  } catch (err) {
    error.value = `Error loading model: ${err.message}`
    loading.value = false
    console.error(err)
  }
}

const resetToRest = () => {
  if (!mixer) return

  // Stop all current animations
  mixer.stopAllAction()

  // Reset animation type
  currentAnimationType.value = null
  currentAnimation = null

  // Optional: fade out current animation smoothly
  if (currentAnimation) {
    currentAnimation.fadeOut(0.5)
  }
}

// Update playAnimation function to handle transitions better
const playAnimation = (type) => {
  if (!mixer || !model || !animations[type]) return

  // Stop any current animation
  mixer.stopAllAction()

  if (currentAnimation) {
    currentAnimation.fadeOut(0.5)
  }

  currentAnimation = mixer.clipAction(animations[type])
  currentAnimation.reset().fadeIn(0.5).play()
  currentAnimationType.value = type
}

const animate = () => {
  if (renderer && scene && camera) {
    animationFrameId = requestAnimationFrame(animate)
    const delta = clock.getDelta()

    if (mixer) mixer.update(delta)
    if (controls) controls.update()

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
