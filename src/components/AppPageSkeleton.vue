<template>
  <div class="app-page-skeleton" role="status" aria-label="Loading page" aria-busy="true">
    <AppPageHeader
      v-if="header && page !== 'dashboard'"
      :title="page[0].toUpperCase() + page.slice(1)"
      :subtitle="page === 'settings' ? undefined : 'Loading summary'"
      loading
    >
      <template v-if="page !== 'settings'" #actions>
        <AppSkeleton v-if="page === 'analytics'" type="field" class="app-page-skeleton__account" />
        <AppSkeleton v-else-if="page === 'transactions'" type="segmented" />
        <AppSkeleton v-else type="button" />
      </template>
    </AppPageHeader>
    <template v-if="page === 'settings'">
      <AppCard
        v-for="section in ['Profile', 'Preferences', 'Backup', 'Security', 'Danger Zone']"
        :key="section"
        :title="section"
        class="mb-4"
      >
        <AppCardBody class="app-page-skeleton__fields">
          <div v-if="section === 'Profile'" class="d-flex align-center ga-3">
            <AppSkeleton type="avatar" width="64px" height="64px" />
            <div class="flex-grow-1 app-page-skeleton__fields">
              <AppSkeleton width="60%" /><AppSkeleton width="80%" />
            </div>
          </div>
          <template v-if="section === 'Backup'">
            <AppCard v-for="group in ['All Transactions', 'All Data']" :key="group" :title="group">
              <AppCardBody class="app-page-skeleton__fields">
                <AppSkeleton width="85%" />
                <div class="d-flex flex-wrap ga-3">
                  <AppSkeleton type="button" /><AppSkeleton type="button" />
                </div>
              </AppCardBody>
            </AppCard>
          </template>
          <template v-else-if="section === 'Danger Zone'">
            <AppSkeleton type="button" width="190px" /><AppSkeleton type="button" />
          </template>
          <AppFormFields v-else :gap="section === 'Security' ? 16 : 24">
            <AppSkeleton
              v-for="n in section === 'Preferences' ? 4 : section === 'Security' ? 3 : 2"
              :key="n"
              type="field"
              height="56px"
            />
            <AppSkeleton v-if="section === 'Profile'" width="180px" />
            <AppSkeleton v-if="section !== 'Preferences'" type="button" />
          </AppFormFields>
        </AppCardBody>
      </AppCard>
    </template>
    <template v-else>
      <DashboardOverview v-if="page === 'dashboard'">
        <template #account>
          <div class="d-flex align-center ga-2 app-page-skeleton__balance-controls">
            <AppSkeleton type="field" width="160px" />
            <AppSkeleton type="avatar" />
          </div>
          <AppSkeleton type="heading" class="app-page-skeleton__balance" />
        </template>
        <template #period>
          <AppSkeleton type="segmented" width="100%" />
          <div class="d-flex align-center justify-center ga-2">
            <AppSkeleton type="avatar" />
            <AppSkeleton width="140px" />
            <AppSkeleton type="avatar" />
          </div>
        </template>
        <template #stats>
          <v-col v-for="n in 3" :key="n" cols="4"><AppStatSkeleton icon /></v-col>
        </template>
      </DashboardOverview>
      <div
        v-if="page === 'budgets' || page === 'recurring'"
        class="app-page-skeleton__filter-header mb-6"
      >
        <AppSkeleton type="field" class="app-page-skeleton__account" />
        <AppSkeleton type="segmented" class="ml-sm-auto" />
      </div>
      <v-row
        v-if="page === 'analytics' || page === 'budgets'"
        class="mb-4"
        :class="{ 'app-page-skeleton__budget-stats': page === 'budgets' }"
      >
        <v-col
          v-for="n in page === 'analytics' ? 4 : 3"
          :key="n"
          :cols="page === 'analytics' ? 6 : 4"
          :md="page === 'analytics' ? 3 : 4"
        >
          <AppStatSkeleton />
        </v-col>
      </v-row>
      <template v-if="page === 'analytics'">
        <v-row class="mb-4">
          <v-col v-for="n in 2" :key="n" cols="12" md="6">
            <AppCard>
              <template #title><AppSkeleton width="170px" /></template>
              <AppCardBody><AppSkeleton type="chart" /></AppCardBody>
            </AppCard>
          </v-col>
        </v-row>
        <AppCard>
          <template #title><AppSkeleton width="190px" /></template>
          <template #header-actions>
            <div class="d-flex flex-wrap justify-center ga-3">
              <AppSkeleton type="button" width="180px" />
              <AppSkeleton type="field" width="150px" />
              <AppSkeleton type="segmented" width="184px" />
            </div>
          </template>
          <AppCardBody padding="pa-0">
            <div class="app-page-skeleton__comparison">
              <AppSkeleton type="rows" :rows="5" />
              <div class="pa-6"><AppSkeleton type="chart" /></div>
            </div>
          </AppCardBody>
        </AppCard>
      </template>
      <template v-else-if="page === 'dashboard'">
        <v-row class="mb-4">
          <v-col cols="12" md="8" order="2" order-md="1">
            <AppCard>
              <template #title><AppSkeleton width="170px" /></template>
              <AppCardBody padding="pa-0"><AppSkeleton type="rows" :rows="5" /></AppCardBody>
            </AppCard>
          </v-col>
          <v-col cols="12" md="4" order="1" order-md="2">
            <AppCard>
              <template #title><AppSkeleton width="170px" /></template>
              <AppCardBody class="app-page-skeleton__fields justify-items-center">
                <AppSkeleton type="segmented" />
                <AppSkeleton type="circle" />
              </AppCardBody>
            </AppCard>
          </v-col>
        </v-row>
        <AppCard>
          <template #title><AppSkeleton width="150px" /></template>
          <AppCardBody class="app-page-skeleton__fields">
            <AppSkeleton v-for="n in 2" :key="n" height="32px" />
          </AppCardBody>
        </AppCard>
      </template>
      <template v-else-if="page === 'transactions'">
        <AppCard class="mb-4">
          <AppCardBody class="app-page-skeleton__fields">
            <div class="app-page-skeleton__filter-header">
              <AppSkeleton type="segmented" width="440px" />
              <AppSkeleton type="button" width="200px" />
            </div>
            <div class="app-page-skeleton__filters">
              <AppSkeleton v-for="n in 3" :key="n" type="field" />
              <div class="d-flex ga-2">
                <AppSkeleton type="field" /><AppSkeleton type="field" />
              </div>
            </div>
          </AppCardBody>
        </AppCard>
        <AppSkeleton type="field" height="44px" class="mb-4" />
        <AppCard
          ><AppCardBody padding="pa-0"><AppSkeleton type="rows" :rows="6" /></AppCardBody
        ></AppCard>
      </template>
      <template v-else>
        <div v-if="page === 'categories'" class="app-page-skeleton__filter-header mb-4">
          <AppSkeleton type="segmented" />
        </div>
        <v-row>
          <v-col
            v-for="n in 4"
            :key="n"
            cols="12"
            :sm="page === 'accounts' || page === 'categories' ? 6 : undefined"
            :md="page === 'accounts' || page === 'categories' ? 4 : 6"
            :lg="page === 'accounts' ? 3 : undefined"
          >
            <AppCard>
              <AppCardBody class="app-page-skeleton__fields">
                <div class="d-flex align-center ga-3">
                  <AppSkeleton type="avatar" /><AppSkeleton width="60%" />
                  <AppSkeleton type="avatar" width="32px" height="32px" class="ml-auto" />
                </div>
                <AppSkeleton v-if="page !== 'categories'" type="heading" width="130px" />
                <AppSkeleton v-if="page !== 'accounts' && page !== 'categories'" height="8px" />
                <div v-if="page === 'goals' || page === 'recurring'" class="d-flex flex-wrap ga-2">
                  <AppSkeleton type="button" width="120px" /><AppSkeleton
                    type="button"
                    width="120px"
                  />
                </div>
              </AppCardBody>
            </AppCard>
          </v-col>
        </v-row>
        <AppCard v-if="page === 'accounts'" class="mt-6">
          <template #title><AppSkeleton width="170px" /></template>
          <template #header-actions><AppSkeleton type="field" width="180px" /></template>
          <AppCardBody padding="pa-0"><AppSkeleton type="rows" :rows="4" /></AppCardBody>
        </AppCard>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import DashboardOverview from '@/components/DashboardOverview.vue'
import AppPageHeader from '@/components/ui/AppPageHeader.vue'
import AppCard from '@/components/ui/AppCard.vue'
import AppCardBody from '@/components/ui/AppCardBody.vue'
import AppSkeleton from '@/components/ui/AppSkeleton.vue'
import AppStatSkeleton from '@/components/ui/AppStatSkeleton.vue'
import AppFormFields from '@/components/ui/AppFormFields.vue'
withDefaults(
  defineProps<{
    page:
      | 'dashboard'
      | 'analytics'
      | 'transactions'
      | 'settings'
      | 'budgets'
      | 'categories'
      | 'recurring'
      | 'accounts'
      | 'goals'
    header?: boolean
  }>(),
  { header: true }
)
</script>

<style scoped>
.app-page-skeleton {
  animation: page-skeleton-pulse 1.5s ease-in-out infinite alternate;
}
.app-page-skeleton__fields {
  display: grid;
  gap: 16px;
}
.app-page-skeleton__filter-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.app-page-skeleton__filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.app-page-skeleton__account {
  width: 200px;
  flex-shrink: 0;
}
.app-page-skeleton__balance-controls {
  min-width: 0;
  min-height: 44px;
}
.app-page-skeleton__balance-controls > :first-child {
  flex: 0 1 160px;
  min-width: 0;
}
.app-page-skeleton__balance {
  height: 32px;
}
.app-page-skeleton__comparison {
  display: grid;
  grid-template-columns: 3fr 2fr;
  align-items: start;
}
@keyframes page-skeleton-pulse {
  from {
    opacity: 0.6;
  }
  to {
    opacity: 1;
  }
}
@media (max-width: 959px) {
  .app-page-skeleton__comparison {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 599px) {
  .app-page-skeleton__filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .app-page-skeleton__filter-header {
    align-items: flex-start;
    flex-direction: column;
  }
  .app-page-skeleton__account {
    width: 180px;
  }
  .app-page-skeleton__budget-stats {
    --v-col-gap-x: 8px;
  }
  .app-page-skeleton__balance {
    height: 24px;
    justify-self: end;
  }
}
@media (prefers-reduced-motion: reduce) {
  .app-page-skeleton {
    animation: none;
  }
}
</style>
