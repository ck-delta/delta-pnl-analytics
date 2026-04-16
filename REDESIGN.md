# Delta PnL Analytics — V2 Redesign Plan

## Summary of Changes

### Architecture: Spotify Wrapped-style Trading Story + Two-level Nav Dashboard

**Flow:**
1. User enters API keys → Loading screen → **Auto-play Trading Wrapped experience** (full-screen stories)
2. After Wrapped ends → Dashboard with two-level nav: **AI Advice | Dashboard | Trade Log**
3. Dashboard sub-tabs: Overview, P&L, Instruments, Funding, Expiry, Risk, Charges, Portfolio

---

## 1. TRADING WRAPPED (Auto-plays after data loads)

Instagram Stories-style tap-to-advance full-screen experience. Progress bar at top. Tap right = next, tap left = previous. Auto-advances every 8s.

### Story Sequence (following Spotify's narrative arc):

**Story 1 — "Your Trading Year" (Setup/Welcome)**
```
Background: Dark with subtle animated orange particles
Content:
  "YOUR TRADING YEAR"
  Jun 2024 — Apr 2026
  
  817 trades
  4 tokens
  $120K+ volume
  
  Let's dive in →
```
Big numbers, bold type. Sets the stage. Low stakes.

**Story 2 — "Your Trading Identity" (Persona)**
```
Background: Orange gradient
Content:
  "YOU'RE A..."
  
  🎯 BTC OPTIONS TRADER
  
  604 of your 817 trades were BTC
  72% of your trades were options
  You mostly went long
  
  Your trading style: High-conviction directional bets
```
Assigns a persona label based on data. Like Spotify's "Clubs."
- Categories: "Perps Scalper", "Options Strategist", "Multi-Asset Diversifier", "Degen Speed Trader", "Diamond Hands Holder", etc.
- Determined by: most-traded instrument type + holding duration + frequency

**Story 3 — "Your Best Moment" (Highlight)**
```
Background: Green gradient
Content:
  "YOUR BEST TRADE"
  
  +$241.84
  
  BTC Put Option
  Nov 5, 2024
  
  You bought 10 contracts and rode them
  to a 3.2x return in 2 hours.
```
Always positive. Cherry-pick the single best trade. Make them feel good.

**Story 4 — "Your Toughest Day" (Handled gracefully)**
```
Background: Muted dark blue
Content:
  "YOUR TOUGHEST LESSON"
  
  Nov 11, 2024
  
  -$1,042 on a single BTC call position.
  
  Every great trader has setbacks.
  The question is: did you learn from it?
```
Frame losses as "lessons" not "failures." Spotify never shows negative trends.

**Story 5 — "What's Working" (Strengths)**
```
Background: Green-tinted dark
Content:
  "WHAT'S WORKING"
  
  ✓ Your winners are 1.7x your losers
    Currently: +$6.74 avg win vs -$3.97 avg loss
    → If you cut losers 20% faster: +$8.10 avg win ratio
  
  ✓ BTC puts are your edge
    65% win rate, +$471 total
    → Keep going: projected +$940/year
  
  ✓ 9-trade win streak shows you can lock in
```
One-liners with "Currently X → Could be Y" framing. Simple, readable.

**Story 6 — "What's Not Working" (Weaknesses)**
```
Background: Red-tinted dark  
Content:
  "WHAT NEEDS WORK"
  
  ✗ 25% overall win rate — you lose 3 of 4 trades
    Currently: 25% → Target: 40%+ with better entries
  
  ✗ ETH calls are bleeding: -$1,487
    Currently: losing → Cut them entirely: saves $1,487
  
  ✗ 98.5% taker fills — you're paying max fees
    Currently: $500 in fees → Use limits: save ~$150/year
```
Same format: punchy one-liner + "Currently → Could be" fix.

**Story 7 — "What If..." (Interactive Scenarios)**
```
Background: Blue gradient
Content:
  "WHAT IF YOU..."
  
  [Toggle ON] Cut your 5 worst trades?
  P&L jumps from -$1,048 → +$196 ✨
  
  [Toggle ON] Stopped trading BTC calls?
  Save $1,487 in losses
  
  [Toggle ON] Only traded your top 3 tokens?
  Fewer trades, better win rate
  
  Combined: -$1,048 → +$723 (+169%)
```
Interactive toggles from the What-If simulator. Moved here from Overview.

**Story 8 — "Your Token Spotlight" (Per-token cards)**
```
Background: Token-colored gradient
Content:
  "BTC SPOTLIGHT"
  
  604 fills | -$1,016 net
  
  ✓ Puts work: +$471 (65% win rate)
  ✗ Calls don't: -$1,487 (18% win rate)
  ○ Perps: -$0.87 (breakeven)
  
  Verdict: Trade BTC puts, avoid calls
```
One card per major token traded. Like Spotify's artist cards.

**Story 9 — "Your Edge" (Projections — only if profitable in something)**
```
Background: Purple gradient
Content:
  "YOUR EDGE"
  
  BTC puts are profitable.
  If you focus here:
  
  +$471/6 months → projected +$942/year
  
  In 5 years at this rate:
  $4,710 from puts alone
  
  "Focus on what works. Cut what doesn't."
```
APR/APY projections for profitable subcategories only.

**Story 10 — "Your Score" (The Big Reveal)**
```
Background: Grade-colored (red for D, green for A)
Content:
  "YOUR GRADE"
  
  D-
  Score: 22 / 100
  
  Win Rate:     ████░░░░░░  19%
  Risk-Reward:  ██████░░░░  25%
  Fee Discipline: ████████░░  40%
  Edge:         ██░░░░░░░░   4%
  
  Room to grow. Start with the what-ifs.
```
Grade reveal is the climax — like Spotify's top song.

**Story 11 — "Your Achievements" (Badges)**
```
Background: Gold/orange
Content:
  "UNLOCKED 🏆"
  
  🏆 First Profit
  🔥 Hot Streak (9 wins)
  📈 Century (100+ trades)
  
  🔒 $1K Club — 52% there
  🔒 Sharpshooter — need 70% win rate
  🔒 Diversified — trade 6 more tokens
```
Show unlocked + progress toward locked. Gamification payoff.

**Story 12 — "Share & Explore" (CTA)**
```
Background: Orange gradient
Content:
  "THAT'S YOUR TRADING WRAPPED"
  
  [Share Your Stats]  ← generates share card PNG
  [Explore Dashboard] ← enters the full dashboard
  [Download PDF]      ← full report
```
End with sharing and navigation to the full dashboard.

### Wrapped Technical Implementation:
- Full-viewport component, `position: fixed`, `z-index: 50`
- Progress bar at top (segmented, one segment per story)
- Tap zones: left 30% = back, right 70% = forward
- Auto-advance timer: 8 seconds per story (pauses on interactive stories like What-If)
- Smooth crossfade transitions between stories (200ms)
- "Skip to Dashboard" button in top-right corner at all times
- Stories rendered from report data — no additional API call needed
- What-If toggles are interactive — pause auto-advance when user interacts

---

## 2. TWO-LEVEL NAVIGATION

After Wrapped ends (or user skips), show the dashboard with this nav:

### Top-level tabs (horizontal, in header):
```
[AI Advice]  [Dashboard]  [Trade Log]
```

### Dashboard sub-tabs (sidebar, when Dashboard is selected):
```
Overview
P&L Analysis
Instruments
Funding
Expiry
Risk & Metrics
Charges
Open Portfolio
```

### AI Advice tab:
- Shows the Wrapped stories in a scrollable format (not full-screen)
- User can revisit any story card
- "Replay Wrapped" button to re-enter the full-screen experience
- Share button for social cards

### Trade Log tab:
- Same as current — searchable/filterable table with CSV export

---

## 3. ADDITIONAL FEATURES

### Token Spotlight Cards (on Instruments page)
Per-token card showing: fills count, net P&L, instrument breakdown (perps/calls/puts), verdict.

### Trading Calendar View (on P&L Analysis page)
Full-page calendar. Each day is a cell with green/red/gray. Click a day → expandable panel showing that day's trades.

### Goal Setting (new section on Overview)
- "Set Monthly Target": input field for monthly P&L goal ($500, $1000, etc.)
- Progress bar showing current month vs target
- Stored in localStorage (no backend needed)

### Notifications/Alerts (future — not V2)
- Defer to V3. Would need a backend worker or browser notifications API.

---

## 4. WRITING STYLE FOR AI ADVICE

**One-liner + Currently/Could-be framing:**

Strengths:
```
✓ Your winners are 1.7x your losers
  Currently: +$6.74 avg win vs -$3.97 avg loss
  → If you cut losers 20% faster: +$8.10 ratio
```

Weaknesses:
```
✗ 25% win rate — you lose 3 of 4 trades
  Currently: 25% win rate → Target: 40%+ with better entries
```

Rules:
- No jargon (no "Kelly Criterion", no "Sortino ratio" in the stories)
- Plain English only
- Always show the fix alongside the problem
- Never just state a number — always give context ("good", "needs work", "above average")
- Use emoji sparingly but effectively (✓, ✗, →, 🔥, 🏆)

---

## 5. WHAT'S REMOVED

- ❌ Kelly Criterion slide (too technical, users don't understand it)
- ❌ "Roast Me" tone (only "Helpful" remains)
- ❌ What-If on Overview page (moved to Wrapped Story 7)
- ❌ Period Comparison on Overview (moved to P&L Analysis)
- ❌ Streaks on Overview (moved to Wrapped Story 11)
- ❌ Share Card on Overview (moved to Wrapped Story 12)

---

## 6. IMPLEMENTATION PLAN

### Phase A: Wrapped Component
1. Build `TradingWrapped.tsx` — full-screen story engine
2. Build individual story slides (12 stories)
3. Build trading identity classifier
4. Build token spotlight card generator
5. Wire into App.tsx as auto-play after data load

### Phase B: Navigation Restructure
6. Restructure App.tsx: top-level tabs (AI Advice / Dashboard / Trade Log)
7. Dashboard sidebar becomes sub-nav
8. AI Advice tab shows scrollable story cards + "Replay" button

### Phase C: AI Advice Backend Update
9. Update advice.py: remove Kelly, remove roast, add identity classification
10. Add "Currently → Could be" framing to all bullets
11. Add token spotlight data to response

### Phase D: New Features
12. Token spotlight cards on Instruments page
13. Trading calendar view on P&L Analysis
14. Goal setting widget on Overview (localStorage)

### Phase E: Polish
15. Share card optimization for social
16. PDF export of Wrapped summary
17. Mobile responsive for all new components
