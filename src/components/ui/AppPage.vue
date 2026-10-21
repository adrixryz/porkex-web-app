<template>
  <v-container fluid class="py-8 px-md-8 max-w-1200" v-bind="$attrs">
    <slot></slot>
  </v-container>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>
