"""
Generate a realistic synthetic Delta trading report for the "Check Sample Report" demo.
1000+ trades across BTC/ETH/SOL (perps) + multi-expiry options (daily/weekly/monthly).
Feeds synthetic data through match_trades + compute_analytics (same pipeline as prod).
Output: public/demo-report.json
"""
import os, json, random, ast, math
from datetime import datetime, timedelta, timezone

random.seed(42)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# Import match_trades + compute_analytics from api/analyze.py without FastAPI deps
with open(os.path.join(ROOT, 'api', 'analyze.py')) as f:
    source = f.read()
tree = ast.parse(source)
def _has_fastapi_ref(node):
    '''Return True if any Name/Attribute in this subtree references fastapi/httpx/app things.'''
    bad = {'FastAPI', 'Request', 'JSONResponse', 'StreamingResponse', 'CORSMiddleware', 'httpx', 'app'}
    for sub in ast.walk(node):
        if isinstance(sub, ast.Name) and sub.id in bad:
            return True
        if isinstance(sub, ast.Attribute) and isinstance(sub.value, ast.Name) and sub.value.id in bad:
            return True
    return False

new_body = []
for node in tree.body:
    if isinstance(node, ast.FunctionDef):
        # Skip handlers like 'analyze'/'advice' that use FastAPI decorators
        if node.decorator_list and _has_fastapi_ref(ast.Module(body=node.decorator_list, type_ignores=[])):
            continue
        new_body.append(node)
    elif isinstance(node, ast.Assign):
        # Skip 'app = FastAPI()', 'app.add_middleware(...)' etc.
        if _has_fastapi_ref(node):
            continue
        new_body.append(node)
    elif isinstance(node, ast.Expr):
        # Skip expression statements referencing app (like app.add_middleware(...))
        if _has_fastapi_ref(node):
            continue
        new_body.append(node)
    elif isinstance(node, ast.Import):
        if not any(n.name in ('fastapi', 'httpx') for n in node.names):
            new_body.append(node)
    elif isinstance(node, ast.ImportFrom):
        if node.module not in ('fastapi', 'httpx', 'fastapi.responses', 'fastapi.middleware.cors'):
            new_body.append(node)
mod = ast.Module(body=new_body, type_ignores=[])
ast.fix_missing_locations(mod)
ns = {}
exec(compile(mod, 'analyze_sub', 'exec'), ns)
match_trades = ns['match_trades']
compute_analytics = ns['compute_analytics']

def make_product(pid, symbol, contract_type, contract_value, underlying):
    return {
        'id': pid, 'symbol': symbol, 'contract_type': contract_type,
        'contract_value': str(contract_value), 'tick_size': '0.5',
        'underlying_asset': {'symbol': underlying},
        'settling_asset': {'symbol': 'USD'},
    }

PERPS = {
    27: make_product(27, 'BTCUSD', 'perpetual_futures', 0.001, 'BTC'),
    139: make_product(139, 'ETHUSD', 'perpetual_futures', 0.01, 'ETH'),
    14969: make_product(14969, 'SOLUSD', 'perpetual_futures', 1, 'SOL'),
}

START = datetime(2024, 10, 1, tzinfo=timezone.utc)
END = datetime(2026, 4, 17, tzinfo=timezone.utc)
days_total = (END - START).days

def build_options():
    products, pid = {}, 100000
    expiries = set()
    for d in range(0, 60, 2):
        expiries.add((END - timedelta(days=d)).strftime('%Y-%m-%d'))
    for w in range(0, 140, 7):
        expiries.add((END - timedelta(days=w)).strftime('%Y-%m-%d'))
    for m in range(0, 18):
        d = (END - timedelta(days=m * 30))
        expiries.add(d.replace(day=1).strftime('%Y-%m-%d'))
    exp_dates = sorted([datetime.strptime(e, '%Y-%m-%d').replace(tzinfo=timezone.utc) for e in expiries])

    UNDS = {
        'BTC': {'spot': 88000, 'cv': 0.001},
        'ETH': {'spot': 3200, 'cv': 0.01},
        'SOL': {'spot': 180, 'cv': 1},
    }
    for und, info in UNDS.items():
        spot = info['spot']
        strikes = [int(spot * k / 100) for k in (70, 80, 90, 95, 100, 105, 110, 120, 130)]
        for exp in exp_dates:
            for strike in strikes:
                for side in ('C', 'P'):
                    ds = exp.strftime('%d%m%y')
                    sym = f'{side}-{und}-{strike}-{ds}'
                    ct = 'call_options' if side == 'C' else 'put_options'
                    products[pid] = make_product(pid, sym, ct, info['cv'], und)
                    pid += 1
    return products

OPTIONS = build_options()
PRODUCTS = {**PERPS, **OPTIONS}
print(f"Products: {len(PERPS)} perps + {len(OPTIONS)} options = {len(PRODUCTS)}")

def sim_prices(start_price, days, vol=0.03):
    prices = [start_price]
    for _ in range(days):
        prices.append(prices[-1] * (1 + random.gauss(0.0005, vol)))
    return prices

btc_p = sim_prices(62000, days_total, 0.025)
eth_p = sim_prices(2500, days_total, 0.035)
sol_p = sim_prices(140, days_total, 0.05)

def price_at(und, dt):
    idx = max(0, min((dt - START).days, days_total))
    return {'BTC': btc_p, 'ETH': eth_p, 'SOL': sol_p}.get(und, [100])[idx]

fills = []
fid, oid = 1000000, 5000000

def emit(t, pid, sym, side, size, price, fee_rate=0.0005, role='taker'):
    global fid, oid
    notional = size * float(PRODUCTS[pid]['contract_value']) * price
    fee = abs(notional * fee_rate)
    fills.append({
        'id': fid, 'user_id': 99999, 'size': size, 'fill_type': 'normal',
        'side': side, 'price': str(price), 'role': role,
        'commission': str(round(fee, 6)),
        'created_at': t.isoformat().replace('+00:00', 'Z'),
        'product_id': pid, 'product_symbol': sym, 'order_id': str(oid),
        'settling_asset_id': 14, 'settling_asset_symbol': 'USD',
        'meta_data': {'effective_commission_rate': str(fee_rate)},
    })
    fid += 1; oid += 1

def round_trip_perp(pid, sym, und, t0, hours, size, direction, bias=0.0):
    entry = price_at(und, t0) * random.uniform(0.995, 1.005)
    t1 = t0 + timedelta(hours=hours)
    winning = random.random() < (0.48 + bias)
    move = random.choice([random.uniform(0.002, 0.008), random.uniform(0.008, 0.025), random.uniform(0.025, 0.08)])
    sign = 1 if winning else -1
    if direction == 'long':
        exit_px = entry * (1 + sign * move)
        emit(t0, pid, sym, 'buy', size, entry)
        emit(t1, pid, sym, 'sell', size, exit_px)
    else:
        exit_px = entry * (1 - sign * move)
        emit(t0, pid, sym, 'sell', size, entry)
        emit(t1, pid, sym, 'buy', size, exit_px)

def round_trip_option(pid, sym, und, t0, hours, size, entry_prem, exp_date, strike, side_cp):
    t1 = t0 + timedelta(hours=hours)
    if t1 >= exp_date:
        t1 = exp_date + timedelta(hours=random.randint(0, 8))
        spot = price_at(und, exp_date)
        intrinsic = max(spot - strike, 0) if side_cp == 'C' else max(strike - spot, 0)
        if intrinsic == 0 and random.random() < 0.65:
            exit_prem = 0
        else:
            exit_prem = intrinsic
    else:
        winning = random.random() < 0.42
        move = random.uniform(0.1, 0.5)
        if winning:
            exit_prem = entry_prem * (1 + move * random.uniform(0.5, 2.0))
        else:
            exit_prem = entry_prem * (1 - move)
        exit_prem = max(exit_prem, 0.01)
    emit(t0, pid, sym, 'buy', size, entry_prem)
    emit(t1, pid, sym, 'sell', size, exit_prem)

print("Generating perp round-trips...")
count = 0
while count < 650:
    t0 = START + timedelta(seconds=random.randint(0, int((END - START).total_seconds())))
    pid = random.choice(list(PERPS.keys()))
    prod = PERPS[pid]
    und = prod['underlying_asset']['symbol']
    if und == 'SOL' and random.random() < 0.5: continue
    size = random.choice([1, 2, 3, 5, 5, 10, 10, 20, 50])
    hours = random.choice([0.1, 0.5, 1, 2, 4, 8, 12, 24, 48])
    direction = random.choice(['long', 'long', 'short'])
    bias = {'BTC': 0.02, 'ETH': 0.00, 'SOL': -0.05}.get(und, 0)
    round_trip_perp(pid, prod['symbol'], und, t0, hours, size, direction, bias)
    count += 1
print(f"  Perp trades: {count}")

print("Generating option round-trips...")
count, attempts = 0, 0
opt_ids = list(OPTIONS.keys())
while count < 500 and attempts < 3000:
    attempts += 1
    pid = random.choice(opt_ids)
    prod = OPTIONS[pid]
    und = prod['underlying_asset']['symbol']
    sym = prod['symbol']
    parts = sym.split('-')
    side_cp, strike_str, exp_str = parts[0], parts[2], parts[3]
    strike = int(strike_str)
    exp_date = datetime.strptime(exp_str, '%d%m%y').replace(tzinfo=timezone.utc)
    earliest = max(START, exp_date - timedelta(days=30))
    if earliest >= exp_date or earliest >= END: continue
    t0 = earliest + timedelta(seconds=random.randint(0, int((min(exp_date, END) - earliest).total_seconds())))
    if t0 >= END: continue
    spot = price_at(und, t0)
    dte_hrs = (exp_date - t0).total_seconds() / 3600
    if dte_hrs < 1: continue
    intrinsic = max(spot - strike, 0) if side_cp == 'C' else max(strike - spot, 0)
    time_val = spot * 0.015 * math.sqrt(max(dte_hrs / 24, 0.1)) * random.uniform(0.5, 1.5)
    entry_prem = max(intrinsic + time_val, 0.5)
    size = random.choice([1, 2, 5, 5, 10, 10, 20, 50])
    hold = random.uniform(0.5, min(dte_hrs * 1.2, 72))
    round_trip_option(pid, sym, und, t0, hold, size, entry_prem, exp_date, strike, side_cp)
    count += 1
print(f"  Option trades: {count}")

fills.sort(key=lambda f: f['created_at'])
print(f"Total fills: {len(fills)}")

transactions = []
tid = 8000000
for f in fills:
    fee = abs(float(f['commission']))
    if fee > 0:
        transactions.append({
            'id': tid, 'user_id': 99999, 'amount': str(-fee), 'balance': '0',
            'transaction_type': 'commission', 'meta_data': {},
            'product_id': f['product_id'], 'asset_id': 14, 'asset_symbol': 'USD',
            'created_at': f['created_at'],
        })
        tid += 1

print("Generating funding events...")
n_funding = 0
for i in range(0, len(fills) - 1, 2):
    fi, fo = fills[i], fills[i + 1]
    if PRODUCTS.get(fi['product_id'], {}).get('contract_type') != 'perpetual_futures': continue
    ti = datetime.fromisoformat(fi['created_at'].replace('Z', '+00:00'))
    to = datetime.fromisoformat(fo['created_at'].replace('Z', '+00:00'))
    hrs = (to - ti).total_seconds() / 3600
    if hrs < 8: continue
    notional = int(fi['size']) * float(PRODUCTS[fi['product_id']]['contract_value']) * float(fi['price'])
    for k in range(int(hrs / 8)):
        tf = ti + timedelta(hours=(k + 1) * 8)
        if tf > to: break
        rate = random.gauss(0.0001, 0.0002)
        sign = -1 if fi['side'] == 'buy' else 1
        amt = round(notional * rate * sign, 6)
        transactions.append({
            'id': tid, 'user_id': 99999, 'amount': str(amt), 'balance': '0',
            'transaction_type': 'funding', 'meta_data': {},
            'product_id': fi['product_id'], 'asset_id': 14, 'asset_symbol': 'USD',
            'created_at': tf.isoformat().replace('+00:00', 'Z'),
        })
        tid += 1
        n_funding += 1
print(f"  Funding txns: {n_funding}")
print(f"Total transactions: {len(transactions)}")

positions = [
    {
        'user_id': 99999, 'size': 5,
        'entry_price': str(round(btc_p[-1] * 0.98, 2)), 'margin': '45.0',
        'liquidation_price': str(round(btc_p[-1] * 0.6, 2)),
        'bankruptcy_price': str(round(btc_p[-1] * 0.55, 2)), 'adl_level': 1,
        'product_id': 27, 'product_symbol': 'BTCUSD',
        'commission': '0', 'realized_pnl': '0', 'realized_funding': '-0.42',
        'unrealized_pnl': str(round(5 * 0.001 * (btc_p[-1] - btc_p[-1] * 0.98), 2)),
    },
    {
        'user_id': 99999, 'size': -20,
        'entry_price': str(round(eth_p[-1] * 1.02, 2)), 'margin': '32.5',
        'liquidation_price': str(round(eth_p[-1] * 1.35, 2)),
        'bankruptcy_price': str(round(eth_p[-1] * 1.4, 2)), 'adl_level': 2,
        'product_id': 139, 'product_symbol': 'ETHUSD',
        'commission': '0', 'realized_pnl': '0', 'realized_funding': '0.18',
        'unrealized_pnl': str(round(20 * 0.01 * (eth_p[-1] * 1.02 - eth_p[-1]), 2)),
    },
]
balances = [{'asset_symbol': 'USD', 'balance': '2847.32', 'available_balance': '2769.82', 'asset_id': 14}]

print("\nMatching trades...")
matched = match_trades(fills, PRODUCTS)
print(f"  Matched: {len(matched)}")

print("Computing analytics...")
report = compute_analytics(matched, fills, transactions, positions, PRODUCTS, balances)
report['metadata']['is_demo'] = True
report['metadata']['demo_label'] = 'Sample Report'

out = os.path.join(ROOT, 'public', 'demo-report.json')
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, 'w') as f:
    json.dump(report, f)

print(f"\nSAVED: {out} ({os.path.getsize(out)/1024:.1f} KB)")
print(f"  Trades:    {report['metadata']['total_trades']}")
print(f"  Tokens:    {report['metadata']['tokens_traded']}")
print(f"  Net P&L:   ${report['overview']['net_realized_pnl']:.2f}")
print(f"  Win Rate:  {report['overview']['win_rate']:.1f}%")
print(f"  Perps:     ${report['overview']['perps_pnl']:.2f} ({report['instruments']['perps_count']} trades)")
print(f"  Options:   ${report['overview']['options_pnl']:.2f} ({report['instruments']['options_count']} trades)")
print(f"  Fees:      ${report['overview']['total_fees']:.2f}")
print(f"  Funding:   ${report['overview']['total_funding_pnl']:.2f}")
