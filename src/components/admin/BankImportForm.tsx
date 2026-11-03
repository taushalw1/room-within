"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Upload } from "lucide-react";
import { importStatement } from "@/app/(admin)/admin/bank/actions";
import { Field, Feedback, SubmitButton, inputClass } from "@/components/ui/Form";

/**
 * Read a statement in.
 *
 * On success it goes straight to the new statement rather than leaving her on
 * the list wondering what happened — reading a file in is never the thing she
 * came to do, it is the step before it.
 */
export function BankImportForm() {
  const [result, action] = useActionState(importStatement, null);
  const router = useRouter();

  useEffect(() => {
    if (result?.ok && result.importId) {
      router.push(`/admin/bank/${result.importId}`);
    }
  }, [result, router]);

  return (
    <form action={action} className="space-y-4">
      <Field
        label="The file from your bank"
        hint="Sign in to your bank, find your account, and look for Download or Export. Choose CSV if it offers a choice."
      >
        <input
          type="file"
          name="file"
          accept=".csv,.txt,text/csv,text/plain"
          required
          className={inputClass}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>
          <Upload className="h-4 w-4" aria-hidden />
          Read it in
        </SubmitButton>
        <Feedback result={result} />
      </div>

      <p className="text-xs leading-relaxed text-ink-faint">
        Nothing is changed on your books by reading a file in. Every line waits
        for you to say what it is.
      </p>
    </form>
  );
}
