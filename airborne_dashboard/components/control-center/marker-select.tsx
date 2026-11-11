"use client";

import { ShieldAlert } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { sensitivityConsequence, sensitivityLabel } from "@/lib/control-center/approval";
import type { RollbackSensitiveReason } from "@/lib/control-center/types";

const REASONS: RollbackSensitiveReason[] = ["security", "one_way_migration"];

/**
 * Declares whether moving users off a release is unsafe. The server trusts the declared marker and does not
 * detect these conditions, so the wording says what each choice means and what it costs.
 */
export function RollbackMarkerSelect({
  value,
  onChange,
  disabled,
  idPrefix = "cc-marker",
  noneLabel = "Not rollback-sensitive",
}: {
  value: RollbackSensitiveReason | null;
  onChange: (next: RollbackSensitiveReason | null) => void;
  disabled?: boolean;
  idPrefix?: string;
  noneLabel?: string;
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="flex items-center gap-1.5 text-sm font-medium">
        <ShieldAlert className="h-3.5 w-3.5 text-red-700 dark:text-red-300" aria-hidden /> Rollback-sensitive
      </legend>
      <p className="text-xs text-muted-foreground">
        Mark a release when moving users off it is unsafe. Lowering its target or rolling it back then needs a request
        from a maker, or an emergency rollback by a checker, instead of a direct action. Airborne does not detect these
        conditions: an unmarked release has no protection.
      </p>
      <RadioGroup
        value={value ?? "none"}
        onValueChange={(v) => onChange(v === "none" ? null : (v as RollbackSensitiveReason))}
        className="gap-2"
        disabled={disabled}
      >
        <div className="flex items-start gap-2">
          <RadioGroupItem value="none" id={`${idPrefix}-none`} className="mt-0.5" />
          <Label htmlFor={`${idPrefix}-none`} className="text-sm font-normal">
            {noneLabel}
          </Label>
        </div>
        {REASONS.map((r) => (
          <div key={r} className="flex items-start gap-2">
            <RadioGroupItem value={r} id={`${idPrefix}-${r}`} className="mt-0.5" />
            <Label htmlFor={`${idPrefix}-${r}`} className="block text-sm font-normal">
              <span className="block first-letter:uppercase">{sensitivityLabel(r)}</span>
              <span className="block text-xs text-muted-foreground">
                Moving users off it {sensitivityConsequence(r)}.
              </span>
            </Label>
          </div>
        ))}
      </RadioGroup>
    </fieldset>
  );
}
