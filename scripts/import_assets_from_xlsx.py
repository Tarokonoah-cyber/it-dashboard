import argparse
import json
import os
import re
import sys
from datetime import date, datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

import pandas as pd


ASSET_SOURCES = {
    "assets_mountain_pc": "山上電腦",
    "assets_downhill_pc": "山下電腦",
    "assets_printer": "印表機",
    "assets_north_ya": "北 YA",
    "assets_iptv": "IPTV",
}

SHEET_SOURCE_MAP = {
    "山上的孩子": "assets_mountain_pc",
    "山下的孩子": "assets_downhill_pc",
    "印表機": "assets_printer",
    "北YA": "assets_north_ya",
    "北 YA": "assets_north_ya",
    "IPTV": "assets_iptv",
}


def load_dotenv(path):
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def clean_value(value):
    if pd.isna(value):
        return ""
    if isinstance(value, (datetime, pd.Timestamp)):
        return value.isoformat(sep=" ")
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def compact_key(value):
    value = re.sub(r"\s+", "-", str(value or "").strip())
    value = re.sub(r"[^\w\-\u4e00-\u9fff]", "", value, flags=re.UNICODE)
    return value[:42] or "row"


def search_text(data):
    return " ".join(str(value) for value in data.values() if value not in ("", None))


def nonempty_rows(df):
    rows = []
    for record in df.to_dict(orient="records"):
        cleaned = {str(key).strip(): clean_value(value) for key, value in record.items() if str(key).strip()}
        cleaned = {key: value for key, value in cleaned.items() if value != ""}
        if cleaned:
            rows.append(cleaned)
    return rows


def read_standard_sheet(path, sheet_name):
    df = pd.read_excel(path, sheet_name=sheet_name, dtype=object)
    df = df.dropna(how="all")
    return nonempty_rows(df)


def parse_iptv_network(value):
    text = clean_value(value)
    ip = ""
    ts = ""
    for part in re.split(r"[\n\r]+", text):
        part = part.strip()
        if not part:
            continue
        if part.upper().startswith("IP"):
            ip = part[2:].strip().replace(":", ".")
        elif part.upper().startswith("TS"):
            ts = part[2:].strip().replace(":", ".")
    return ip, ts


def read_iptv_sheet(path, sheet_name):
    raw = pd.read_excel(path, sheet_name=sheet_name, header=None, dtype=object).dropna(how="all")
    rows = []
    for _, row in raw.iterrows():
        values = [clean_value(value) for value in row.tolist()]
        if len(values) < 3:
            values += [""] * (3 - len(values))
        network, name, mac = values[:3]
        if not any([network, name, mac]):
            continue
        ip, ts = parse_iptv_network(network)
        rows.append({
            "名稱": name,
            "IP": ip,
            "TS": ts,
            "MAC": mac,
            "原始網路欄位": network,
        })
    return rows


def build_sheet_records(workbook_path):
    excel = pd.ExcelFile(workbook_path)
    records = []
    for sheet_name in excel.sheet_names:
        source_key = SHEET_SOURCE_MAP.get(sheet_name)
        if not source_key:
            continue
        rows = read_iptv_sheet(workbook_path, sheet_name) if source_key == "assets_iptv" else read_standard_sheet(workbook_path, sheet_name)
        for index, data in enumerate(rows, start=1):
            identity = (
                data.get("電腦名稱")
                or data.get("設備名稱")
                or data.get("名稱")
                or data.get("IP位置")
                or data.get("IP 位址")
                or data.get("IP位址")
                or data.get("IP")
                or index
            )
            records.append({
                "source_key": source_key,
                "source_label": ASSET_SOURCES[source_key],
                "sheet_name": sheet_name,
                "record_key": f"{source_key}-{index:03d}-{compact_key(identity)}",
                "data": data,
                "search_text": search_text(data),
            })
    return records


def first(data, *keys):
    for key in keys:
        value = data.get(key)
        if value not in ("", None):
            return value
    return ""


def normalize_asset(sheet_record):
    data = sheet_record["data"]
    source_key = sheet_record["source_key"]
    source_label = sheet_record["source_label"]

    if source_key == "assets_printer":
        asset_type = first(data, "設備類型", "資產類型") or "印表機"
        asset_name = first(data, "電腦名稱", "設備名稱", "硬體型號")
        department = first(data, "使用部門", "部門").strip()
        model = first(data, "硬體型號")
        ip = first(data, "IP 位址", "IP位置", "IP位址", "IP")
        status = first(data, "資產狀態", "狀態")
        note = first(data, "碳粉/墨水型號 ", "碳粉/墨水型號", "備註")
        updated = first(data, "最後更新", "最後更新時間")
    elif source_key == "assets_north_ya":
        asset_type = "北 YA 電腦"
        asset_name = first(data, "電腦名稱", "使用者", "IP位址")
        department = "北 YA"
        model = first(data, "主機品牌")
        ip = first(data, "IP位址", "IP 位址", "IP")
        status = first(data, "資料更新時間")
        note = first(data, "備註", "Anydesk ID")
        updated = first(data, "資料更新時間")
    elif source_key == "assets_iptv":
        asset_type = "IPTV"
        asset_name = first(data, "名稱", "IP")
        department = "IPTV"
        model = ""
        ip = first(data, "IP")
        status = "正常" if asset_name or ip else ""
        note = first(data, "TS", "MAC")
        updated = ""
    else:
        asset_type = first(data, "資產類型") or source_label
        asset_name = first(data, "電腦名稱", "設備名稱", "使用人", "IP位置")
        department = first(data, "部門")
        model = first(data, "主機型號", "設備型號", "型號")
        ip = first(data, "IP位置", "IP 位址", "IP位址", "IP")
        status = first(data, "第 1 欄", "資產狀態", "盤點狀態", "狀態")
        note = first(data, "備註", "盤點備註")
        updated = first(data, "最後更新時間", "最後更新")

    return {
        "source_record_id": sheet_record["id"],
        "source_key": source_key,
        "source_label": source_label,
        "record_key": sheet_record["record_key"],
        "asset_type": asset_type,
        "asset_name": asset_name,
        "department": department,
        "user_name": first(data, "使用人", "使用者"),
        "ip_address": ip,
        "mac_address": first(data, "MAC", "MAC位置", "MAC位址"),
        "model": model,
        "windows_version": first(data, "WINDOWS版本", "Windows 版本"),
        "antivirus_installed": first(data, "是否裝防毒", "防毒"),
        "status": status,
        "inventory_staff": "",
        "inventory_time": updated,
        "note": note,
    }


class SupabaseRest:
    def __init__(self):
        url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        if not url or not key:
            raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        self.base_url = f"{url}/rest/v1"
        self.key = key

    def request(self, table, query="", method="GET", body=None, prefer="return=representation"):
        url = f"{self.base_url}/{table}"
        if query:
            url = f"{url}?{query}"
        payload = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
        request = Request(url, data=payload, method=method)
        request.add_header("apikey", self.key)
        request.add_header("Authorization", f"Bearer {self.key}")
        request.add_header("Content-Type", "application/json")
        request.add_header("Prefer", prefer)
        try:
            with urlopen(request, timeout=60) as response:
                text = response.read().decode("utf-8")
                return json.loads(text) if text else []
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"{method} {table} failed: HTTP {error.code} {detail}") from error
        except URLError as error:
            raise RuntimeError(f"{method} {table} failed: {error}") from error


def chunks(items, size):
    for index in range(0, len(items), size):
        yield items[index:index + size]


def import_records(workbook_path):
    records = build_sheet_records(workbook_path)
    if not records:
        raise RuntimeError("No matching asset sheets found in workbook")

    client = SupabaseRest()
    source_list = ",".join(ASSET_SOURCES)
    source_filter = f"source_key=in.({quote(source_list, safe=',')})"

    client.request("assets", source_filter, method="DELETE", prefer="return=minimal")
    client.request("sheet_records", source_filter, method="DELETE", prefer="return=minimal")

    inserted_sheet_records = []
    for batch in chunks(records, 100):
        inserted_sheet_records.extend(client.request("sheet_records", method="POST", body=batch))

    assets = [normalize_asset(row) for row in inserted_sheet_records]
    for batch in chunks(assets, 100):
        client.request("assets", method="POST", body=batch, prefer="return=minimal")

    counts = {}
    for row in inserted_sheet_records:
        counts[row["source_key"]] = counts.get(row["source_key"], 0) + 1
    return counts


def main():
    parser = argparse.ArgumentParser(description="Import IT asset workbook into Supabase.")
    parser.add_argument("workbook", nargs="?", default=r"C:\Users\User\Desktop\資訊室 的Monkey.xlsx")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parents[1]
    load_dotenv(project_root / ".env.local")

    workbook_path = Path(args.workbook)
    if not workbook_path.exists():
        raise SystemExit(f"Workbook not found: {workbook_path}")

    counts = import_records(workbook_path)
    for source_key in ASSET_SOURCES:
        print(f"{source_key}: {counts.get(source_key, 0)}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        raise
