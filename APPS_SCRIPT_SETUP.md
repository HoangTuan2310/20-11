# Lưu thiệp vào Google Drive của chủ sở hữu

Trang gửi dữ liệu tới Google Apps Script. Khách truy cập không cần đăng nhập
hoặc cấp quyền Google; Apps Script lưu ảnh và lời chúc vào Drive/Sheets của tài
khoản đã triển khai. Không gửi email.

## Triển khai lần đầu

1. Đăng nhập vào Google Apps Script bằng tài khoản Google sở hữu Drive muốn lưu.
2. Tạo một Apps Script project tại <https://script.google.com/>.
3. Thay nội dung `Code.gs` mặc định bằng nội dung từ [`apps-script/Code.gs`](./apps-script/Code.gs), rồi lưu.
4. Chọn **Deploy → New deployment → Web app**.
5. Đặt **Execute as** thành tài khoản của bạn và **Who has access** thành **Anyone**.
6. Chọn **Deploy**, chấp thuận quyền truy cập Drive/Sheets bằng tài khoản của bạn, rồi sao chép URL kết thúc bằng `/exec`.
7. Trong `script.js`, thay giá trị `APPS_SCRIPT_URL` bằng URL vừa sao chép.
8. Đăng tải lại các tệp web lên hosting hiện tại.

Lần gửi đầu tiên sẽ tự tạo thư mục `ThiepTriAn` và bảng tính `ThiepTriAn - Loi chuc`
trong Drive của tài khoản triển khai. Mỗi lượt gửi sẽ lưu ảnh PNG vào thư mục và
thêm lời chúc vào bảng tính. Tài khoản sở hữu dữ liệu là tài khoản đặt **Execute as**
khi triển khai Web app.

## Cập nhật Apps Script

Sau khi chỉnh sửa `Code.gs`, chọn **Deploy → Manage deployments**, sửa deployment,
chọn **New version**, rồi triển khai. Giữ URL `/exec` của deployment và đặt URL đó
trong `APPS_SCRIPT_URL` ở `script.js`.

## Lưu ý

Web app cho phép truy cập ẩn danh để khách không phải đăng nhập. Endpoint công khai
có thể bị lạm dụng; script giới hạn kích thước ảnh 6 MB, độ dài nội dung và 20 lượt
gửi mỗi phút. Không chia sẻ quyền chỉnh sửa project Apps Script hoặc các tệp Drive
được tạo.
