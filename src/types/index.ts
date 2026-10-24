// Shapes returned by the Porkex API. They mirror the routes in
// porkex-backend/src/routes (see api.ts and auth.ts).

export type TxType = 'Income' | 'Expense'

export interface Account {
  isGoal?: boolean
  targetAmount?: number | null
  id: string
  userId: number
  name: string
  openingBalance: number
  balance: number
  isMain: boolean
  archived: boolean
}
export interface Transfer {
  id: string
  sourceId: string
  destinationId: string
  amount: number
  date: string
  comment: string
  source: Account
  destination: Account
}

export interface MovementDraft {
  type: TxType
  amount: number
  comment: string
  categoryId: number
  accountId?: string | null
  tagIds: string[]
}
export interface Favorite extends MovementDraft {
  id: string
  name: string
}

/** The period filters the transactions and categories screens offer. */
export type PeriodFilter = 'day' | 'week' | 'month' | 'year'

export type WeekDay =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY'

export type DecimalSeparator = '.' | ','

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
  /** Recurring rules attached: they go with the category as well. */
  recurringCount: number
}

export interface Tag {
  id: string
  name: string
  position: number
  aliases?: string[]
}

export interface Transaction {
  accountId?: string | null
  account?: Account | null
  editedAt?: string | null
  lastEditId?: string | null
  comment?: string
  tags?: Tag[]
  id: number
  amount: number
  type: TxType
  description: string
  date: string
  createdAt: string
  categoryId: number
  userId: number
  category: Category | null
  /** Set when a recurring rule generated the movement. */
  recurringId: number | null
}

export interface User {
  id: number
  name: string
  email: string
  currency?: string
  defaultPeriod?: PeriodFilter
  firstDayOfWeek?: WeekDay
  decimalSeparator?: DecimalSeparator
}

export interface Profile {
  id: number
  name: string
  email: string
  currency: string
  defaultPeriod: PeriodFilter
  firstDayOfWeek: WeekDay
  decimalSeparator: DecimalSeparator
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

export type RecurringFrequency = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'

export interface RecurringRule {
  accountId?: string | null
  nextException?: {
    date: string
    amount: number
    comment: string
    categoryId: number
    tags: Tag[]
  } | null
  id: number
  userId: number
  categoryId: number
  type: TxType
  amount: number
  description: string
  frequency: RecurringFrequency
  /** "Every N": 2 + WEEK is a fortnight. 1–12. */
  interval: number
  /** Anchor day of the schedule, as UTC midnight. */
  startDate: string
  /** Inclusive last day, or null when it runs forever. */
  endDate: string | null
  /** Next occurrence still to materialize. */
  nextDate: string
  active: boolean
  createdAt: string
  updatedAt: string
  category: Pick<Category, 'id' | 'name' | 'color' | 'type'> | null
}
