import { TriangleAlert } from "lucide-react";

import { translate, type Locale } from "@/lib/i18n";

export function GuardrailScreen({ reason, locale = "hu" }: { reason: string; locale?: Locale }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
            <TriangleAlert className="size-5" aria-hidden="true" />
          </span>
          <h1 className="text-lg font-semibold text-foreground">
            {translate(locale, "guardrail.title")}
          </h1>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          {translate(locale, "guardrail.body")}
        </p>
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 font-mono text-xs break-words text-foreground/80">
          {reason}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          {translate(locale, "guardrail.configure")}
        </p>
      </div>
    </div>
  );
}
