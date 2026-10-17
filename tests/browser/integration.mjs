// The backend harness overrides inherited Turso credentials and deletes its
// temporary SQLite database after the browser runner and API have exited.
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'
const backend = resolve(process.env.PORKEX_BACKEND_DIR || '../porkex-backend')
const { withServer, createTestUser } = await import(
  pathToFileURL(resolve(backend, 'tests/helpers.mjs'))
)
await withServer('frontend-integration', async ctx => {
  const { user } = await createTestUser(ctx)
  const status = await new Promise((done, reject) => {
    const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        PORKEX_TEST_API_ORIGIN: ctx.base,
        PORKEX_TEST_TOKEN: ctx.state.token,
        PORKEX_TEST_USER: JSON.stringify(user)
      }
    })
    child.once('error', reject)
    child.once('exit', code => done(code))
  })
  if (status !== 0) throw new Error(`Local browser/API integration failed: ${status}`)
})
