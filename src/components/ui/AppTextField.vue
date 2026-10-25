<template>
  <v-text-field class="app-text-field" v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps || {}"></slot>
    </template>
  </v-text-field>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
</script>

<style scoped>
.app-text-field.v-input--error :deep(.v-input__details) {
  padding-bottom: 12px;
}
</style>
