<script setup lang="ts">
// TheWelcome.vue

import { onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
import { availableAnimations } from './constants/animations'
import { useThree } from './composables/useThree'
import { useAnimations } from './composables/useAnimations'
import { useCamera } from './composables/useCamera'

const {
  threeContainer,
  threeLoading,
  error: threeError,
  initThree,
  cleanup
} = useThree()

const {
  currentAnimationType,
  isTransitioning,
  model,
  mixer,
  animations,
  loadModel,
  playAndWait,
  resetToRest,
  isReady,
  animate,
  animationLoading,
  animationError,
  initThreeContext
} = useAnimations()

// Computed properties
const loading = computed(() => threeLoading.value || animationLoading.value)
const error = computed(() => threeError.value || animationError.value)

const playAnimation = async (type: string, reverse = false) => {
  if (!isReady.value) {
    error.value = 'Animation system not ready'
    return
  }

  try {
    console.log(`Playing animation: ${type}, reverse: ${reverse}`)
    isTransitioning.value = true

    if (currentAnimation && !reverse) {
      if (currentAnimationType.value === 'climbing') {
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
        await resetToRest()
      } else if (currentAnimationType.value === 'gaming') {
        if (type !== 'typing') {
          await resetToRest()
        }
      } else if (currentAnimationType.value === 'typing') {
        if (type !== 'gaming') {
          await resetToRest()
        }
      }
    }

    if (type === 'climbing' || type === 'frisbee') {
      moveCamera(type)
      await new Promise(resolve => setTimeout(resolve, 1000))
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
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    isTransitioning.value = false
  }
}

onMounted(async () => {
  try {
    console.log('🚀 Starting initialization...')

    // Wait for the DOM to render the container
    await nextTick()

    if (!threeContainer.value) {
      console.error('❌ Three.js container not found')
      throw new Error('Three.js container not found')
    }
    console.log('✓ Container ready:', threeContainer.value)

    // Initialize Three.js context
    const context = await initThree()
    if (!context) {
      console.error('❌ Failed to initialize Three.js context')
      throw new Error('Failed to initialize Three.js context')
    }
    console.log('✓ Three.js context initialized:', context)

    // Pass context to animation system
    initThreeContext(context)
    console.log('✓ Animation context set')

    // Load model and animations
    console.log('🔄 Loading model and animations...')
    await loadModel()
    console.log('✓ Model loaded')

    // Start animation loop
    console.log('🎬 Starting animation loop...')
    animate()
    console.log('✅ Initialization complete')

  } catch (err) {
    console.error('❌ Initialization failed:', err)
    error.value = (err as Error).message
  }
})


onBeforeUnmount(() => {
  console.log('🧹 Cleaning up...')
  cleanup()
})
</script>

<template>
  <div class="container">
    <div ref="threeContainer" class="three-avatar"></div>
    <div class="controls">
      <button
        @click="resetToRest()"
        :class="{ active: !currentAnimationType }"
      >
        Rest
      </button>
      <div v-for="anim in availableAnimations" :key="anim.name">
        <button
          @click="playAnimation(anim.name)"
        
          :class="{ active: currentAnimationType === anim.name }"
        >
          {{ anim.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="css">
@import './styles/style.css';
</style>

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
  display: flex;
  gap: 10px;
}

button {
  padding: 8px 16px;
  border: 1px solid #fff;
  background: transparent;
  color: #fff;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button.active {
  background: #fff;
  color: #000;
}
</style>
