<template>
  <v-select v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps || {}"></slot>
    </template>
  </v-select>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>
