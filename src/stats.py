#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""电量指标构建器（纯标准库）。

从 data/electricity_data.csv 计算全部指标，生成 docs/data/stats.json 并复制 CSV。

用法: python src/stats.py [csv_path] [out_dir]
缺省: csv_path=<repo>/data/electricity_data.csv, out_dir=<repo>/docs/data
"""
import csv
import json
import os
import shutil
import sys
from datetime import datetime, timedelta, timezone

BJT = timezone(timedelta(hours=8))
DEFAULT_THRESHOLDS = {"warn": 15, "high": 10, "critical": 5}
RECHARGE_AMOUNTS = (30, 50, 100, 200)


def repo_root():
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_thresholds(root):
    th = dict(DEFAULT_THRESHOLDS)
    try:
        with open(os.path.join(root, "config_workflow.json"), encoding="utf-8") as f:
            cfg = json.load(f)
        th["warn"] = float(cfg.get("alert_threshold_warn", th["warn"]))
        th["high"] = float(cfg.get("alert_threshold_high", th["high"]))
        th["critical"] = float(cfg.get("alert_threshold_critical", th["critical"]))
    except Exception:
        pass
    return th


def load_room_default(root):
    """从 config_workflow.json 读取 room_default（跨宿主默认展示名），缺失时为空。"""
    try:
        with open(os.path.join(root, "config_workflow.json"), encoding="utf-8") as f:
            cfg = json.load(f)
        rd = cfg.get("room_default") or {}
        return {
            "room": str(rd.get("room", "")),
            "campus": str(rd.get("campus", "")),
            "building": str(rd.get("building", "")),
        }
    except Exception:
        return {"room": "", "campus": "", "building": ""}


def parse_records(csv_path):
    """读取 CSV，返回按时间升序的 [(datetime, num), ...]；文件缺失/空/坏行均容忍。"""
    records = []
    if not os.path.exists(csv_path):
        return records
    try:
        with open(csv_path, encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                try:
                    t = datetime.fromisoformat((row.get("time") or "").strip())
                    num = float(row.get("num"))
                except Exception:
                    continue
                records.append((t, num))
    except Exception:
        pass
    records.sort(key=lambda x: x[0])
    return records


def build_stats(records, thresholds, room_default=None):
    stats = {
        "generated_at": datetime.now(BJT).isoformat(),
        "room_default": room_default or {"room": "", "campus": "", "building": ""},
        "thresholds": thresholds,
        "current_balance": None,
        "min_balance": None,
        "stats": {
            "avg_daily_7d": None,
            "week_consumption": None,
            "days_remaining": None,
            "depletion_date": None,
            "today_consumption": None,
            "wow_change_pct": None,
        },
        "daily": [],
        "recharge": [{"amount": a, "days": None} for a in RECHARGE_AMOUNTS],
    }
    if not records:
        return stats

    # 每日代表点 = 21 点档 = 当日最后一条采集（容忍 cron 延迟，如 22:01 仍属 21 点档）
    daily21 = {}
    for t, num in records:
        daily21[t.date()] = num
    series = [(d, daily21[d]) for d in sorted(daily21)]

    # 日消耗 = max(0, 前一日21点 - 当日21点)；前一日历日不在序列（缺口）时 null，不跨日累计
    consumption = {}
    for i in range(1, len(series)):
        d_prev, e_prev = series[i - 1]
        d, e = series[i]
        consumption[d] = max(0.0, e_prev - e) if (d - d_prev).days == 1 else None

    today = datetime.now(BJT).date()

    def window_sum(end_day, days):
        return sum((consumption.get(end_day - timedelta(days=i)) or 0.0) for i in range(days))

    week_sum = window_sum(today, 7)
    avg7 = week_sum / 7.0
    prev_sum = window_sum(today - timedelta(days=7), 7)
    avg_prev7 = prev_sum / 7.0

    current_balance = records[-1][1]
    today_consumption = consumption.get(series[-1][0]) if series else None

    days_remaining = None
    depletion_date = None
    if avg7 > 0:
        days_remaining = int(current_balance // avg7)
        depletion_date = (today + timedelta(days=days_remaining)).isoformat()

    wow = None
    if avg_prev7 > 0:
        wow = (avg7 - avg_prev7) / avg_prev7 * 100.0

    stats["current_balance"] = current_balance
    stats["min_balance"] = min(num for _, num in records)
    stats["stats"] = {
        "avg_daily_7d": round(avg7, 6),
        "week_consumption": round(week_sum, 6),
        "days_remaining": days_remaining,
        "depletion_date": depletion_date,
        "today_consumption": round(today_consumption, 6) if today_consumption is not None else None,
        "wow_change_pct": round(wow, 6) if wow is not None else None,
    }
    stats["daily"] = [
        {
            "date": d.isoformat(),
            "end_balance": round(e, 4),
            "consumption": round(consumption[d], 4) if consumption.get(d) is not None else None,
        }
        for d, e in series
    ]
    stats["records"] = [
        {
            "time": t.isoformat(),
            "num": round(num, 4),
            "consumption": round(consumption[t.date()], 4) if consumption.get(t.date()) is not None else None,
        }
        for t, num in records
    ]
    stats["recharge"] = [
        {"amount": a, "days": int(a // avg7) if avg7 > 0 else None}
        for a in RECHARGE_AMOUNTS
    ]
    return stats


def main(argv):
    root = repo_root()
    csv_path = argv[1] if len(argv) > 1 else os.path.join(root, "data", "electricity_data.csv")
    out_dir = argv[2] if len(argv) > 2 else os.path.join(root, "docs", "data")
    os.makedirs(out_dir, exist_ok=True)

    stats = build_stats(parse_records(csv_path), load_thresholds(root), load_room_default(root))
    out_json = os.path.join(out_dir, "stats.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

    dest_csv = os.path.join(out_dir, "electricity_data.csv")
    if os.path.exists(csv_path) and os.path.abspath(csv_path) != os.path.abspath(dest_csv):
        shutil.copyfile(csv_path, dest_csv)

    print(f"[stats] records={len(stats['daily'])} -> {out_json}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
