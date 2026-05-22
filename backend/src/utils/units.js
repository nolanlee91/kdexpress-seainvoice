// Map đơn vị tính Việt → English chuẩn cho khai báo hải quan Commercial Invoice
const UNIT_VN_TO_EN = {
  // Piece
  'cái': 'PCS', 'chiếc': 'PCS', 'cây': 'PCS', 'con': 'PCS',
  'pcs': 'PCS', 'pc': 'PCS', 'piece': 'PCS', 'pieces': 'PCS', 'unit': 'PCS', 'units': 'PCS', 'ea': 'PCS', 'each': 'PCS',
  // Set
  'bộ': 'SET', 'set': 'SET', 'sets': 'SET',
  // Roll
  'cuộn': 'ROLL', 'roll': 'ROLL', 'rolls': 'ROLL',
  // Box
  'hộp': 'BOX', 'box': 'BOX', 'boxes': 'BOX',
  // Bag
  'túi': 'BAG', 'bao': 'BAG', 'bag': 'BAG', 'bags': 'BAG',
  // Sheet
  'tấm': 'SHEET', 'tờ': 'SHEET', 'sheet': 'SHEET', 'sheets': 'SHEET',
  // Carton
  'thùng': 'CTN', 'carton': 'CTN', 'cartons': 'CTN', 'ctn': 'CTN',
  // Can
  'lon': 'CAN', 'can': 'CAN', 'cans': 'CAN',
  // Pack
  'gói': 'PACK', 'pack': 'PACK', 'packs': 'PACK',
  // Pair
  'đôi': 'PAIR', 'cặp': 'PAIR', 'pair': 'PAIR', 'pairs': 'PAIR',
  // Bottle
  'chai': 'BOTTLE', 'bottle': 'BOTTLE', 'bottles': 'BOTTLE',
  // Jar
  'lọ': 'JAR', 'hũ': 'JAR', 'jar': 'JAR', 'jars': 'JAR',
  // Tablet/pill
  'viên': 'TABLET', 'tablet': 'TABLET', 'pill': 'TABLET',
  // Book
  'cuốn': 'BOOK', 'quyển': 'BOOK', 'book': 'BOOK', 'books': 'BOOK',
  // Tube
  'ống': 'TUBE', 'tube': 'TUBE', 'tubes': 'TUBE',
  // Bar
  'thanh': 'BAR', 'bar': 'BAR', 'bars': 'BAR',
  // Mass
  'kg': 'KG', 'kilogram': 'KG', 'kilograms': 'KG', 'kilo': 'KG',
  'g': 'G', 'gram': 'G', 'grams': 'G',
  'tấn': 'TON', 'ton': 'TON', 'tonne': 'TON',
  'lb': 'LB', 'lbs': 'LB', 'pound': 'LB', 'pounds': 'LB',
  // Volume
  'lít': 'L', 'liter': 'L', 'liters': 'L', 'litre': 'L', 'l': 'L',
  'ml': 'ML', 'milliliter': 'ML',
  // Length
  'm': 'M', 'mét': 'M', 'meter': 'M', 'meters': 'M', 'metre': 'M',
  'cm': 'CM', 'centimeter': 'CM',
  'mm': 'MM',
  'inch': 'IN', 'in': 'IN',
  // Area
  'm2': 'M2', 'sqm': 'M2',
  // Volume cubic
  'm3': 'M3', 'cbm': 'M3',
};

const STANDARD_EN_UNITS = new Set(Object.values(UNIT_VN_TO_EN));

function translateUnit(u) {
  if (!u) return 'PCS';
  const direct = String(u).toLowerCase().trim();
  if (!direct) return 'PCS';
  if (UNIT_VN_TO_EN[direct]) return UNIT_VN_TO_EN[direct];
  // Strip Vietnamese diacritics
  const stripped = direct.normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (UNIT_VN_TO_EN[stripped]) return UNIT_VN_TO_EN[stripped];
  // Đã viết hoa và là EN unit chuẩn → giữ nguyên
  const upper = String(u).trim().toUpperCase();
  if (STANDARD_EN_UNITS.has(upper)) return upper;
  // Nếu có ký tự non-ASCII (Việt) mà không match → fallback PCS để đảm bảo English
  if (/[^\x00-\x7F]/.test(u)) return 'PCS';
  // ASCII unknown → uppercase pass-through
  return upper;
}

module.exports = { translateUnit, UNIT_VN_TO_EN };
