<!-- filepath: /Users/daniele.bordignon/Projects/avatar/avatar/src/components/avatar/ThreeAvatar.vue -->
<template>
  <div ref="threeContainer" class="three-avatar"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

// Import avatar file
import avatarUrl from '@/assets/avatar.glb'

import climbingUrl from '@/assets/Climbing Up Wall.fbx'
import frisbeeUrl from '@/assets/Frisbee Throw.fbx'
import gamingUrl from '@/assets/Gaming.fbx'
import typingUrl from '@/assets/Typing.fbx'

const threeContainer = ref(null)
let scene = null
let camera = null
let renderer = null
let controls = null
let model = null
let mixer = null
let animationFrameId = null
let clock = new THREE.Clock()
let animations = {}

const initThree = async () => {
  try {
    const container = threeContainer.value
    if (!container) throw new Error('Three.js container not found')

    // Initialize scene
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x666666)

    // Initialize camera
    camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.01,
      1000
    )
    camera.position.set(0, 1, 3)

    // Initialize renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    // Initialize controls
    controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 1, 0)
    controls.enableDamping = true
    controls.update()

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(5, 5, 5)
    directionalLight.castShadow = true
    scene.add(directionalLight)

    // Load model and animations
    await loadModel()

    // Start animation loop
    animate()

    // Add resize listener
    window.addEventListener('resize', onWindowResize)
  } catch (err) {
    console.error('Failed to initialize Three.js:', err)
  }
}

const loadModel = async () => {
  const gltfLoader = new GLTFLoader()
  const fbxLoader = new FBXLoader()

  try {
    // Load main model
    
    const gltf = await gltfLoader.loadAsync(avatarUrl)
    model = gltf.scene
    mixer = new THREE.AnimationMixer(model)

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        if (child.material) {
          child.material = new THREE.MeshStandardMaterial({
            map: child.material.map,
            color: child.material.color,
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

    // Load animations
    const animationsList = [
      { name: 'climbing', url: climbingUrl },
      { name: 'frisbee', url: frisbeeUrl },
      { name: 'gaming', url: gamingUrl },
      { name: 'typing', url: typingUrl }
    ]

    for (const anim of animationsList) {
      const fbx = await fbxLoader.loadAsync(anim.url)
      if (fbx.animations.length > 0) {
        animations[anim.name] = fbx.animations[0]
      }
    }
  } catch (err) {
    console.error('Error loading model or animations:', err)
  }
}

const animate = () => {
  animationFrameId = requestAnimationFrame(animate)

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
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  if (renderer) renderer.dispose()
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
.three-avatar {
  width: 100%;
  height: 100%;
  background: #000;
}
</style>
