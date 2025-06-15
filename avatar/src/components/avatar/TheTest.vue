<template>
  <div class="container">
    <ThreeAvatar />
    <div class="controls">
      <button
        @click="resetToRest()"
        :disabled="loading"
        :class="{ active: !currentAnimationType }"
      >
        Rest
      </button>
      <div v-for="anim in availableAnimations" :key="anim.name" class="button-group">
        <button
          @click="playAnimation(anim.name, false)"
          :disabled="loading"
          :class="{ active: currentAnimationType === anim.name }"
        >
          {{ anim.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import ThreeAvatar from './ThreeAvatar.vue'

const availableAnimations = [
  { name: 'climbing', label: 'Climbing' },
  { name: 'frisbee', label: 'Frisbee' },
  { name: 'gaming', label: 'Gaming' },
  { name: 'typing', label: 'Typing' }
]

const resetToRest = () => {
  console.log('Resetting to rest pose...')
}

const playAnimation = (name, reverse) => {
  console.log(`Playing animation: ${name}, reverse: ${reverse}`)
}
</script>

<style scoped>
.container {
  position: relative;
  width: 600px;
  height: 100vh;
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
</style>
