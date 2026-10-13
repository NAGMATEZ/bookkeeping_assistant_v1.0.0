// spec: dispatcher retries once on Secondary if Primary throws network error / 429 / invalid JSON; provider
//       rejection messages pass through verbatim; DB-stored API keys are decrypted only here, right before dispatch.
// expected (hand-derived): primary 429 + secondary 200 "secondary-answer" → result { text:"secondary-answer", provider:"secondary" }
//   with exactly 2 fetch calls (primary then secondary, no loop); primary 400 {"error":{"message":"unsupported file type"}}
//   → rejects with "unsupported file type" and exactly 1 fetch call (no fallback); DB-source key decrypts to
//   "test-key-db" → Authorization header is exactly "Bearer test-key-db".
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { resolveSettingMock } = vi.hoisted(() => ({ resolveSettingMock: vi.fn() }));

vi.mock("@/lib/settings", () => ({ resolveSetting: resolveSettingMock }));

import { encryptSecret } from "@/lib/encryption";
import { dispatchChat } from "@/lib/llm";

const fetchMock = vi.fn();

function config(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    PRIMARY_BASE_URL: "https://primary.test/v1",
    PRIMARY_MODEL: "primary-model",
    PRIMARY_API_KEY: "primary-key",
    SECONDARY_BASE_URL: "https://secondary.test/v1",
    SECONDARY_MODEL: "secondary-model",
    SECONDARY_API_KEY: "secondary-key",
    ...overrides,
  };
}

function useSettings(values: Record<string, string>) {
  resolveSettingMock.mockImplementation(async (key: string) =>
    key in values ? { value: values[key], source: "env" } : null,
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  resolveSettingMock.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("APP_ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("dispatchChat", () => {
  it("uses the primary provider when it succeeds", async () => {
    useSettings(config());
    fetchMock.mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: "primary-answer" } }] }));

    const result = await dispatchChat([{ role: "user", content: "hi" }]);

    expect(result).toEqual({ text: "primary-answer", provider: "primary" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://primary.test/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("retries exactly once on the secondary provider after a primary 429", async () => {
    useSettings(config());
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: { message: "rate limited" } }, 429))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: "secondary-answer" } }] }));

    const result = await dispatchChat([{ role: "user", content: "hi" }]);

    expect(result).toEqual({ text: "secondary-answer", provider: "secondary" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://secondary.test/v1/chat/completions");
  });

  it("retries on the secondary provider after a primary network error", async () => {
    useSettings(config());
    fetchMock
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: "secondary-answer" } }] }));

    const result = await dispatchChat([{ role: "user", content: "hi" }]);

    expect(result).toEqual({ text: "secondary-answer", provider: "secondary" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not fall back when the primary rejects the request (HTTP 400)", async () => {
    useSettings(config());
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: "unsupported file type" } }, 400));

    await expect(dispatchChat([{ role: "user", content: "hi" }])).rejects.toThrow("unsupported file type");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("decrypts a DB-sourced API key immediately before dispatch", async () => {
    const encryptedKey = encryptSecret("test-key-db");
    resolveSettingMock.mockImplementation(async (key: string) => {
      if (key === "PRIMARY_API_KEY") {
        return { value: encryptedKey, source: "db" };
      }
      return key in config() ? { value: config()[key], source: "env" } : null;
    });
    fetchMock.mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: "ok" } }] }));

    await dispatchChat([{ role: "user", content: "hi" }]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://primary.test/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-key-db" }),
      }),
    );
  });

  it("reports both provider failures when neither succeeds", async () => {
    useSettings(config());
    fetchMock
      .mockRejectedValueOnce(new TypeError("primary down"))
      .mockResolvedValueOnce(jsonResponse({ error: { message: "still rate limited" } }, 429));

    await expect(dispatchChat([{ role: "user", content: "hi" }])).rejects.toThrow(
      "Primary and secondary LLM providers both failed: Network error contacting LLM provider: primary down; still rate limited",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});