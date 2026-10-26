import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h, nextTick, ref } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { useReorderableList } from './useReorderableList'

enableAutoUnmount(afterEach)
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())
function pointer(type: string, values = {}) {
  const event = new Event(type, { bubbles: true })
  Object.assign(event, {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    clientX: 100,
    clientY: 100,
    ...values
  })
  return event
}
function list() {
  const source = ref([{ id: 1 }, { id: 2 }, { id: 3 }])
  const save = vi.fn(async items => {
    source.value = items
  })
  let reorder!: ReturnType<typeof useReorderableList<{ id: number }>>
  const wrapper = mount(
    defineComponent({
      setup() {
        reorder = useReorderableList({
          source: () => source.value,
          busy: () => false,
          save,
          attribute: 'data-item-id'
        })
        return () =>
          h(
            'div',
            reorder.ordered.value.map(item =>
              h(
                'button',
                {
                  key: item.id,
                  'data-item-id': item.id,
                  onPointerdown: (event: PointerEvent) => reorder.startDrag(event, item.id)
                },
                String(item.id)
              )
            )
          )
      }
    })
  )
  return {
    wrapper,
    source,
    save,
    get reorder() {
      return reorder
    }
  }
}
it('saves once when reordered DOM rows lose their handle and release happens elsewhere', async () => {
  const state = list()
  state.wrapper.get('[data-item-id="1"]').element.dispatchEvent(pointer('pointerdown'))
  await vi.advanceTimersByTimeAsync(250)
  for (const id of [2, 3]) {
    document.elementFromPoint = () => state.wrapper.get(`[data-item-id="${id}"]`).element
    window.dispatchEvent(pointer('pointermove'))
    await nextTick()
  }
  window.dispatchEvent(pointer('pointerup'))
  await nextTick()
  window.dispatchEvent(pointer('pointerup'))
  expect(state.save).toHaveBeenCalledTimes(1)
  expect(state.source.value.map(item => item.id)).toEqual([2, 3, 1])
  expect(state.reorder.dragging.value).toBeNull()
})
it('a quick click never starts a later drag after releasing outside the handle', async () => {
  const state = list()
  state.wrapper.get('button').element.dispatchEvent(pointer('pointerdown'))
  window.dispatchEvent(pointer('pointerup'))
  await vi.advanceTimersByTimeAsync(300)
  expect(state.reorder.dragging.value).toBeNull()
  expect(state.save).not.toHaveBeenCalled()
})
it('cancels on window blur and removes global listeners on unmount', async () => {
  const state = list()
  state.wrapper.get('button').element.dispatchEvent(pointer('pointerdown'))
  await vi.advanceTimersByTimeAsync(250)
  window.dispatchEvent(new Event('blur'))
  expect(state.reorder.dragging.value).toBeNull()
  state.wrapper.unmount()
  window.dispatchEvent(pointer('pointerup'))
  expect(state.save).not.toHaveBeenCalled()
})
