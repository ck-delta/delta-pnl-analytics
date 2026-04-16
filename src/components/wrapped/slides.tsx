import { StorySlide } from './StorySlide'
import { classifyTrader } from './TraderIdentity'
import { formatCurrency, formatCurrencyFull, formatPercent, formatDate, pnlColor } from '../../lib/utils'
import type { DeltaReportData, MatchedTrade, WhatIfScenario, UnderlyingPnl, Achievement } from '../../types/report'

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function heroNum(value: string, color?: string) {
  return (
    <span
      className="font-mono"
      style={{
        fontSize: '3.5rem',
        fontWeight: 800,
        lineHeight: 1.1,
        color: color ?? 'var(--color-text-on-bg)',
        display: 'block',
      }}
    >
      {value}
    </span>
  )
}

function label(text: string) {
  return (
    <span
      style={{
        fontSize: '0.75rem',
        fontWeight: 600,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.08em',
        color: 'var(--color-text-secondary)',
        display: 'block',
        marginBottom: 4,
      }}
    >
      {text}
    </span>
  )
}

function body(text: string, color?: string) {
  return (
    <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: color ?? 'var(--color-text-secondary)', margin: '8px 0' }}>
      {text}
    </p>
  )
}

function spacer(h = 24) {
  return <div style={{ height: h }} />
}

function miniCard(children: React.ReactNode) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  )
}

function progressBar(value: number, max: number, color: string) {
  const pct = max > 0 ? Math.min(Math.max(value / max, 0), 1) * 100 : 0
  return (
    <div style={{ height: 6, borderRadius: 3, background: 'var(--color-bg-tertiary)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: color, transition: 'width 600ms ease' }} />
    </div>
  )
}

// Gradients for each slide
const gradients = {
  intro: 'linear-gradient(135deg, #101013 0%, #1a1420 50%, #101013 100%)',
  identity: 'linear-gradient(135deg, #101013 0%, #1c1810 50%, #101013 100%)',
  best: 'linear-gradient(135deg, #101013 0%, #0a1a14 50%, #101013 100%)',
  tough: 'linear-gradient(135deg, #101013 0%, #1a1014 50%, #101013 100%)',
  working: 'linear-gradient(135deg, #101013 0%, #0f1520 50%, #101013 100%)',
  notWorking: 'linear-gradient(135deg, #101013 0%, #1a1510 50%, #101013 100%)',
  whatIf: 'linear-gradient(135deg, #101013 0%, #181020 50%, #101013 100%)',
  token: 'linear-gradient(135deg, #101013 0%, #10181a 50%, #101013 100%)',
  edge: 'linear-gradient(135deg, #101013 0%, #0f1a10 50%, #101013 100%)',
  grade: 'linear-gradient(135deg, #101013 0%, #1a1418 50%, #101013 100%)',
  achievements: 'linear-gradient(135deg, #101013 0%, #1a1a10 50%, #101013 100%)',
  share: 'linear-gradient(135deg, #101013 0%, #1a1210 50%, #101013 100%)',
}

// ---------------------------------------------------------------------------
// Slide 1 — YourTradingYear
// ---------------------------------------------------------------------------

interface SlideProps {
  report: DeltaReportData
}

export function YourTradingYear({ report }: SlideProps) {
  const { metadata, overview } = report
  const startDate = formatDate(metadata.date_range.start)
  const endDate = formatDate(metadata.date_range.end)

  return (
    <StorySlide background={gradients.intro}>
      {label('Your Trading Year')}
      {spacer(12)}
      {heroNum(overview.total_trades.toLocaleString())}
      <span style={{ fontSize: '1.25rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
        trades executed
      </span>
      {spacer(32)}
      <div style={{ display: 'flex', gap: 32 }}>
        <div>
          {label('Tokens')}
          <span className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-brand-text)' }}>
            {metadata.tokens_traded}
          </span>
        </div>
        <div>
          {label('Period')}
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
            {startDate} &mdash; {endDate}
          </span>
        </div>
      </div>
      {spacer(40)}
      <span style={{ fontSize: '0.875rem', color: 'var(--color-brand-text)', fontWeight: 600 }}>
        Let&apos;s dive in &rarr;
      </span>
    </StorySlide>
  )
}

// ---------------------------------------------------------------------------
// Slide 2 — YourIdentity
// ---------------------------------------------------------------------------

export function YourIdentity({ report }: SlideProps) {
  const identity = classifyTrader(report)

  return (
    <StorySlide background={gradients.identity}>
      {label('Your Trader Persona')}
      {spacer(8)}
      <span style={{ fontSize: '4rem', display: 'block', lineHeight: 1 }}>{identity.emoji}</span>
      {spacer(8)}
      <span
        style={{
          fontSize: '2rem',
          fontWeight: 800,
          color: 'var(--color-brand-text)',
          display: 'block',
          lineHeight: 1.2,
        }}
      >
        {identity.persona}
      </span>
      {spacer(12)}
      {body(identity.description)}
      {spacer(20)}
      {miniCard(
        <>
          {label('Style')}
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>{identity.style}</span>
          {spacer(12)}
          {label('Top Instrument')}
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>{identity.topInstrument}</span>
        </>
      )}
      {spacer(8)}
      <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
        {identity.statLine}
      </span>
    </StorySlide>
  )
}

// ---------------------------------------------------------------------------
// Slide 3 — BestMoment
// ---------------------------------------------------------------------------

export function BestMoment({ report }: SlideProps) {
  const trades = report.trade_log.trades
  if (trades.length === 0) {
    return (
      <StorySlide background={gradients.best}>
        {label('Best Moment')}
        {spacer(12)}
        {body('No trades recorded yet.')}
      </StorySlide>
    )
  }

  const best: MatchedTrade = trades.reduce((a, b) => (b.net_pnl > a.net_pnl ? b : a), trades[0])
  const date = formatDate(best.exit_time || best.entry_time)
  const typeLabel = best.instrument_type === 'perpetual' ? 'perp' : best.instrument_type

  return (
    <StorySlide background={gradients.best}>
      {label('Your Best Moment')}
      {spacer(12)}
      {heroNum(formatCurrencyFull(best.net_pnl), 'var(--color-positive-text)')}
      {spacer(12)}
      <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
        {best.underlying} {typeLabel}
      </span>
      {spacer(4)}
      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
        {best.direction} &middot; {date}
      </span>
      {spacer(24)}
      {body(`A single ${best.underlying} ${best.direction} ${typeLabel} that returned ${formatPercent(best.pnl_pct)}. This was the trade that defined your best day.`)}
    </StorySlide>
  )
}

// ---------------------------------------------------------------------------
// Slide 4 — ToughestLesson
// ---------------------------------------------------------------------------

export function ToughestLesson({ report }: SlideProps) {
  const trades = report.trade_log.trades
  if (trades.length === 0) {
    return (
      <StorySlide background={gradients.tough}>
        {label('Toughest Lesson')}
        {spacer(12)}
        {body('No trades to review.')}
      </StorySlide>
    )
  }

  const worst: MatchedTrade = trades.reduce((a, b) => (b.net_pnl < a.net_pnl ? b : a), trades[0])
  const date = formatDate(worst.exit_time || worst.entry_time)
  const typeLabel = worst.instrument_type === 'perpetual' ? 'perp' : worst.instrument_type

  return (
    <StorySlide background={gradients.tough}>
      {label('Toughest Lesson')}
      {spacer(12)}
      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
        Every great trader has setbacks.
      </span>
      {spacer(16)}
      <span
        className="font-mono"
        style={{
          fontSize: '2.5rem',
          fontWeight: 800,
          color: 'var(--color-text-tertiary)',
          display: 'block',
          lineHeight: 1.1,
        }}
      >
        {formatCurrencyFull(worst.net_pnl)}
      </span>
      {spacer(12)}
      <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
        {worst.underlying} {worst.direction} {typeLabel}
      </span>
      {spacer(4)}
      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>
        {date}
      </span>
      {spacer(24)}
      {body('The biggest lessons come from the toughest moments. What matters is how you adapt.')}
    </StorySlide>
  )
}

// ---------------------------------------------------------------------------
// Slide 5 — WhatsWorking
// ---------------------------------------------------------------------------

export function WhatsWorking({ report }: SlideProps) {
  const { overview, instruments, streaks, charges } = report
  const strengths: string[] = []

  if (overview.win_loss_ratio > 1.2) {
    strengths.push(`Your winners are ${overview.win_loss_ratio.toFixed(1)}x your losers`)
  }

  // Find best asset by win rate with enough trades
  const goodAssets = instruments.pnl_by_underlying
    .filter((u: UnderlyingPnl) => u.num_trades >= 5 && u.win_rate > 50)
    .sort((a: UnderlyingPnl, b: UnderlyingPnl) => b.win_rate - a.win_rate)
  if (goodAssets.length > 0) {
    const a = goodAssets[0]
    strengths.push(`${a.underlying} is your edge with a ${a.win_rate.toFixed(0)}% win rate`)
  }

  if (streaks.best_win_streak >= 5) {
    strengths.push(`${streaks.best_win_streak}-trade win streak shows you can lock in`)
  }

  if (overview.win_rate >= 50) {
    strengths.push(`${overview.win_rate.toFixed(0)}% win rate means you\'re right more than you\'re wrong`)
  }

  if (charges.maker_fill_rate >= 30) {
    strengths.push(`${charges.maker_fill_rate.toFixed(0)}% maker fills keep your fees low`)
  }

  // Take top 3
  const display = strengths.slice(0, 3)

  if (display.length === 0) {
    display.push('Still building your edge. Keep tracking and learning.')
  }

  return (
    <StorySlide background={gradients.working}>
      {label("What's Working")}
      {spacer(16)}
      <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-positive-text)', display: 'block' }}>
        Your Strengths
      </span>
      {spacer(16)}
      {display.map((s, i) => (
        <div key={i} style={{ marginBottom: 16 }}>
          {miniCard(
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ color: 'var(--color-positive-text)', fontSize: '1.25rem', lineHeight: 1 }}>
                {'\u2713'}
              </span>
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
                {s}
              </span>
            </div>
          )}
        </div>
      ))}
    </StorySlide>
  )
}

// ---------------------------------------------------------------------------
// Slide 6 — WhatsNotWorking
// ---------------------------------------------------------------------------

export function WhatsNotWorking({ report }: SlideProps) {
  const { overview, instruments, charges } = report
  const weaknesses: string[] = []

  if (overview.win_rate < 40) {
    const lossRatio = Math.round((1 - overview.win_rate / 100) * 4)
    weaknesses.push(`Low win rate \u2014 you lose roughly ${lossRatio} of every 4 trades`)
  }

  if (charges.maker_fill_rate < 10) {
    weaknesses.push(`${(100 - charges.maker_fill_rate).toFixed(0)}% taker fills \u2014 you\'re paying max fees`)
  }

  // Find worst token
  const worstTokens = [...instruments.pnl_by_underlying]
    .filter((u: UnderlyingPnl) => u.pnl < 0)
    .sort((a: UnderlyingPnl, b: UnderlyingPnl) => a.pnl - b.pnl)
  if (worstTokens.length > 0) {
    const w = worstTokens[0]
    weaknesses.push(`${w.underlying} is bleeding: ${formatCurrency(w.pnl)}`)
  }

  if (overview.avg_loser !== 0 && Math.abs(overview.avg_loser) > Math.abs(overview.avg_winner)) {
    weaknesses.push('Your avg loser is bigger than your avg winner \u2014 cut losers faster')
  }

  if (charges.fees_pct_pnl > 50 && overview.net_realized_pnl > 0) {
    weaknesses.push(`Fees eat ${charges.fees_pct_pnl.toFixed(0)}% of your gross P&L`)
  }

  const display = weaknesses.slice(0, 3)

  if (display.length === 0) {
    display.push('No major red flags detected. Keep it up.')
  }

  return (
    <StorySlide background={gradients.notWorking}>
      {label("What Needs Work")}
      {spacer(16)}
      <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-warning)', display: 'block' }}>
        Areas to Improve
      </span>
      {spacer(16)}
      {display.map((s, i) => (
        <div key={i} style={{ marginBottom: 16 }}>
          {miniCard(
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ color: 'var(--color-warning)', fontSize: '1.25rem', lineHeight: 1 }}>
                {'\u26A0'}
              </span>
              <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
                {s}
              </span>
            </div>
          )}
        </div>
      ))}
    </StorySlide>
  )
}

// ---------------------------------------------------------------------------
// Slide 7 — WhatIf
// ---------------------------------------------------------------------------

export function WhatIf({ report }: SlideProps) {
  const scenarios = report.what_ifs
  if (!scenarios || scenarios.length === 0) {
    return (
      <StorySlide background={gradients.whatIf}>
        {label('What If')}
        {spacer(12)}
        {body('No what-if scenarios available.')}
      </StorySlide>
    )
  }

  const totalImprovement = scenarios.reduce((sum: number, s: WhatIfScenario) => sum + (s.new_pnl - s.original_pnl), 0)

  return (
    <StorySlide background={gradients.whatIf}>
      {label('What If...')}
      {spacer(12)}
      <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--color-accent-purple-text)', display: 'block' }}>
        Small changes, big impact
      </span>
      {spacer(16)}
      {scenarios.slice(0, 4).map((s: WhatIfScenario) => (
        <div key={s.id} style={{ marginBottom: 12 }}>
          {miniCard(
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: '1rem' }}>{s.icon}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {s.label}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="font-mono" style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>
                  {formatCurrency(s.original_pnl)}
                </span>
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: '0.75rem' }}>&rarr;</span>
                <span className="font-mono" style={{ fontSize: '0.8rem', color: pnlColor(s.new_pnl), fontWeight: 700 }}>
                  {formatCurrency(s.new_pnl)}
                </span>
                {s.improvement_pct > 0 && (
                  <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--color-positive-text)' }}>
                    +{s.improvement_pct.toFixed(0)}%
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      ))}
      {spacer(8)}
      {miniCard(
        <div style={{ textAlign: 'center' }}>
          {label('Combined Impact')}
          <span className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: pnlColor(totalImprovement) }}>
            {formatCurrency(totalImprovement)}
          </span>
        </div>
      )}
    </StorySlide>
  )
}

// ---------------------------------------------------------------------------
// Slide 8 — TokenSpotlight
// ---------------------------------------------------------------------------

export function TokenSpotlight({ report }: SlideProps) {
  const tokens = report.instruments.pnl_by_underlying
  if (!tokens || tokens.length === 0) {
    return (
      <StorySlide background={gradients.token}>
        {label('Token Spotlight')}
        {spacer(12)}
        {body('No token data available.')}
      </StorySlide>
    )
  }

  // Sort by number of trades, take top 3
  const top = [...tokens].sort((a: UnderlyingPnl, b: UnderlyingPnl) => b.num_trades - a.num_trades).slice(0, 3)

  function verdict(u: UnderlyingPnl): { text: string; color: string } {
    if (u.pnl > 0 && u.win_rate >= 50) return { text: 'Your edge', color: 'var(--color-positive-text)' }
    if (u.pnl > 0) return { text: 'Trade it', color: 'var(--color-positive-text)' }
    if (u.win_rate >= 45) return { text: 'Mixed bag', color: 'var(--color-warning)' }
    return { text: 'Avoid', color: 'var(--color-negative-text)' }
  }

  return (
    <StorySlide background={gradients.token}>
      {label('Token Spotlight')}
      {spacer(12)}
      <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-on-bg)', display: 'block' }}>
        Your Most Traded
      </span>
      {spacer(16)}
      {top.map((u: UnderlyingPnl) => {
        const v = verdict(u)
        return (
          <div key={u.underlying} style={{ marginBottom: 12 }}>
            {miniCard(
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text-on-bg)' }}>
                    {u.underlying}
                  </span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.08)',
                      color: v.color,
                    }}
                  >
                    {v.text}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 20 }}>
                  <div>
                    {label('Fills')}
                    <span className="font-mono" style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                      {u.num_trades}
                    </span>
                  </div>
                  <div>
                    {label('P&L')}
                    <span className="font-mono" style={{ fontSize: '0.875rem', color: pnlColor(u.pnl), fontWeight: 700 }}>
                      {formatCurrency(u.pnl)}
                    </span>
                  </div>
                  <div>
                    {label('Win Rate')}
                    <span className="font-mono" style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>
                      {u.win_rate.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )
      })}
    </StorySlide>
  )
}

// ---------------------------------------------------------------------------
// Slide 9 — YourEdge (returns null if no profitable path)
// ---------------------------------------------------------------------------

export function YourEdge({ report }: SlideProps) {
  const { projections } = report

  // Check overall
  if (projections.overall && projections.overall.apr > 0) {
    const p = projections.overall
    return (
      <StorySlide background={gradients.edge}>
        {label('Your Edge, Projected')}
        {spacer(12)}
        <span style={{ fontSize: '1rem', color: 'var(--color-text-secondary)' }}>
          If you keep doing exactly what you&apos;re doing...
        </span>
        {spacer(16)}
        {heroNum(`${p.apr.toFixed(0)}%`, 'var(--color-positive-text)')}
        <span style={{ fontSize: '1rem', color: 'var(--color-text-secondary)' }}>annualized return</span>
        {spacer(24)}
        <div style={{ display: 'flex', gap: 24 }}>
          <div>
            {label('1 Year')}
            <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-positive-text)' }}>
              {formatCurrency(p.value_1yr)}
            </span>
          </div>
          <div>
            {label('3 Years')}
            <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-positive-text)' }}>
              {formatCurrency(p.value_3yr)}
            </span>
          </div>
        </div>
        {spacer(12)}
        <span className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)' }}>
          Starting from {formatCurrency(p.starting_capital)} capital
        </span>
      </StorySlide>
    )
  }

  // Check category projections
  const cats = projections.categories
  const profitable: { name: string; apr: number; value1yr: number }[] = []
  if (cats.perps && cats.perps.apr > 0) profitable.push({ name: 'Perps', apr: cats.perps.apr, value1yr: cats.perps.value_1yr })
  if (cats.options && cats.options.apr > 0) profitable.push({ name: 'Options', apr: cats.options.apr, value1yr: cats.options.value_1yr })
  if (cats.calls && cats.calls.apr > 0) profitable.push({ name: 'Calls', apr: cats.calls.apr, value1yr: cats.calls.value_1yr })
  if (cats.puts && cats.puts.apr > 0) profitable.push({ name: 'Puts', apr: cats.puts.apr, value1yr: cats.puts.value_1yr })

  if (profitable.length === 0) {
    // Skip slide entirely
    return null
  }

  profitable.sort((a, b) => b.apr - a.apr)

  return (
    <StorySlide background={gradients.edge}>
      {label('Your Edge, Projected')}
      {spacer(12)}
      <span style={{ fontSize: '1rem', color: 'var(--color-text-secondary)' }}>
        Not everything is red. These categories show promise:
      </span>
      {spacer(16)}
      {profitable.slice(0, 3).map((c) => (
        <div key={c.name} style={{ marginBottom: 12 }}>
          {miniCard(
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-on-bg)' }}>{c.name}</span>
              <div style={{ textAlign: 'right' }}>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-positive-text)' }}>
                  {c.apr.toFixed(0)}% APR
                </span>
                <br />
                <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>
                  {formatCurrency(c.value1yr)} in 1yr
                </span>
              </div>
            </div>
          )}
        </div>
      ))}
    </StorySlide>
  )
}

// ---------------------------------------------------------------------------
// Slide 10 — YourGrade
// ---------------------------------------------------------------------------

interface GradeResult {
  letter: string
  color: string
  total: number
  dimensions: { name: string; score: number; max: number }[]
  summary: string
}

function computeGrade(report: DeltaReportData): GradeResult {
  const { overview, risk_metrics, charges } = report

  // Win rate score: 0-25, scaled 30-65%
  const wrRaw = Math.min(Math.max((overview.win_rate - 30) / (65 - 30), 0), 1)
  const winRateScore = Math.round(wrRaw * 25)

  // Profit factor score: 0-25, scaled 0.5-2.0
  const pfRaw = Math.min(Math.max((risk_metrics.profit_factor - 0.5) / (2.0 - 0.5), 0), 1)
  const profitFactorScore = Math.round(pfRaw * 25)

  // Fee discipline score: 0-25, based on maker_fill_rate (0-100)
  const fdRaw = Math.min(Math.max(charges.maker_fill_rate / 100, 0), 1)
  const feeDisciplineScore = Math.round(fdRaw * 25)

  // Edge score: 0-25, based on win_loss_ratio (0.5-3.0)
  const edgeRaw = Math.min(Math.max((overview.win_loss_ratio - 0.5) / (3.0 - 0.5), 0), 1)
  const edgeScore = Math.round(edgeRaw * 25)

  const total = winRateScore + profitFactorScore + feeDisciplineScore + edgeScore

  let letter: string
  let color: string
  if (total >= 90) { letter = 'A+'; color = 'var(--color-positive-text)' }
  else if (total >= 80) { letter = 'A'; color = 'var(--color-positive-text)' }
  else if (total >= 70) { letter = 'B+'; color = 'var(--color-accent-blue-text)' }
  else if (total >= 55) { letter = 'B'; color = 'var(--color-accent-blue-text)' }
  else if (total >= 40) { letter = 'C'; color = 'var(--color-warning)' }
  else { letter = 'D'; color = 'var(--color-negative-text)' }

  const summaries: Record<string, string> = {
    'A+': 'Elite performance across all dimensions.',
    'A': 'Strong all-around trading with room for one more edge.',
    'B+': 'Solid foundation with clear areas to sharpen.',
    'B': 'Decent performance. Consistency will get you to the next level.',
    'C': 'Room for improvement. Focus on the weakest area.',
    'D': 'Early days. Focus on one dimension at a time.',
  }

  return {
    letter,
    color,
    total,
    dimensions: [
      { name: 'Win Rate', score: winRateScore, max: 25 },
      { name: 'Profit Factor', score: profitFactorScore, max: 25 },
      { name: 'Fee Discipline', score: feeDisciplineScore, max: 25 },
      { name: 'Edge (W/L Ratio)', score: edgeScore, max: 25 },
    ],
    summary: summaries[letter] ?? 'Keep trading and refining your approach.',
  }
}

export function YourGrade({ report }: SlideProps) {
  const grade = computeGrade(report)

  return (
    <StorySlide background={gradients.grade}>
      {label('Your Grade')}
      {spacer(12)}
      <span
        className="font-mono"
        style={{
          fontSize: '5rem',
          fontWeight: 900,
          color: grade.color,
          display: 'block',
          lineHeight: 1,
        }}
      >
        {grade.letter}
      </span>
      <span className="font-mono" style={{ fontSize: '0.875rem', color: 'var(--color-text-tertiary)' }}>
        {grade.total}/100
      </span>
      {spacer(20)}
      {grade.dimensions.map((d) => (
        <div key={d.name} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{d.name}</span>
            <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--color-text-primary)' }}>
              {d.score}/{d.max}
            </span>
          </div>
          {progressBar(d.score, d.max, grade.color)}
        </div>
      ))}
      {spacer(16)}
      {body(grade.summary)}
    </StorySlide>
  )
}

// ---------------------------------------------------------------------------
// Slide 11 — Achievements
// ---------------------------------------------------------------------------

export function Achievements({ report }: SlideProps) {
  const achievements = report.streaks.achievements
  if (!achievements || achievements.length === 0) {
    return (
      <StorySlide background={gradients.achievements}>
        {label('Achievements')}
        {spacer(12)}
        {body('No achievements tracked yet. Keep trading!')}
      </StorySlide>
    )
  }

  const unlocked = achievements.filter((a: Achievement) => a.unlocked)
  const locked = achievements.filter((a: Achievement) => !a.unlocked)

  return (
    <StorySlide background={gradients.achievements}>
      {label('Achievements')}
      {spacer(8)}
      <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-highlight)', display: 'block' }}>
        {unlocked.length} Unlocked
      </span>
      {spacer(12)}
      <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
        {unlocked.map((a: Achievement) => (
          <div
            key={a.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 16px',
              marginBottom: 8,
              borderRadius: 10,
              background: 'rgba(246, 166, 9, 0.1)',
              border: '1px solid rgba(246, 166, 9, 0.2)',
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>{a.icon}</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-highlight)' }}>
                {a.name}
              </span>
              <br />
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-tertiary)' }}>{a.description}</span>
            </div>
          </div>
        ))}
        {locked.slice(0, 3).map((a: Achievement) => (
          <div
            key={a.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 16px',
              marginBottom: 8,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              opacity: 0.5,
            }}
          >
            <span style={{ fontSize: '1.25rem', filter: 'grayscale(1)' }}>{a.icon}</span>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-tertiary)' }}>
                {a.name}
              </span>
              <br />
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-quaternary)' }}>{a.description}</span>
            </div>
            <span style={{ fontSize: '0.6rem', color: 'var(--color-text-quaternary)' }}>Locked</span>
          </div>
        ))}
      </div>
      {report.streaks.best_win_streak >= 3 && (
        <>
          {spacer(12)}
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-tertiary)' }}>
            {'\uD83D\uDD25'} Best win streak: {report.streaks.best_win_streak}
          </span>
        </>
      )}
    </StorySlide>
  )
}

// ---------------------------------------------------------------------------
// Slide 12 — ShareAndExplore
// ---------------------------------------------------------------------------

interface ShareSlideProps {
  report: DeltaReportData
  onShare: () => void
  onExplore: () => void
}

export function ShareAndExplore({ report, onShare, onExplore }: ShareSlideProps) {
  return (
    <StorySlide background={gradients.share}>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }}>{'\uD83C\uDF89'}</span>
        <span
          style={{
            fontSize: '1.75rem',
            fontWeight: 800,
            color: 'var(--color-text-on-bg)',
            display: 'block',
            lineHeight: 1.3,
          }}
        >
          That&apos;s Your Trading Wrapped
        </span>
        {spacer(8)}
        {body(`${report.metadata.total_trades} trades. ${report.metadata.tokens_traded} tokens. One story.`)}
        {spacer(32)}
        <button
          onClick={(e) => { e.stopPropagation(); onShare() }}
          style={{
            background: 'var(--color-brand)',
            color: 'var(--color-text-on-bg)',
            fontWeight: 700,
            fontSize: '0.875rem',
            border: 'none',
            borderRadius: 8,
            padding: '14px 32px',
            cursor: 'pointer',
            width: '100%',
            marginBottom: 12,
          }}
        >
          Share Your Stats
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onExplore() }}
          style={{
            background: 'var(--color-bg-secondary)',
            color: 'var(--color-text-primary)',
            fontWeight: 600,
            fontSize: '0.875rem',
            border: '1px solid var(--color-separator-2)',
            borderRadius: 8,
            padding: '12px 32px',
            cursor: 'pointer',
            width: '100%',
            marginBottom: 12,
          }}
        >
          Explore Dashboard
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); window.print() }}
          style={{
            background: 'transparent',
            color: 'var(--color-text-tertiary)',
            fontWeight: 600,
            fontSize: '0.8rem',
            border: 'none',
            cursor: 'pointer',
            padding: '8px 0',
          }}
        >
          Download PDF
        </button>
      </div>
    </StorySlide>
  )
}
