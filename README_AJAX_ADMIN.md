# K&K Admin — AJAX & Security

Admin hiện dùng AJAX để cập nhật nội dung mà không reload toàn trang.

## Chức năng
- Đơn hàng/đặt bàn: cập nhật trạng thái bằng AJAX.
- Món ăn: thêm/sửa/xóa, upload ảnh được kiểm tra nội dung thật.
- Món nổi bật: kéo thả + tối đa 8 món.
- Danh mục: thêm/sửa/xóa/ẩn/hiện/di chuyển.
- Voucher: thêm/sửa/xóa/bật/tắt.
- Cài đặt nhà hàng: AJAX + upload logo/banner.
- Bảo mật: đổi username/password, CSRF, timeout, session version.
- Nhật ký quản trị: xem audit log và trạng thái database/backup.

## Security
Mọi POST Admin cần CSRF. Session Admin có HttpOnly/SameSite, timeout 30 phút và session version để vô hiệu hóa phiên cũ.

Không commit `.env`. Dùng `bootstrap_admin.py` để thiết lập Admin lần đầu.
