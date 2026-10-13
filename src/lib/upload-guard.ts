export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
export const RATE_LIMIT_MAX_UPLOADS = 10;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export type UploadCheck = { ok: true } | { ok: false; message: string };
export type RateLimitCheck = { allowed: true } | { allowed: false; retryAfterSeconds: number };

const uploadTimestamps = new Map<string, number[]>();

export function checkUploadFile(file: { name: string; type: string; size: number }): UploadCheck {
  const allowed = ALLOWED_UPLOAD_TYPES.some((type) => type === file.type);
  if (!allowed) {
    return {
      ok: false,
      message: `Unsupported file type "${file.type || file.name}". Upload a PNG, JPEG, WEBP, or PDF file.`,
    };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    const megabytes = (file.size / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      message: `File is too large (${megabytes} MB). The limit is 15 MB before base64 encoding.`,
    };
  }

  return { ok: true };
}

export function checkUploadRateLimit(key: string, now: number = Date.now()): RateLimitCheck {
  const recent = (uploadTimestamps.get(key) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  if (recent.length >= RATE_LIMIT_MAX_UPLOADS) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - recent[0]);
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }

  recent.push(now);
  uploadTimestamps.set(key, recent);
  return { allowed: true };
}