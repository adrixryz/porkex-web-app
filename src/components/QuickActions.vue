<template>
  <div class="quick-actions-space" aria-hidden="true" />
  <v-menu location="top end" :offset="12">
    <template #activator="{ props }">
      <AppIconButton
        v-bind="props"
        :icon="mdiPlus"
        :label="translate('Quick actions')"
        color="primary"
        variant="flat"
        rounded="circle"
        :size="56"
        class="quick-actions-button"
      />
    </template>
    <v-list
      density="compact"
      class="quick-actions-menu app-action-menu"
      :aria-label="translate('Quick actions')"
    >
      <v-list-item
        :title="translate('Expense')"
        :prepend-icon="mdiMinus"
        class="text-error"
        @click="openMovement('Expense')"
      />
      <v-list-item
        :title="translate('Income')"
        :prepend-icon="mdiPlus"
        class="text-success"
        @click="openMovement('Income')"
      />
      <v-list-item
        :title="translate('Favorites')"
        :prepend-icon="mdiStarOutline"
        class="text-warning"
        @click="favoritesOpen = true"
      />
      <v-list-item
        :title="translate('Transfer')"
        :prepend-icon="mdiSwapHorizontal"
        class="text-primary"
        @click="transferOpen = true"
      />
    </v-list>
  </v-menu>
  <TransactionDialog
    v-model="movementOpen"
    :type="movementType"
    :default-account-id="defaultAccountId"
    @saved="movementSaved"
  />
  <AppDialog v-model="favoritesOpen" :title="translate('Favorites')" max-width="520">
    <FavoritesPanel manage embedded />
  </AppDialog>
  <TransferDialog v-model="transferOpen" :source-id="defaultAccountId" @saved="emit('saved')" />
</template>

<script setup lang="ts">
import { t as translate } from '@/i18n'
import { ref } from 'vue'
import { mdiMinus, mdiPlus, mdiStarOutline, mdiSwapHorizontal } from '@mdi/js'
import AppIconButton from './ui/AppIconButton.vue'
import AppDialog from './ui/AppDialog.vue'
import TransactionDialog from './TransactionDialog.vue'
import TransferDialog from './TransferDialog.vue'
import FavoritesPanel from './FavoritesPanel.vue'
import { useSnackbar } from '@/composables/useSnackbar'
import { mutationFeedback } from '@/utils/mutationFeedback'

defineProps<{ defaultAccountId?: string }>()
const emit = defineEmits<{ saved: [] }>()
const { showSnack } = useSnackbar()
const movementOpen = ref(false)
const movementType = ref<'Expense' | 'Income'>('Expense')
const favoritesOpen = ref(false)
const transferOpen = ref(false)

function openMovement(type: 'Expense' | 'Income') {
  movementType.value = type
  movementOpen.value = true
}
function movementSaved({ queued, superseded }: { queued: boolean; superseded?: boolean }) {
  showSnack(...mutationFeedback(queued, 'Transaction saved!', superseded))
  emit('saved')
}
</script>

<style scoped>
.quick-actions-button {
  border-radius: 50% !important;
  width: 56px;
  height: 56px;
  position: fixed;
  right: calc(24px + env(safe-area-inset-right, 0px));
  bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  z-index: 100;
}
.quick-actions-space {
  height: 80px;
}
.quick-actions-menu {
  min-width: 170px;
}
</style>
