import { onUnmounted, ref, shallowRef, watch } from 'vue'

export function useReorderableList<T extends { id: string | number }>(options: {
  source: () => T[]
  busy: () => boolean
  save: (items: T[]) => Promise<unknown>
  attribute: string
}) {
  const ordered = shallowRef<T[]>([])
  const list = ref<HTMLElement>()
  const dragging = ref<string | number | null>(null)
  let press: ReturnType<typeof setTimeout> | undefined
  let initial: (string | number)[] = []
  let pointer: number | null = null
  function detachPointer() {
    pointer = null
    window.removeEventListener('pointermove', onPointerMove, true)
    window.removeEventListener('pointerup', onPointerUp, true)
    window.removeEventListener('pointercancel', onPointerCancel, true)
    window.removeEventListener('blur', cancelDrag)
  }
  function onPointerMove(event: PointerEvent) {
    if (event.pointerId !== pointer) return
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      void finishDrag()
      return
    }
    moveDrag(event)
  }
  function onPointerUp(event: PointerEvent) {
    if (event.pointerId === pointer) void finishDrag()
  }
  function onPointerCancel(event: PointerEvent) {
    if (event.pointerId === pointer) cancelDrag()
  }
  watch(
    options.source,
    items => {
      if (dragging.value === null && !options.busy()) ordered.value = [...items]
    },
    { immediate: true }
  )
  function cancelDrag() {
    detachPointer()
    clearTimeout(press)
    dragging.value = null
    ordered.value = [...options.source()]
  }
  async function saveOrder() {
    try {
      await options.save([...ordered.value])
    } finally {
      ordered.value = [...options.source()]
    }
  }
  async function move(index: number, offset: number) {
    const target = index + offset
    if (options.busy() || dragging.value !== null || target < 0 || target >= ordered.value.length)
      return
    const items = [...ordered.value]
    const [item] = items.splice(index, 1)
    items.splice(target, 0, item!)
    ordered.value = items
    await saveOrder()
  }
  function startDrag(event: PointerEvent, id: string | number) {
    if (options.busy() || pointer !== null || (event.pointerType === 'mouse' && event.button !== 0))
      return
    initial = ordered.value.map(item => item.id)
    // Keyed rows move in the DOM while dragging and can lose pointer capture.
    // Observe release at the window, including releases outside the handle.
    pointer = event.pointerId
    window.addEventListener('pointermove', onPointerMove, true)
    window.addEventListener('pointerup', onPointerUp, true)
    window.addEventListener('pointercancel', onPointerCancel, true)
    window.addEventListener('blur', cancelDrag)
    clearTimeout(press)
    press = setTimeout(() => {
      dragging.value = id
    }, 250)
  }
  function moveDrag(event: PointerEvent) {
    if (dragging.value === null) return
    const row = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>(`[${options.attribute}]`)
    const id = row?.getAttribute(options.attribute)
    const from = ordered.value.findIndex(item => item.id === dragging.value)
    const to = ordered.value.findIndex(item => String(item.id) === id)
    if (from >= 0 && to >= 0 && from !== to) {
      const items = [...ordered.value]
      const [item] = items.splice(from, 1)
      items.splice(to, 0, item!)
      ordered.value = items
    }
    const bounds = list.value?.getBoundingClientRect()
    if (bounds && list.value && list.value.scrollHeight > list.value.clientHeight) {
      if (event.clientY < bounds.top + 35) list.value.scrollTop -= 15
      if (event.clientY > bounds.bottom - 35) list.value.scrollTop += 15
    } else {
      if (event.clientY < 50) window.scrollBy(0, -15)
      if (event.clientY > window.innerHeight - 50) window.scrollBy(0, 15)
    }
  }
  async function finishDrag() {
    detachPointer()
    clearTimeout(press)
    if (dragging.value === null) return
    dragging.value = null
    if (ordered.value.some((item, index) => item.id !== initial[index])) await saveOrder()
  }
  onUnmounted(cancelDrag)
  return { ordered, list, dragging, startDrag, moveDrag, finishDrag, cancelDrag, move }
}
