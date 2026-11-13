import type { Locale } from "@/lib/i18n";

type TranslationRule = {
  pattern: RegExp;
  hu: (match: RegExpMatchArray) => string;
};

const FIELD_LABELS: Record<string, string> = {
  Total: "Összes",
  Net: "Nettó",
  VAT: "ÁFA",
  Gross: "Bruttó",
  "net amount": "nettó összeg",
  "VAT amount": "ÁFA összeg",
  "gross amount": "bruttó összeg",
};

function translateAmountLabel(label: string): string {
  const direct = FIELD_LABELS[label];
  if (direct) {
    return direct;
  }

  const invoice = /^Invoice (total|net|VAT|gross)$/.exec(label);
  if (invoice) {
    return `Számla ${FIELD_LABELS[invoice[1]] ?? invoice[1]}`;
  }

  const lineItem = /^Line item "(.*)" (net|VAT|gross)$/.exec(label);
  if (lineItem) {
    return `"${lineItem[1]}" tétel ${FIELD_LABELS[lineItem[2]] ?? lineItem[2]}`;
  }

  const wholeLine = /^Line item "(.*)"$/.exec(label);
  if (wholeLine) {
    return `"${wholeLine[1]}" tétel`;
  }

  return label;
}

const DEFAULT_CURRENCY_ACTIONS: Record<string, string> = {
  "confirming invoices": "a számlák visszaigazolása előtt",
  "entering transactions": "a tranzakciók rögzítése előtt",
  "importing transactions": "a tranzakciók importálása előtt",
  "uploading invoices": "a számlák feltöltése előtt",
};

const RULES: TranslationRule[] = [
  {
    pattern: /^Missing required environment (variable|variables): (.+)$/,
    hu: (match) =>
      `Hiányzó kötelező környezeti ${match[1] === "variable" ? "változó" : "változók"}: ${match[2]}`,
  },
  {
    pattern: /^Missing required environment variable\(s\): (.+)$/,
    hu: (match) => `Hiányzó kötelező környezeti változó(k): ${match[1]}`,
  },
  { pattern: /^Database connection check failed$/, hu: () => "Az adatbázis-kapcsolat ellenőrzése nem sikerült" },
  { pattern: /^Creating the transaction failed$/, hu: () => "A tranzakció létrehozása nem sikerült" },
  { pattern: /^Saving settings failed$/, hu: () => "A beállítások mentése nem sikerült" },
  { pattern: /^Importing transactions failed$/, hu: () => "A tranzakciók importálása nem sikerült" },
  { pattern: /^Reading the import file failed$/, hu: () => "Az importfájl olvasása nem sikerült" },
  { pattern: /^Confirming the invoice failed$/, hu: () => "A számla visszaigazolása nem sikerült" },
  { pattern: /^Updating the invoice failed$/, hu: () => "A számla frissítése nem sikerült" },
  { pattern: /^Deleting the invoice failed$/, hu: () => "A számla törlése nem sikerült" },
  { pattern: /^Deleting the transaction failed$/, hu: () => "A tranzakció törlése nem sikerült" },
  { pattern: /^Deleting all data failed$/, hu: () => "Az összes adat törlése nem sikerült" },
  { pattern: /^Exporting transactions failed$/, hu: () => "A tranzakciók exportálása nem sikerült" },
  { pattern: /^Invoice upload failed$/, hu: () => "A számla feltöltése nem sikerült" },
  { pattern: /^Loading the invoice image failed$/, hu: () => "A számlakép betöltése nem sikerült" },
  { pattern: /^No file was uploaded\.$/, hu: () => "Nem töltöttek fel fájlt." },
  {
    pattern: /^No file was uploaded\. Send a multipart\/form-data request with a `file` field\.$/,
    hu: () => "Nem töltöttek fel fájlt. Küldj egy multipart/form-data kérést `file` mezővel.",
  },
  {
    pattern: /^Unsupported import file "(.+)"\. Upload a \.csv, \.xlsx, or \.xls file\.$/,
    hu: (match) => `Nem támogatott importfájl: "${match[1]}". Tölts fel .csv, .xlsx vagy .xls fájlt.`,
  },
  {
    pattern: /^File is too large \((.+)\)\. The import limit is (\d+) MB\.$/,
    hu: (match) => `A fájl túl nagy (${match[1]}). Az importálási korlát ${match[2]} MB.`,
  },
  {
    pattern: /^File is too large \((.+)\)\. The limit is (\d+) MB before base64 encoding\.$/,
    hu: (match) => `A fájl túl nagy (${match[1]}). A korlát base64-kódolás előtt ${match[2]} MB.`,
  },
  { pattern: /^Spreadsheet has no sheets$/, hu: () => "A táblázat nem tartalmaz munkalapot" },
  { pattern: /^CSV parse error: (.+)$/, hu: (match) => `CSV-feldolgozási hiba: ${match[1]}` },
  {
    pattern: /^Unsupported file type "(.+)"\. Upload a PNG, JPEG, WEBP, or PDF file\.$/,
    hu: (match) => `Nem támogatott fájltípus: "${match[1]}". Tölts fel PNG, JPEG, WEBP vagy PDF fájlt.`,
  },
  {
    pattern: /^Too many uploads\. Try again in (\d+) seconds\.$/,
    hu: (match) => `Túl sok feltöltés. Próbáld újra ${match[1]} másodperc múlva.`,
  },
  { pattern: /^Invoice not found$/, hu: () => "A számla nem található" },
  { pattern: /^Invoice is already confirmed$/, hu: () => "A számla már vissza van igazolva" },
  {
    pattern: /^DEFAULT_CURRENCY is not set\. Configure it in Settings before (confirming invoices|entering transactions|importing transactions|uploading invoices)\.$/,
    hu: (match) =>
      `A DEFAULT_CURRENCY nincs beállítva. Állítsd be a Beállításokban ${DEFAULT_CURRENCY_ACTIONS[match[1]] ?? match[1]}.`,
  },
  {
    pattern: /^DEFAULT_CURRENCY is not set\. Configure it in Settings to load the dashboard\.$/,
    hu: () => "A DEFAULT_CURRENCY nincs beállítva. Állítsd be a Beállításokban az irányítópult betöltéséhez.",
  },
  {
    pattern: /^DEFAULT_CURRENCY must be set before saving an opening balance$/,
    hu: () => "A nyitó egyenleg mentése előtt a DEFAULT_CURRENCY-t be kell állítani",
  },
  {
    pattern: /^DEFAULT_CURRENCY must be a 3-letter ISO 4217 code \(e\.g\. USD\)$/,
    hu: () => "A DEFAULT_CURRENCY-nek 3 betűs ISO 4217 kódnak kell lennie (pl. USD)",
  },
  {
    pattern:
      /^Multi-currency support is coming in a future release\. This invoice is in (\w+) but the active currency is (\w+)\. Non-(\w+) invoices cannot be confirmed yet\.$/,
    hu: (match) =>
      `A többpénznemes támogatás egy későbbi verzióban érkezik. Ez a számla ${match[1]}, az aktív pénznem pedig ${match[2]}. A nem ${match[3]} számlák még nem igazolhatók vissza.`,
  },
  { pattern: /^Category is required$/, hu: () => "A kategória megadása kötelező" },
  { pattern: /^Date cannot be in the future$/, hu: () => "A dátum nem lehet a jövőben" },
  {
    pattern: /^Invalid date \(expected YYYY-MM-DD within 1900–2100\): "(.+)"$/,
    hu: (match) => `Érvénytelen dátum (elvárt formátum: ÉÉÉÉ-HH-NN, 1900–2100 között): "${match[1]}"`,
  },
  { pattern: /^Invalid amount: "(.+)"$/, hu: (match) => `Érvénytelen összeg: "${match[1]}"` },
  {
    pattern: /^Amount has more than 2 decimal places: "(.+)"$/,
    hu: (match) => `Az összeg legfeljebb 2 tizedesjegyet tartalmazhat: "${match[1]}"`,
  },
  { pattern: /^Amount is too large: "(.+)"$/, hu: (match) => `Az összeg túl nagy: "${match[1]}"` },
  { pattern: /^Amount must not be zero$/, hu: () => "Az összeg nem lehet nulla" },
  {
    pattern: /^Amount exceeds the (\d+) minor-unit cap$/,
    hu: (match) => `Az összeg meghaladja a(z) ${match[1]} minor egység felső korlátját`,
  },
  {
    pattern: /^Invalid or missing date "(.+)"$/,
    hu: (match) => `Érvénytelen vagy hiányzó dátum: "${match[1]}"`,
  },
  { pattern: /^Date "(.+)" is after today$/, hu: (match) => `A dátum ("${match[1]}") a mai nap után van` },
  {
    pattern: /^Reset requires \{ "confirm": true, "confirmation": "DELETE" \}$/,
    hu: () => 'A visszaállításhoz { "confirm": true, "confirmation": "DELETE" } szükséges',
  },
  { pattern: /^Invalid column mapping$/, hu: () => "Érvénytelen oszlophozzárendelés" },
  {
    pattern: /^`mapping` must be a JSON object$/,
    hu: () => "A(z) `mapping` értékének JSON-objektumnak kell lennie",
  },
  {
    pattern: /^`overrides` must be a JSON object$/,
    hu: () => "A(z) `overrides` értékének JSON-objektumnak kell lennie",
  },
  { pattern: /^Invalid row overrides$/, hu: () => "Érvénytelen sor-felülírások" },
  {
    pattern: /^Unsupported export format "(.+)"$/,
    hu: (match) => `Nem támogatott exportformátum: "${match[1]}"`,
  },
  {
    pattern: /^Invalid (settings|transaction|invoice) payload — (.+)$/,
    hu: (match) => {
      const kind =
        match[1] === "settings"
          ? "beállítási"
          : match[1] === "transaction"
            ? "tranzakciós"
            : "számla-";
      return `Érvénytelen ${kind} adatcsomag — ${match[2]}`;
    },
  },
  {
    pattern: /^(Primary base URL|Primary model|Primary API key) is required$/,
    hu: (match) => {
      const label =
        match[1] === "Primary base URL"
          ? "Az elsődleges alap URL"
          : match[1] === "Primary model"
            ? "Az elsődleges modell"
            : "Az elsődleges API-kulcs";
      return `${label} megadása kötelező`;
    },
  },
  { pattern: /^Invalid opening balance — (.+)$/, hu: (match) => `Érvénytelen nyitó egyenleg — ${match[1]}` },
  {
    pattern: /^OPENING_BALANCE_(\w+) must be an integer number of minor units$/,
    hu: (match) => `A(z) OPENING_BALANCE_${match[1]} egész számú minor egység kell legyen`,
  },
  {
    pattern: /^drizzle\/meta\/_journal\.json does not contain migration (.+)$/,
    hu: (match) => `A drizzle/meta/_journal.json nem tartalmazza a(z) ${match[1]} migrációt`,
  },
  { pattern: /^APP_ENCRYPTION_KEY is not set$/, hu: () => "Az APP_ENCRYPTION_KEY nincs beállítva" },
  {
    pattern: /^APP_ENCRYPTION_KEY must be exactly 64 hex characters \(32 bytes\)$/,
    hu: () => "Az APP_ENCRYPTION_KEY-nek pontosan 64 hexadecimális karakternek (32 bájt) kell lennie",
  },
  {
    pattern: /^Encrypted value has an unrecognized format$/,
    hu: () => "A titkosított érték felismerhetetlen formátumú",
  },
  { pattern: /^Encrypted value is malformed$/, hu: () => "A titkosított érték hibás formátumú" },
  {
    pattern: /^Network error contacting LLM provider: (.+)$/,
    hu: (match) => `Hálózati hiba az LLM-szolgáltató elérésekor: ${match[1]}`,
  },
  {
    pattern: /^LLM provider rate limited the request \(HTTP 429\)$/,
    hu: () => "Az LLM-szolgáltató korlátozta a kérést (HTTP 429)",
  },
  {
    pattern: /^LLM provider rejected the request with HTTP (\d+)$/,
    hu: (match) => `Az LLM-szolgáltató HTTP ${match[1]} hibával elutasította a kérést`,
  },
  { pattern: /^LLM provider returned invalid JSON$/, hu: () => "Az LLM-szolgáltató érvénytelen JSON-t adott vissza" },
  {
    pattern: /^LLM provider response did not contain message content$/,
    hu: () => "Az LLM-szolgáltató válasza nem tartalmazott üzenettartalmat",
  },
  { pattern: /^Primary LLM provider is not configured$/, hu: () => "Az elsődleges LLM-szolgáltató nincs beállítva" },
  {
    pattern: /^Primary LLM provider failed \((.+)\) and no secondary provider is configured$/,
    hu: (match) => `Az elsődleges LLM-szolgáltató meghiúsult (${match[1]}), és nincs beállítva másodlagos szolgáltató`,
  },
  {
    pattern: /^Primary and secondary LLM providers both failed: (.+); (.+)$/,
    hu: (match) => `Az elsődleges és a másodlagos LLM-szolgáltató is meghiúsult: ${match[1]}; ${match[2]}`,
  },
  {
    pattern: /^LLM response did not contain a JSON object$/,
    hu: () => "Az LLM-válasz nem tartalmazott JSON-objektumot",
  },
  { pattern: /^LLM response was not valid JSON$/, hu: () => "Az LLM-válasz nem érvényes JSON" },
  {
    pattern: /^Invoice data from the LLM failed validation — (.+)$/,
    hu: (match) => `A számlaadatok LLM-ellenőrzése nem sikerült — ${match[1]}`,
  },
  {
    pattern: /^Invoice date is invalid or out of range \(1900–2100\): "(.+)"$/,
    hu: (match) => `A számla dátuma érvénytelen vagy tartományon kívül esik (1900–2100): "${match[1]}"`,
  },
  {
    pattern: /^(.+) is missing its amount$/,
    hu: (match) => `A(z) ${translateAmountLabel(match[1])} összege hiányzik`,
  },
  {
    pattern: /^(.+) exceeds the (\d+) minor-unit cap \(got (-?\d+)\)$/,
    hu: (match) =>
      `${translateAmountLabel(match[1])} meghaladja a(z) ${match[2]} minor egység felső korlátját (érték: ${match[3]})`,
  },
  {
    pattern:
      /^Line item (\d+) (net amount|VAT amount|gross amount) must be an integer number of minor units not exceeding (\d+)$/,
    hu: (match) =>
      `A(z) ${match[1]}. tétel ${FIELD_LABELS[match[2]] ?? match[2]}: egész számú minor egység kell legyen, legfeljebb ${match[3]}.`,
  },
  {
    pattern: /^(.+) must be an integer number of minor units not exceeding (\d+)$/,
    hu: (match) =>
      `${translateAmountLabel(match[1])}: egész számú minor egység kell legyen, legfeljebb ${match[2]}.`,
  },
  {
    pattern: /^Line items must not contain more than (\d+) entries$/,
    hu: (match) => `A tételek száma nem haladhatja meg a(z) ${match[1]} elemet`,
  },
  {
    pattern: /^Line item (\d+) description must not be empty$/,
    hu: (match) => `A(z) ${match[1]}. tétel leírása nem lehet üres`,
  },
  {
    pattern: /^Line item (\d+) description must not exceed (\d+) characters$/,
    hu: (match) => `A(z) ${match[1]}. tétel leírása nem haladhatja meg a(z) ${match[2]} karaktert`,
  },
];

/**
 * Localizes an app-authored English error message for display. In Hungarian mode the result is
 * "magyar szöveg (English original)"; in English mode the message is returned verbatim. Messages
 * that do not belong to the app (raw provider/database errors) are returned untouched.
 */
export function localizeErrorMessage(locale: Locale, message: string): string {
  if (locale !== "hu") {
    return message;
  }

  const trimmed = message.trim();
  if (trimmed === "") {
    return message;
  }

  for (const rule of RULES) {
    const match = rule.pattern.exec(trimmed);
    if (match) {
      const hungarian = rule.hu(match);
      return hungarian === trimmed ? message : `${hungarian} (${message})`;
    }
  }

  return message;
}
