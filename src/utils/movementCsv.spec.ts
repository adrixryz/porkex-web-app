import { afterEach, expect, it, vi } from 'vite-plus/test'
import { onlineApi } from './api'
import { exportMovementsCsv } from './movementCsv'

vi.mock('./api', () => ({
  getSessionIdentity: () => 'owner',
  onlineApi: vi.fn(),
  readJson: vi.fn()
}))
vi.mock('./date', () => ({ todayInput: () => '2026-10-24' }))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('names backups with the local calendar day and exports every filtered page', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-25T01:00:00Z'))
  const revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:backup', revokeObjectURL: revoke })
  vi.mocked(onlineApi).mockResolvedValue(
    new Response('Date;Type;Account;Category;Tags;Comment;Amount')
  )
  let filename = ''
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    filename = this.download
  })
  await exportMovementsCsv(
    '/transactions?type=Expense&accountId=cash&min=4.75&page=9&perPage=15&sortBy=amount&order=desc'
  )
  expect(onlineApi).toHaveBeenCalledWith(
    '/transactions/export?type=Expense&accountId=cash&min=4.75'
  )
  expect(filename).toBe('porkex-backup-2026-10-24.csv')
  expect(document.querySelector('a[download]')).toBeNull()
  await vi.advanceTimersByTimeAsync(60_000)
  expect(revoke).toHaveBeenCalledWith('blob:backup')
})
