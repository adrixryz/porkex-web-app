<template>
  <div class="dashboard-overview">
    <AppPageHeader class="dashboard-balance">
      <template #title>
        <div class="dashboard-header">
          <div class="dashboard-account"><slot name="account" /></div>
          <div class="dashboard-period"><slot name="period" /></div>
        </div>
      </template>
    </AppPageHeader>
    <v-row class="dashboard-kpis"><slot name="stats" /></v-row>
  </div>
</template>

<script setup lang="ts">
import AppPageHeader from '@/components/ui/AppPageHeader.vue'
</script>

<style scoped>
.dashboard-overview {
  display: grid;
  gap: 24px;
  margin-bottom: 24px;
}
.dashboard-overview > .dashboard-balance,
.dashboard-overview > .dashboard-kpis {
  min-width: 0;
  margin: 0 !important;
}
.dashboard-balance :deep(.v-col),
.dashboard-balance :deep(.v-col > div) {
  width: 100%;
  min-width: 0;
  padding: 0;
}
.dashboard-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  align-items: start;
  gap: 12px;
}
.dashboard-account,
.dashboard-period {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 12px;
}
.dashboard-account {
  container-type: inline-size;
}
.dashboard-period {
  width: 100%;
  max-width: 352px;
  justify-self: end;
}
.dashboard-period :deep(.app-period-navigation) {
  justify-content: center;
  width: 100%;
  gap: 0;
}
.dashboard-period :deep(.app-period-navigation .v-btn) {
  flex-shrink: 0;
}
.dashboard-kpis {
  --v-col-gap-x: 12px;
  --v-col-gap-y: 12px;
}
@media (min-width: 960px) {
  .dashboard-kpis :deep(.v-card) {
    aspect-ratio: 1;
  }
  .dashboard-overview {
    grid-template-columns: minmax(0, 1fr) 456px;
    align-items: center;
    column-gap: 24px;
  }
  .dashboard-header {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    align-items: center;
  }
  .dashboard-period {
    max-width: 280px;
    justify-self: center;
    align-items: center;
  }
}
@media (max-width: 599px) {
  .dashboard-header {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
  .dashboard-account {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }
  .dashboard-period {
    max-width: none;
    justify-self: stretch;
  }
  .dashboard-kpis {
    --v-col-gap-x: 8px;
    --v-col-gap-y: 8px;
  }
}
</style>
