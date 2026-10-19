import { TriangleAlert } from "lucide-react";

import { translate, type Locale } from "@/lib/i18n";

export function GuardrailScreen({ reason, locale = "hu" }: { reason: string; locale?: Locale }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
            <TriangleAlert className="size-5" aria-hidden="true" />
          </span>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            {translate(locale, "guardrail.title")}
          </h1>
        </div>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          {translate(locale, "guardrail.body")}
        </p>
        <p className="mt-3 rounded-lg bg-zinc-100 px-3 py-2 font-mono text-xs break-words text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {reason}
        </p>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          {translate(locale, "guardrail.configure")}
        </p>
      </div>
    </div>
  );
}
