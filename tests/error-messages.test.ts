// spec: app-authored (server/validation) error messages are shown Hungarian-first in HU mode with the
//   English original in parentheses; EN mode is unchanged; unknown provider/database messages are never
//   relabeled. Expected values are hand-derived from the Hungarian sentence + " (" + original + ")".
import { describe, expect, it } from "vitest";

import { localizeErrorMessage } from "@/lib/error-messages";

describe("localizeErrorMessage", () => {
  it("translates a fixed server message and keeps the English original parenthesized", () => {
    expect(localizeErrorMessage("hu", "Invoice not found")).toBe(
      "A számla nem található (Invoice not found)",
    );
  });

  it("translates dynamic file-type and size messages", () => {
    expect(
      localizeErrorMessage(
        "hu",
        'Unsupported file type "text/plain". Upload a PNG, JPEG, WEBP, or PDF file.',
      ),
    ).toBe(
      'Nem támogatott fájltípus: "text/plain". Tölts fel PNG, JPEG, WEBP vagy PDF fájlt. (Unsupported file type "text/plain". Upload a PNG, JPEG, WEBP, or PDF file.)',
    );

    expect(
      localizeErrorMessage(
        "hu",
        "File is too large (16.0 MB). The limit is 15 MB before base64 encoding.",
      ),
    ).toBe(
      "A fájl túl nagy (16.0 MB). A korlát base64-kódolás előtt 15 MB. (File is too large (16.0 MB). The limit is 15 MB before base64 encoding.)",
    );
  });

  it("translates the multi-currency rejection with both currency codes", () => {
    expect(
      localizeErrorMessage(
        "hu",
        "Multi-currency support is coming in a future release. This invoice is in USD but the active currency is HUF. Non-HUF invoices cannot be confirmed yet.",
      ),
    ).toBe(
      "A többpénznemes támogatás egy későbbi verzióban érkezik. Ez a számla USD, az aktív pénznem pedig HUF. A nem HUF számlák még nem igazolhatók vissza. (Multi-currency support is coming in a future release. This invoice is in USD but the active currency is HUF. Non-HUF invoices cannot be confirmed yet.)",
    );
  });

  it("translates import row skip reasons and amount validation", () => {
    expect(localizeErrorMessage("hu", 'Invalid or missing date "2024-02-30"')).toBe(
      'Érvénytelen vagy hiányzó dátum: "2024-02-30" (Invalid or missing date "2024-02-30")',
    );
    expect(localizeErrorMessage("hu", "Amount must not be zero")).toBe(
      "Az összeg nem lehet nulla (Amount must not be zero)",
    );
    expect(
      localizeErrorMessage("hu", "Amount exceeds the 100000000000 minor-unit cap"),
    ).toBe(
      "Az összeg meghaladja a(z) 100000000000 minor egység felső korlátját (Amount exceeds the 100000000000 minor-unit cap)",
    );
  });

  it("translates invoice line-item validation labels", () => {
    expect(
      localizeErrorMessage("hu", "Line item 1 description must not exceed 500 characters"),
    ).toBe(
      "A(z) 1. tétel leírása nem haladhatja meg a(z) 500 karaktert (Line item 1 description must not exceed 500 characters)",
    );
    expect(
      localizeErrorMessage(
        "hu",
        "Line item 2 net amount must be an integer number of minor units not exceeding 100000000000",
      ),
    ).toBe(
      "A(z) 2. tétel nettó összeg: egész számú minor egység kell legyen, legfeljebb 100000000000. (Line item 2 net amount must be an integer number of minor units not exceeding 100000000000)",
    );
  });

  it("leaves English mode and unknown raw errors untouched", () => {
    expect(localizeErrorMessage("en", "Invoice not found")).toBe("Invoice not found");
    expect(localizeErrorMessage("hu", "connection refused")).toBe("connection refused");
    expect(localizeErrorMessage("hu", "fetch failed")).toBe("fetch failed");
  });
});
