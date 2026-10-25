<template>
  <div class="app-page-skeleton" role="status" aria-label="Loading page" aria-busy="true">
    <div v-if="header" class="app-page-skeleton__header">
      <div class="app-page-skeleton__heading">
        <AppSkeleton type="heading" /><AppSkeleton
          v-if="page === 'analytics' || page === 'goals'"
          width="240px"
        />
      </div>
      <AppSkeleton v-if="!['dashboard', 'settings', 'analytics'].includes(page)" type="button" />
    </div>
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
            <AppSkeleton width="85%" />
            <div class="d-flex flex-wrap ga-3">
              <AppSkeleton type="button" /><AppSkeleton type="button" />
            </div>
          </template>
          <template v-else-if="section === 'Danger Zone'">
            <AppSkeleton type="button" width="190px" /><AppSkeleton type="button" />
          </template>
          <template v-else>
            <AppFormFields :gap="section === 'Security' ? 16 : 24">
              <AppSkeleton
                v-for="n in section === 'Preferences' ? 4 : section === 'Security' ? 3 : 2"
                :key="n"
                type="field"
              />
              <AppSkeleton v-if="section === 'Profile'" width="180px" />
              <AppSkeleton v-if="section !== 'Preferences'" type="button" />
            </AppFormFields>
          </template>
        </AppCardBody>
      </AppCard>
    </template>
    <template v-else>
      <div v-if="page === 'budgets'" class="app-page-skeleton__header">
        <AppSkeleton type="field" width="260px" height="48px" />
        <AppSkeleton type="segmented" class="ml-auto" />
      </div>
      <v-row v-if="['dashboard', 'analytics', 'budgets'].includes(page)" class="mb-4">
        <v-col
          v-for="n in page === 'analytics' ? 4 : 3"
          :key="n"
          :cols="page === 'budgets' ? 12 : page === 'analytics' ? 6 : 4"
          :sm="page === 'budgets' ? (n === 3 ? 12 : 6) : undefined"
          :md="page === 'analytics' ? 3 : 4"
        >
          <AppCard class="fill-height"
            ><AppCardBody class="app-page-skeleton__fields"
              ><AppSkeleton width="65%" /><AppSkeleton type="heading" width="85%" /></AppCardBody
          ></AppCard>
        </v-col>
      </v-row>
      <template v-if="page === 'analytics'">
        <v-row class="mb-4"
          ><v-col v-for="(width, i) in [7, 5]" :key="i" cols="12" :md="width"
            ><AppCard
              ><template #title><AppSkeleton width="170px" /></template
              ><AppCardBody><AppSkeleton type="chart" /></AppCardBody></AppCard></v-col
        ></v-row>
        <AppCard
          ><template #title><AppSkeleton width="190px" /></template
          ><AppCardBody padding="pa-0"
            ><div class="app-page-skeleton__comparison">
              <AppSkeleton type="rows" :rows="5" />
              <div class="pa-6"><AppSkeleton type="chart" /></div></div></AppCardBody
        ></AppCard>
      </template>
      <template v-else-if="page === 'dashboard'">
        <v-row class="mb-4"
          ><v-col cols="12" md="8"
            ><AppCard
              ><template #title><AppSkeleton width="170px" /></template
              ><AppCardBody padding="pa-0"
                ><AppSkeleton type="rows" :rows="5" /></AppCardBody></AppCard></v-col
          ><v-col cols="12" md="4"
            ><AppCard
              ><template #title><AppSkeleton width="170px" /></template
              ><AppCardBody class="d-flex justify-center"
                ><AppSkeleton type="circle" /></AppCardBody></AppCard></v-col
        ></v-row>
        <AppCard
          ><template #title><AppSkeleton width="150px" /></template
          ><AppCardBody class="app-page-skeleton__fields"
            ><AppSkeleton v-for="n in 2" :key="n" height="32px" /></AppCardBody
        ></AppCard>
      </template>
      <template v-else-if="page === 'transactions'">
        <AppCard class="mb-4"
          ><AppCardBody class="app-page-skeleton__fields"
            ><AppSkeleton type="segmented" width="380px" />
            <div class="app-page-skeleton__filters">
              <AppSkeleton v-for="n in 4" :key="n" type="field" height="40px" />
            </div>
            <AppSkeleton type="button" width="100%" /></AppCardBody
        ></AppCard>
        <AppCard
          ><AppCardBody padding="pa-0"><AppSkeleton type="rows" :rows="6" /></AppCardBody
        ></AppCard>
      </template>
      <template v-else>
        <div v-if="page === 'categories'" class="app-page-skeleton__header">
          <AppSkeleton type="segmented" />
          <AppSkeleton type="segmented" width="352px" />
        </div>
        <v-row
          ><v-col
            v-for="n in 4"
            :key="n"
            cols="12"
            :sm="page === 'accounts' || page === 'categories' ? 6 : undefined"
            :md="page === 'accounts' || page === 'categories' ? 4 : 6"
            :lg="page === 'accounts' ? 3 : undefined"
            ><AppCard
              ><AppCardBody class="app-page-skeleton__fields"
                ><div class="d-flex align-center ga-3">
                  <AppSkeleton v-if="page !== 'accounts'" type="avatar" /><AppSkeleton
                    width="60%"
                  />
                </div>
                <AppSkeleton type="heading" width="130px" /><AppSkeleton
                  v-if="page !== 'accounts'"
                  height="8px" /><AppSkeleton
                  v-if="page === 'goals' || page === 'recurring'"
                  type="button"
                  width="65%" /></AppCardBody></AppCard></v-col
        ></v-row>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import AppCard from '@/components/ui/AppCard.vue'
import AppCardBody from '@/components/ui/AppCardBody.vue'
import AppSkeleton from '@/components/ui/AppSkeleton.vue'
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
.app-page-skeleton__header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}
.app-page-skeleton__heading {
  display: grid;
  gap: 12px;
  min-width: 0;
}
.app-page-skeleton__fields {
  display: grid;
  gap: 16px;
}
.app-page-skeleton__filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
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
}
@media (prefers-reduced-motion: reduce) {
  .app-page-skeleton {
    animation: none;
  }
}
</style>
