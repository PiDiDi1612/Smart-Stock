# Hướng dẫn Sử dụng SmartStock - Hệ thống Quản lý Kho Chuyên nghiệp

## 1. Cài đặt và Thiết lập Ban đầu

### Cài đặt
1. Chạy file `SmartStock-Setup.exe` (trong thư mục release hoặc file bạn đã nhận được).
2. Chờ quá trình cài đặt tự động hoàn tất.
3. Biểu tượng **SmartStock** sẽ xuất hiện trên màn hình Desktop.

### Thiết lập Kết nối (Lần đầu khởi chạy)
Khi mở ứng dụng lần đầu, bạn cần chọn chế độ hoạt động:

*   **MÁY CHỦ (SERVER)**:
    *   **Chọn khi nào?** Đây là máy tính CHÍNH lưu trữ toàn bộ dữ liệu kho.
    *   Hệ thống sẽ tự động khởi tạo Cơ sở dữ liệu.
    *   Hệ thống sẽ hiển thị **IP Máy chủ** (Ví dụ: `192.168.1.15`).
    *   **Quan trọng**: Bạn cần bật ứng dụng trên máy chủ thì các máy con mới kết nối được.

*   **MÁY KHÁCH (CLIENT)**:
    *   **Chọn khi nào?** Đây là máy tính nhân viên, cần kết nối vào máy chủ để xem/nhập liệu.
    *   Nhập **Địa chỉ IP của Máy chủ** vào ô trống (lấy từ máy chủ).
    *   Nhấn **Kết nối**.

## 2. Câu hỏi Thường gặp (FAQ)

### Q: Tôi muốn chuyển Máy chủ sang máy tính khác thì làm thế nào?
**A: Quy trình chuyển đổi đơn giản như sau:**
1.  Trên máy chủ cũ: Vào **Tài khoản** -> **Sao lưu dữ liệu** (nếu có tính năng này) hoặc copy thủ công file dữ liệu.
    *   *Lưu ý*: Dữ liệu nằm trong thư mục `%APPDATA%\SmartStock\data`. Bạn có thể copy cả thư mục này sang máy mới.
2.  Trên máy mới: Cài đặt SmartStock.
3.  Chọn chế độ **MÁY CHỦ**.
4.  Copy dữ liệu cũ đè vào thư mục dữ liệu trên máy mới (nếu cần khôi phục).
5.  Cập nhật lại địa chỉ IP mới cho các máy khách.

### Q: Ngoài cách luôn mở App trên màn hình, có cách nào chạy ngầm không?
**A: Hiện tại, Kiến trúc Desktop App yêu cầu ứng dụng phải chạy để phục vụ dữ liệu.**
*   **Cách tốt nhất**: Bạn cứ mở ứng dụng SmartStock trên máy chủ.
*   **Mẹo**: Nếu không muốn vướng màn hình, bạn có thể nhấn nút **Thu nhỏ (Minimize)** để nó nằm dưới thanh Taskbar. Server vẫn hoạt động bình thường miễn là bạn không tắt hẳn ứng dụng (nút X).
*   *Lưu ý kỹ thuật*: Ứng dụng này tích hợp sẵn Máy chủ bên trong file chạy `.exe`. Chúng ta không tách rời phần Server chạy ngầm (Service) để đảm bảo việc cài đặt đơn giản nhất cho người dùng phổ thông (chỉ 1 click là chạy).

## 3. Các Tính năng Chính

*   **Tổng quan (Dashboard)**: Xem nhanh tồn kho, cảnh báo vật tư sắp hết.
*   **Vật tư**: Tìm kiếm, Quản lý danh mục vật tư.
*   **Lập phiếu**: Nhập/Xuất kho nhanh chóng.
*   **Lịch sử**: Xem lại nhật ký giao dịch, xuất báo cáo Excel.
*   **Định mức**: Quản lý vật tư theo dự toán công trình.
*   **Hệ thống**:
    *   **Dark Mode**: Chế độ tối bảo vệ mắt.
    *   **Real-time**: Dữ liệu đồng bộ tức thì giữa các máy.

---
**Hỗ trợ Kỹ thuật**: Liên hệ bộ phận IT hoặc nhà phát triển (Phạm Đức Duy).
