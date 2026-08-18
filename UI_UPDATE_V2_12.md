# K&K UI Update v2.12

Trang Chủ đã được tinh chỉnh theo 5 điểm UX/UI:

1. Giảm khoảng cách giữa Hero và Món nổi bật.
2. Đổi section Địa điểm từ nền kem sang nền trắng để tách rõ với About K&K.
3. Bỏ dòng địa chỉ bị lặp trong phần thông tin Địa điểm.
4. Thu gọn section Địa điểm: giảm padding, chiều cao gallery và khoảng cách nội dung.
5. Khi tắt đặt hàng trực tuyến, `delivery_note` trên Hero được hiển thị dạng business-hours badge; khi bật online vẫn hiển thị dạng mô tả thông thường.

Đã kiểm tra:
- Python syntax: OK
- Jinja templates compile: OK
- SQLite quick_check: OK
- SQLite foreign_key_check: 0 lỗi
- admin.js syntax: OK
- app.js syntax: OK
- Không còn tham chiếu `location_intro` trong source
