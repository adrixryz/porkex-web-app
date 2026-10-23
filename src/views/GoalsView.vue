<template>
  <AppPage
    ><AppPageHeader title="Goals" subtitle="Set money aside and track your progress." /><GoalsPanel
  /></AppPage>
</template>
<script setup lang="ts">
import GoalsPanel from '@/components/GoalsPanel.vue'
import AppPage from '@/components/ui/AppPage.vue'
import AppPageHeader from '@/components/ui/AppPageHeader.vue'
</script>
