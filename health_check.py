import os, sqlite3, sys, importlib.util, time

BASE=os.path.dirname(os.path.abspath(__file__))
DB=os.path.join(BASE,"data","kk.db")
ENV=os.path.join(BASE,".env")

def check(name, ok, detail=""):
    print(f"[{'OK' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))
    return ok

def main():
    results=[]
    results.append(check("Python >= 3.11", sys.version_info >= (3,11), sys.version.split()[0]))
    results.append(check("Flask", importlib.util.find_spec("flask") is not None))
    results.append(check("Pillow", importlib.util.find_spec("PIL") is not None))
    results.append(check(".env", os.path.isfile(ENV)))
    if not os.path.isfile(DB):
        results.append(check("Database", False, DB)); return 1
    c=sqlite3.connect(DB)
    c.row_factory=sqlite3.Row
    # SQLite enforces foreign keys per connection. Enable it before checking
    # so this diagnostic mirrors the application's `conn()` configuration.
    c.execute("PRAGMA foreign_keys=ON")
    results.append(check("Database connection", True))
    results.append(check("SQLite integrity", c.execute("PRAGMA integrity_check").fetchone()[0]=="ok"))
    results.append(check("Foreign keys", c.execute("PRAGMA foreign_keys").fetchone()[0]==1))
    results.append(check("WAL", str(c.execute("PRAGMA journal_mode").fetchone()[0]).lower()=="wal"))
    tables={r["name"] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    required={"admin_account","menu_items","categories","orders","bookings","vouchers","settings","audit_logs","rate_limit_hits"}
    results.append(check("Required tables", required.issubset(tables)))
    indexes={r["name"] for r in c.execute("SELECT name FROM sqlite_master WHERE type='index'").fetchall()}
    results.append(check("Booking idempotency index", "idx_bookings_idempotency" in indexes))
    setting_keys={r["k"] for r in c.execute("SELECT k FROM settings").fetchall()}
    results.append(check("Independent feature settings", {"online_order_enabled","booking_enabled"}.issubset(setting_keys)))
    c.close()
    backups=os.path.join(BASE,"backups")
    newest=max((os.path.join(backups,x) for x in os.listdir(backups) if x.startswith("kk_") and x.endswith(".db")),key=os.path.getmtime,default=None) if os.path.isdir(backups) else None
    backup_ok=bool(newest and time.time()-os.path.getmtime(newest)<48*3600)
    results.append(check("Recent backup", backup_ok, (os.path.basename(newest) if newest else "chưa có") + ("" if backup_ok else " — quá 48 giờ hoặc chưa có")))
    print("\nRESULT:", "PASS" if all(results) else "FAIL")
    return 0 if all(results) else 1

if __name__=="__main__":
    raise SystemExit(main())
