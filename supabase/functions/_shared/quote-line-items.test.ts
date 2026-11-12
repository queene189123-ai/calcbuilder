import { assertEquals } from "jsr:@std/assert@1";
import { parseFlattenedQuoteLineItems } from "./quote-line-items.ts";

Deno.test("flattened Russian commercial offer yields exactly four product rows", () => {
  const sample = `КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ. Срок действия 5 рабочих дней. Предмет предложения: листовой металл.
№ Наименование / спецификация Кол-во Ед. Цена за ед., ₽ Сумма, ₽
1 Лист горячекатаный Ст3сп, 4 мм, 1500×6000 мм, ГОСТ 19903 20 лист 8 450,00 169 000,00
2 Лист горячекатаный Ст3сп, 6 мм, 1500×6000 мм, ГОСТ 19903 12 лист 12 600,00 151 200,00
3 Лист нержавеющий AISI 304, 2 мм, 1250×2500 мм 8 лист 18 900,00 151 200,00
4 Лист алюминиевый АМг3, 3 мм, 1500×3000 мм 6 лист 14 750,00 88 500,00
Стоимость товаров: 559 900,00`;
  const rows = parseFlattenedQuoteLineItems(sample, "RUB");
  assertEquals(rows.length, 4);
  assertEquals(rows.map(row => row.description), [
    "Лист горячекатаный Ст3сп, 4 мм, 1500×6000 мм, ГОСТ 19903",
    "Лист горячекатаный Ст3сп, 6 мм, 1500×6000 мм, ГОСТ 19903",
    "Лист нержавеющий AISI 304, 2 мм, 1250×2500 мм",
    "Лист алюминиевый АМг3, 3 мм, 1500×3000 мм"
  ]);
  assertEquals(rows.map(row => row.quantity), [20, 12, 8, 6]);
  assertEquals(rows.map(row => row.unit_price), [8450, 12600, 18900, 14750]);
  assertEquals(rows.map(row => row.total), [169000, 151200, 151200, 88500]);
  assertEquals(rows.every(row => row.currency === "RUB"), true);
});
