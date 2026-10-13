import { decryptSecret } from "@/lib/encryption";
import { resolveSetting } from "@/lib/settings";

export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ChatContentPart[];
};

export type LlmProvider = "primary" | "secondary";
export type DispatchResult = { text: string; provider: LlmProvider };

type ProviderConfig = { baseUrl: string; model: string; apiKey: string };

const CONFIG_KEYS: Record<LlmProvider, { baseUrl: string; model: string; apiKey: string }> = {
  primary: { baseUrl: "PRIMARY_BASE_URL", model: "PRIMARY_MODEL", apiKey: "PRIMARY_API_KEY" },
  secondary: { baseUrl: "SECONDARY_BASE_URL", model: "SECONDARY_MODEL", apiKey: "SECONDARY_API_KEY" },
};

class ProviderRejection extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderRejection";
  }
}

class RetryableDispatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableDispatchError";
  }
}

async function readProviderConfig(provider: LlmProvider): Promise<ProviderConfig | null> {
  const keys = CONFIG_KEYS[provider];
  const [baseUrl, model, apiKey] = await Promise.all([
    resolveSetting(keys.baseUrl),
    resolveSetting(keys.model),
    resolveSetting(keys.apiKey),
  ]);

  if (!baseUrl || !model || !apiKey) {
    return null;
  }

  return {
    baseUrl: baseUrl.value.replace(/\/+$/, ""),
    model: model.value,
    apiKey: apiKey.source === "db" ? decryptSecret(apiKey.value) : apiKey.value,
  };
}

function extractProviderMessage(bodyText: string): string | null {
  try {
    const parsed: unknown = JSON.parse(bodyText);
    if (typeof parsed === "object" && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      const error = record.error;
      const fromError =
        typeof error === "object" && error !== null
          ? (error as Record<string, unknown>).message
          : undefined;
      const candidate = typeof fromError === "string" ? fromError : record.message;
      if (typeof candidate === "string" && candidate.trim() !== "") {
        return candidate.trim();
      }
    }
  } catch {
    // body is not JSON; fall through to the raw text
  }

  const raw = bodyText.trim();
  return raw === "" ? null : raw;
}

function extractContent(parsed: unknown): string | null {
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const choices = (parsed as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }
  const message = (choices[0] as Record<string, unknown>).message;
  if (typeof message !== "object" || message === null) {
    return null;
  }
  const content = (message as Record<string, unknown>).content;
  return typeof content === "string" ? content : null;
}

async function callProvider(config: ProviderConfig, messages: ChatMessage[]): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({ model: config.model, messages }),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new RetryableDispatchError(`Network error contacting LLM provider: ${detail}`);
  }

  const bodyText = await response.text();

  if (response.status === 429) {
    throw new RetryableDispatchError(
      extractProviderMessage(bodyText) ?? "LLM provider rate limited the request (HTTP 429)",
    );
  }
  if (!response.ok) {
    throw new ProviderRejection(
      extractProviderMessage(bodyText) ?? `LLM provider rejected the request with HTTP ${response.status}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new RetryableDispatchError("LLM provider returned invalid JSON");
  }

  const content = extractContent(parsed);
  if (content === null || content.trim() === "") {
    throw new RetryableDispatchError("LLM provider response did not contain message content");
  }

  return content;
}

export async function dispatchChat(messages: ChatMessage[]): Promise<DispatchResult> {
  const primary = await readProviderConfig("primary");
  if (!primary) {
    throw new Error("Primary LLM provider is not configured");
  }

  let primaryError: unknown;
  try {
    return { text: await callProvider(primary, messages), provider: "primary" };
  } catch (error) {
    if (error instanceof ProviderRejection) {
      throw error;
    }
    primaryError = error;
  }

  const primaryDetail = primaryError instanceof Error ? primaryError.message : String(primaryError);
  const secondary = await readProviderConfig("secondary");
  if (!secondary) {
    throw new Error(`Primary LLM provider failed (${primaryDetail}) and no secondary provider is configured`);
  }

  try {
    return { text: await callProvider(secondary, messages), provider: "secondary" };
  } catch (error) {
    if (error instanceof ProviderRejection) {
      throw error;
    }
    const secondaryDetail = error instanceof Error ? error.message : String(error);
    throw new Error(`Primary and secondary LLM providers both failed: ${primaryDetail}; ${secondaryDetail}`);
  }
}