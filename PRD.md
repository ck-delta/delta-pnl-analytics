# PnL Analytics — PRD

| Sno | Document Status | Review and Approval |
|-----|----------------|-------------------|
| 1 | Author | @Charandeep Kapoor |
| 2 | Version | 1.0 |
| 3 | Date | Apr 17, 2026 |
| 4 | Status | Ready for Review |
| 5 | Reviewer | @Hashmeet Sikka |

---

## Problem Statement

### Customer Pain Points

Active Delta traders generate hundreds to thousands of trades across perps, options, and spot — but have no way to understand performance inside the Delta app. They trade blind: they know their balance went up or down, but not *why*.

- No aggregated P&L view by asset, instrument type, or time period
- Funding rate costs on perps are invisible
- Options traders cannot see daily vs weekly vs monthly expiry performance separately
- No way to identify patterns: win streaks, best trading hours, worst tokens

### Business Pain Points

- Traders who don't understand their performance churn faster. "-$1,000" with no context drives users away. "-$1,000 overall, but your BTC puts are +$471" gives a reason to stay
- Trade frequency drops when traders lose confidence without insights
- Delta loses engagement to third-party tools (Koinly, CoinTracker, spreadsheets)
- No viral loop exists — shareable "Wrapped" cards create free social marketing
- **Target:** D30 retention +10-15%, trade frequency +20%, loss-driven churn -15-20%

### Market Gap

- Bybit, Binance, OKX all have built-in PnL tracking. Delta has none
- Indian brokers (Dhan, Groww) have normalized trading analytics expectations
- No crypto exchange has done a Spotify Wrapped-style trading story experience

---

## User Persona

**Primary:** Active traders with 3+ months on Delta, 50-5,000+ trades across perps and/or options. They want to understand performance patterns, optimize strategy, and track improvement. Currently use spreadsheets or nothing.

| Persona | Needs |
|---------|-------|
| Perps Trader (3-12mo) | P&L by token, funding costs, best trading hours, win rate trends |
| Options Trader (3+mo) | P&L by expiry type (daily/weekly/monthly), calls vs puts, DTE analysis |
| Multi-Asset Trader | Cross-token comparison, correlation, which assets to focus vs avoid |
| High-Frequency (500+) | Aggregated stats, fee analysis (maker/taker), what-if scenarios |

---

## User Flow

**Current:** Check wallet balance → see a number → no context → trade blind or export to spreadsheet

**Proposed:** Profile → PnL Analytics → Trading Wrapped auto-plays (12 slides) → Dashboard deep-dive

[WHIMSICAL LINK - Delta Exchange team workspace]

---

## Requirements

| Sno | Story Name | User Story | Acceptance Criteria |
|-----|-----------|------------|---------------------|
| 1 | Entry Point | As a trader, I want to access PnL Analytics from my profile | PnL Analytics in Profile dropdown, visible for users with 1+ trade, 1-tap access |
| 2 | Data Loading | As a trader, I want my complete history analyzed | All fills/transactions/positions fetched via Delta API with pagination. Progress bar with real-time status. Load < 90s for 2,000+ fills |
| 3 | Trading Wrapped | As a trader, I want a story-like experience showing my trading personality | 12 full-screen slides, tap to advance, 8s auto-advance, progress bar, skip button, keyboard support |
| 4 | Trader Identity | As a trader, I want to know my "trader persona" | 7 persona types classified from: asset, instrument, hold duration, frequency, direction |
| 5 | AI Advice | As a trader, I want plain English advice on what to fix | Grade A+ to D- from 4 dimensions. "Currently X → Could be Y" format. AI-powered with rule-based fallback. No jargon |
| 6 | Dashboard | As a trader, I want charts and tables for deep analysis | 8 sub-tabs: Overview, P&L, Instruments, Funding, Expiry, Risk, Charges, Portfolio. 25+ data points |
| 7 | What-If | As a trader, I want to see strategy change impact | Auto-generated scenarios with before/after P&L. Interactive toggles |
| 8 | Social Sharing | As a trader, I want to share my stats | PNG card (1200x675) + shareable URL. Optimized for Twitter/X |
| 9 | Goal Setting | As a trader, I want monthly P&L targets | Progress bar, localStorage persistence, color-coded status |
| 10 | Trade Log | As a trader, I want all trades searchable | 13-column sortable table, search, filters, CSV export |
| 11 | Mixpanel | As a PM, I want engagement tracking | 20 events per tracking plan below, tested in staging first |

### Data Point Sources

**Wrapped slides:** Total trades, persona, best/worst trade, strengths/weaknesses (AI-generated), what-if scenarios, token spotlight, APR projections, grade, achievements, streaks — all computed client-side from `/v2/fills`, `/v2/wallet/transactions`, `/v2/positions/margined`

**Dashboard:** Net P&L, win rate, equity curve, monthly table, daily heatmap, 2D time heatmap, hourly/weekly P&L, funding by token, expiry by DTE, Sharpe/Sortino/drawdown, maker fill rate, GST estimate, open positions, correlation matrix — all computed client-side

---

## Success Metrics

| # | Metric | Target | How to Measure |
|---|--------|--------|---------------|
| 1 | Feature DAU / Total DAU | >15% in 30 days | pnl_analytics_opened / total DAU |
| 2 | Wrapped Completion Rate | >60% | wrapped_completed / wrapped_started |
| 3 | Share Rate | >20% of completions | share_card_generated / wrapped_completed |
| 4 | Tab Exploration | Avg 3+ tabs/session | unique dashboard_tab_viewed |
| 5 | Feature → Trade | >5% within 1 hour | trade_placed after pnl_analytics_opened |
| 6 | D30 Retention Lift | +10-15% | Cohort: PnL users vs non-users |
| 7 | Trade Frequency Lift | +20% trades/month | Pre vs post launch |
| 8 | AI Advice CSAT | >70% positive | advice_helpful_yes / total ratings |
| 9 | D7 Repeat Usage | >40% | Return to PnL Analytics within 7 days |
| 10 | Replay Rate | >15% | wrapped_replayed / wrapped_completed |

> **Internal insight goals:** Token interest by persona, ARPU correlation with analytics usage, which dashboard tabs predict retention. Measurable via Mixpanel events.

---

## Mixpanel Tracking Plan

> Events must flow in Mixpanel test environment before production.

**Super Properties:** user_id, platform (web/mobile), session_id, trader_persona

| # | Event | Fired When | Key Properties |
|---|-------|-----------|---------------|
| 1 | pnl_analytics_opened | Enters feature | source_page |
| 2 | data_load_completed | Data ready | total_fills, load_time_seconds |
| 3 | data_load_failed | API error | error_type |
| 4 | wrapped_started | First slide shown | total_slides |
| 5 | wrapped_slide_viewed | Each slide | slide_index, slide_name, time_ms |
| 6 | wrapped_skipped | Clicks Skip | slide_index, slides_remaining |
| 7 | wrapped_completed | Final slide | total_time_seconds |
| 8 | wrapped_replayed | Replay clicked | source_page |
| 9 | share_card_generated | Downloads/copies card | action (download/copy/url) |
| 10 | dashboard_tab_viewed | Navigates sub-tab | tab_name |
| 11 | advice_loaded | AI response received | grade, ai_enhanced |
| 12 | advice_helpful_yes/no | Thumbs up/down | grade |
| 13 | trade_log_exported | CSV export | total_rows |
| 14 | goal_set | Sets monthly target | target_amount |
| 15 | trade_now_clicked | Any trade CTA | source_page, token_symbol |

---

## Touch Points

| # | Placement | Trigger | CTA |
|---|-----------|---------|-----|
| 1 | Profile dropdown | Always (1+ trade) | "PnL Analytics" |
| 2 | Post-trade nudge | Every 10th trade | "See how this trade affects your stats →" |
| 3 | Trading page sidebar | 50+ trades, hasn't used feature | "Analyze your {TOKEN} performance" |
| 4 | Weekly email | Monday, 5+ trades that week | "Your weekly trading Wrapped is ready" |
| 5 | Push notification | Monday 10am, active traders | "You made {N} trades this week →" |
| 6 | App home banner | First 3 sessions post-launch | "NEW: Your Wrapped is ready" |
| 7 | Portfolio page | Always | "See detailed P&L breakdown →" |

---

## Design Handoff

| Platform | Navigation |
|----------|-----------|
| Web | Profile → PnL Analytics → Wrapped → Top tabs: AI Advice / Dashboard / Trade Log. Dashboard sidebar: 8 sub-tabs |
| Mobile | Profile → Wrapped (full-screen tap) → Bottom bar: Advice / Dashboard / Trades. Dashboard: scrollable tab strip |

**Key screens:** Loading (hedge fund style) → Wrapped (12 slides) → AI Advice (scrollable cards) → Dashboard (8 sub-pages) → Trade Log (table)

**Prototype:** https://delta-pnl-analytics.vercel.app | **GitHub:** https://github.com/ck-delta/delta-pnl-analytics

---

## API Routes

**Client-side (browser → Delta API directly):** IP whitelisting requires user's browser to make calls.

| Endpoint | Purpose | Cache |
|----------|---------|-------|
| GET /v2/wallet/balances | Validate credentials | Never |
| GET /v2/fills?page_size=50&start_time=X | All trade executions | Never |
| GET /v2/products/{id} | Instrument metadata (inc. expired options) | 5 min |
| GET /v2/wallet/transactions?page_size=50&start_time=X | Funding, commissions, settlements | Never |
| GET /v2/positions/margined | Open positions | Never |

**Server-side:**

| Route | Purpose | Cache |
|-------|---------|-------|
| POST /api/advice | AI-powered trading advice | Never |
| GET /api/wrapped/{user_id} | Public share page | 1 hour |

---

## V2 Improvements

| # | Feature | Business Value |
|---|---------|---------------|
| 1 | Real-time position monitoring (WebSocket) | Engagement during active trading |
| 2 | Push notifications (win rate drops, weekly Wrapped) | Retention hooks |
| 3 | Comparison vs Delta averages ("top 20% of ETH traders") | Social proof + competition |
| 4 | AI chat ("Why did I lose on BTC calls in Nov?") | Deep engagement |
| 5 | Tax report generation (Indian capital gains, TDS) | Utility at tax time |
| 6 | Strategy backtesting ("What if 2x leverage on BTC puts?") | Power user feature |
| 7 | Mobile-native Wrapped (haptics, 60fps, Share Sheet) | Better mobile UX |
| 8 | Personalized weekly AI coaching | Retention + frequency |
| 9 | Multiplayer Wrapped (compare with friends) | Viral loop |
| 10 | Multi-period comparison (month/quarter/year) | Long-term retention |

---

## Milestones

| # | Action | Start | End | Status |
|---|--------|-------|-----|--------|
| 1 | PRD Ready for Review | Apr 17 | Apr 17 | Ready |
| 2 | PRD review with Hashmeet | Apr 18 | Apr 21 | Pending |
| 3 | Comms and stakeholder alignment | Apr 21 | Apr 23 | Pending |
| 4 | Design handoff | Apr 23 | Apr 25 | Pending |
| 5 | Tech handoff | Apr 25 | Apr 28 | Pending |
| 6 | Design/BE/FE estimation | Apr 28 | Apr 30 | Pending |
| 7 | Design | May 1 | May 15 | Pending |
| 8 | Dev | May 8 | Jun 5 | Pending |
| 9 | Testing | Jun 5 | Jun 12 | Pending |
| 10 | Launch | Jun 12 | Jun 15 | Pending |

---

## User Flows & Failure Scenarios

### Flow 1: Data Loading
1. Profile → PnL Analytics → auth token auto-used → loading screen with progress
2. Fetch: balances (<2s) → products (<3s) → fills paginated (5-60s) → expired product lookups (5-30s) → transactions (5-30s) → positions (<2s) → trade matching (1-5s) → analytics (1-3s) → Wrapped plays

**Failures:** Auth expired → redirect to login | Empty fills → "No trades found" + trade CTA | Rate limit 429 → "Paused, resuming in {X}s" auto-retry | Network drop → 3 retries exponential backoff | Load >120s → "Taking longer for large accounts" (never timeout)

### Flow 2: Wrapped
12 slides auto-play. Missing data → skip slide. Grade slide uses local computation if API fails. Share card fail → retry button.

### Flow 3: AI Advice
POST /api/advice → AI engine (30s timeout) → rule-based fallback on any failure. Fallback works with zero external calls.

### Failure Summary

| Scenario | User Sees | System Does |
|----------|-----------|-------------|
| Auth expired | "Session expired" | Redirect login |
| Empty fills | "No trades found" | Trade CTA |
| Rate limit 429 | "Paused, resuming..." | Auto-retry |
| Network drop | "Retrying..." | 3x exponential backoff |
| AI engine fail | "Showing basic analysis" | Rule-based fallback |
| Slide data missing | (skipped) | Filter null slides |
| Product 404 | (invisible) | Use generic metadata |
| JS chunk error | "Page failed to load" | Reload button |

### Dev Checklist
- [ ] HMAC-SHA256 with ? in query string
- [ ] start_time=2020-01-01 in microseconds
- [ ] Expired options fetched individually
- [ ] 429 retry with X-RATE-LIMIT-RESET
- [ ] Mixpanel on success AND failure paths
- [ ] 500ms skeleton delay
- [ ] Error boundaries on lazy pages
- [ ] Trade matching: partial closes, flips, zero-price options
- [ ] Rule-based AI fallback (no external dependency)
- [ ] Share card renders with dark bg + custom fonts
- [ ] localStorage keys prefixed deltaPnl_
- [ ] Keyboard nav in Wrapped
- [ ] Mobile 44px touch targets
- [ ] Charts handle empty arrays
- [ ] CSV export with proper escaping
