#!/usr/bin/env python3
"""Loopback-only SQLite receiver for temporary MT5/ACCM journal testing."""
from __future__ import annotations

import argparse
import hashlib
import json
import secrets
import sqlite3
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "journal.local.db"
TOKEN_PATH = ROOT / ".bridge-token"
MAX_BODY = 2 * 1024 * 1024


def get_token() -> str:
    if TOKEN_PATH.exists():
        saved = TOKEN_PATH.read_text(encoding="utf-8").strip()
        if len(saved) >= 32:
            return saved
    created = secrets.token_urlsafe(32)
    TOKEN_PATH.write_text(created, encoding="utf-8")
    return created


BRIDGE_TOKEN = get_token()


def db_connect() -> sqlite3.Connection:
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    return db


def initialize() -> None:
    with db_connect() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS accounts (
          id TEXT PRIMARY KEY, provider TEXT NOT NULL, broker_server TEXT NOT NULL,
          broker_login TEXT NOT NULL, company TEXT NOT NULL, currency TEXT NOT NULL,
          trade_mode INTEGER NOT NULL, balance REAL NOT NULL, equity REAL NOT NULL,
          margin REAL NOT NULL, free_margin REAL NOT NULL, floating_profit REAL NOT NULL,
          observed_at INTEGER NOT NULL, updated_at TEXT NOT NULL)""")
        db.execute("""CREATE TABLE IF NOT EXISTS deals (
          account_id TEXT NOT NULL, ticket TEXT NOT NULL, order_ticket TEXT NOT NULL,
          position_id TEXT NOT NULL, time_msc INTEGER NOT NULL, type INTEGER NOT NULL,
          entry INTEGER NOT NULL, symbol TEXT NOT NULL, volume REAL NOT NULL,
          price REAL NOT NULL, commission REAL NOT NULL, swap REAL NOT NULL,
          fee REAL NOT NULL, profit REAL NOT NULL, comment TEXT NOT NULL,
          PRIMARY KEY(account_id, ticket))""")
        db.execute("CREATE INDEX IF NOT EXISTS deals_time_idx ON deals(account_id,time_msc DESC)")


def number(value: Any) -> float:
    try:
        result = float(value)
        return result if result == result and abs(result) != float("inf") else 0.0
    except (TypeError, ValueError):
        return 0.0


def integer(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def ingest(payload: dict[str, Any]) -> tuple[str, int]:
    account = payload.get("account")
    deals = payload.get("deals", [])
    if not isinstance(account, dict):
        raise ValueError("account object is required")
    if not isinstance(deals, list) or len(deals) > 1000:
        raise ValueError("deals must contain at most 1000 records")
    provider = str(payload.get("provider", "MT5"))[:24] or "MT5"
    login = str(account.get("login", ""))[:64]
    server = str(account.get("server", ""))[:160]
    if not login or not server:
        raise ValueError("login and broker server are required")
    account_id = hashlib.sha256(f"{provider}|{server}|{login}".encode()).hexdigest()[:32]
    now = datetime.now(timezone.utc).isoformat()
    with db_connect() as db:
        db.execute("""INSERT INTO accounts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET company=excluded.company,currency=excluded.currency,
          trade_mode=excluded.trade_mode,balance=excluded.balance,equity=excluded.equity,
          margin=excluded.margin,free_margin=excluded.free_margin,
          floating_profit=excluded.floating_profit,observed_at=excluded.observed_at,
          updated_at=excluded.updated_at""", (
            account_id, provider, server, login, str(account.get("company", ""))[:160],
            str(account.get("currency", ""))[:16], integer(account.get("tradeMode")),
            number(account.get("balance")), number(account.get("equity")),
            number(account.get("margin")), number(account.get("freeMargin")),
            number(account.get("floatingProfit")), integer(account.get("observedAt")), now))
        accepted = 0
        for deal in deals:
            if not isinstance(deal, dict) or not str(deal.get("ticket", "")):
                continue
            db.execute("""INSERT OR IGNORE INTO deals VALUES
              (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", (
                account_id, str(deal.get("ticket"))[:64], str(deal.get("orderTicket", ""))[:64],
                str(deal.get("positionId", ""))[:64], integer(deal.get("timeMsc")),
                integer(deal.get("type")), integer(deal.get("entry")),
                str(deal.get("symbol", ""))[:64], number(deal.get("volume")),
                number(deal.get("price")), number(deal.get("commission")),
                number(deal.get("swap")), number(deal.get("fee")), number(deal.get("profit")),
                str(deal.get("comment", ""))[:500]))
            accepted += 1
    return account_id, accepted


def snapshot() -> dict[str, Any]:
    with db_connect() as db:
        account = db.execute("SELECT * FROM accounts ORDER BY updated_at DESC LIMIT 1").fetchone()
        if account is None:
            return {"connected": False, "account": None, "summary": None, "deals": []}
        rows = db.execute("SELECT * FROM deals WHERE account_id=? ORDER BY time_msc DESC LIMIT 250", (account["id"],)).fetchall()
    net_total = gross_profit = gross_loss = 0.0
    closed = winners = 0
    deals = []
    for row in rows:
        net = row["profit"] + row["commission"] + row["swap"] + row["fee"]
        trade = row["type"] in (0, 1)
        exit_deal = row["entry"] in (1, 2, 3)
        if trade:
            net_total += net
        if trade and exit_deal:
            closed += 1
            if net > 0:
                winners += 1
                gross_profit += net
            elif net < 0:
                gross_loss += net
        deals.append({**dict(row), "net": round(net, 2)})
    return {"connected": True, "account": dict(account), "summary": {
        "net": round(net_total, 2), "grossProfit": round(gross_profit, 2),
        "grossLoss": round(gross_loss, 2), "closedTrades": closed,
        "winRate": round(winners * 100 / closed, 1) if closed else 0}, "deals": deals}


DASHBOARD = """<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Asheparte Local Journal</title><style>
body{margin:0;background:#030b15;color:#e7f5ff;font:14px system-ui}main{max-width:1100px;margin:auto;padding:28px}.top{display:flex;justify-content:space-between;gap:16px;align-items:center}.pill{border:1px solid #22d3ee55;background:#22d3ee12;color:#8be9f5;border-radius:999px;padding:7px 11px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:22px 0}.card{border:1px solid #7dd3fc22;background:#07192bbb;border-radius:14px;padding:16px}.label{color:#8296aa;font-size:11px;text-transform:uppercase;letter-spacing:.08em}.value{font:700 23px ui-monospace;margin-top:8px}.good{color:#6ee7b7}.bad{color:#fca5a5}table{width:100%;border-collapse:collapse;background:#061727;border:1px solid #7dd3fc22}th,td{text-align:left;padding:11px;border-bottom:1px solid #ffffff0d;font-size:12px}th{color:#8296aa;text-transform:uppercase;font-size:10px}.empty{text-align:center;color:#8296aa;padding:48px}.muted{color:#8296aa}@media(max-width:700px){.grid{grid-template-columns:1fr 1fr}.top{align-items:flex-start;flex-direction:column}main{padding:18px}.scroll{overflow:auto}}</style></head><body><main><div class=top><div><div class=label>Loopback receiver</div><h1>Asheparte MT5 / ACCM Local Journal</h1><p class=muted>Read-only test data stored only on this computer.</p></div><div id=status class=pill>Waiting for MT5…</div></div><div class=grid><div class=card><div class=label>Balance</div><div id=balance class=value>—</div></div><div class=card><div class=label>Equity</div><div id=equity class=value>—</div></div><div class=card><div class=label>Net P/L</div><div id=net class=value>—</div></div><div class=card><div class=label>Closed trades</div><div id=trades class=value>—</div></div></div><div class=scroll><table><thead><tr><th>Time</th><th>Symbol</th><th>Entry</th><th>Volume</th><th>Price</th><th>Net</th></tr></thead><tbody id=rows><tr><td colspan=6 class=empty>Attach the bridge to MT5 to begin.</td></tr></tbody></table></div></main><script>
const money=(v,c='$')=>c+Number(v||0).toFixed(2);async function refresh(){const r=await fetch('/api/journal'),j=await r.json();if(!j.connected)return;const a=j.account,s=j.summary;status.textContent=`${a.provider} · ${a.broker_server} · ${a.broker_login}`;balance.textContent=money(a.balance,a.currency+' ');equity.textContent=money(a.equity,a.currency+' ');net.textContent=(s.net>=0?'+':'−')+money(Math.abs(s.net),a.currency+' ');net.className='value '+(s.net>=0?'good':'bad');trades.textContent=s.closedTrades;rows.textContent='';for(const d of j.deals){const tr=document.createElement('tr');for(const v of [new Date(d.time_msc).toLocaleString(),d.symbol,d.entry,d.volume,d.price,(d.net>=0?'+':'−')+money(Math.abs(d.net),a.currency+' ')]){const td=document.createElement('td');td.textContent=v;tr.appendChild(td)}rows.appendChild(tr)}if(!j.deals.length)rows.innerHTML='<tr><td colspan=6 class=empty>Account linked. No imported deals yet.</td></tr>'}refresh();setInterval(refresh,5000);</script></body></html>"""


class Handler(BaseHTTPRequestHandler):
    server_version = "AsheparteLocalJournal/1.0"

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/" or self.path.startswith("/?"):
            body = DASHBOARD.encode()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
        elif self.path.startswith("/health"):
            self.send_json(HTTPStatus.OK, {"ok": True})
        elif self.path.startswith("/api/journal"):
            self.send_json(HTTPStatus.OK, snapshot())
        else:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/api/mt5/ingest":
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
            return
        if not secrets.compare_digest(self.headers.get("X-Asheparte-Bridge-Token", ""), BRIDGE_TOKEN):
            self.send_json(HTTPStatus.UNAUTHORIZED, {"error": "invalid_bridge_token"})
            return
        length = integer(self.headers.get("Content-Length"))
        if length <= 0 or length > MAX_BODY:
            self.send_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": "invalid_body_size"})
            return
        try:
            payload = json.loads(self.rfile.read(length).decode())
            if not isinstance(payload, dict):
                raise ValueError("JSON object required")
            account_id, accepted = ingest(payload)
            self.send_json(HTTPStatus.OK, {"ok": True, "accountId": account_id, "acceptedDeals": accepted})
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {fmt % args}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    port = parser.parse_args().port
    initialize()
    print(f"LOCAL_JOURNAL_URL=http://127.0.0.1:{port}/", flush=True)
    print(f"INGEST_ENDPOINT=http://127.0.0.1:{port}/api/mt5/ingest", flush=True)
    print(f"PAIRING_TOKEN={BRIDGE_TOKEN}", flush=True)
    print("BOUND_TO_LOOPBACK_ONLY=true", flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
