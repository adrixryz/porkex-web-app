<template>
  <v-btn elevation="0" rounded="pill" v-bind="$attrs">
    <slot></slot>
  </v-btn>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>
