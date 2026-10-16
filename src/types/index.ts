// Shapes returned by the Porkex API. They mirror the routes in
// porkex-backend/src/routes (see api.ts and auth.ts).

export type TxType = 'INCOME' | 'EXPENSE'

export interface Category {
  id: number
  name: string
  type: TxType
  color: string | null
  userId: number
  /** Movements inside the selected period, if one was requested. */
  transactionCount: number
  /** Sum of the amounts inside the selected period. */
  total: number
  /** Movements ever: this is what decides whether a delete needs a target. */
  allTimeCount: number
  /** Budgets attached to it: deleting the category deletes them too. */
  budgetCount: number
}

export interface Transaction {
  id: number
  amount: number
  type: TxType
  description: string
  date: string
  createdAt: string
  categoryId: number
  userId: number
  category: Category | null
}

export interface User {
  id: number
  name: string
  email: string
  currency?: string
}

export interface Profile {
  id: number
  name: string
  email: string
  currency: string
  createdAt: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface PieSlice {
  label: string
  value: number
  color: string
}

export interface DashboardResponse {
  globalBalance: number
  totalIncome: number
  totalExpense: number
  transactionCount: number
  recentTransactions: Transaction[]
  pieChartData: PieSlice[]
}

export interface CategorySummary {
  name: string
  color: string
  value: number
  percent: number
}

export interface CategoryComparison {
  name: string
  color: string
  current: number
  previous: number
  changePercent: number
}

export interface MonthPoint {
  month: string
  income: number
  expense: number
  net: number
  avgExpense: number
}

export interface TrendPoint {
  date: string
  balance: number
}

export interface AnalyticsResponse {
  range: { months: number; days: number }
  monthlyData: MonthPoint[]
  trendData: TrendPoint[]
  topCategories: CategorySummary[]
  categoryComparison: CategoryComparison[]
  insights: {
    currentMonthIncome: number
    currentMonthExpense: number
    lastMonthExpense: number
    expenseChangePercent: number
    avgDailyExpense: number
    savingsRate: number
  }
}

export interface TransactionsResponse {
  items: Transaction[]
  total: number
  page: number
  perPage: number
  totalPages: number
}

export interface CurrencyOption {
  symbol: string
  code: string
  name: string
}

export type BudgetPeriod = 'WEEK' | 'MONTH'

export interface Budget {
  id: number
  categoryId: number
  amount: number
  period: BudgetPeriod
  spent: number
  remaining: number
  usagePercent: number
  overBudget: boolean
  category: Pick<Category, 'id' | 'name' | 'color' | 'type'>
}

export interface BudgetTotals {
  period: BudgetPeriod
  amount: number
  spent: number
  overBudget: boolean
  count: number
}

export interface BudgetsResponse {
  budgets: Budget[]
  /** One entry per period: mixing WEEK and MONTH would count movements twice. */
  totals: BudgetTotals[]
}
