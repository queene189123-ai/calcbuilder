export type ParsedQuoteLineItem = {
  description: string;
  specification: Record<string, never>;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  currency: string;
  confidence: number;
  source_excerpt: string;
};

function amount(value: string): number | null {
  const cleaned = String(value || "").replace(/[^0-9,.-]/g, "").replace(/\s/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",") && cleaned.includes(".")
    ? (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, ""))
    : cleaned.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function currency(value: string): string | null {
  if (/₽|руб|RUB/i.test(value)) return "RUB";
  if (/USD|\$/i.test(value)) return "USD";
  if (/EUR|€/i.test(value)) return "EUR";
  return null;
}

/** Extract numbered rows from flattened PDF text, starting after the item-table header. */
export function parseFlattenedQuoteLineItems(text: string, fallbackCurrency = "RUB"): ParsedQuoteLineItem[] {
  const tableHeader = text.match(
    /(?:наименование|номенклатура|описание|товар)[\s\S]{0,180}?(?:кол-во|количество|qty)[\s\S]{0,120}?(?:цена|стоимость)[\s\S]{0,120}?(?:сумма|итого|total)/i
  );
  const tableText = tableHeader ? text.slice(tableHeader.index! + tableHeader[0].length) : text;
  const flatRow = /(?:^|\s)(\d{1,3})\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+(шт\.?|штук|лист(?:а|ов)?|м|метр(?:а|ов)?|кг|т|упак\.?)\s+([\d\s]+[,.]\d{2})\s+([\d\s]+[,.]\d{2})(?=\s+\d{1,3}\s+|\s*(?:Стоимость товаров|ИТОГО)|$)/gi;
  const items: ParsedQuoteLineItem[] = [];
  for (const match of tableText.matchAll(flatRow)) {
    const quantity = amount(match[3]);
    const unitPrice = amount(match[5]);
    const total = amount(match[6]);
    const description = match[2].trim();
    if (!description || quantity === null || unitPrice === null || total === null) continue;
    items.push({
      description: description.slice(0, 500),
      specification: {},
      quantity,
      unit: match[4].slice(0, 40),
      unit_price: unitPrice,
      total,
      currency: currency(match[0]) || fallbackCurrency,
      confidence: 0.65,
      source_excerpt: match[0].trim().slice(0, 1000)
    });
    if (items.length >= 150) break;
  }
  return items;
}
