const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// --- Scan prompt: raw extract only, KHÔNG dịch ---

const scanSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name_vn: { type: 'string' },
          name_en: { type: 'string' },
          qty: { type: 'number' },
          unit: { type: 'string' },
          unit_value: { type: 'number' },
          total_value: { type: 'number' },
          country_of_origin: { type: 'string' },
        },
        required: ['qty', 'unit', 'unit_value', 'total_value'],
      },
    },
    currency_detected: { type: 'string' },
    notes: { type: 'string' },
  },
  required: ['items'],
};

const SCAN_PROMPT = `Bạn là OCR cho hóa đơn của nhà cung cấp Việt Nam. Trích xuất danh sách hàng hóa NHƯ NGUYÊN VĂN trên ảnh — KHÔNG dịch, KHÔNG thay đổi.

Quy tắc tên hàng:
- Nếu trên hóa đơn dòng đó có TÊN TIẾNG VIỆT → điền vào "name_vn", để "name_en" là chuỗi rỗng "".
- Nếu trên hóa đơn dòng đó có TÊN TIẾNG ANH → điền vào "name_en", để "name_vn" là chuỗi rỗng "".
- Nếu hóa đơn song ngữ (có cả VN và EN) → điền cả 2.
- TUYỆT ĐỐI KHÔNG tự dịch giữa VN ↔ EN.

Các field khác:
- qty: số lượng (số thuần)
- unit: đơn vị tính (PCS, KG, Rolls, Set, Cái, Bộ, Cuộn, ...). Mặc định "PCS" nếu không rõ.
- unit_value: đơn giá — giữ NGUYÊN số trên hóa đơn (vd "150.000 đ" → 150000)
- total_value: thành tiền = qty × unit_value
- country_of_origin: mặc định "VIETNAM" trừ khi hóa đơn ghi rõ khác

currency_detected: "VND" / "USD" / khác — đơn vị tiền trên hóa đơn.
notes: ghi chú nếu ảnh mờ/không đọc được dòng nào.`;

async function scanInvoice(imageUrl) {
  if (!process.env.GEMINI_API_KEY) throw new Error('gemini_not_configured');

  const resp = await fetch(imageUrl);
  if (!resp.ok) throw new Error(`fetch_image_failed_${resp.status}`);
  const arrayBuf = await resp.arrayBuffer();
  const base64 = Buffer.from(arrayBuf).toString('base64');
  const mimeType = resp.headers.get('content-type') || 'image/jpeg';

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: scanSchema,
      temperature: 0.1,
    },
  });

  const result = await model.generateContent([
    { text: SCAN_PROMPT },
    { inlineData: { mimeType, data: base64 } },
  ]);

  const text = result.response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('gemini_invalid_json: ' + text.slice(0, 200));
  }
  parsed.items = (parsed.items || []).map((it) => ({
    name_vn: String(it.name_vn || '').trim(),
    name_en: String(it.name_en || '').trim(),
    qty: Number(it.qty || 0),
    unit: String(it.unit || 'PCS').trim(),
    unit_value: Number(it.unit_value || 0),
    total_value: Number(it.total_value || (Number(it.qty || 0) * Number(it.unit_value || 0))),
    country_of_origin: String(it.country_of_origin || 'VIETNAM').trim() || 'VIETNAM',
  }));
  return parsed;
}

// --- Translate: VN → EN cho commercial invoice ---

const translateSchema = {
  type: 'object',
  properties: {
    translations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name_en: { type: 'string' },
        },
        required: ['id', 'name_en'],
      },
    },
  },
  required: ['translations'],
};

const TRANSLATE_PROMPT = `Bạn là chuyên viên dịch hồ sơ xuất khẩu Việt Nam → Bắc Mỹ (Canada/Mỹ). Dịch tên hàng từ tiếng Việt sang tiếng Anh để khai báo HẢI QUAN trên Commercial Invoice.

Quy tắc:
- Dịch SÁT NGHĨA, ưu tiên thuật ngữ thương mại / hải quan.
- Giữ thông số kỹ thuật nếu có (vd kích thước, công suất, chất liệu).
- Đơn vị đo (kg, ml, cm...) giữ nguyên.
- Tên thương hiệu / model giữ nguyên (không phiên âm).
- KHÔNG thêm bình luận, KHÔNG giải thích — chỉ trả về bản dịch.

Input là 1 mảng JSON [{id, name_vn}, ...]. Trả về [{id, name_en}, ...] với cùng id.`;

async function translateNames(items) {
  if (!process.env.GEMINI_API_KEY) throw new Error('gemini_not_configured');
  const input = items.map((it) => ({ id: it.id, name_vn: it.name_vn }));
  if (input.length === 0) return [];

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: translateSchema,
      temperature: 0.2,
    },
  });

  const result = await model.generateContent([
    { text: TRANSLATE_PROMPT },
    { text: 'Input:\n' + JSON.stringify(input) },
  ]);

  const text = result.response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('gemini_invalid_json: ' + text.slice(0, 200));
  }
  return (parsed.translations || []).map((t) => ({
    id: Number(t.id),
    name_en: String(t.name_en || '').trim(),
  }));
}

// --- Suggest metadata: material + HS code (Canada + Vietnam) ---

const metadataSchema = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          material: { type: 'string' },
          hs_code_ca: { type: 'string' },
          hs_code_vn: { type: 'string' },
        },
        required: ['id', 'material', 'hs_code_ca', 'hs_code_vn'],
      },
    },
  },
  required: ['suggestions'],
};

const METADATA_PROMPT = `Bạn là chuyên viên khai báo hải quan xuất khẩu Việt Nam → Canada. Với mỗi item dưới đây, hãy gợi ý 3 trường:

1. **material**: Chất liệu chính bằng tiếng Anh (vd: "Stainless Steel 304", "Aluminum", "Cast Iron", "Plastic", "Cotton", "Polyester", "Wood", "Glass", "Ceramic", "Paper", "Rattan", "Bamboo", ...). Nếu là máy móc/điện tử thì ghi vật liệu vỏ + công năng chính (vd: "Stainless steel body, electric motor"). Không trả về tiếng Việt.

2. **hs_code_ca**: HS code 10 chữ số theo Canadian Customs Tariff (HSC), format "XXXX.XX.XX.XX" (vd "8210.00.00.10"). Dựa training data nhưng manager sẽ verify, hãy chọn code phù hợp nhất.

3. **hs_code_vn**: HS code 8 chữ số theo biểu thuế xuất nhập khẩu Việt Nam, format "XXXX.XX.XX" (vd "8210.00.00").

Input là mảng JSON [{id, name_vn, name_en}, ...]. Trả [{id, material, hs_code_ca, hs_code_vn}] cùng id.

Lưu ý: HS code là GỢI Ý — không 100% chính xác. Nếu item quá generic không gắn được, trả best-effort guess. Không bỏ trống.`;

async function suggestMetadata(items) {
  if (!process.env.GEMINI_API_KEY) throw new Error('gemini_not_configured');
  const input = items.map((it) => ({ id: it.id, name_vn: it.name_vn || '', name_en: it.name_en || '' }));
  if (input.length === 0) return [];

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: metadataSchema,
      temperature: 0.1,
    },
  });

  const result = await model.generateContent([
    { text: METADATA_PROMPT },
    { text: 'Input:\n' + JSON.stringify(input) },
  ]);

  const text = result.response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('gemini_invalid_json: ' + text.slice(0, 200));
  }
  return (parsed.suggestions || []).map((s) => ({
    id: Number(s.id),
    material: String(s.material || '').trim(),
    hs_code_ca: String(s.hs_code_ca || '').trim(),
    hs_code_vn: String(s.hs_code_vn || '').trim(),
  }));
}

module.exports = { scanInvoice, translateNames, suggestMetadata };
