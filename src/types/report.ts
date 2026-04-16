export interface LoadingProgress {
  step: string
  stepIndex: number
  totalSteps: number
  detail?: string
  percent: number
}

export interface DeltaReportData {
  metadata: ReportMetadata
  overview: OverviewData
  pnl_analysis: PnlAnalysisData
  instruments: InstrumentData
  funding: FundingData
  expiry: ExpiryData
  risk_metrics: RiskMetricsData
  charges: ChargesData
  open_portfolio: OpenPortfolioData
  trade_log: TradeLogData
  projections: ProjectionData
  what_ifs: WhatIfScenario[]
  streaks: StreakData
}

export interface ReportMetadata {
  date_range: { start: string; end: string }
  total_trades: number
  tokens_traded: number
  platform: 'india' | 'global'
  fetch_timestamp: string
}

export interface OverviewData {
  net_realized_pnl: number
  unrealized_pnl: number
  total_fees: number
  total_funding_pnl: number
  net_after_fees: number
  win_rate: number
  total_trades: number
  tokens_traded: number
  winners: number
  losers: number
  breakeven: number
  avg_winner: number
  avg_loser: number
  win_loss_ratio: number
  best_trade: number
  worst_trade: number
  long_pnl: number
  short_pnl: number
  perps_pnl: number
  options_pnl: number
  equity_curve: { date: string; pnl: number; cumulative: number }[]
  pnl_distribution: HistogramBin[]
  return_distribution: HistogramBin[]
}

export interface HistogramBin {
  range: string
  count: number
  min: number
  max: number
}

export interface PnlAnalysisData {
  monthly: MonthlyPnl[]
  daily_pnl: { date: string; pnl: number; trades: number }[]
  hourly_pnl: { hour: number; avg_pnl: number; trades: number; win_rate: number }[]
  day_of_week: { day: string; avg_pnl: number; trades: number; win_rate: number }[]
  trades_per_day: { date: string; count: number }[]
  top_contributors: { underlying: string; pnl: number }[]
  top_detractors: { underlying: string; pnl: number }[]
  waterfall: { underlying: string; pnl: number; cumulative: number }[]
  pareto: { underlying: string; pnl: number; cumulative_pct: number }[]
  pareto_80_index: number
}

export interface MonthlyPnl {
  month: string
  trades: number
  gross_pnl: number
  fees: number
  funding: number
  net_pnl: number
  win_rate: number
  best: number
  worst: number
}

export interface InstrumentData {
  perps_pnl: number
  perps_count: number
  options_pnl: number
  options_count: number
  calls_pnl: number
  calls_count: number
  puts_pnl: number
  puts_count: number
  pnl_by_underlying: UnderlyingPnl[]
  capital_vs_returns: { underlying: string; capital: number; return_pct: number; pnl: number }[]
  long_vs_short: { underlying: string; long_pnl: number; short_pnl: number }[]
  correlation_matrix: { tokens: string[]; matrix: number[][] }
}

export interface UnderlyingPnl {
  underlying: string
  num_trades: number
  pnl: number
  win_rate: number
  avg_return: number
  capital: number
}

export interface FundingData {
  total_funding_pnl: number
  funding_by_token: { token: string; pnl: number; count: number }[]
  daily_funding: { date: string; pnl: number }[]
  cumulative_funding: { date: string; cumulative: number }[]
  monthly_funding_vs_trading: { month: string; trading_pnl: number; funding_pnl: number }[]
  avg_funding_rate: number
  funding_paid_as_long: number
  funding_received_as_short: number
}

export interface ExpiryData {
  has_options: boolean
  by_expiry_type: { type: string; pnl: number; count: number; win_rate: number }[]
  by_dte: { bucket: string; pnl: number; count: number }[]
  by_expiry_date: { date: string; pnl: number; count: number }[]
}

export interface RiskMetricsData {
  sharpe_ratio: number
  sortino_ratio: number
  profit_factor: number
  payoff_ratio: number
  max_drawdown: number
  max_drawdown_duration_days: number
  calmar_ratio: number
  daily_std_dev: number
  consecutive_wins: number
  consecutive_losses: number
  recovery_factor: number
  expectancy: number
  equity_curve: { date: string; cumulative: number }[]
  drawdown_curve: { date: string; drawdown: number }[]
  pnl_distribution: HistogramBin[]
  return_distribution: HistogramBin[]
  risk_reward_scatter: { pnl: number; capital: number; return_pct: number; underlying: string }[]
}

export interface ChargesData {
  total_fees: number
  fees_pct_pnl: number
  fees_pct_volume: number
  maker_fees: number
  taker_fees: number
  maker_fill_rate: number
  gst_estimate: number
  fees_by_instrument: { instrument: string; fees: number }[]
  fees_by_token: { token: string; fees: number }[]
  trades_to_cover_fees: number
}

export interface OpenPortfolioData {
  open_count: number
  total_unrealized_pnl: number
  max_profit: number
  max_loss: number
  positions: OpenPosition[]
  concentration: { underlying: string; value: number }[]
  unrealized_by_position: { symbol: string; pnl: number }[]
}

export interface OpenPosition {
  symbol: string
  underlying: string
  type: 'perpetual' | 'call' | 'put'
  size: number
  direction: 'long' | 'short'
  entry_price: number
  mark_price: number
  unrealized_pnl: number
  pnl_pct: number
  margin: number
  leverage: number
  liquidation_price: number
  realized_funding: number
}

export interface TradeLogData {
  trades: MatchedTrade[]
}

export interface MatchedTrade {
  id: string
  underlying: string
  product_symbol: string
  instrument_type: 'perpetual' | 'call' | 'put'
  direction: 'long' | 'short'
  entry_time: string
  exit_time: string
  entry_price: number
  exit_price: number
  size: number
  notional_value: number
  pnl: number
  pnl_pct: number
  fees: number
  funding_pnl: number
  net_pnl: number
  hold_duration_hours: number
  leverage: number
  role: 'maker' | 'taker' | 'mixed'
}

export interface ProjectionData {
  overall: Projection | null
  categories: {
    perps: Projection | null
    options: Projection | null
    calls: Projection | null
    puts: Projection | null
  }
  edges: EdgeInsight[]
  avoid: AvoidInsight[]
}

export interface Projection {
  apr: number
  apy_1yr: number
  apy_5yr: number
  apy_10yr: number
  value_1yr: number
  value_3yr: number
  value_5yr: number
  value_10yr: number
  starting_capital: number
  daily_return_pct: number
}

export interface EdgeInsight {
  label: string
  underlying: string
  instrument_type: string
  expiry_bucket?: string
  apr: number
  value_1yr: number
  trade_count: number
  win_rate: number
}

export interface AvoidInsight {
  label: string
  apr: number
  total_loss: number
  trade_count: number
}

export interface WhatIfScenario {
  id: string
  label: string
  icon: string
  original_pnl: number
  new_pnl: number
  improvement_pct: number
  detail: string
}

export interface StreakData {
  current_win_streak: number
  best_win_streak: number
  current_loss_streak: number
  worst_loss_streak: number
  profitable_month_streak: number
  best_month_streak: number
  achievements: Achievement[]
}

export interface Achievement {
  id: string
  name: string
  icon: string
  description: string
  unlocked: boolean
  unlocked_date?: string
}
