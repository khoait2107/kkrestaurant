import os, sqlite3, secrets
from getpass import getpass
from werkzeug.security import generate_password_hash

BASE=os.path.dirname(os.path.abspath(__file__))
ENV=os.path.join(BASE,".env")
DB=os.path.join(BASE,"data","kk.db")

def read_env():
    data={}
    if os.path.isfile(ENV):
        for raw in open(ENV,encoding="utf-8"):
            line=raw.strip()
            if line and not line.startswith("#") and "=" in line:
                k,v=line.split("=",1); data[k.strip()]=v.strip().strip('"').strip("'")
    return data

def write_env(data):
    lines=[
        "# K&K Restaurant secrets - DO NOT COMMIT THIS FILE",
        f"SECRET_KEY={data.get('SECRET_KEY') or secrets.token_urlsafe(48)}",
        f"ADMIN_USERNAME={data.get('ADMIN_USERNAME') or 'admin'}",
        f"ADMIN_PASSWORD_HASH={data.get('ADMIN_PASSWORD_HASH') or ''}",
        f"SESSION_COOKIE_SECURE={data.get('SESSION_COOKIE_SECURE') or '0'}",
    ]
    # Preserve non-admin variables already present.
    known={x.split("=",1)[0] for x in lines if "=" in x}
    for k,v in data.items():
        if k not in known and k not in {"SECRET_KEY","ADMIN_USERNAME","ADMIN_PASSWORD_HASH","SESSION_COOKIE_SECURE"}:
            lines.append(f"{k}={v}")
    with open(ENV,"w",encoding="utf-8") as f: f.write("\n".join(lines)+"\n")

def main():
    data=read_env()
    if not data.get("SECRET_KEY"):
        data["SECRET_KEY"]=secrets.token_urlsafe(48)
        print("Đã tạo SECRET_KEY mới.")
    username=input(f"Tên Admin [{data.get('ADMIN_USERNAME','admin')}]: ").strip() or data.get("ADMIN_USERNAME","admin")
    while True:
        password=getpass("Mật khẩu Admin mới: ")
        confirm=getpass("Nhập lại mật khẩu: ")
        if password!=confirm:
            print("Hai mật khẩu không khớp."); continue
        if len(password)<12 or not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password) or not any(not c.isalnum() for c in password):
            print("Mật khẩu phải >=12 ký tự và có chữ, số, ký tự đặc biệt."); continue
        break
    data["ADMIN_USERNAME"]=username
    data["ADMIN_PASSWORD_HASH"]=generate_password_hash(password)
    write_env(data)
    os.makedirs(os.path.dirname(DB),exist_ok=True)
    c=sqlite3.connect(DB)
    c.execute("""CREATE TABLE IF NOT EXISTS admin_account(
        id INTEGER PRIMARY KEY CHECK(id=1), username TEXT NOT NULL,
        password_hash TEXT NOT NULL, session_version INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP)""")
    c.execute("""INSERT INTO admin_account(id,username,password_hash,session_version)
                 VALUES(1,?,?,1)
                 ON CONFLICT(id) DO UPDATE SET username=excluded.username,
                 password_hash=excluded.password_hash,
                 session_version=admin_account.session_version+1,
                 updated_at=CURRENT_TIMESTAMP""",(username,data["ADMIN_PASSWORD_HASH"]))
    c.commit(); c.close()
    print("\nĐã thiết lập Admin.")
    print("SECRET_KEY và ADMIN_PASSWORD_HASH đã được lưu vào .env.")
    print("Không đưa .env lên GitHub hoặc gửi kèm source ZIP.")

if __name__=="__main__":
    main()
