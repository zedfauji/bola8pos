"""
Quick Firestore exporter using a service account.

Usage (PowerShell / cmd):
  cd pos/backend/scripts
  python dump_firestore.py --project bola8pos --key serviceAccount.json --out ../../firestore_export

Requirements:
  pip install -r requirements.txt

Notes:
  - Recursively exports all root collections and subcollections into JSON files
  - Adds a __manifest__.json with metadata
  - Filenames use path with '/' replaced by '__'
"""

from __future__ import annotations

import argparse
import base64
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from google.cloud import firestore
from google.cloud.firestore_v1 import DocumentReference, GeoPoint
from google.oauth2 import service_account


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--project", required=True, help="GCP project id")
    p.add_argument("--key", default="serviceAccount.json", help="Service account JSON path (relative to scripts/) or absolute")
    p.add_argument("--out", default="firestore_export", help="Output dir (relative to repo root or absolute)")
    return p.parse_args()


def get_client(project_id: str, key_path: str) -> firestore.Client:
    key_file = Path(key_path)
    if not key_file.is_file():
        # try relative to this script
        key_file = Path(__file__).parent / key_path
    if not key_file.is_file():
        raise FileNotFoundError(f"Service account key not found: {key_path}")
    creds = service_account.Credentials.from_service_account_file(str(key_file))
    return firestore.Client(project=project_id, credentials=creds)


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def safe_filename(collection_path: str) -> str:
    return collection_path.replace("/", "__") + ".json"


def to_serializable(value: Any) -> Any:
    # Firestore Timestamp -> ISO8601
    if isinstance(value, datetime):
        dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    # GeoPoint -> dict
    if isinstance(value, GeoPoint):
        return {"_type": "geopoint", "latitude": value.latitude, "longitude": value.longitude}
    # DocumentReference -> path string
    if isinstance(value, DocumentReference):
        return {"_type": "docref", "path": value.path}
    # bytes -> base64
    if isinstance(value, (bytes, bytearray, memoryview)):
        return {"_type": "bytes", "base64": base64.b64encode(bytes(value)).decode("ascii")}
    # list/tuple
    if isinstance(value, (list, tuple)):
        return [to_serializable(v) for v in value]
    # dict
    if isinstance(value, dict):
        return {k: to_serializable(v) for k, v in value.items()}
    return value


def dump_collection_recursive(client: firestore.Client, base_out: Path, collection_path: str) -> None:
    col_ref = client.collection(collection_path)
    log(f"Reading: {collection_path}")
    docs = list(col_ref.stream())
    log(f"Exporting: {collection_path} (docs={len(docs)})")
    records = []
    for d in docs:
        data = d.to_dict() or {}
        data = {**{"__id": d.id}, **to_serializable(data)}
        records.append(data)

    out_file = base_out / safe_filename(collection_path)
    out_file.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    log(f"Wrote: {out_file}")

    # Recurse into subcollections
    for d in docs:
        subs = list(d.reference.collections())
        if subs:
            log(f"{collection_path}/{d.id} -> {len(subs)} subcollections: {[s.id for s in subs]}")
        for sub in subs:
            dump_collection_recursive(client, base_out, f"{collection_path}/{d.id}/{sub.id}")


def main() -> None:
    args = parse_args()
    out_dir = Path(__file__).resolve().parents[2] / args.out
    ensure_dir(out_dir)

    log("Initializing Firestore client")
    client = get_client(args.project, args.key)
    log("Listing root collections")
    root_cols = list(client.collections())

    manifest = {
        "projectId": args.project,
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "rootCollections": [c.id for c in root_cols],
    }
    (out_dir / "__manifest__.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    log(f"Found {len(root_cols)} root collections: {[c.id for c in root_cols]}")

    for c in root_cols:
        try:
            dump_collection_recursive(client, out_dir, c.id)
        except Exception as e:
            log(f"ERROR exporting {c.id}: {e}")

    log(f"Done. Exported {len(root_cols)} root collections to {out_dir}")


def log(message: str) -> None:
    ts = datetime.now(timezone.utc).isoformat()
    print(f"[{ts}] {message}", flush=True)


if __name__ == "__main__":
    main()


