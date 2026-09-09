from decimal import Decimal, ROUND_HALF_UP


def calculate_score(current: Decimal, low: Decimal, high: Decimal) -> Decimal:
    if high == low:
        return Decimal("5.00")
    raw = (current - low) / (high - low) * Decimal("10")
    bounded = max(Decimal("0"), min(Decimal("10"), raw))
    return bounded.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def zone_from_score(score: Decimal) -> str:
    if score <= Decimal("3"):
        return "build"
    if score <= Decimal("6"):
        return "hold"
    if score <= Decimal("8"):
        return "warning"
    return "harvest"


ZONE_CN = {
    "build": "建仓区",
    "hold": "持有区",
    "warning": "警惕区",
    "harvest": "收获区",
}


def zone_label(zone: str) -> str:
    return ZONE_CN.get(zone, zone)


def distance_to_high_pct(current: Decimal, high: Decimal) -> Decimal:
    if high == 0:
        return Decimal("0.00")
    return ((current / high - Decimal("1")) * Decimal("100")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
