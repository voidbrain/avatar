<template>
  <div class="comparison-container">
    <div class="model-container">
      <h3>GLB Model</h3>
      <div ref="glbContainer" class="three-box"></div>
      <div v-if="glbError" class="error-message">{{ glbError }}</div>
    </div>
    <div class="model-container">
      <h3>OBJ Model</h3>
      <div ref="objContainer" class="three-box"></div>
      <div v-if="objError" class="error-message">{{ objError }}</div>
    </div>
    <div class="model-container">
      <h3>FBX Model</h3>
      <div ref="fbxContainer" class="three-box"></div>
      <div v-if="fbxError" class="error-message">{{ fbxError }}</div>
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
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import { cameraConfig, lightsConfig, rendererConfig } from '@/config/three.js'

// Import models with proper URL handling
import glbModel from '@/assets/untitled.glb?url'
import objModel from '@/assets/avatar.obj?url'
import objMaterials from '@/assets/avatar.mtl?url'
import fbxModel from '@/assets/untitled.fbx?url'

// Refs for containers
const glbContainer = ref(null)
const objContainer = ref(null)
const fbxContainer = ref(null)

// Error states
const glbError = ref(null)
const objError = ref(null)
const fbxError = ref(null)

// Scene containers
const scenes = {
  glb: { scene: null, camera: null, renderer: null, controls: null },
  obj: { scene: null, camera: null, renderer: null, controls: null },
  fbx: { scene: null, camera: null, renderer: null, controls: null }
}

const setupScene = (container, type) => {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x666666)

  const camera = new THREE.PerspectiveCamera(
    cameraConfig.fov,
    container.clientWidth / container.clientHeight,
    cameraConfig.near,
    cameraConfig.far
  )
  camera.position.set(...cameraConfig.position)

  const renderer = new THREE.WebGLRenderer(rendererConfig)
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, rendererConfig.pixelRatio))
  renderer.shadowMap.enabled = rendererConfig.shadow
  container.appendChild(renderer.domElement)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(...cameraConfig.target)
  controls.update()

  // Add lights
  const ambient = new THREE.AmbientLight(0xffffff, 1.0) // Increased intensity
  scene.add(ambient)

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1)
  scene.add(hemiLight)

  const directional = new THREE.DirectionalLight(0xffffff, 2) // Increased intensity
  directional.position.set(5, 5, 5)
  directional.castShadow = true
  scene.add(directional)

  // Add fill light
  const fillLight = new THREE.DirectionalLight(0xffffff, 1)
  fillLight.position.set(-5, 5, -5)
  scene.add(fillLight)

  scenes[type] = { scene, camera, renderer, controls }
  return { scene, camera, renderer, controls }
}

const loadModel = async (type, container) => {
  try {
    const { scene, camera, renderer, controls } = setupScene(container, type)
    let model

    switch (type) {
      case 'glb':
        model = await new GLTFLoader().loadAsync(glbModel)
        model = model.scene
        break
      case 'obj':
        try {
          const mtlLoader = new MTLLoader()
          const materials = await mtlLoader.loadAsync(objMaterials)
          materials.preload()

          const objLoader = new OBJLoader()
          objLoader.setMaterials(materials)
          model = await objLoader.loadAsync(objModel)
        } catch (mtlError) {
          console.warn('MTL loading failed:', mtlError)
          const objLoader = new OBJLoader()
          model = await objLoader.loadAsync(objModel)
        }
        break
      case 'fbx':
        model = await new FBXLoader().loadAsync(fbxModel)
        // FBX specific adjustments
        model.scale.setScalar(0.01) // Uniform scaling for FBX
        break
    }

    // Apply materials and setup
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true

        // Create new material for each mesh
        if (child.material) {
          const oldMaterial = child.material
          child.material = new THREE.MeshStandardMaterial({
            map: oldMaterial.map,
            color: oldMaterial.color || new THREE.Color(0xcccccc),
            normalMap: oldMaterial.normalMap,
            roughnessMap: oldMaterial.roughnessMap,
            roughness: 0.8,
            metalness: 0.0,
            skinning: true
          })

          // Ensure proper texture handling
          if (child.material.map) {
            child.material.map.encoding = THREE.sRGBEncoding
            child.material.map.needsUpdate = true
          }
        }
      }
    })

    model.position.set(0, 0, 0)
    model.scale.set(1, 1, 1)
    scene.add(model)

  } catch (err) {
    switch (type) {
      case 'glb': glbError.value = err.message; break
      case 'fbx': fbxError.value = err.message; break
      case 'obj': objError.value = err.message; break
    }
    console.error(`Error loading ${type} model:`, err)
  }
}

const animate = () => {
  requestAnimationFrame(animate)

  Object.values(scenes).forEach(({ renderer, scene, camera, controls }) => {
    if (renderer && scene && camera) {
      controls?.update()
      renderer.render(scene, camera)
    }
  })
}

onMounted(async () => {
  await loadModel('glb', glbContainer.value)
  await loadModel('obj', objContainer.value)
  await loadModel('fbx', fbxContainer.value)
  animate()
})

onBeforeUnmount(() => {
  Object.values(scenes).forEach(({ renderer }) => {
    if (renderer) {
      renderer.dispose()
      renderer.forceContextLoss()
    }
  })
})
</script>

<style scoped>
.comparison-container {
  display: flex;
  justify-content: space-around; /* Changed from space-between */
  align-items: flex-start;
  padding: 20px;
  background: #1a1a1a;
  min-height: 100vh;
  gap: 20px; /* Add gap between containers */
}

.model-container {
  flex: 1;
  max-width: 400px; /* Add max-width */
  margin: 0;
  border: 1px solid #444;
  border-radius: 8px;
  overflow: hidden;
}

.three-box {
  width: 400px;
  height: 400px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

h3 {
  color: white;
  text-align: center;
  margin-bottom: 15px;
}

.error-message {
  color: #ff4444;
  padding: 10px;
  margin-top: 10px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 4px;
  text-align: center;
}
</style>
