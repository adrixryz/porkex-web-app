<template>
  <AppButton type="button" variant="outlined" size="large" :prepend-icon="icon" v-bind="$attrs">
    <slot></slot>
  </AppButton>
</template>

<script setup lang="ts">
import AppButton from './AppButton.vue'

defineOptions({ inheritAttrs: false })
defineProps<{ icon: string }>()
</script>
