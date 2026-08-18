# K&K Restaurant — V2.7 Production Hardening

Website nhà hàng K&K dùng Flask + SQLite, có menu, giỏ hàng, đặt hàng, voucher, đặt bàn, theo dõi đơn, VNPAY và Admin.

## Yêu cầu
- Python 3.11+ (khuyến nghị 3.12)
- `pip install -r requirements.txt`

## Chạy local
```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```
Mở `http://127.0.0.1:5000`.

## Thiết lập Admin
Chạy:
```powershell
python bootstrap_admin.py
```
Lệnh này tạo/cập nhật `SECRET_KEY`, tài khoản Admin và hash mật khẩu trong `.env`.

Không dùng mật khẩu mặc định. Không commit `.env`.

Nếu chỉ cần tạo hash:
```powershell
python generate_admin_hash.py
```

## Bảo mật V2.5
- Kiểm tra món + danh mục đang active khi tạo đơn.
- Idempotency key chống tạo đơn trùng.
- Rate limit bằng SQLite cho login/order/booking.
- Kiểm tra nội dung ảnh thật bằng Pillow và re-encode ảnh.
- Backup SQLite tự động vào `backups/`.
- Audit log Admin.
- Không lưu password dạng plaintext.
- CSRF + session timeout + session version.

## Database V2.6
- SQLite WAL + busy timeout + foreign keys.
- Index cho order/booking/menu/category/rate limit/audit.
- Transaction cho các thao tác ghi quan trọng.
- Health check: `/admin/health` (Admin only).
- Audit API: `/admin/audit-logs` (Admin only).
- Log xoay vòng tại `logs/app.log`.

Kiểm tra nhanh:
```powershell
python health_check.py
```

## VNPAY production
Return URL chỉ hiển thị kết quả. Server cập nhật trạng thái thanh toán qua IPN:
```text
/payment/vnpay-ipn
```
Cấu hình:
```env
VNPAY_TMN_CODE=...
VNPAY_HASH_SECRET=...
VNPAY_RETURN_URL=https://your-domain.com/payment/vnpay-return
VNPAY_IPN_URL=https://your-domain.com/payment/vnpay-ipn
```
IPN phải là URL HTTPS public mà VNPAY có thể gọi tới.

## Production V2.7

### Windows Server
Dùng Waitress:
```powershell
python run_waitress.py
```
Nên đặt IIS/Nginx/Apache làm reverse proxy HTTPS phía trước.

### Linux
Dùng Gunicorn:
```bash
gunicorn -c gunicorn.conf.py app:app
```
Có file mẫu systemd tại `deployment/linux/`.

Nginx mẫu tại:
`deployment/nginx/kkrestaurant.conf.example`

Production `.env`:
```env
SESSION_COOKIE_SECURE=1
FORCE_HTTPS=1
TRUST_PROXY=1
HSTS_ENABLED=1
CSP_ENABLED=1
```

CSP hiện dùng `unsafe-inline` vì giao diện hiện có inline script/style. Đây là CSP thực dụng; khi refactor toàn bộ inline JS/CSS có thể siết chặt hơn.

## Backup
Ứng dụng tạo backup SQLite bằng SQLite Backup API. Giữ tối đa 14 bản gần nhất.
Không lưu backup production trong Git.

## Source control
`.env`, database, uploads, backups, logs và virtualenv không được commit.

## Lưu ý
- Không bật `debug=True` trên production.
- Không dùng HTTP cho Admin/payment production.
- VNPAY credentials là bí mật.
- Nếu chạy sau reverse proxy, chỉ bật `TRUST_PROXY=1` khi proxy là máy chủ bạn kiểm soát.


## V2.7.1 — CSRF form hardening

Admin AJAX form submissions now include the CSRF token in both the request header and FormData body. The admin.js URL is versioned to prevent stale browser cache from serving an older script.


## V2.7.2 — Admin AJAX & Audit Log hardening

- Fixed CSRF handling for JSON AJAX requests such as featured ordering and status updates.
- Added a persistent Admin CSRF token to the Admin partial so it survives AJAX refreshes.
- Added working Admin Audit Log loading UI with safe detail rendering.
- Added Audit Log pagination parameters to `/admin/audit-logs`.
- Added system/database health status to the Audit Log page.
- Login success audit entries now record the authenticated Admin username correctly.
