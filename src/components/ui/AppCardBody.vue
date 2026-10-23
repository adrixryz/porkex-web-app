<template>
  <v-card-text :class="padding" v-bind="$attrs">
    <slot></slot>
  </v-card-text>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

withDefaults(defineProps<{ padding?: string }>(), { padding: 'pa-6' })
</script>
