# App Hàng Biển

Web app standalone giúp quản lý chuyến container đường biển + sinh file Excel
`Tách Cont Biển` (cùng các Commercial Invoice cho từng khách).

## Flow

1. **Tạo chuyến hàng biển** (vd `SEA 052026`) ở `/shipments`.
2. **Thêm khách hàng** vào chuyến từ sidebar trang detail.
3. **Tab "Mã kiện"**: nhập danh sách mã kiện + kích thước + container 20/40ft (chính là dữ liệu sheet `SEA xxx`).
4. **Tab "Hóa đơn AI"**: up ảnh hóa đơn → Gemini scan → items được clone sang Commercial Invoice. Data raw của AI luôn được lưu lại.
5. **Tab "Commercial Invoice"**: sửa items thoải mái (giá, tên EN, số lượng…). Có nút "Khôi phục về gốc" ở mỗi hóa đơn nếu lỡ sửa hỏng.
6. **Nút "Xuất Excel"** ở header trang detail → file `.xlsx` gồm 1 sheet `SEA …` + n sheet Commercial Invoice cho từng khách.

## Stack

- Backend: Node + Express + PostgreSQL, JWT, Gemini Vision, Cloudinary, exceljs.
- Frontend: React 18 + Vite + react-router-dom v6.

## Cài đặt local

### Chuẩn bị
- Node ≥ 18 (kiểm tra `node -v`).
- PostgreSQL chạy local (hoặc Railway/Neon connection string).
- Cloudinary account (free tier OK) — lấy `cloud_name`, `api_key`, `api_secret` ở dashboard.
- Gemini API key — lấy ở https://aistudio.google.com/app/apikey

### Backend

```powershell
cd "c:\Users\User\Desktop\Thang Le\14. Hàng biển\app\backend"
npm install
Copy-Item .env.example .env
# Mở .env, điền DATABASE_URL, JWT_SECRET (32+ ký tự), CLOUDINARY_*, GEMINI_API_KEY
npm run dev
```

Backend chạy ở `http://localhost:4000`. Lúc khởi động sẽ tự `CREATE TABLE` (idempotent) và tạo user mặc định `admin / admin`.

Test nhanh:
```powershell
Invoke-RestMethod http://localhost:4000/api/health
```

### Frontend

```powershell
cd "c:\Users\User\Desktop\Thang Le\14. Hàng biển\app\frontend"
npm install
Copy-Item .env.example .env
# Mặc định VITE_API_URL=http://localhost:4000 — không cần sửa nếu chạy local
npm run dev
```

Mở `http://localhost:5173`. Đăng nhập `admin / admin`.

## Cấu trúc thư mục

```
app/
├── backend/
│   ├── src/
│   │   ├── db/index.js          # pool + initDB (CREATE TABLE IF NOT EXISTS)
│   │   ├── middleware/auth.js   # JWT + verifyPassword
│   │   ├── services/
│   │   │   ├── gemini.js        # scanInvoice(image_url) → {items, …}
│   │   │   ├── cloudinary.js    # signUploadParams()
│   │   │   └── excelExport.js   # buildWorkbook(seaShipmentId) → ExcelJS.Workbook
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── users.js
│   │   │   ├── customers.js
│   │   │   ├── seaShipments.js  # + sub-route /customers
│   │   │   ├── cargos.js
│   │   │   ├── invoices.js      # POST /sea-shipments/:id/invoices/scan
│   │   │   ├── commercialInvoiceItems.js
│   │   │   ├── upload.js        # POST /sign-cloudinary
│   │   │   └── export.js        # GET /sea-shipments/:id/export.xlsx
│   │   └── index.js             # entry, mount routes
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api/index.js
    │   ├── context/AuthContext.jsx
    │   ├── components/
    │   │   ├── Layout.jsx
    │   │   └── ImageUpload.jsx
    │   └── pages/
    │       ├── Login.jsx
    │       ├── SeaShipments.jsx
    │       ├── SeaShipmentDetail.jsx   # ← trang chính, 3 tab
    │       ├── Customers.jsx
    │       ├── Accounts.jsx
    │       └── MyAccount.jsx
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── .env.example
```

## Data model

```
users
customers (name, address, receiver_block)
sea_shipments (code, invoice_date, sender_block, status)
sea_shipment_customers (link table, display_order)
cargos (shipment_title, description, weight, dimensions, container_type)
invoices (image_url, raw_json — bất biến, status)
commercial_invoice_items (line_no, name_vn, name_en, qty, unit, unit_value_usd, total_value_usd, country, source_invoice_id)
```

`invoices.raw_json` là source of truth của bước 2 (data gốc).
`commercial_invoice_items` là editable copy của bước 3-4. Reset về raw qua endpoint `POST /api/invoices/:id/restore`.

## API surface

Toàn bộ JWT bearer.

| Method | Path | Mục đích |
|---|---|---|
| POST | `/api/auth/login` | login |
| GET | `/api/auth/me` | self info |
| POST | `/api/auth/change-password` | đổi pass |
| `*` | `/api/users` | admin only |
| `*` | `/api/customers` | CRUD khách |
| GET/POST | `/api/sea-shipments` | list / create chuyến |
| GET/PUT/DELETE | `/api/sea-shipments/:id` | chi tiết + customers nested |
| POST/DELETE | `/api/sea-shipments/:id/customers[/:cid]` | thêm/bỏ khách khỏi chuyến |
| GET/POST | `/api/sea-shipments/:id/cargos` | cargo của chuyến |
| PUT/DELETE | `/api/cargos/:id` | sửa/xoá cargo |
| POST | `/api/sea-shipments/:id/invoices/scan` | **AI scan** (sync) |
| GET | `/api/sea-shipments/:id/invoices` | list hóa đơn |
| DELETE | `/api/invoices/:id` | xoá hóa đơn + items |
| POST | `/api/invoices/:id/restore` | reset items về raw |
| GET | `/api/sea-shipments/:id/commercial-invoice-items` | list items |
| POST | `/api/commercial-invoice-items/bulk` | upsert + delete trong 1 lần |
| POST | `/api/upload/sign-cloudinary` | signed URL upload |
| GET | `/api/sea-shipments/:id/export.xlsx` | **xuất Excel** |

## Verify E2E

1. Đăng nhập `admin / admin`.
2. Tạo customer "Test Customer" với `receiver_block` mẫu.
3. Tạo chuyến `SEA TEST` + ngày invoice.
4. Mở chuyến → "Thêm khách" → chọn Test Customer.
5. Tab Mã kiện: thêm 2 dòng (`KD123...`, weight 100kg, 100x80x60, 20ft). Lưu.
6. Tab Hóa đơn AI: up `máy xay giò chả Wingo.jpg` (có sẵn trong folder cha) → đợi 5-15s → thấy items raw.
7. Tab Commercial Invoice: thấy items đã clone, sửa 1 giá → Lưu.
8. Nút Xuất Excel → tải file → mở verify:
   - Sheet `SEA TEST`: header bg xanh, "Test Customer" bg vàng, 2 dòng cargos.
   - Sheet `Test Customer`: header "COMMERCIAL INVOICE", block sender/receiver, bảng items có formula `F = C*E`, dòng `TOTAL` SUM.
9. Test thử `POST /api/invoices/:id/restore` để verify khôi phục items về raw.

## Deploy lên Railway (sau)

- Tạo 2 service (backend + frontend), 1 Postgres add-on.
- Backend: env vars như `.env`, start command `node src/index.js`.
- Frontend: build `npm run build` → serve `dist/` (vd `npx serve -s dist`).
- `VITE_API_URL` của frontend trỏ vào URL backend Railway.

## Quirks

- Cloudinary phải có cấu hình; nếu không, upload sẽ fail với error `cloudinary_not_configured`.
- Gemini có rate limit free tier 10 RPM — scan tuần tự thì OK. Nếu nhiều ảnh, đợi giữa các lần.
- Sheet name Excel tối đa 31 ký tự — `excelExport.js` tự cắt + dedupe.
- Khi xoá chuyến → CASCADE xoá tất cả customers/cargos/invoices/items thuộc chuyến đó.
- Khi xoá invoice → xoá kèm items có `source_invoice_id` đúng nó. Items add tay (không có source) thì không bị xoá.
