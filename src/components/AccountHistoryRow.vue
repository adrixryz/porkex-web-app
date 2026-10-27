<template>
  <div class="account-history-row">
    <v-avatar :color="color" variant="tonal" size="36">
      <v-icon :icon="icon" />
    </v-avatar>
    <div class="history-details">
      <slot name="details" />
      <p class="text-caption text-medium-emphasis">
        {{
          instant
            ? new Date(date).toLocaleDateString(dateLocale(), {
                month: 'numeric',
                day: 'numeric',
                year: '2-digit'
              })
            : formatDateOnly(date, { month: 'numeric', day: 'numeric', year: '2-digit' })
        }}
      </p>
    </div>
    <p class="history-comment text-caption" :title="comment">{{ comment }}</p>
    <div class="history-value">
      <div><slot name="value" /></div>
      <div v-if="$slots.actions" class="history-actions"><slot name="actions" /></div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { dateLocale, formatDateOnly } from '@/utils/date'
defineProps<{ date: string; comment?: string; icon: string; color: string; instant?: boolean }>()
</script>
<style scoped>
.account-history-row {
  display: grid;
  grid-template-columns: 36px clamp(96px, 25%, 260px) minmax(0, 1fr) max-content;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 52px;
}
.history-details {
  min-width: 0;
  overflow-wrap: anywhere;
}
.history-details > p {
  margin-top: 2px;
  margin-bottom: 0;
}
.history-comment {
  margin: 0;
}
.history-value {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  text-align: right;
  white-space: nowrap;
}
.history-actions {
  display: flex;
  flex-shrink: 0;
}
.history-comment {
  min-width: 0;
  overflow-wrap: anywhere;
  text-align: left;
  white-space: normal;
}
@media (max-width: 599px) {
  .history-value {
    flex-direction: column;
    align-items: flex-end;
    gap: 0;
  }
  .account-history-row {
    min-height: 80px;
    grid-template-columns: 36px clamp(72px, 25%, 150px) minmax(0, 1fr) max-content;
    gap: 8px;
  }
}
@media (max-width: 359px) {
  .account-history-row {
    gap: 6px;
  }
}
</style>
