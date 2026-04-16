from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import math
import os
import httpx
import json
import traceback

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Tab index mapping (must match frontend App.tsx NAV_ITEMS / PAGES order)
# ---------------------------------------------------------------------------
TAB_OVERVIEW = 0
TAB_PNL_ANALYSIS = 1
TAB_INSTRUMENTS = 2
TAB_FUNDING = 3
TAB_EXPIRY = 4
TAB_RISK_METRICS = 5
TAB_CHARGES = 6
TAB_OPEN_PORTFOLIO = 7
TAB_TRADE_LOG = 8
TAB_AI_ADVICE = 9


# ============================================================================
# HELPER: safe numeric access
# ============================================================================

def _f(obj, *keys, default=0.0):
    """Drill into nested dicts safely, return float."""
    v = obj
    for k in keys:
        if isinstance(v, dict):
            v = v.get(k, default)
        else:
            return float(default)
    try:
        return float(v)
    except (TypeError, ValueError):
        return float(default)


def _safe_div(a, b, default=0.0):
    return a / b if b != 0 else default


# ============================================================================
# METRIC COMPUTATION  (30+ metrics from report data)
# ============================================================================

def compute_metrics(report: dict) -> dict:
    ov = report.get("overview", {})
    rm = report.get("risk_metrics", {})
    ch = report.get("charges", {})
    pnl_a = report.get("pnl_analysis", {})
    inst = report.get("instruments", {})
    meta = report.get("metadata", {})
    fund = report.get("funding", {})
    proj = report.get("projections", {})
    streaks = report.get("streaks", {})
    trade_log = report.get("trade_log", {})
    trades = trade_log.get("trades", [])

    total_trades = _f(ov, "total_trades")
    winners = _f(ov, "winners")
    losers = _f(ov, "losers")
    win_rate = _f(ov, "win_rate")
    avg_winner = _f(ov, "avg_winner")
    avg_loser = _f(ov, "avg_loser")
    net_pnl = _f(ov, "net_realized_pnl")
    gross_pnl = net_pnl + _f(ch, "total_fees")
    total_fees = _f(ch, "total_fees")
    best_trade = _f(ov, "best_trade")
    worst_trade = _f(ov, "worst_trade")
    wl_ratio = _f(ov, "win_loss_ratio")
    long_pnl = _f(ov, "long_pnl")
    short_pnl = _f(ov, "short_pnl")
    perps_pnl = _f(ov, "perps_pnl")
    options_pnl = _f(ov, "options_pnl")
    tokens_traded = _f(ov, "tokens_traded")
    total_funding = _f(fund, "total_funding_pnl")

    sharpe = _f(rm, "sharpe_ratio")
    sortino = _f(rm, "sortino_ratio")
    profit_factor = _f(rm, "profit_factor")
    payoff_ratio = _f(rm, "payoff_ratio")
    max_dd = _f(rm, "max_drawdown")
    calmar = _f(rm, "calmar_ratio")
    daily_std = _f(rm, "daily_std_dev")
    expectancy = _f(rm, "expectancy")
    consec_wins = _f(rm, "consecutive_wins")
    consec_losses = _f(rm, "consecutive_losses")
    recovery_factor = _f(rm, "recovery_factor")

    maker_rate = _f(ch, "maker_fill_rate")
    fees_pct_pnl = _f(ch, "fees_pct_pnl")
    fees_pct_vol = _f(ch, "fees_pct_volume")
    maker_fees = _f(ch, "maker_fees")
    taker_fees = _f(ch, "taker_fees")
    gst = _f(ch, "gst_estimate")

    # ---------- Derived metrics ----------

    # Win probability / loss probability
    w = win_rate / 100.0 if win_rate else 0.0
    l = 1.0 - w

    # Risk-Reward ratio
    rr_ratio = _safe_div(abs(avg_winner), abs(avg_loser)) if avg_loser != 0 else 0.0

    # Kelly Criterion: f* = W - (L / R)  where W=win prob, L=loss prob, R=win/loss ratio
    if rr_ratio > 0 and w > 0:
        kelly_full = w - (l / rr_ratio)
    else:
        kelly_full = 0.0
    kelly_half = kelly_full / 2.0

    # Edge / expectancy per dollar risked
    edge_per_dollar = _safe_div(expectancy, abs(avg_loser)) if avg_loser != 0 else 0.0

    # Asymmetry: best_trade / abs(worst_trade)
    asymmetry = _safe_div(best_trade, abs(worst_trade)) if worst_trade != 0 else 0.0

    # Gross profit vs gross loss
    gross_wins = avg_winner * winners if winners else 0.0
    gross_losses = abs(avg_loser) * losers if losers else 0.0

    # Charges as % of gross profit
    fees_pct_gross_profit = _safe_div(total_fees, gross_wins, 0.0) * 100 if gross_wins > 0 else 0.0

    # Total volume
    total_volume = sum(_f(t, "notional_value") for t in trades)

    # Average trade size (notional)
    avg_trade_size = _safe_div(total_volume, total_trades)

    # Average hold duration
    avg_hold_hours = _safe_div(
        sum(_f(t, "hold_duration_hours") for t in trades), total_trades
    )

    # Net $ per trade
    net_per_trade = _safe_div(net_pnl, total_trades)

    # Daily P&L statistics
    daily_pnl_list = pnl_a.get("daily_pnl", [])
    daily_values = [d.get("pnl", 0) for d in daily_pnl_list]
    num_trading_days = len(daily_values)
    avg_daily_pnl = _safe_div(sum(daily_values), num_trading_days) if daily_values else 0.0
    profitable_days = sum(1 for d in daily_values if d > 0)
    losing_days = sum(1 for d in daily_values if d < 0)
    daily_win_rate = _safe_div(profitable_days, num_trading_days, 0.0) * 100

    # Trades per day
    trades_per_day = _safe_div(total_trades, num_trading_days) if num_trading_days else 0.0

    # Concentration: top underlying % of total P&L
    pnl_by_und = inst.get("pnl_by_underlying", [])
    if pnl_by_und and net_pnl != 0:
        top_und_pnl = abs(pnl_by_und[0].get("pnl", 0)) if pnl_by_und else 0
        top_und_name = pnl_by_und[0].get("underlying", "?") if pnl_by_und else "?"
        top_und_pct = _safe_div(top_und_pnl, abs(net_pnl), 0.0) * 100
    else:
        top_und_pnl = 0
        top_und_name = "N/A"
        top_und_pct = 0

    # Pareto: how many underlyings make 80% of P&L
    sorted_und = sorted(pnl_by_und, key=lambda x: abs(x.get("pnl", 0)), reverse=True)
    pareto_cum = 0
    pareto_count = 0
    total_abs_pnl = sum(abs(u.get("pnl", 0)) for u in sorted_und)
    for u in sorted_und:
        pareto_cum += abs(u.get("pnl", 0))
        pareto_count += 1
        if total_abs_pnl > 0 and pareto_cum / total_abs_pnl >= 0.80:
            break
    pareto_total = len(sorted_und)

    # Long vs Short split
    long_trades = sum(1 for t in trades if t.get("direction") == "long")
    short_trades = sum(1 for t in trades if t.get("direction") == "short")
    long_pct = _safe_div(long_trades, total_trades, 0) * 100
    short_pct = 100 - long_pct if total_trades else 0

    # Fees per trade
    fees_per_trade = _safe_div(total_fees, total_trades)

    # Break-even trades needed to cover fees
    breakeven_trades_for_fees = math.ceil(_safe_div(total_fees, abs(avg_winner))) if avg_winner > 0 else 0

    # Monthly consistency
    monthly = pnl_a.get("monthly", [])
    profitable_months = sum(1 for m in monthly if m.get("net_pnl", 0) > 0)
    total_months = len(monthly)
    monthly_consistency = _safe_div(profitable_months, total_months, 0) * 100

    # Best/worst month
    monthly_pnls = [m.get("net_pnl", 0) for m in monthly]
    best_month = max(monthly_pnls) if monthly_pnls else 0
    worst_month = min(monthly_pnls) if monthly_pnls else 0

    # Hourly edge
    hourly = pnl_a.get("hourly_pnl", [])
    best_hour_data = max(hourly, key=lambda h: h.get("avg_pnl", 0)) if hourly else {}
    worst_hour_data = min(hourly, key=lambda h: h.get("avg_pnl", 0)) if hourly else {}
    best_hour = best_hour_data.get("hour", 0)
    worst_hour = worst_hour_data.get("hour", 0)
    best_hour_pnl = best_hour_data.get("avg_pnl", 0)
    worst_hour_pnl = worst_hour_data.get("avg_pnl", 0)

    # Day of week edge
    dow = pnl_a.get("day_of_week", [])
    best_dow_data = max(dow, key=lambda d: d.get("avg_pnl", 0)) if dow else {}
    worst_dow_data = min(dow, key=lambda d: d.get("avg_pnl", 0)) if dow else {}
    best_dow = best_dow_data.get("day", "N/A")
    worst_dow = worst_dow_data.get("day", "N/A")

    # APR from projections
    apr = _f(proj, "overall", "apr", default=0)

    # Net pnl per dollar of fees
    pnl_per_fee_dollar = _safe_div(net_pnl, total_fees) if total_fees > 0 else 0

    # Taker ratio
    taker_ratio = 100 - maker_rate

    return {
        # Core
        "total_trades": total_trades,
        "winners": winners,
        "losers": losers,
        "win_rate": round(win_rate, 1),
        "avg_winner": round(avg_winner, 2),
        "avg_loser": round(avg_loser, 2),
        "net_pnl": round(net_pnl, 2),
        "gross_pnl": round(gross_pnl, 2),
        "best_trade": round(best_trade, 2),
        "worst_trade": round(worst_trade, 2),
        # Ratios
        "rr_ratio": round(rr_ratio, 2),
        "profit_factor": round(profit_factor, 2),
        "payoff_ratio": round(payoff_ratio, 2),
        "win_loss_ratio": round(wl_ratio, 2),
        # Kelly
        "kelly_full_pct": round(kelly_full * 100, 2),
        "kelly_half_pct": round(kelly_half * 100, 2),
        # Risk
        "sharpe_ratio": round(sharpe, 2),
        "sortino_ratio": round(sortino, 2),
        "max_drawdown_pct": round(max_dd, 2),
        "calmar_ratio": round(calmar, 2),
        "daily_std_dev": round(daily_std, 2),
        "expectancy": round(expectancy, 2),
        "recovery_factor": round(recovery_factor, 2),
        "edge_per_dollar": round(edge_per_dollar, 4),
        # Asymmetry
        "asymmetry": round(asymmetry, 2),
        # Streaks
        "consecutive_wins": int(consec_wins),
        "consecutive_losses": int(consec_losses),
        # Charges
        "total_fees": round(total_fees, 2),
        "maker_fill_rate": round(maker_rate, 1),
        "taker_ratio": round(taker_ratio, 1),
        "fees_pct_pnl": round(fees_pct_pnl, 2),
        "fees_pct_volume": round(fees_pct_vol, 4),
        "fees_pct_gross_profit": round(fees_pct_gross_profit, 2),
        "fees_per_trade": round(fees_per_trade, 4),
        "maker_fees": round(maker_fees, 2),
        "taker_fees": round(taker_fees, 2),
        "gst_estimate": round(gst, 2),
        "pnl_per_fee_dollar": round(pnl_per_fee_dollar, 2),
        "breakeven_trades_for_fees": breakeven_trades_for_fees,
        # Volume / sizing
        "total_volume": round(total_volume, 2),
        "avg_trade_size": round(avg_trade_size, 2),
        "avg_hold_hours": round(avg_hold_hours, 2),
        "net_per_trade": round(net_per_trade, 4),
        "trades_per_day": round(trades_per_day, 1),
        # Concentration
        "tokens_traded": int(tokens_traded),
        "top_underlying": top_und_name,
        "top_underlying_pct": round(top_und_pct, 1),
        "pareto_count": pareto_count,
        "pareto_total": pareto_total,
        # Directional
        "long_pnl": round(long_pnl, 2),
        "short_pnl": round(short_pnl, 2),
        "long_pct": round(long_pct, 1),
        "short_pct": round(short_pct, 1),
        # Instrument
        "perps_pnl": round(perps_pnl, 2),
        "options_pnl": round(options_pnl, 2),
        # Funding
        "total_funding": round(total_funding, 2),
        # Daily
        "num_trading_days": num_trading_days,
        "avg_daily_pnl": round(avg_daily_pnl, 2),
        "profitable_days": profitable_days,
        "losing_days": losing_days,
        "daily_win_rate": round(daily_win_rate, 1),
        # Monthly
        "profitable_months": profitable_months,
        "total_months": total_months,
        "monthly_consistency": round(monthly_consistency, 1),
        "best_month": round(best_month, 2),
        "worst_month": round(worst_month, 2),
        # Temporal edge
        "best_hour": int(best_hour),
        "best_hour_avg_pnl": round(best_hour_pnl, 2),
        "worst_hour": int(worst_hour),
        "worst_hour_avg_pnl": round(worst_hour_pnl, 2),
        "best_day_of_week": best_dow,
        "worst_day_of_week": worst_dow,
        # Projection
        "apr": round(apr, 1),
    }


# ============================================================================
# GRADING  (4 dimensions, 25 pts each => 100)
# ============================================================================

def compute_grade(m: dict) -> tuple:
    """Return (score 0-100, letter grade, dimension scores dict)."""

    # --- Dimension 1: Win Rate (25 pts) ---
    wr = m["win_rate"]
    if wr >= 65:
        wr_score = 25
    elif wr >= 55:
        wr_score = 20 + (wr - 55) * 0.5
    elif wr >= 45:
        wr_score = 12 + (wr - 45) * 0.8
    elif wr >= 35:
        wr_score = 5 + (wr - 35) * 0.7
    else:
        wr_score = max(0, wr * 0.14)

    # --- Dimension 2: Risk-Reward (25 pts) ---
    # Combine profit_factor, payoff_ratio, sharpe
    pf = min(m["profit_factor"], 5)
    pr = min(m["rr_ratio"], 5)
    sh = min(max(m["sharpe_ratio"], -2), 5)

    pf_pts = min(10, pf * 3.33)  # 3.0 PF = 10 pts
    pr_pts = min(8, pr * 2.67)    # 3.0 RR = 8 pts
    sh_pts = min(7, max(0, (sh + 0.5) * 2.33))  # 2.5 sharpe = 7 pts
    rr_score = pf_pts + pr_pts + sh_pts

    # --- Dimension 3: Charges Discipline (25 pts) ---
    maker = m["maker_fill_rate"]
    fee_pct = m["fees_pct_pnl"]

    # Maker rate: higher is better (25pts if >80%, scale down)
    if maker >= 80:
        maker_pts = 12
    elif maker >= 50:
        maker_pts = 6 + (maker - 50) * 0.2
    elif maker >= 20:
        maker_pts = 2 + (maker - 20) * 0.133
    else:
        maker_pts = maker * 0.1

    # Fees as % of PnL: lower is better
    if m["net_pnl"] > 0:
        if fee_pct <= 5:
            fee_pts = 13
        elif fee_pct <= 15:
            fee_pts = 10 - (fee_pct - 5) * 0.3
        elif fee_pct <= 30:
            fee_pts = 7 - (fee_pct - 15) * 0.233
        elif fee_pct <= 60:
            fee_pts = 3.5 - (fee_pct - 30) * 0.117
        else:
            fee_pts = max(0, 1.5 - (fee_pct - 60) * 0.025)
    else:
        # If net loss, base on volume %
        vol_pct = m["fees_pct_volume"]
        if vol_pct <= 0.02:
            fee_pts = 10
        elif vol_pct <= 0.05:
            fee_pts = 6
        elif vol_pct <= 0.1:
            fee_pts = 3
        else:
            fee_pts = 1

    ch_score = maker_pts + fee_pts

    # --- Dimension 4: Asymmetry / Edge (25 pts) ---
    asym = min(m["asymmetry"], 10)
    kelly = max(m["kelly_full_pct"], -50)
    expect = m["expectancy"]
    consec_w = m["consecutive_wins"]

    asym_pts = min(8, asym * 1.6)          # 5:1 asym = 8 pts
    kelly_pts = min(8, max(0, kelly * 0.4)) # 20% kelly = 8 pts
    expect_pts = min(5, max(0, expect * 2)) if expect > 0 else 0
    streak_pts = min(4, consec_w * 0.5)     # 8 streak = 4 pts
    edge_score = asym_pts + kelly_pts + expect_pts + streak_pts

    total = wr_score + rr_score + ch_score + edge_score
    total = max(0, min(100, total))

    # Letter grade
    if total >= 93:
        grade = "A+"
    elif total >= 87:
        grade = "A"
    elif total >= 80:
        grade = "A-"
    elif total >= 73:
        grade = "B+"
    elif total >= 67:
        grade = "B"
    elif total >= 60:
        grade = "B-"
    elif total >= 53:
        grade = "C+"
    elif total >= 47:
        grade = "C"
    elif total >= 40:
        grade = "C-"
    elif total >= 33:
        grade = "D+"
    elif total >= 27:
        grade = "D"
    else:
        grade = "D-"

    dimensions = {
        "win_rate": {"score": round(wr_score, 1), "max": 25, "label": "Win Rate"},
        "risk_reward": {"score": round(rr_score, 1), "max": 25, "label": "Risk-Reward"},
        "charges": {"score": round(ch_score, 1), "max": 25, "label": "Charges Discipline"},
        "edge": {"score": round(edge_score, 1), "max": 25, "label": "Asymmetry & Edge"},
    }

    return round(total, 1), grade, dimensions


# ============================================================================
# RULE-BASED ADVICE GENERATION
# ============================================================================

def _bullet(text: str, tab) -> dict:
    return {"text": text, "related_tab": tab}


def generate_rule_based_advice(m: dict, score: float, grade: str, tone: str) -> dict:
    """Generate complete advice payload using rule-based logic."""

    is_roast = tone == "roast"
    net = m["net_pnl"]
    wr = m["win_rate"]
    rr = m["rr_ratio"]
    kelly = m["kelly_full_pct"]
    kelly_h = m["kelly_half_pct"]
    pf = m["profit_factor"]
    fees = m["total_fees"]
    maker = m["maker_fill_rate"]
    maker_fees = m["maker_fees"]
    taker_fees = m["taker_fees"]
    fee_pct = m["fees_pct_pnl"]
    sharpe = m["sharpe_ratio"]
    dd = m["max_drawdown_pct"]
    asym = m["asymmetry"]
    best = m["best_trade"]
    worst = m["worst_trade"]
    exp = m["expectancy"]
    trades = m["total_trades"]
    avg_w = m["avg_winner"]
    avg_l = m["avg_loser"]
    top_und = m["top_underlying"]
    top_pct = m["top_underlying_pct"]
    pareto_c = m["pareto_count"]
    pareto_t = m["pareto_total"]
    consec_w = m["consecutive_wins"]
    consec_l = m["consecutive_losses"]
    best_h = m["best_hour"]
    best_hour_pnl = m["best_hour_avg_pnl"]
    worst_h = m["worst_hour"]
    worst_hour_pnl = m["worst_hour_avg_pnl"]
    daily_wr = m["daily_win_rate"]
    monthly_con = m["monthly_consistency"]
    apr_val = m["apr"]
    long_pnl = m["long_pnl"]
    short_pnl = m["short_pnl"]
    funding = m["total_funding"]

    # ---- SUMMARY ----
    if is_roast:
        if net > 0:
            if grade.startswith("A"):
                summary = f"Alright, you actually know what you're doing. ${net:,.2f} net with a {grade} grade across {int(trades)} trades. Don't let it go to your head -- the market humbles everyone eventually."
            elif grade.startswith("B"):
                summary = f"${net:,.2f} profit, grade {grade}. Not terrible, not great -- you're the participation trophy of trading. {int(trades)} trades and still room to stop being mediocre."
            else:
                summary = f"You somehow squeezed ${net:,.2f} of profit out of {int(trades)} trades with a {grade} grade. That's like winning a race while running backwards -- impressive but painful to watch."
        else:
            summary = f"${net:,.2f} net P&L. Grade: {grade}. {int(trades)} trades and your account is bleeding. Even a coin flip would've done better with that win rate of {wr:.1f}%."
    else:
        if net > 0:
            summary = f"You've generated ${net:,.2f} net profit across {int(trades)} trades, earning a {grade} grade. Your {wr:.1f}% win rate with a {rr:.1f}:1 reward-risk ratio shows a structured approach. Here's how to sharpen your edge further."
        else:
            summary = f"Your portfolio shows ${net:,.2f} net P&L across {int(trades)} trades with a {grade} grade. While the numbers need improvement, understanding what's dragging performance is the first step to turning this around."

    # ---- STRENGTHS ----
    strengths = []

    # Win rate strength
    if wr >= 55:
        if is_roast:
            strengths.append(_bullet(
                f"Your {wr:.1f}% win rate is actually decent -- you hit more than you miss. {int(m['winners'])} winners vs {int(m['losers'])} losers. Even a broken clock is right twice a day, but you're at least a slow clock.",
                TAB_OVERVIEW
            ))
        else:
            strengths.append(_bullet(
                f"Strong win rate of {wr:.1f}% ({int(m['winners'])} wins / {int(m['losers'])} losses). This is above the 50% baseline, indicating positive trade selection skill.",
                TAB_OVERVIEW
            ))

    # Risk-reward strength
    if rr >= 1.5:
        if is_roast:
            strengths.append(_bullet(
                f"Your winners average ${avg_w:,.2f} vs losers at ${avg_l:,.2f} -- a {rr:.1f}:1 ratio. At least when you're right, you milk it properly.",
                TAB_RISK_METRICS
            ))
        else:
            strengths.append(_bullet(
                f"Solid {rr:.1f}:1 reward-to-risk ratio. Average winner (${avg_w:,.2f}) meaningfully exceeds average loser (${avg_l:,.2f}), showing good trade management.",
                TAB_RISK_METRICS
            ))

    # Profit factor
    if pf >= 1.5:
        if is_roast:
            strengths.append(_bullet(
                f"Profit factor of {pf:.2f}x -- for every dollar lost, you're making ${pf:.2f} back. Finally, someone who can do basic math in the markets.",
                TAB_RISK_METRICS
            ))
        else:
            strengths.append(_bullet(
                f"Profit factor of {pf:.2f}x means your gross profits are {pf:.2f} times your gross losses -- a healthy margin of safety.",
                TAB_RISK_METRICS
            ))

    # Sharpe
    if sharpe >= 1.0:
        if is_roast:
            strengths.append(_bullet(
                f"Sharpe ratio of {sharpe:.2f}. You're generating returns without insane volatility. Boring? Yes. Smart? Also yes.",
                TAB_RISK_METRICS
            ))
        else:
            strengths.append(_bullet(
                f"Sharpe ratio of {sharpe:.2f} indicates strong risk-adjusted returns. Anything above 1.0 is considered good for crypto trading.",
                TAB_RISK_METRICS
            ))

    # Consecutive wins
    if consec_w >= 5:
        if is_roast:
            strengths.append(_bullet(
                f"Best win streak: {consec_w} in a row. You were on fire -- or the market was just handing out free money. Probably the latter.",
                TAB_OVERVIEW
            ))
        else:
            strengths.append(_bullet(
                f"Impressive {consec_w}-trade winning streak demonstrates the ability to stay in rhythm and capitalize on favorable conditions.",
                TAB_OVERVIEW
            ))

    # Maker rate
    if maker >= 50:
        if is_roast:
            strengths.append(_bullet(
                f"{maker:.1f}% maker fill rate -- you actually use limit orders like a grown-up. Saved yourself from paying the full taker fee tax.",
                TAB_CHARGES
            ))
        else:
            strengths.append(_bullet(
                f"Maker fill rate of {maker:.1f}% shows good execution discipline, minimizing trading costs through limit orders.",
                TAB_CHARGES
            ))

    # Best trade
    if best > 0:
        if is_roast:
            strengths.append(_bullet(
                f"Best trade: +${best:,.2f}. At least one trade went right enough to screenshot for Twitter.",
                TAB_TRADE_LOG
            ))
        else:
            strengths.append(_bullet(
                f"Best individual trade of +${best:,.2f} shows ability to capture large moves when positioned correctly.",
                TAB_TRADE_LOG
            ))

    # Daily consistency
    if daily_wr >= 55:
        strengths.append(_bullet(
            f"{'You manage to be green ' if is_roast else ''}{daily_wr:.1f}% of trading days are profitable ({m['profitable_days']} of {m['num_trading_days']} days){' -- at least you show up with a pulse' if is_roast else ', reflecting consistent daily execution'}.",
            TAB_PNL_ANALYSIS
        ))

    # Monthly consistency
    if monthly_con >= 60:
        strengths.append(_bullet(
            f"{'Month over month, you actually make money' if is_roast else 'Monthly consistency is strong'}: {monthly_con:.0f}% of months profitable ({m['profitable_months']} of {m['total_months']}){'. Wild concept.' if is_roast else '.'}",
            TAB_PNL_ANALYSIS
        ))

    # Trim to 4 best strengths
    strengths = strengths[:4]

    # If we have fewer than 3, add generic ones
    if len(strengths) < 3:
        if trades >= 50:
            strengths.append(_bullet(
                f"{'At least you have' if is_roast else 'Solid'} sample size of {int(trades)} trades{' -- enough rope to hang yourself with data' if is_roast else ' provides statistical significance for analysis'}.",
                TAB_TRADE_LOG
            ))
        if len(strengths) < 3 and m["tokens_traded"] >= 5:
            strengths.append(_bullet(
                f"Diversified across {int(m['tokens_traded'])} tokens{' -- spreading your losses like butter' if is_roast else ', reducing single-asset concentration risk'}.",
                TAB_INSTRUMENTS
            ))
        if len(strengths) < 3:
            strengths.append(_bullet(
                f"{'You at least track your data -- most degens just YOLO and cry' if is_roast else 'You are tracking and analyzing your performance, which puts you ahead of most retail traders'}.",
                TAB_AI_ADVICE
            ))

    # ---- WEAKNESSES ----
    weaknesses = []

    # Low win rate
    if wr < 45:
        if is_roast:
            weaknesses.append(_bullet(
                f"{wr:.1f}% win rate -- you lose more than half your trades. A literal coin flip would outperform your entry strategy.",
                TAB_OVERVIEW
            ))
        else:
            weaknesses.append(_bullet(
                f"Win rate of {wr:.1f}% is below the 50% threshold. Review entry criteria -- are you chasing momentum or entering at weak levels?",
                TAB_OVERVIEW
            ))

    # Poor R:R
    if rr < 1.2 and rr > 0:
        if is_roast:
            weaknesses.append(_bullet(
                f"Your {rr:.1f}:1 risk-reward is tragic. Average winner ${avg_w:,.2f} barely beats average loser ${avg_l:,.2f}. You're risking dollars to make dimes.",
                TAB_RISK_METRICS
            ))
        else:
            weaknesses.append(_bullet(
                f"Risk-reward ratio of {rr:.1f}:1 needs improvement. Average winner (${avg_w:,.2f}) should ideally be 1.5-2x the average loser (${avg_l:,.2f}).",
                TAB_RISK_METRICS
            ))

    # High fees
    if net > 0 and fee_pct > 20:
        if is_roast:
            weaknesses.append(_bullet(
                f"Fees ate {fee_pct:.1f}% of your gross profit -- ${fees:,.2f} donated to the exchange. You're basically working for Delta's shareholders.",
                TAB_CHARGES
            ))
        else:
            weaknesses.append(_bullet(
                f"Trading fees of ${fees:,.2f} represent {fee_pct:.1f}% of gross profit. This is a significant drag -- focus on reducing taker orders and optimizing execution.",
                TAB_CHARGES
            ))
    elif fees > abs(net) * 0.5 and net <= 0:
        if is_roast:
            weaknesses.append(_bullet(
                f"Your fees (${fees:,.2f}) are literally bigger than your P&L. The exchange thanks you for your donation.",
                TAB_CHARGES
            ))
        else:
            weaknesses.append(_bullet(
                f"Fees of ${fees:,.2f} are disproportionate to net P&L. Fee optimization should be an immediate priority.",
                TAB_CHARGES
            ))

    # Low maker rate
    if maker < 30:
        if is_roast:
            weaknesses.append(_bullet(
                f"Maker fill rate: {maker:.1f}%. You're market-ordering everything like you're in a rush to lose money faster. Taker fees are eating you alive.",
                TAB_CHARGES
            ))
        else:
            weaknesses.append(_bullet(
                f"Maker fill rate of {maker:.1f}% means most trades hit taker fees. Using more limit orders could save ${(taker_fees - maker_fees) * 0.3:,.2f}+ in fees.",
                TAB_CHARGES
            ))

    # Max drawdown
    if dd < -20:
        if is_roast:
            weaknesses.append(_bullet(
                f"Max drawdown of {dd:.1f}% -- at one point you gave back a fifth of your peak. That's not risk management, that's a slow-motion car crash.",
                TAB_RISK_METRICS
            ))
        else:
            weaknesses.append(_bullet(
                f"Max drawdown of {dd:.1f}% is steep. Consider implementing position sizing limits or daily loss limits to protect capital during adverse periods.",
                TAB_RISK_METRICS
            ))

    # Concentration
    if top_pct > 50 and m["tokens_traded"] > 3:
        if is_roast:
            weaknesses.append(_bullet(
                f"{top_und} accounts for {top_pct:.0f}% of your total P&L impact. One token controlling your destiny -- that's not trading, that's gambling with extra steps.",
                TAB_INSTRUMENTS
            ))
        else:
            weaknesses.append(_bullet(
                f"High concentration: {top_und} drives {top_pct:.0f}% of P&L. Diversifying across more setups would reduce single-asset dependency.",
                TAB_INSTRUMENTS
            ))

    # Negative expectancy
    if exp < 0:
        if is_roast:
            weaknesses.append(_bullet(
                f"Expectancy is ${exp:,.2f} per trade -- you literally lose money on average per trade. The math says stop trading and go touch grass.",
                TAB_RISK_METRICS
            ))
        else:
            weaknesses.append(_bullet(
                f"Negative expectancy of ${exp:,.2f} per trade means the current strategy is losing money on average. This requires a fundamental strategy review.",
                TAB_RISK_METRICS
            ))

    # Bad loss streak
    if consec_l >= 5:
        weaknesses.append(_bullet(
            f"{'A ' if is_roast else ''}{consec_l}-trade loss streak{' -- how did you not rage-quit?' if is_roast else ' suggests potential for tilt or revenge trading. Consider mandatory cool-off periods after 3 consecutive losses.'}",
            TAB_OVERVIEW
        ))

    weaknesses = weaknesses[:4]

    if len(weaknesses) < 3:
        if worst < -100:
            weaknesses.append(_bullet(
                f"Worst trade: ${worst:,.2f}{'. Ouch. Did you fall asleep with a position open?' if is_roast else '. Review if a stop-loss could have limited this loss.'}",
                TAB_TRADE_LOG
            ))
        if len(weaknesses) < 3 and m["avg_hold_hours"] > 72:
            weaknesses.append(_bullet(
                f"Average hold time of {m['avg_hold_hours']:.0f} hours{' -- you hold trades longer than most people hold grudges' if is_roast else ' is long. Consider if tighter time-based exits could improve capital efficiency'}.",
                TAB_TRADE_LOG
            ))
        if len(weaknesses) < 3:
            weaknesses.append(_bullet(
                f"{'No obvious other weaknesses. Don\\'t get cocky -- the market is always watching.' if is_roast else 'Continue monitoring performance metrics for emerging weaknesses as market conditions change.'}",
                TAB_AI_ADVICE
            ))

    # ---- RECOMMENDATIONS ----
    recs = []

    # Kelly sizing
    if kelly > 0:
        optimal_size = kelly_h
        if is_roast:
            recs.append(_bullet(
                f"Kelly Criterion says bet {kelly:.1f}% per trade. You should use Half Kelly ({kelly_h:.1f}%) because you're not as good as you think. This alone could stabilize your equity curve.",
                TAB_RISK_METRICS
            ))
        else:
            recs.append(_bullet(
                f"Optimal position sizing via Half Kelly is {kelly_h:.1f}% of capital per trade (full Kelly: {kelly:.1f}%). This balances growth with drawdown protection.",
                TAB_RISK_METRICS
            ))
    elif kelly <= 0:
        if is_roast:
            recs.append(_bullet(
                f"Kelly Criterion is {kelly:.1f}% -- literally negative. The math says you should be REDUCING position size to near zero until you fix your edge. Your current strategy has no mathematical right to exist.",
                TAB_RISK_METRICS
            ))
        else:
            recs.append(_bullet(
                f"Kelly Criterion is {kelly:.1f}% (negative), indicating no positive edge at current parameters. Reduce position sizes and focus on improving win rate or R:R ratio before scaling.",
                TAB_RISK_METRICS
            ))

    # Fee optimization
    if maker < 50 and fees > 10:
        potential_save = fees * 0.3  # rough estimate
        if is_roast:
            recs.append(_bullet(
                f"Switch to limit orders. Your {maker:.0f}% maker rate is embarrassing. Even bumping to 60% could save ~${potential_save:,.2f} in fees. That's free money you're lighting on fire.",
                TAB_CHARGES
            ))
        else:
            recs.append(_bullet(
                f"Increase maker fill rate from {maker:.0f}% to 60%+ by using more limit orders. Estimated annual fee savings: ~${potential_save:,.2f}.",
                TAB_CHARGES
            ))

    # Temporal edge
    if best_hour_pnl > 0 and worst_hour_pnl < 0:
        if is_roast:
            recs.append(_bullet(
                f"You crush it at {best_h}:00 UTC (avg ${best_hour_pnl:,.2f}/trade) and get destroyed at {worst_h}:00 UTC (avg ${worst_hour_pnl:,.2f}/trade). Maybe just... don't trade at {worst_h}:00?",
                TAB_PNL_ANALYSIS
            ))
        else:
            recs.append(_bullet(
                f"Focus trading around {best_h}:00 UTC (avg +${best_hour_pnl:,.2f}/trade) and reduce activity at {worst_h}:00 UTC (avg ${worst_hour_pnl:,.2f}/trade) to exploit your temporal edge.",
                TAB_PNL_ANALYSIS
            ))

    # Concentration recommendation
    if top_pct > 40 and m["tokens_traded"] > 3:
        if is_roast:
            recs.append(_bullet(
                f"Stop putting all your eggs in the {top_und} basket ({top_pct:.0f}% of P&L). Spread across your top 3-5 tokens. You know, like someone who passed Finance 101.",
                TAB_INSTRUMENTS
            ))
        else:
            recs.append(_bullet(
                f"Reduce concentration on {top_und} ({top_pct:.0f}% of P&L). Cap single-asset exposure at 25-30% and allocate across your top 3-5 performing assets.",
                TAB_INSTRUMENTS
            ))

    # Cut worst losers
    if worst < -50:
        stop_level = abs(worst) * 0.3
        savings = abs(worst) * 0.5
        if is_roast:
            recs.append(_bullet(
                f"Your worst trade was ${worst:,.2f}. A simple ${stop_level:,.0f} stop-loss would've saved you ~${savings:,.0f}. Stop-losses exist for a reason -- use them.",
                TAB_TRADE_LOG
            ))
        else:
            recs.append(_bullet(
                f"Implement a max loss of ${stop_level:,.0f} per trade. This would have reduced your worst loss (${worst:,.2f}) by ~${savings:,.0f}.",
                TAB_TRADE_LOG
            ))

    # Improve R:R
    if rr < 1.5 and rr > 0:
        target_rr = 2.0
        new_avg_w = abs(avg_l) * target_rr
        improvement = (new_avg_w - avg_w) * m["winners"]
        if is_roast:
            recs.append(_bullet(
                f"Your {rr:.1f}:1 R:R is amateur hour. Target 2:1 minimum -- that means holding winners to ${new_avg_w:,.2f} instead of cutting at ${avg_w:,.2f}. Potential upside: +${improvement:,.0f}.",
                TAB_RISK_METRICS
            ))
        else:
            recs.append(_bullet(
                f"Improve R:R from {rr:.1f}:1 to 2:1 by letting winners run to ${new_avg_w:,.2f} avg. With current win count, this could add +${improvement:,.0f} to net P&L.",
                TAB_RISK_METRICS
            ))

    # Drawdown management
    if dd < -15:
        if is_roast:
            recs.append(_bullet(
                f"Your {dd:.1f}% max drawdown needs a leash. Set a daily loss limit of 2-3% and walk away. Your future self will thank you instead of cursing you.",
                TAB_RISK_METRICS
            ))
        else:
            recs.append(_bullet(
                f"Cap daily drawdown at 2-3% of capital. Current max DD of {dd:.1f}% suggests inadequate loss limits during losing streaks.",
                TAB_RISK_METRICS
            ))

    recs = recs[:4]

    if len(recs) < 3:
        if is_roast:
            recs.append(_bullet(
                "Start a trading journal. Write down your entries, exits, and most importantly WHY. Right now you're trading on vibes and prayers.",
                TAB_AI_ADVICE
            ))
        else:
            recs.append(_bullet(
                "Maintain a detailed trading journal documenting entry/exit rationale for each trade to identify repeating patterns in both wins and losses.",
                TAB_AI_ADVICE
            ))

    # ---- PARETO INSIGHT ----
    if pareto_c > 0 and pareto_t > 0:
        pareto_pct = round(pareto_c / pareto_t * 100)
        if is_roast:
            pareto_insight = f"Just {pareto_c} of your {pareto_t} tokens ({pareto_pct}%) drive 80% of your P&L impact. The rest are basically noise -- expensive noise that costs you fees."
        else:
            pareto_insight = f"{pareto_c} out of {pareto_t} tokens ({pareto_pct}%) account for 80% of your P&L. Consider focusing capital on these high-impact assets and reducing exposure to the long tail."
    else:
        pareto_insight = "Insufficient data for Pareto analysis."

    return {
        "summary": summary,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "recommendations": recs,
        "kelly_full": round(kelly, 2),
        "kelly_half": round(kelly_h, 2),
        "pareto_insight": pareto_insight,
        "overall_score": score,
        "grade": grade,
    }


# ============================================================================
# GROQ LLM ENHANCEMENT  (optional, falls back to rule-based)
# ============================================================================

GROQ_SYSTEM_PROMPT_HELPFUL = """You are an expert trading coach analyzing a crypto derivatives trader's performance data. You provide encouraging but direct advice, like a supportive mentor who doesn't sugarcoat.

You will receive a JSON object with computed trading metrics. Generate a response in the following JSON format:
{
  "summary": "1-2 sentence executive summary with specific numbers",
  "strengths": [{"text": "strength with specific numbers from data", "related_tab": <0-9 or null>}],
  "weaknesses": [{"text": "weakness with specific numbers from data", "related_tab": <0-9 or null>}],
  "recommendations": [{"text": "actionable rec with dollar impact estimate", "related_tab": <0-9 or null>}]
}

Tab mapping: 0=Overview, 1=PnL Analysis, 2=Instruments, 3=Funding, 4=Expiry, 5=Risk & Metrics, 6=Charges, 7=Open Portfolio, 8=Trade Log, 9=AI Advice.

Rules:
- Include 3-4 items in each array
- Every bullet MUST reference specific numbers from the metrics
- Recommendations must include estimated dollar impact where possible
- Be encouraging but honest about weaknesses
- Use the trader's actual data, never make up numbers"""

GROQ_SYSTEM_PROMPT_ROAST = """You are a savage Gordon Ramsay-style trading roast master analyzing a crypto derivatives trader's performance. You deliver brutal humor with real numbers -- think "you donkey!" but for traders.

You will receive a JSON object with computed trading metrics. Generate a response in the following JSON format:
{
  "summary": "1-2 sentence savage executive summary with specific numbers",
  "strengths": [{"text": "backhanded compliment with specific numbers", "related_tab": <0-9 or null>}],
  "weaknesses": [{"text": "savage roast with specific numbers from data", "related_tab": <0-9 or null>}],
  "recommendations": [{"text": "brutally honest actionable rec with dollar impact", "related_tab": <0-9 or null>}]
}

Tab mapping: 0=Overview, 1=PnL Analysis, 2=Instruments, 3=Funding, 4=Expiry, 5=Risk & Metrics, 6=Charges, 7=Open Portfolio, 8=Trade Log, 9=AI Advice.

Rules:
- Include 3-4 items in each array
- Every bullet MUST reference specific numbers from the metrics (roast with DATA, not just insults)
- Recommendations must include estimated dollar impact
- Be savage and funny but the underlying advice must be REAL and actionable
- Use the trader's actual data, never make up numbers
- Think Gordon Ramsay meets Wall Street -- devastating but educational"""


async def enhance_with_groq(metrics: dict, tone: str, rule_based: dict) -> dict | None:
    """Call Groq API to enhance advice. Returns None on failure."""
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        return None

    system_prompt = GROQ_SYSTEM_PROMPT_ROAST if tone == "roast" else GROQ_SYSTEM_PROMPT_HELPFUL

    # Prepare a focused metrics payload (avoid sending entire trade log)
    focused_metrics = {k: v for k, v in metrics.items()}

    user_message = json.dumps({
        "metrics": focused_metrics,
        "current_grade": rule_based["grade"],
        "current_score": rule_based["overall_score"],
        "kelly_full": rule_based["kelly_full"],
        "kelly_half": rule_based["kelly_half"],
        "pareto_insight": rule_based["pareto_insight"],
    }, indent=2)

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.7 if tone == "roast" else 0.5,
                    "max_tokens": 1500,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            parsed = json.loads(content)

            # Validate structure
            result = {}
            if "summary" in parsed and isinstance(parsed["summary"], str) and len(parsed["summary"]) > 10:
                result["summary"] = parsed["summary"]
            if "strengths" in parsed and isinstance(parsed["strengths"], list) and len(parsed["strengths"]) >= 2:
                result["strengths"] = _normalize_bullets(parsed["strengths"])
            if "weaknesses" in parsed and isinstance(parsed["weaknesses"], list) and len(parsed["weaknesses"]) >= 2:
                result["weaknesses"] = _normalize_bullets(parsed["weaknesses"])
            if "recommendations" in parsed and isinstance(parsed["recommendations"], list) and len(parsed["recommendations"]) >= 2:
                result["recommendations"] = _normalize_bullets(parsed["recommendations"])

            return result if result else None

    except Exception:
        # Silently fall back to rule-based
        traceback.print_exc()
        return None


def _normalize_bullets(items: list) -> list:
    """Ensure each bullet has {text, related_tab} shape."""
    normalized = []
    for item in items:
        if isinstance(item, dict):
            text = item.get("text", "")
            tab = item.get("related_tab")
            if isinstance(tab, int) and 0 <= tab <= 9:
                pass
            else:
                tab = None
            if text:
                normalized.append({"text": text, "related_tab": tab})
        elif isinstance(item, str):
            normalized.append({"text": item, "related_tab": None})
    return normalized[:4]


# ============================================================================
# MAIN ENDPOINT
# ============================================================================

@app.post("/api/advice")
async def advice(request: Request):
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON body"}, status_code=400)

    tone = body.get("tone", "helpful")
    if tone not in ("helpful", "roast"):
        tone = "helpful"
    report = body.get("report", {})

    if not report or not report.get("overview"):
        return JSONResponse({
            "summary": "No report data provided. Run the analysis first.",
            "strengths": [],
            "weaknesses": [],
            "recommendations": [],
            "kelly_full": 0,
            "kelly_half": 0,
            "pareto_insight": "No data.",
            "overall_score": 0,
            "grade": "?",
            "metrics": {},
            "dimensions": {},
            "tone": tone,
        })

    # Step 1: Compute 30+ metrics
    metrics = compute_metrics(report)

    # Step 2: Grade
    score, grade, dimensions = compute_grade(metrics)

    # Step 3: Rule-based advice
    advice_data = generate_rule_based_advice(metrics, score, grade, tone)
    advice_data["dimensions"] = dimensions
    advice_data["metrics"] = metrics
    advice_data["tone"] = tone

    # Step 4: Optionally enhance with Groq
    groq_result = await enhance_with_groq(metrics, tone, advice_data)
    if groq_result:
        # Override only the fields Groq returned successfully
        if "summary" in groq_result:
            advice_data["summary"] = groq_result["summary"]
        if "strengths" in groq_result:
            advice_data["strengths"] = groq_result["strengths"]
        if "weaknesses" in groq_result:
            advice_data["weaknesses"] = groq_result["weaknesses"]
        if "recommendations" in groq_result:
            advice_data["recommendations"] = groq_result["recommendations"]
        advice_data["enhanced_by_ai"] = True
    else:
        advice_data["enhanced_by_ai"] = False

    return JSONResponse(advice_data)
