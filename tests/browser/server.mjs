// Production PWA shell with a deterministic local API, or an explicitly local
// real API for the integration suite. Never uses the project's .env API URL.
import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, extname } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const upstream = process.env.PORKEX_TEST_API_ORIGIN
if (upstream && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(upstream))
  throw new Error('Integration tests only accept a local API')
const build = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_API_BASE: '' }
})
if (build.status !== 0) process.exit(build.status || 1)
const states = new Map()
let version = 1
function state(key) {
  if (!states.has(key))
    states.set(key, {
      rows: [],
      tags: [],
      rules: [],
      categoryComparisons: {},
      topCategories: [],
      requests: [],
      failure: 0,
      recurring: 'ready',
      delay: 0,
      active: 0,
      maxActive: 0
    })
  return states.get(key)
}
const user = { id: 1, name: 'Personal', email: 'owner@example.com', currency: 'USD' }
const categories = [
  { id: 1, userId: 1, name: 'Food', type: 'EXPENSE', color: '#EA4335' },
  { id: 2, userId: 1, name: 'Salary', type: 'INCOME', color: '#34A853' }
].map(c => ({
  ...c,
  total: 0,
  transactionCount: 0,
  allTimeCount: 0,
  budgetCount: 0,
  recurringCount: 0
}))
const json = (res, value, status = 200, headers = {}) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...headers
  })
  res.end(JSON.stringify(value))
}
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    const key = (req.headers.authorization || 'Bearer anonymous').slice(7)
    const db = state(key)
    const bytes = []
    for await (const chunk of req) bytes.push(chunk)
    const bodyText = Buffer.concat(bytes).toString()
    const body = bodyText ? JSON.parse(bodyText) : {}
    if (url.pathname === '/__test/version') {
      version++
      return json(res, { version })
    }
    if (url.pathname === '/__test/state') {
      if (req.method === 'POST') Object.assign(db, body)
      return json(res, db)
    }
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
      if (upstream) {
        const response = await fetch(upstream + req.url, {
          method: req.method,
          headers: { ...req.headers, host: new URL(upstream).host },
          ...(bodyText ? { body: bodyText } : {})
        })
        res.writeHead(response.status, Object.fromEntries(response.headers))
        return res.end(Buffer.from(await response.arrayBuffer()))
      }
      db.requests.push({
        method: req.method,
        path: req.url,
        body,
        zone: req.headers['x-porkex-time-zone']
      })
      if (url.pathname === '/auth/config') return json(res, { registrationEnabled: false })
      if (url.pathname === '/auth/login') return json(res, { token: body.email, user })
      const headers = { 'X-Porkex-Recurring-State': db.recurring }
      if (db.failure) return json(res, { error: 'Controlled rejection' }, db.failure, headers)
      if (req.method !== 'GET' && db.delay) {
        db.maxActive = Math.max(db.maxActive, ++db.active)
        await new Promise(r => setTimeout(r, db.delay))
        db.active--
      }
      const decorate = row => ({
        ...row,
        comment: row.comment ?? row.description ?? '',
        tags: row.tagIds
          ? db.tags
              .filter(tag => row.tagIds.some(id => tag.id === id || tag.aliases?.includes(id)))
              .sort((a, b) => a.position - b.position)
          : (row.tags ?? [])
      })
      if (url.pathname === '/api/tags') {
        if (req.method === 'POST') {
          let tag = db.tags.find(
            tag => tag.id === body.id || tag.name.toLowerCase() === body.name.trim().toLowerCase()
          )
          if (!tag) {
            tag = {
              id: body.id,
              name: body.name.trim(),
              aliases: [body.id],
              position: db.tags.length
            }
            db.tags.push(tag)
          } else if (!tag.aliases.includes(body.id)) tag.aliases.push(body.id)
          return json(res, tag, 201, headers)
        }
        return json(
          res,
          [...db.tags].sort((a, b) => a.position - b.position),
          200,
          headers
        )
      }
      if (url.pathname === '/api/tags/order') {
        const ordered = body.ids
          .map(id => db.tags.find(tag => tag.id === id || tag.aliases?.includes(id)))
          .filter(Boolean)
        db.tags = [...ordered, ...db.tags.filter(tag => !ordered.includes(tag))].map(
          (tag, position) => ({ ...tag, position })
        )
        return json(res, db.tags, 200, headers)
      }
      if (url.pathname.startsWith('/api/tags/')) {
        const id = url.pathname.split('/')[3]
        const tag = db.tags.find(tag => tag.id === id || tag.aliases?.includes(id))
        if (!tag) return json(res, { error: 'Tag not found' }, 404, headers)
        if (req.method === 'DELETE') db.tags = db.tags.filter(item => item !== tag)
        else tag.name = body.name
        return json(res, tag, 200, headers)
      }
      if (/^\/api\/recurring\/\d+\/occurrences\//.test(url.pathname)) {
        const [, , , id, , day] = url.pathname.split('/')
        const rule = db.rules.find(rule => rule.id === Number(id))
        if (!rule || rule.nextDate.slice(0, 10) !== day)
          return json(res, { error: 'Occurrence changed' }, 409, headers)
        if (body.kind === 'SKIP') {
          const following = new Date(rule.nextDate)
          following.setUTCDate(following.getUTCDate() + 1)
          rule.nextDate = following.toISOString()
          rule.nextException = null
        } else
          rule.nextException = {
            date: day,
            amount: Number(body.amount),
            comment: body.comment ?? '',
            categoryId: body.categoryId,
            tags: db.tags.filter(tag => body.tagIds?.includes(tag.id))
          }
        return json(res, { success: true }, 200, headers)
      }
      if (url.pathname === '/api/analytics/category-comparison') {
        const mode = url.searchParams.get('mode') || 'month'
        return json(
          res,
          {
            mode,
            partial: mode !== 'month',
            categoryComparison: db.categoryComparisons[mode] ?? []
          },
          200,
          headers
        )
      }
      if (url.pathname === '/api/analytics/comparison') {
        const mode = url.searchParams.get('mode') || 'year'
        const anchor = url.searchParams.get('anchor') || new Date().toISOString().slice(0, 10)
        const year = Number(anchor.slice(0, 4))
        const zero = { income: 0, expense: 0, net: 0, count: 0 }
        return json(
          res,
          {
            mode,
            partial: false,
            ranges: {
              current: {
                from: mode === 'year' ? year + '-01-01' : anchor,
                to: mode === 'year' ? year + '-12-31' : anchor
              },
              previous: { from: year - 1 + '-01-01', to: year - 1 + '-12-31' }
            },
            current: zero,
            previous: zero,
            delta: {
              income: { absolute: 0, percent: 0 },
              expense: { absolute: 0, percent: 0 },
              net: { absolute: 0, percent: 0 }
            },
            buckets: []
          },
          200,
          headers
        )
      }
      if (url.pathname === '/api/categories') return json(res, categories, 200, headers)
      if (url.pathname === '/api/profile')
        return json(res, { ...user, createdAt: new Date().toISOString() }, 200, headers)
      if (url.pathname === '/api/budgets')
        return json(res, { budgets: [], totals: [] }, 200, headers)
      if (url.pathname === '/api/recurring') return json(res, db.rules, 200, headers)
      if (url.pathname === '/api/analytics')
        return json(
          res,
          {
            range: {
              months: Number(url.searchParams.get('months') || 6),
              days: Number(url.searchParams.get('days') || 30)
            },
            monthlyData: [],
            trendData: [],
            topCategories: db.topCategories,
            categoryComparison: [],
            insights: {
              currentMonthIncome: 0,
              currentMonthExpense: 0,
              lastMonthExpense: 0,
              expenseChangePercent: 0,
              avgDailyExpense: 0,
              savingsRate: 0
            }
          },
          200,
          headers
        )
      if (url.pathname === '/api/dashboard') {
        const totalExpense = db.rows
          .filter(r => r.type === 'EXPENSE')
          .reduce((sum, r) => sum + r.amount, 0)
        const totalIncome = db.rows
          .filter(r => r.type === 'INCOME')
          .reduce((sum, r) => sum + r.amount, 0)
        return json(
          res,
          {
            globalBalance: totalIncome - totalExpense,
            totalIncome,
            totalExpense,
            transactionCount: db.rows.length,
            recentTransactions: db.rows.map(decorate),
            pieChartData: []
          },
          200,
          headers
        )
      }
      if (url.pathname === '/api/transactions') {
        if (req.method === 'POST') {
          let row = db.rows.find(r => r.clientId === body.clientId)
          if (!row) {
            row = {
              ...body,
              id: db.rows.length + 1,
              userId: 1,
              createdAt: new Date().toISOString(),
              category: categories.find(c => c.id === body.categoryId),
              recurringId: null
            }
            db.rows.push(row)
          }
          return json(res, decorate(row), 201, headers)
        }
        let rows = db.rows
        if (url.searchParams.get('type'))
          rows = rows.filter(r => r.type === url.searchParams.get('type'))
        if (url.searchParams.get('search'))
          rows = rows.filter(r => r.description.includes(url.searchParams.get('search')))
        const perPage = Number(url.searchParams.get('perPage') || 15)
        const page = Number(url.searchParams.get('page') || 1)
        return json(
          res,
          {
            items: rows.slice((page - 1) * perPage, page * perPage).map(decorate),
            total: rows.length,
            page,
            perPage,
            totalPages: Math.max(1, Math.ceil(rows.length / perPage))
          },
          200,
          headers
        )
      }
      if (/^\/api\/transactions\/\d+$/.test(url.pathname)) {
        const id = Number(url.pathname.split('/').at(-1))
        const row = db.rows.find(r => r.id === id)
        if (!row) return json(res, { error: 'Not found' }, 404, headers)
        if (req.method === 'DELETE') db.rows = db.rows.filter(r => r.id !== id)
        else Object.assign(row, body)
        return json(res, row, 200, headers)
      }
      return json(res, { error: 'Unknown fixture route' }, 404, headers)
    }
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    let file = resolve(root, 'dist', relative || 'index.html')
    if (
      !file.startsWith(resolve(root, 'dist') + '/') &&
      !file.startsWith(resolve(root, 'dist') + '\\')
    )
      return json(res, {}, 403)
    if (!existsSync(file)) file = resolve(root, 'dist/index.html')
    const types = {
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.html': 'text/html',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.webmanifest': 'application/manifest+json'
    }
    res.writeHead(200, {
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    })
    let data = readFileSync(file)
    if (relative === 'sw.js')
      data = Buffer.concat([data, Buffer.from(`\n// local fixture version ${version}\n`)])
    res.end(data)
  } catch (error) {
    json(res, { error: error.message }, 500)
  }
})
server.listen(4178, 'localhost', () => console.log('Porkex test shell http://localhost:4178'))
