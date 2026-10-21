import { expect, type Page } from '@playwright/test'

export async function expectIncomeExpenseChart(page: Page) {
  const chart = page.getByRole('img', { name: /^Income vs expenses for the last/ })
  const canvas = chart.locator('canvas')
  await expect(canvas).toBeVisible()
  // Inspect the plot below the legend. An empty canvas or a legend alone
  // cannot pass: all three bar colors, a loss and the average line must draw.
  await expect
    .poll(() =>
      canvas.evaluate(element => {
        const node = element as HTMLCanvasElement
        const top = Math.floor(node.height * 0.45)
        const pixels = node
          .getContext('2d')!
          .getImageData(0, top, node.width, node.height - top).data
        const colors = {
          income: [0, 200, 83],
          expense: [229, 72, 77],
          profit: [0, 112, 243],
          loss: [245, 166, 35],
          average: [255, 235, 59]
        }
        return Object.fromEntries(
          Object.entries(colors).map(([name, rgb]) => {
            let count = 0
            for (let i = 0; i < pixels.length; i += 4) {
              if (
                pixels[i + 3]! > 200 &&
                rgb.every((value, channel) => Math.abs(value - pixels[i + channel]!) <= 4)
              )
                count++
            }
            return [name, count > 40]
          })
        )
      })
    )
    .toEqual({ income: true, expense: true, profit: true, loss: true, average: true })
}
