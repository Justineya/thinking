from __future__ import annotations

import socket
from dataclasses import dataclass
from typing import Any

from app.core.config import get_settings
from app.services.market import LEVERAGE_MAP


class FutuError(RuntimeError):
    """OpenD / Futu API failure."""


@dataclass
class FutuPosition:
    code: str  # US.COHX
    symbol: str  # COHX
    underlying: str  # COHR
    shares: float
    cost_price: float
    market_price: float | None
    market_value: float | None
    stock_name: str | None = None
    pl_ratio: float | None = None


def _import_futu():
    try:
        import futu as ft
    except ImportError as exc:  # pragma: no cover
        raise FutuError("futu-api 未安装，请 pip install futu-api") from exc
    return ft


def _ensure_opend_reachable(timeout: float = 1.2) -> None:
    """Fail fast — futu-api retries forever on ECONNREFUSED."""
    settings = get_settings()
    host = settings.futu_opend_host
    port = int(settings.futu_opend_port)
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return
    except OSError as exc:
        raise FutuError(
            f"无法连接 OpenD {host}:{port}（{exc}）。请在本机启动 FutuOpenD。"
        ) from exc


def _quote_ctx(ft):
    settings = get_settings()
    _ensure_opend_reachable()
    ctx = ft.OpenQuoteContext(host=settings.futu_opend_host, port=settings.futu_opend_port)
    if hasattr(ctx, "set_sync_query_connect_timeout"):
        try:
            ctx.set_sync_query_connect_timeout(3)
        except Exception:  # noqa: BLE001
            pass
    return ctx


def _trade_ctx(ft):
    settings = get_settings()
    _ensure_opend_reachable()
    market_key = settings.futu_default_market.upper()
    filter_market = getattr(ft.TrdMarket, market_key, ft.TrdMarket.NONE)
    ctx = ft.OpenSecTradeContext(
        filter_trdmarket=filter_market,
        host=settings.futu_opend_host,
        port=settings.futu_opend_port,
        security_firm=ft.SecurityFirm.FUTUSECURITIES,
    )
    if hasattr(ctx, "set_sync_query_connect_timeout"):
        try:
            ctx.set_sync_query_connect_timeout(3)
        except Exception:  # noqa: BLE001
            pass
    return ctx


def strip_market(code: str) -> str:
    code = (code or "").strip().upper()
    if "." in code:
        return code.split(".", 1)[1]
    return code


def to_futu_code(symbol: str, market: str | None = None) -> str:
    symbol = strip_market(symbol)
    mkt = (market or get_settings().futu_default_market).upper()
    if symbol.startswith(("US.", "HK.", "SH.", "SZ.")):
        return symbol
    return f"{mkt}.{symbol}"


def underlying_of(symbol: str) -> str:
    s = strip_market(symbol)
    return LEVERAGE_MAP.get(s, s)


def check_opend() -> dict[str, Any]:
    ft = _import_futu()
    settings = get_settings()
    quote_ctx = _quote_ctx(ft)
    try:
        ret, data = quote_ctx.get_global_state()
        if ret != ft.RET_OK:
            raise FutuError(f"OpenD 不可用: {data}")
        return {
            "ok": True,
            "host": settings.futu_opend_host,
            "port": settings.futu_opend_port,
            "trd_env": settings.futu_trd_env,
            "state": data.to_dict() if hasattr(data, "to_dict") else str(data),
        }
    finally:
        quote_ctx.close()


def _trd_env(ft):
    settings = get_settings()
    return ft.TrdEnv.SIMULATE if settings.futu_trd_env.upper() == "SIMULATE" else ft.TrdEnv.REAL


def fetch_positions() -> list[FutuPosition]:
    ft = _import_futu()
    settings = get_settings()
    trd_ctx = _trade_ctx(ft)
    try:
        pwd = settings.futu_unlock_password
        if pwd:
            ret, data = trd_ctx.unlock_trade(pwd)
            if ret != ft.RET_OK:
                raise FutuError(f"解锁交易失败: {data}")

        ret, data = trd_ctx.position_list_query(trd_env=_trd_env(ft), refresh_cache=True)
        if ret != ft.RET_OK:
            raise FutuError(f"拉取持仓失败: {data}")
        if data is None or getattr(data, "empty", True):
            return []

        positions: list[FutuPosition] = []
        for _, row in data.iterrows():
            qty = float(row.get("qty") or 0)
            if qty <= 0:
                continue
            code = str(row.get("code") or "")
            symbol = strip_market(code)
            cost = float(row.get("cost_price") or 0)
            if not row.get("cost_price_valid", True):
                cost = float(row.get("nominal_price") or 0)
            positions.append(
                FutuPosition(
                    code=code,
                    symbol=symbol,
                    underlying=underlying_of(symbol),
                    shares=qty,
                    cost_price=cost,
                    market_price=float(row["nominal_price"]) if row.get("nominal_price") is not None else None,
                    market_value=float(row["market_val"]) if row.get("market_val") is not None else None,
                    stock_name=str(row.get("stock_name") or "") or None,
                    pl_ratio=float(row["pl_ratio"]) if row.get("pl_ratio_valid") else None,
                )
            )
        return positions
    finally:
        trd_ctx.close()


def list_watchlist_groups() -> list[dict[str, str]]:
    ft = _import_futu()
    quote_ctx = _quote_ctx(ft)
    try:
        ret, data = quote_ctx.get_user_security_group(group_type=ft.UserSecurityGroupType.ALL)
        if ret != ft.RET_OK:
            raise FutuError(f"读取自选分组失败: {data}")
        if data is None or getattr(data, "empty", True):
            return []
        out = []
        for _, row in data.iterrows():
            out.append(
                {
                    "name": str(row.get("group_name") or row.get("name") or ""),
                    "type": str(row.get("group_type") or ""),
                }
            )
        return [g for g in out if g["name"]]
    finally:
        quote_ctx.close()


def fetch_watchlist(group_name: str | None = None) -> list[dict[str, str]]:
    ft = _import_futu()
    settings = get_settings()
    group = group_name or settings.futu_watchlist_group
    quote_ctx = _quote_ctx(ft)
    try:
        ret, data = quote_ctx.get_user_security(group)
        if ret != ft.RET_OK:
            raise FutuError(f"读取自选「{group}」失败: {data}")
        if data is None or getattr(data, "empty", True):
            return []
        rows = []
        for _, row in data.iterrows():
            code = str(row.get("code") or "")
            rows.append(
                {
                    "code": code,
                    "ticker": strip_market(code),
                    "name": str(row.get("name") or row.get("stock_name") or ""),
                }
            )
        return rows
    finally:
        quote_ctx.close()


def add_to_watchlist(tickers: list[str], group_name: str | None = None) -> dict[str, Any]:
    ft = _import_futu()
    settings = get_settings()
    group = group_name or settings.futu_watchlist_group
    codes = [to_futu_code(t) for t in tickers if t]
    if not codes:
        raise FutuError("代码列表为空")

    quote_ctx = _quote_ctx(ft)
    try:
        ret, data = quote_ctx.modify_user_security(group, ft.ModifyUserSecurityOp.ADD, codes)
        if ret != ft.RET_OK:
            raise FutuError(f"加入富途自选失败: {data}")
        return {"ok": True, "group": group, "codes": codes, "detail": str(data)}
    finally:
        quote_ctx.close()


def remove_from_watchlist(tickers: list[str], group_name: str | None = None) -> dict[str, Any]:
    ft = _import_futu()
    settings = get_settings()
    group = group_name or settings.futu_watchlist_group
    codes = [to_futu_code(t) for t in tickers if t]
    quote_ctx = _quote_ctx(ft)
    try:
        ret, data = quote_ctx.modify_user_security(group, ft.ModifyUserSecurityOp.DEL, codes)
        if ret != ft.RET_OK:
            raise FutuError(f"移出自选失败: {data}")
        return {"ok": True, "group": group, "codes": codes, "detail": str(data)}
    finally:
        quote_ctx.close()
