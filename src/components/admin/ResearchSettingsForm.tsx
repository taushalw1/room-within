"use client";

import { useActionState } from "react";
import { updateResearchSettings } from "@/app/(admin)/admin/settings/actions";
import {
  CheckField,
  Feedback,
  Field,
  SubmitButton,
  inputClass,
} from "@/components/ui/Form";
import type { ResearchSettings } from "@/lib/data/types";

/**
 * What the Monday search is told to look for.
 *
 * This is the whole quality of the feature. A vague description produces a
 * list of irrelevant grants that wastes her afternoons, so the fields are
 * plain prose rather than keywords, and the hints say what to write.
 */
export function ResearchSettingsForm({
  settings,
}: {
  settings: ResearchSettings;
}) {
  const [result, action] = useActionState(updateResearchSettings, null);

  return (
    <form action={action} className="space-y-5">
      <Field
        label="About this place"
        hint="Written in plain sentences. What the building is, how it's run, and what the money is for. The search judges everything it finds against this."
      >
        <textarea
          name="profile"
          rows={6}
          required
          defaultValue={settings.profile}
          className={`${inputClass} resize-y`}
        />
      </Field>

      <Field
        label="What sort of funding to look for"
        hint="Kinds of funders, subjects, which parts of the country."
      >
        <textarea
          name="grantNotes"
          rows={4}
          defaultValue={settings.grant_notes}
          className={`${inputClass} resize-y`}
        />
      </Field>

      <Field
        label="What sort of events to look for"
        hint="Subjects worth travelling for, and whether online counts."
      >
        <textarea
          name="conferenceNotes"
          rows={4}
          defaultValue={settings.conference_notes}
          className={`${inputClass} resize-y`}
        />
      </Field>

      <Field
        label="Most to bring back each week"
        hint="A shorter list you actually read beats a long one you don't."
      >
        <input
          name="maxResults"
          type="number"
          min="1"
          max="30"
          required
          defaultValue={settings.max_results}
          className={inputClass}
        />
      </Field>

      <CheckField
        name="enabled"
        label="Search every Monday morning"
        defaultChecked={settings.enabled}
        hint="Turn this off and nothing runs. You can still search by hand, and add things yourself."
      />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Save</SubmitButton>
        <Feedback result={result} />
      </div>
    </form>
  );
}
