<template>
  <v-snackbar v-model="snackbar" :color="snackColor" timeout="3000" location="bottom right">
    {{ translate(snackMessage) }}
  </v-snackbar>
</template>

<script setup lang="ts">
import { t as translate } from '@/i18n'
import { useSnackbar } from '@/composables/useSnackbar'

const { snackbar, snackMessage, snackColor } = useSnackbar()
</script>
