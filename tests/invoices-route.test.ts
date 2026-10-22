// spec: upload endpoint — reject >15MB/unsupported files and rate-limited clients before any LLM dispatch or
//   invoice row; same content hash on retry returns the existing invoice without re-dispatching; a valid file is
//   sent to the dispatcher as a base64 data URL and stored as needs_review.
// expected (hand-derived): 16MiB PDF → 400 "File is too large (16.0 MB)...", dispatch not called, zero rows added;
//   .txt → unsupported-type 400; 11th request for one IP in the window → 429 "Try again in 600 seconds" and no
//   dispatch; valid PNG with provider JSON total 5000 (USD) → { ok:true, duplicate:false, status:"needs_review" },
//   the dispatcher receives "data:image/png;base64,<bytes>", the bytes are stored for preview, and the content
//   hash is persisted for dedupe; re-uploading identical bytes → duplicate:true, same id, dispatch count unchanged.
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { dispatchChatMock } = vi.hoisted(() => ({ dispatchChatMock: vi.fn() }));

vi.hoisted(() => {
  process.env.TURSO_DATABASE_URL = ":memory:";
  process.env.TURSO_AUTH_TOKEN = "test-token";
});

vi.mock("@/lib/llm", () => ({ dispatchChat: dispatchChatMock }));

import { POST } from "@/app/api/invoices/route";
import { invoices, settings } from "@/db/schema";
import { db } from "@/lib/db";
import { hashUploadContent } from "@/lib/invoices";
import { checkUploadRateLimit } from "@/lib/upload-guard";

function invoiceJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    vendor: "Acme Kft",
    date: "2026-01-15",
    total_minor: 5000,
    currency_code: "USD",
    line_items: [{ description: "Widget", amount_minor: 5000 }],
    suggested_category: "Office supplies",
    project: "P1",
    ...overrides,
  });
}

function uploadRequest(
  bytes: Uint8Array<ArrayBuffer>,
  options: { name?: string; type?: string; ip?: string } = {},
): Request {
  const form = new FormData();
  form.append(
    "file",
    new File([bytes], options.name ?? "invoice.png", { type: options.type ?? "image/png" }),
  );
  return new Request("http://localhost/api/invoices", {
    method: "POST",
    headers: options.ip ? { "x-forwarded-for": options.ip } : undefined,
    body: form,
  });
}

async function setDefaultCurrency(code: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key: "DEFAULT_CURRENCY", value: code })
    .onConflictDoUpdate({ target: settings.key, set: { value: code } });
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
  await setDefaultCurrency("USD");
});

beforeEach(() => {
  dispatchChatMock.mockReset();
  dispatchChatMock.mockResolvedValue({ text: invoiceJson(), provider: "primary" });
});

describe("POST /api/invoices", () => {
  it("rejects an oversized PDF before dispatch and without creating a row", async () => {
    const before = await db.select().from(invoices);

    const response = await POST(
      uploadRequest(new Uint8Array(16 * 1024 * 1024), {
        name: "big.pdf",
        type: "application/pdf",
        ip: "10.0.0.1",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "File is too large (16.0 MB). The limit is 15 MB before base64 encoding.",
    });
    expect(dispatchChatMock).not.toHaveBeenCalled();
    expect(await db.select().from(invoices)).toHaveLength(before.length);
  });

  it("rejects unsupported file types before dispatch", async () => {
    const response = await POST(
      uploadRequest(new Uint8Array([1, 2, 3]), { name: "notes.txt", type: "text/plain", ip: "10.0.0.2" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: 'Unsupported file type "text/plain". Upload a PNG, JPEG, WEBP, or PDF file.',
    });
    expect(dispatchChatMock).not.toHaveBeenCalled();
  });

  it("returns 429 without dispatching once the rate limit is exhausted", async () => {
    const ip = "10.0.0.3";
    for (let i = 0; i < 10; i += 1) {
      checkUploadRateLimit(ip);
    }

    const response = await POST(uploadRequest(new Uint8Array([4, 5, 6]), { ip }));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "Too many uploads. Try again in 600 seconds.",
    });
    expect(dispatchChatMock).not.toHaveBeenCalled();
  });

  it("stores a valid upload as needs_review and sends the file as a base64 data URL", async () => {
    const bytes = new TextEncoder().encode("fake-png-bytes-success");

    const response = await POST(uploadRequest(bytes, { ip: "10.0.0.4" }));
    const body = (await response.json()) as { ok: boolean; invoiceId: string; duplicate: boolean; status: string };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, duplicate: false, status: "needs_review" });

    const stored = await db.select().from(invoices).where(eq(invoices.id, body.invoiceId));
    expect(stored).toHaveLength(1);
    expect(stored[0].content_hash).toBe(hashUploadContent(bytes));
    expect(stored[0].source_image).toBe(Buffer.from(bytes).toString("base64"));
    expect(stored[0].source_image_mime).toBe("image/png");
    expect(stored[0].raw_llm_response).toBe(invoiceJson());

    const messages = dispatchChatMock.mock.calls[0][0] as Array<{
      role: string;
      content: Array<{ type: string; image_url?: { url: string } }>;
    }>;
    const imagePart = messages[1].content.find((part) => part.type === "image_url");
    expect(imagePart?.image_url?.url).toBe(`data:image/png;base64,${Buffer.from(bytes).toString("base64")}`);
  });

  it("returns the existing invoice for a repeated upload without dispatching again", async () => {
    const bytes = new TextEncoder().encode("fake-png-bytes-duplicate");
    const ip = "10.0.0.5";

    const first = (await (await POST(uploadRequest(bytes, { ip }))).json()) as { invoiceId: string };
    expect(dispatchChatMock).toHaveBeenCalledTimes(1);

    const second = (await (await POST(uploadRequest(bytes, { ip }))).json()) as {
      duplicate: boolean;
      invoiceId: string;
    };

    expect(second.duplicate).toBe(true);
    expect(second.invoiceId).toBe(first.invoiceId);
    expect(dispatchChatMock).toHaveBeenCalledTimes(1);

    const stored = await db
      .select()
      .from(invoices)
      .where(eq(invoices.content_hash, hashUploadContent(bytes)));
    expect(stored).toHaveLength(1);
  });
});