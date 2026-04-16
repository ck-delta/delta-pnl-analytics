from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import json
import time
import hashlib
import hmac
import httpx

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_URL = "https://api.india.delta.exchange"

def sse_event(event_type: str, data: dict) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


class DeltaClient:
    def __init__(self, api_key: str, api_secret: str):
        self.api_key = api_key
        self.api_secret = api_secret
        self.client = httpx.Client(base_url=BASE_URL, timeout=30.0)

    def _headers(self, method: str, path: str, query: str = "", body: str = ""):
        timestamp = str(int(time.time()))
        message = method + timestamp + path + query + body
        signature = hmac.new(
            self.api_secret.encode("utf-8"),
            message.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return {
            "api-key": self.api_key,
            "signature": signature,
            "timestamp": timestamp,
            "User-Agent": "DeltaPnLAnalytics/1.0",
            "Content-Type": "application/json",
        }

    def get(self, path: str, params: dict | None = None) -> dict:
        qs = ""
        if params:
            qs = "&".join(f"{k}={v}" for k, v in params.items() if v is not None)
        headers = self._headers("GET", path, qs)
        url = path + ("?" + qs if qs else "")
        resp = self.client.get(url, headers=headers)
        resp.raise_for_status()
        return resp.json()

    def get_all_paginated(self, path: str, params: dict | None = None):
        """Fetch all pages from a paginated endpoint."""
        all_results = []
        after = None
        base_params = dict(params or {})
        base_params["page_size"] = "50"

        while True:
            p = dict(base_params)
            if after:
                p["after"] = after

            data = self.get(path, p)
            if not data.get("success", False):
                break

            results = data.get("result", [])
            all_results.extend(results)

            meta = data.get("meta", {})
            after = meta.get("after")
            if not after or len(results) < 50:
                break

        return all_results

    def close(self):
        self.client.close()


@app.post("/api/analyze")
async def analyze(request: Request):
    body = await request.json()
    api_key = body.get("api_key", "")
    api_secret = body.get("api_secret", "")

    if not api_key or not api_secret:
        return StreamingResponse(
            iter([sse_event("error", {"message": "API key and secret are required"})]),
            media_type="text/event-stream",
        )

    def generate():
        client = DeltaClient(api_key, api_secret)
        try:
            # Step 0: Validate credentials
            yield sse_event("progress", {
                "step": "Connecting to Delta Exchange...",
                "stepIndex": 0, "totalSteps": 7, "percent": 5,
            })
            try:
                balances = client.get("/v2/wallet/balances")
                if not balances.get("success"):
                    yield sse_event("error", {"message": "Invalid API key or missing read permission"})
                    return
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 401:
                    yield sse_event("error", {"message": "Invalid API key or secret"})
                else:
                    yield sse_event("error", {"message": f"Delta API error: {e.response.status_code}"})
                return
            except Exception as e:
                yield sse_event("error", {"message": f"Connection failed: {str(e)}"})
                return

            # Step 1: Fetch products
            yield sse_event("progress", {
                "step": "Fetching product metadata...",
                "stepIndex": 1, "totalSteps": 7, "percent": 10,
            })
            products_resp = client.get("/v2/products", {"page_size": "500"})
            products = products_resp.get("result", [])
            products_map = {p["id"]: p for p in products}

            # Step 2: Fetch fills (the long one)
            yield sse_event("progress", {
                "step": "Fetching fill history...",
                "stepIndex": 2, "totalSteps": 7, "percent": 15,
            })
            fills = []
            after = None
            page = 0
            while True:
                params = {"page_size": "50"}
                if after:
                    params["after"] = after
                data = client.get("/v2/fills", params)
                if not data.get("success"):
                    break
                batch = data.get("result", [])
                fills.extend(batch)
                page += 1

                pct = min(15 + (page * 2), 55)
                yield sse_event("progress", {
                    "step": "Fetching fill history...",
                    "stepIndex": 2, "totalSteps": 7, "percent": pct,
                    "detail": f"{len(fills)} fills fetched ({page} pages)",
                })

                meta = data.get("meta", {})
                after = meta.get("after")
                if not after or len(batch) < 50:
                    break

            # Step 3: Fetch wallet transactions
            yield sse_event("progress", {
                "step": "Fetching wallet transactions...",
                "stepIndex": 3, "totalSteps": 7, "percent": 60,
            })
            transactions = client.get_all_paginated("/v2/wallet/transactions")

            # Step 4: Fetch open positions
            yield sse_event("progress", {
                "step": "Fetching open positions...",
                "stepIndex": 4, "totalSteps": 7, "percent": 70,
            })
            positions_resp = client.get("/v2/positions/margined")
            positions = positions_resp.get("result", []) if positions_resp.get("success") else []

            # Step 5: Match trades
            yield sse_event("progress", {
                "step": "Matching trades...",
                "stepIndex": 5, "totalSteps": 7, "percent": 80,
            })
            matched_trades = match_trades(fills, products_map)

            # Step 6: Compute analytics
            yield sse_event("progress", {
                "step": "Computing analytics...",
                "stepIndex": 6, "totalSteps": 7, "percent": 90,
            })
            report = compute_analytics(
                matched_trades, fills, transactions, positions,
                products_map, balances.get("result", [])
            )

            yield sse_event("progress", {
                "step": "Done!",
                "stepIndex": 7, "totalSteps": 7, "percent": 100,
            })

            yield sse_event("complete", report)

        except Exception as e:
            yield sse_event("error", {"message": f"Analysis failed: {str(e)}"})
        finally:
            client.close()

    return StreamingResponse(generate(), media_type="text/event-stream")


# ============================================
# TRADE MATCHING
# ============================================

def match_trades(fills: list, products_map: dict) -> list:
    """Match fills into round-trip trades using FIFO."""
    sorted_fills = sorted(fills, key=lambda f: f.get("created_at", ""))
    positions: dict = {}  # product_id -> {size, avg_entry, fees, first_fill_time}
    trades = []
    trade_id = 0

    for fill in sorted_fills:
        pid = fill.get("product_id")
        if pid is None:
            continue

        product = products_map.get(pid, {})
        contract_value = float(product.get("contract_value", "1") or "1")
        size = int(fill.get("size", 0))
        price = float(fill.get("price", "0") or "0")
        fee = abs(float(fill.get("commission", "0") or "0"))
        side = fill.get("side", "")
        fill_time = fill.get("created_at", "")
        role = fill.get("role", "taker")

        if size == 0 or price == 0:
            continue

        signed = size if side == "buy" else -size

        pos = positions.get(pid, {
            "size": 0, "avg_entry": 0.0, "fees": 0.0,
            "first_time": fill_time, "role": role,
        })

        old_size = pos["size"]
        new_size = old_size + signed

        # Same direction — adding to position
        same_dir = (old_size >= 0 and signed > 0) or (old_size <= 0 and signed < 0)
        if same_dir or old_size == 0:
            if abs(old_size) + size > 0:
                total = pos["avg_entry"] * abs(old_size) + price * size
                pos["avg_entry"] = total / (abs(old_size) + size)
            pos["size"] = new_size
            pos["fees"] += fee
            if old_size == 0:
                pos["first_time"] = fill_time
                pos["role"] = role
            positions[pid] = pos
            continue

        # Closing or flipping
        close_qty = min(abs(signed), abs(old_size))
        if close_qty > 0:
            direction = "long" if old_size > 0 else "short"
            if direction == "long":
                pnl = close_qty * contract_value * (price - pos["avg_entry"])
            else:
                pnl = close_qty * contract_value * (pos["avg_entry"] - price)

            total_fees = pos["fees"] + fee
            underlying = product.get("underlying_asset", {}).get("symbol", "")
            ct = product.get("contract_type", "perpetual_futures")
            if "call" in ct:
                inst_type = "call"
            elif "put" in ct:
                inst_type = "put"
            else:
                inst_type = "perpetual"

            notional = close_qty * contract_value * price
            pnl_pct = (pnl / notional * 100) if notional else 0

            # Hold duration in hours
            try:
                from datetime import datetime
                t0 = datetime.fromisoformat(pos["first_time"].replace("Z", "+00:00"))
                t1 = datetime.fromisoformat(fill_time.replace("Z", "+00:00"))
                hold_hours = (t1 - t0).total_seconds() / 3600
            except Exception:
                hold_hours = 0

            trade_id += 1
            trades.append({
                "id": str(trade_id),
                "underlying": underlying or fill.get("product_symbol", "")[:3],
                "product_symbol": fill.get("product_symbol", ""),
                "instrument_type": inst_type,
                "direction": direction,
                "entry_time": pos["first_time"],
                "exit_time": fill_time,
                "entry_price": pos["avg_entry"],
                "exit_price": price,
                "size": close_qty,
                "notional_value": notional,
                "pnl": round(pnl, 4),
                "pnl_pct": round(pnl_pct, 4),
                "fees": round(total_fees, 4),
                "funding_pnl": 0,  # attributed later from transactions
                "net_pnl": round(pnl - total_fees, 4),
                "hold_duration_hours": round(hold_hours, 2),
                "leverage": 0,
                "role": pos.get("role", "taker"),
            })

        remaining = abs(signed) - close_qty
        if remaining > 0:
            # Flip position
            pos = {
                "size": remaining if signed > 0 else -remaining,
                "avg_entry": price,
                "fees": 0.0,
                "first_time": fill_time,
                "role": role,
            }
        else:
            pos = {"size": new_size, "avg_entry": pos["avg_entry"] if new_size != 0 else 0,
                   "fees": 0.0, "first_time": pos["first_time"], "role": role}
            if new_size == 0:
                pos["avg_entry"] = 0

        positions[pid] = pos

    return trades


# ============================================
# ANALYTICS COMPUTATION
# ============================================

def compute_analytics(trades, fills, transactions, positions, products_map, balances):
    """Compute all analytics from matched trades and raw data."""
    from collections import defaultdict
    from datetime import datetime
    import math

    # --- OVERVIEW ---
    winning = [t for t in trades if t["net_pnl"] > 0]
    losing = [t for t in trades if t["net_pnl"] < 0]
    breakeven = [t for t in trades if t["net_pnl"] == 0]

    net_pnl = sum(t["net_pnl"] for t in trades)
    gross_pnl = sum(t["pnl"] for t in trades)
    total_fees = sum(t["fees"] for t in trades)
    win_rate = len(winning) / len(trades) * 100 if trades else 0
    avg_winner = sum(t["net_pnl"] for t in winning) / len(winning) if winning else 0
    avg_loser = sum(t["net_pnl"] for t in losing) / len(losing) if losing else 0

    # Unique underlyings
    underlyings = list(set(t["underlying"] for t in trades))

    # Equity curve
    sorted_trades = sorted(trades, key=lambda t: t["exit_time"])
    cumulative = 0
    equity_curve = []
    daily_pnl_map = defaultdict(float)
    daily_trades_map = defaultdict(int)

    for t in sorted_trades:
        cumulative += t["net_pnl"]
        try:
            d = t["exit_time"][:10]
        except Exception:
            d = "unknown"
        daily_pnl_map[d] += t["net_pnl"]
        daily_trades_map[d] += 1
        equity_curve.append({"date": t["exit_time"], "pnl": t["net_pnl"], "cumulative": round(cumulative, 2)})

    # Daily P&L list
    daily_pnl = [{"date": d, "pnl": round(v, 2), "trades": daily_trades_map[d]}
                 for d, v in sorted(daily_pnl_map.items())]

    # Hourly P&L
    hourly_map = defaultdict(lambda: {"total": 0, "count": 0, "wins": 0})
    for t in trades:
        try:
            h = int(t["exit_time"][11:13])
        except Exception:
            continue
        hourly_map[h]["total"] += t["net_pnl"]
        hourly_map[h]["count"] += 1
        if t["net_pnl"] > 0:
            hourly_map[h]["wins"] += 1

    hourly_pnl = [{"hour": h, "avg_pnl": round(d["total"] / d["count"], 2) if d["count"] else 0,
                   "trades": d["count"],
                   "win_rate": round(d["wins"] / d["count"] * 100, 1) if d["count"] else 0}
                  for h, d in sorted(hourly_map.items())]

    # Day of week
    dow_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    dow_map = defaultdict(lambda: {"total": 0, "count": 0, "wins": 0})
    for t in trades:
        try:
            dt = datetime.fromisoformat(t["exit_time"].replace("Z", "+00:00"))
            dow = dt.weekday()
        except Exception:
            continue
        dow_map[dow]["total"] += t["net_pnl"]
        dow_map[dow]["count"] += 1
        if t["net_pnl"] > 0:
            dow_map[dow]["wins"] += 1

    day_of_week = [{"day": dow_names[i],
                    "avg_pnl": round(dow_map[i]["total"] / dow_map[i]["count"], 2) if dow_map[i]["count"] else 0,
                    "trades": dow_map[i]["count"],
                    "win_rate": round(dow_map[i]["wins"] / dow_map[i]["count"] * 100, 1) if dow_map[i]["count"] else 0}
                   for i in range(7)]

    # Monthly P&L
    monthly_map = defaultdict(lambda: {"trades": 0, "gross": 0, "fees": 0, "funding": 0, "net": 0, "wins": 0, "best": 0, "worst": 0})
    for t in sorted_trades:
        m = t["exit_time"][:7]
        monthly_map[m]["trades"] += 1
        monthly_map[m]["gross"] += t["pnl"]
        monthly_map[m]["fees"] += t["fees"]
        monthly_map[m]["net"] += t["net_pnl"]
        if t["net_pnl"] > 0:
            monthly_map[m]["wins"] += 1
        monthly_map[m]["best"] = max(monthly_map[m]["best"], t["net_pnl"])
        monthly_map[m]["worst"] = min(monthly_map[m]["worst"], t["net_pnl"])

    monthly = [{"month": m, "trades": d["trades"], "gross_pnl": round(d["gross"], 2),
                "fees": round(d["fees"], 2), "funding": round(d["funding"], 2),
                "net_pnl": round(d["net"], 2),
                "win_rate": round(d["wins"] / d["trades"] * 100, 1) if d["trades"] else 0,
                "best": round(d["best"], 2), "worst": round(d["worst"], 2)}
               for m, d in sorted(monthly_map.items())]

    # P&L by underlying
    und_map = defaultdict(lambda: {"trades": 0, "pnl": 0, "wins": 0, "capital": 0})
    for t in trades:
        u = t["underlying"]
        und_map[u]["trades"] += 1
        und_map[u]["pnl"] += t["net_pnl"]
        und_map[u]["capital"] += t["notional_value"]
        if t["net_pnl"] > 0:
            und_map[u]["wins"] += 1

    pnl_by_und = sorted(
        [{"underlying": u, "num_trades": d["trades"], "pnl": round(d["pnl"], 2),
          "win_rate": round(d["wins"] / d["trades"] * 100, 1) if d["trades"] else 0,
          "avg_return": round(d["pnl"] / d["capital"] * 100, 2) if d["capital"] else 0,
          "capital": round(d["capital"], 2)}
         for u, d in und_map.items()],
        key=lambda x: abs(x["pnl"]), reverse=True
    )

    # Top contributors/detractors
    top_contributors = [x for x in pnl_by_und if x["pnl"] > 0][:5]
    top_detractors = sorted([x for x in pnl_by_und if x["pnl"] < 0], key=lambda x: x["pnl"])[:5]

    # Waterfall (top 20 by abs pnl)
    waterfall_data = pnl_by_und[:20]
    wf_cum = 0
    waterfall = []
    for w in waterfall_data:
        wf_cum += w["pnl"]
        waterfall.append({"underlying": w["underlying"], "pnl": w["pnl"], "cumulative": round(wf_cum, 2)})

    # Instruments
    perps = [t for t in trades if t["instrument_type"] == "perpetual"]
    calls = [t for t in trades if t["instrument_type"] == "call"]
    puts = [t for t in trades if t["instrument_type"] == "put"]
    options = calls + puts

    # Funding from transactions
    funding_txns = [tx for tx in transactions if tx.get("transaction_type") == "funding"]
    total_funding = sum(float(tx.get("amount", 0)) for tx in funding_txns)

    # Risk metrics
    daily_returns = [d["pnl"] for d in daily_pnl]
    if len(daily_returns) >= 2:
        avg_ret = sum(daily_returns) / len(daily_returns)
        std_ret = (sum((r - avg_ret) ** 2 for r in daily_returns) / (len(daily_returns) - 1)) ** 0.5
        sharpe = (avg_ret / std_ret * math.sqrt(365)) if std_ret > 0 else 0
        downside = [r for r in daily_returns if r < 0]
        down_std = (sum(r ** 2 for r in downside) / len(downside)) ** 0.5 if downside else 0
        sortino = (avg_ret / down_std * math.sqrt(365)) if down_std > 0 else 0
    else:
        sharpe = sortino = 0
        std_ret = 0
        avg_ret = 0

    gross_wins = sum(t["net_pnl"] for t in winning)
    gross_losses = abs(sum(t["net_pnl"] for t in losing))
    profit_factor = gross_wins / gross_losses if gross_losses > 0 else float("inf") if gross_wins > 0 else 0

    # Max drawdown
    peak = 0
    max_dd = 0
    dd_curve = []
    cum = 0
    for d in daily_pnl:
        cum += d["pnl"]
        peak = max(peak, cum)
        dd = (cum - peak) / peak * 100 if peak > 0 else 0
        max_dd = min(max_dd, dd)
        dd_curve.append({"date": d["date"], "drawdown": round(dd, 2)})

    # Streaks
    current_ws = best_ws = current_ls = worst_ls = 0
    ws = ls = 0
    for d in daily_pnl:
        if d["pnl"] > 0:
            ws += 1
            ls = 0
        elif d["pnl"] < 0:
            ls += 1
            ws = 0
        best_ws = max(best_ws, ws)
        worst_ls = max(worst_ls, ls)
    current_ws = ws
    current_ls = ls

    # Unrealized from positions
    total_unrealized = sum(float(p.get("unrealized_pnl", 0)) for p in positions)

    # Projections (only if profitable)
    projections = compute_projections(trades, daily_pnl)

    # What-ifs
    what_ifs = compute_what_ifs(trades, net_pnl)

    # Achievements
    achievements = compute_achievements(trades, daily_pnl, win_rate, best_ws, underlyings, total_fees)

    report = {
        "metadata": {
            "date_range": {
                "start": sorted_trades[0]["entry_time"][:10] if sorted_trades else "",
                "end": sorted_trades[-1]["exit_time"][:10] if sorted_trades else "",
            },
            "total_trades": len(trades),
            "tokens_traded": len(underlyings),
            "platform": "india",
            "fetch_timestamp": datetime.utcnow().isoformat(),
        },
        "overview": {
            "net_realized_pnl": round(net_pnl, 2),
            "unrealized_pnl": round(total_unrealized, 2),
            "total_fees": round(total_fees, 2),
            "total_funding_pnl": round(total_funding, 2),
            "net_after_fees": round(net_pnl, 2),
            "win_rate": round(win_rate, 1),
            "total_trades": len(trades),
            "tokens_traded": len(underlyings),
            "winners": len(winning),
            "losers": len(losing),
            "breakeven": len(breakeven),
            "avg_winner": round(avg_winner, 2),
            "avg_loser": round(avg_loser, 2),
            "win_loss_ratio": round(abs(avg_winner / avg_loser), 2) if avg_loser != 0 else 0,
            "best_trade": round(max((t["net_pnl"] for t in trades), default=0), 2),
            "worst_trade": round(min((t["net_pnl"] for t in trades), default=0), 2),
            "long_pnl": round(sum(t["net_pnl"] for t in trades if t["direction"] == "long"), 2),
            "short_pnl": round(sum(t["net_pnl"] for t in trades if t["direction"] == "short"), 2),
            "perps_pnl": round(sum(t["net_pnl"] for t in perps), 2),
            "options_pnl": round(sum(t["net_pnl"] for t in options), 2),
            "equity_curve": equity_curve[-500:],  # cap for response size
            "pnl_distribution": make_histogram([t["net_pnl"] for t in trades], 20, "$", ""),
            "return_distribution": make_histogram([t["pnl_pct"] for t in trades if t["pnl_pct"] != 0], 20, "", "%"),
        },
        "pnl_analysis": {
            "monthly": monthly,
            "daily_pnl": daily_pnl,
            "hourly_pnl": hourly_pnl,
            "day_of_week": day_of_week,
            "trades_per_day": [{"date": d["date"], "count": d["trades"]} for d in daily_pnl],
            "top_contributors": [{"underlying": c["underlying"], "pnl": c["pnl"]} for c in top_contributors],
            "top_detractors": [{"underlying": d["underlying"], "pnl": d["pnl"]} for d in top_detractors],
            "waterfall": waterfall,
            "pareto": [],  # TODO: compute Pareto
            "pareto_80_index": 0,
        },
        "instruments": {
            "perps_pnl": round(sum(t["net_pnl"] for t in perps), 2),
            "perps_count": len(perps),
            "options_pnl": round(sum(t["net_pnl"] for t in options), 2),
            "options_count": len(options),
            "calls_pnl": round(sum(t["net_pnl"] for t in calls), 2),
            "calls_count": len(calls),
            "puts_pnl": round(sum(t["net_pnl"] for t in puts), 2),
            "puts_count": len(puts),
            "pnl_by_underlying": pnl_by_und[:50],
            "capital_vs_returns": [{"underlying": u["underlying"], "capital": u["capital"],
                                    "return_pct": u["avg_return"], "pnl": u["pnl"]}
                                   for u in pnl_by_und[:50]],
            "long_vs_short": [],  # TODO
            "correlation_matrix": {"tokens": [], "matrix": []},  # TODO
        },
        "funding": {
            "total_funding_pnl": round(total_funding, 2),
            "funding_by_token": [],  # TODO: group funding txns by product
            "daily_funding": [],
            "cumulative_funding": [],
            "monthly_funding_vs_trading": [],
            "avg_funding_rate": 0,
            "funding_paid_as_long": 0,
            "funding_received_as_short": 0,
        },
        "expiry": {
            "has_options": len(options) > 0,
            "by_expiry_type": [],
            "by_dte": [],
            "by_expiry_date": [],
        },
        "risk_metrics": {
            "sharpe_ratio": round(sharpe, 2),
            "sortino_ratio": round(sortino, 2),
            "profit_factor": round(profit_factor, 2) if profit_factor != float("inf") else 999,
            "payoff_ratio": round(abs(avg_winner / avg_loser), 2) if avg_loser != 0 else 0,
            "max_drawdown": round(max_dd, 2),
            "max_drawdown_duration_days": 0,
            "calmar_ratio": round(net_pnl / abs(max_dd) if max_dd != 0 else 0, 2),
            "daily_std_dev": round(std_ret, 2),
            "consecutive_wins": best_ws,
            "consecutive_losses": worst_ls,
            "recovery_factor": round(net_pnl / abs(max_dd) if max_dd != 0 else 0, 2),
            "expectancy": round((win_rate / 100 * avg_winner) + ((1 - win_rate / 100) * avg_loser), 2),
            "equity_curve": [{"date": d["date"], "cumulative": round(sum(x["pnl"] for x in daily_pnl[:i+1]), 2)}
                             for i, d in enumerate(daily_pnl)],
            "drawdown_curve": dd_curve,
            "pnl_distribution": make_histogram([t["net_pnl"] for t in trades], 20, "$", ""),
            "return_distribution": make_histogram([t["pnl_pct"] for t in trades if t["pnl_pct"] != 0], 20, "", "%"),
            "risk_reward_scatter": [{"pnl": t["net_pnl"], "capital": t["notional_value"],
                                     "return_pct": t["pnl_pct"], "underlying": t["underlying"]}
                                    for t in trades[:500]],
        },
        "charges": {
            "total_fees": round(total_fees, 2),
            "fees_pct_pnl": round(total_fees / abs(gross_pnl) * 100, 2) if gross_pnl else 0,
            "fees_pct_volume": round(total_fees / sum(t["notional_value"] for t in trades) * 100, 4) if trades else 0,
            "maker_fees": round(sum(t["fees"] for t in trades if t["role"] == "maker"), 2),
            "taker_fees": round(sum(t["fees"] for t in trades if t["role"] == "taker"), 2),
            "maker_fill_rate": round(sum(1 for t in trades if t["role"] == "maker") / len(trades) * 100, 1) if trades else 0,
            "gst_estimate": round(total_fees * 0.18, 2),
            "fees_by_instrument": [
                {"instrument": "Perpetuals", "fees": round(sum(t["fees"] for t in perps), 2)},
                {"instrument": "Options", "fees": round(sum(t["fees"] for t in options), 2)},
            ],
            "fees_by_token": sorted(
                [{"token": u, "fees": round(sum(t["fees"] for t in trades if t["underlying"] == u), 2)}
                 for u in underlyings],
                key=lambda x: x["fees"], reverse=True
            )[:10],
            "trades_to_cover_fees": 0,  # TODO
        },
        "open_portfolio": {
            "open_count": len(positions),
            "total_unrealized_pnl": round(total_unrealized, 2),
            "max_profit": round(max((float(p.get("unrealized_pnl", 0)) for p in positions), default=0), 2),
            "max_loss": round(min((float(p.get("unrealized_pnl", 0)) for p in positions), default=0), 2),
            "positions": [
                {
                    "symbol": p.get("product_symbol", ""),
                    "underlying": products_map.get(p.get("product_id"), {}).get("underlying_asset", {}).get("symbol", ""),
                    "type": "perpetual",
                    "size": abs(int(p.get("size", 0))),
                    "direction": "long" if int(p.get("size", 0)) > 0 else "short",
                    "entry_price": float(p.get("entry_price", 0)),
                    "mark_price": 0,
                    "unrealized_pnl": round(float(p.get("unrealized_pnl", 0)), 2),
                    "pnl_pct": 0,
                    "margin": round(float(p.get("margin", 0)), 2),
                    "leverage": 0,
                    "liquidation_price": float(p.get("liquidation_price", 0)),
                    "realized_funding": round(float(p.get("realized_funding", 0)), 2),
                }
                for p in positions if int(p.get("size", 0)) != 0
            ],
            "concentration": [],
            "unrealized_by_position": [
                {"symbol": p.get("product_symbol", ""), "pnl": round(float(p.get("unrealized_pnl", 0)), 2)}
                for p in positions if int(p.get("size", 0)) != 0
            ],
        },
        "trade_log": {
            "trades": sorted_trades[-1000:],  # cap at 1000 for response size
        },
        "projections": projections,
        "what_ifs": what_ifs,
        "streaks": {
            "current_win_streak": current_ws,
            "best_win_streak": best_ws,
            "current_loss_streak": current_ls,
            "worst_loss_streak": worst_ls,
            "profitable_month_streak": 0,
            "best_month_streak": 0,
            "achievements": achievements,
        },
    }

    return report


def make_histogram(values, num_bins, prefix, suffix):
    if not values:
        return []
    mn, mx = min(values), max(values)
    if mn == mx:
        return [{"range": f"{prefix}{mn:.0f}{suffix}", "count": len(values), "min": mn, "max": mx}]
    step = (mx - mn) / num_bins
    bins = []
    for i in range(num_bins):
        lo = mn + i * step
        hi = mn + (i + 1) * step
        count = sum(1 for v in values if lo <= v < hi or (i == num_bins - 1 and v == hi))
        bins.append({"range": f"{prefix}{lo:.0f}{suffix} - {prefix}{hi:.0f}{suffix}", "count": count, "min": lo, "max": hi})
    return [b for b in bins if b["count"] > 0]


def compute_projections(trades, daily_pnl):
    if not trades or not daily_pnl:
        return {"overall": None, "categories": {"perps": None, "options": None, "calls": None, "puts": None}, "edges": [], "avoid": []}

    days = len(daily_pnl)
    if days < 7:
        return {"overall": None, "categories": {"perps": None, "options": None, "calls": None, "puts": None}, "edges": [], "avoid": []}

    total_pnl = sum(t["net_pnl"] for t in trades)
    total_capital = sum(t["notional_value"] for t in trades) / len(trades) if trades else 0

    def project(pnl, capital, num_days):
        if pnl <= 0 or capital <= 0 or num_days < 7:
            return None
        daily = pnl / capital / num_days
        rate = 1 + daily
        return {
            "apr": round(daily * 365 * 100, 1),
            "apy_1yr": round((rate ** 365 - 1) * 100, 1),
            "apy_5yr": round((rate ** (365 * 5) - 1) * 100, 1),
            "apy_10yr": round((rate ** (365 * 10) - 1) * 100, 1),
            "value_1yr": round(capital * rate ** 365, 2),
            "value_3yr": round(capital * rate ** (365 * 3), 2),
            "value_5yr": round(capital * rate ** (365 * 5), 2),
            "value_10yr": round(capital * rate ** (365 * 10), 2),
            "starting_capital": round(capital, 2),
            "daily_return_pct": round(daily * 100, 4),
        }

    overall = project(total_pnl, total_capital, days)

    perps_t = [t for t in trades if t["instrument_type"] == "perpetual"]
    opts_t = [t for t in trades if t["instrument_type"] in ("call", "put")]
    calls_t = [t for t in trades if t["instrument_type"] == "call"]
    puts_t = [t for t in trades if t["instrument_type"] == "put"]

    def cat_proj(subset):
        p = sum(t["net_pnl"] for t in subset)
        c = sum(t["notional_value"] for t in subset) / len(subset) if subset else 0
        return project(p, c, days)

    return {
        "overall": overall,
        "categories": {
            "perps": cat_proj(perps_t),
            "options": cat_proj(opts_t),
            "calls": cat_proj(calls_t),
            "puts": cat_proj(puts_t),
        },
        "edges": [],
        "avoid": [],
    }


def compute_what_ifs(trades, current_pnl):
    if not trades:
        return []
    scenarios = []
    sorted_by_pnl = sorted(trades, key=lambda t: t["net_pnl"])

    # Cut worst 5 trades
    if len(trades) > 5:
        without = trades[5:] if sorted_by_pnl[0]["net_pnl"] < 0 else trades
        new_pnl = sum(t["net_pnl"] for t in sorted_by_pnl[5:])
        if new_pnl > current_pnl:
            improvement = new_pnl - current_pnl
            scenarios.append({
                "id": "cut_worst_5",
                "label": "Cut your 5 worst trades",
                "icon": "scissors",
                "original_pnl": round(current_pnl, 2),
                "new_pnl": round(new_pnl, 2),
                "improvement_pct": round(improvement / abs(current_pnl) * 100, 1) if current_pnl else 0,
                "detail": "Tighter risk management would have boosted your P&L",
            })

    # Remove worst underlying
    from collections import defaultdict
    und_pnl = defaultdict(float)
    und_count = defaultdict(int)
    for t in trades:
        und_pnl[t["underlying"]] += t["net_pnl"]
        und_count[t["underlying"]] += 1

    worst_und = min(und_pnl, key=und_pnl.get) if und_pnl else None
    if worst_und and und_pnl[worst_und] < 0:
        new_pnl = current_pnl - und_pnl[worst_und]
        scenarios.append({
            "id": f"remove_{worst_und}",
            "label": f"Stop trading {worst_und}",
            "icon": "ban",
            "original_pnl": round(current_pnl, 2),
            "new_pnl": round(new_pnl, 2),
            "improvement_pct": round((new_pnl - current_pnl) / abs(current_pnl) * 100, 1) if current_pnl else 0,
            "detail": f"{und_count[worst_und]} fewer trades, less exposure to {worst_und}",
        })

    # Only trade top 3
    top3 = sorted(und_pnl.items(), key=lambda x: x[1], reverse=True)[:3]
    top3_names = {u for u, _ in top3}
    top3_pnl = sum(t["net_pnl"] for t in trades if t["underlying"] in top3_names)
    if top3_pnl > current_pnl and len(und_pnl) > 3:
        top3_count = sum(1 for t in trades if t["underlying"] in top3_names)
        scenarios.append({
            "id": "top3_only",
            "label": f"Only trade {', '.join(sorted(top3_names))}",
            "icon": "target",
            "original_pnl": round(current_pnl, 2),
            "new_pnl": round(top3_pnl, 2),
            "improvement_pct": round((top3_pnl - current_pnl) / abs(current_pnl) * 100, 1) if current_pnl else 0,
            "detail": f"{top3_count} trades instead of {len(trades)}, focused on your edge",
        })

    return sorted(scenarios, key=lambda s: s["improvement_pct"], reverse=True)[:5]


def compute_achievements(trades, daily_pnl, win_rate, best_streak, underlyings, total_fees):
    achievements = []

    def add(id, name, icon, desc, condition, date=None):
        achievements.append({
            "id": id, "name": name, "icon": icon, "description": desc,
            "unlocked": condition, "unlocked_date": date,
        })

    has_profit = any(d["pnl"] > 0 for d in daily_pnl)
    cum = 0
    first_1k_date = None
    first_10k_date = None
    for d in daily_pnl:
        cum += d["pnl"]
        if cum >= 1000 and not first_1k_date:
            first_1k_date = d["date"]
        if cum >= 10000 and not first_10k_date:
            first_10k_date = d["date"]

    add("first_profit", "First Profit", "trophy", "First day with positive P&L", has_profit)
    add("1k_club", "$1K Club", "dollar-sign", "Cumulative P&L exceeds $1,000", first_1k_date is not None, first_1k_date)
    add("10k_club", "$10K Club", "gem", "Cumulative P&L exceeds $10,000", first_10k_date is not None, first_10k_date)
    add("hot_streak", "Hot Streak", "flame", "5+ consecutive winning days", best_streak >= 5)
    add("century", "Century", "trending-up", "100 total trades", len(trades) >= 100)
    add("sharpshooter", "Sharpshooter", "crosshair", "70%+ win rate over 50+ trades", win_rate >= 70 and len(trades) >= 50)
    add("diversified", "Diversified", "pie-chart", "Traded 10+ different tokens", len(underlyings) >= 10)
    add("fee_efficient", "Fee Efficient", "zap", "Maker fill rate > 60%",
        sum(1 for t in trades if t["role"] == "maker") / len(trades) > 0.6 if trades else False)

    return achievements
