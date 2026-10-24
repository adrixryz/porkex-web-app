<template>
  <AppPage>
    <AppPageHeader title="Goals" subtitle="Set money aside and track your progress.">
      <template #actions>
        <AppButton color="primary" :prepend-icon="mdiPlus" @click="goalsPanel?.newGoal()">
          New Goal
        </AppButton>
      </template>
    </AppPageHeader>
    <GoalsPanel ref="goalsPanel" />
  </AppPage>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { mdiPlus } from '@mdi/js'
import GoalsPanel from '@/components/GoalsPanel.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppPage from '@/components/ui/AppPage.vue'
import AppPageHeader from '@/components/ui/AppPageHeader.vue'
const goalsPanel = ref<InstanceType<typeof GoalsPanel> | null>(null)
</script>
