import { onUnmounted, ref } from 'vue'

// One snackbar state for the whole app, created once at module scope. Declaring
// the refs inside the function would hand every caller its own copy, which is
// not shared state at all.
const snackbar = ref(false)
const snackMessage = ref('')
const snackColor = ref('success')

// Pair it with <v-snackbar v-model="snackbar" :color="snackColor">.
export function useSnackbar() {
  // Each view renders its own <v-snackbar>, but they all read the refs above.
  // Without this reset, leaving a view while its message is still on screen
  // would make the next view mount already showing the previous message.
  onUnmounted(() => {
    snackbar.value = false
  })

  function showSnack(message: string, color: string = 'success') {
    snackMessage.value = message
    snackColor.value = color
    snackbar.value = true
  }

  return { snackbar, snackMessage, snackColor, showSnack }
}