# Import Menu từ Excel — K&K

## Cài thư viện

```powershell
py -m pip install -r requirements.txt
```

Nếu chỉ cần tính năng Excel:

```powershell
py -m pip install openpyxl
```

## Sử dụng

Trong **Admin → Quản lý món ăn**:

1. Bấm **📄 Tải mẫu Excel** hoặc mở file `KK_Menu_Import_Template.xlsx`.
2. Nhập dữ liệu ở sheet `Menu`.
3. Bấm **📥 Import Excel**.
4. Chọn file `.xlsx`.
5. Bấm **Kiểm tra file** để xem lỗi/cảnh báo và preview.
6. Nếu không còn lỗi, bấm **✓ Xác nhận Import**.

## Quy tắc

- Hỗ trợ tối đa 500 món/lần.
- `Category`: có thể nhập ID hoặc tên danh mục hiện có. Dạng song ngữ như `Phở | Noodle Soup` cũng được hỗ trợ.
- `Name` + `Category` là khóa nhận diện khi import:
  - đã tồn tại → cập nhật món;
  - chưa tồn tại → tạo món mới.
- `Price_USD`: nhập giá USD, ví dụ `16.90`.
- `Available`: `Yes`/`No`, mặc định `Yes`.
- `Featured`: `Yes`/`No`, tối đa 8 món nổi bật.
- `Image`: tên file đã có trong `uploads/` hoặc `static/dishes/`; có thể để trống.
- Không xóa món cũ chỉ vì món đó không có trong Excel.
- Hệ thống tạo backup database trước khi Import và dùng transaction để rollback nếu có lỗi.
- Import có audit log `IMPORT` để truy vết.
