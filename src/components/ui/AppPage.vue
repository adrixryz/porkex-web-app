<template>
  <v-container
    fluid
    :class="
      centered ? 'app-page-centered d-flex align-center justify-center' : 'py-8 px-md-8 max-w-1200'
    "
    v-bind="$attrs"
  >
    <slot></slot>
  </v-container>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{ centered?: boolean }>(), { centered: false })
</script>

<style scoped>
.app-page-centered {
  min-height: 100vh;
  min-height: 100dvh;
}
</style>
