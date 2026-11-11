"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, CircleDot, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FirstRunMemory, FirstRunProgress, StepState } from "@/lib/control-center/first-run";
import { appPath, releasePath, createAppFormPath } from "./paths";

const GUIDE = "https://airborne.juspay.in/docs/guides/integrate-react-native/";
const key = (org: string) => `airborne.control-center.first-run.${org}`;

/** What this browser remembers about the checklist for one organisation. Only a nudge; the ticks come from the server. */
export function useFirstRunMemory(org: string): [FirstRunMemory, (m: Exclude<FirstRunMemory, null>) => void] {
  const [memory, setMemory] = useState<FirstRunMemory>(null);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(key(org));
      setMemory(v === "active" || v === "dismissed" ? v : null);
    } catch {
      setMemory(null);
    }
  }, [org]);
  const set = useCallback(
    (m: Exclude<FirstRunMemory, null>) => {
      setMemory(m);
      try {
        window.localStorage.setItem(key(org), m);
      } catch {
        // Private mode: the checklist simply is not remembered.
      }
    },
    [org]
  );
  return [memory, set];
}

const ICON: Record<StepState, { Icon: typeof Circle; tone: string; label: string }> = {
  done: { Icon: CheckCircle2, tone: "text-emerald-700 dark:text-emerald-300", label: "Done" },
  next: { Icon: CircleDot, tone: "text-sky-700 dark:text-sky-300", label: "Next" },
  todo: { Icon: Circle, tone: "text-muted-foreground", label: "Not yet" },
  unknown: { Icon: CircleHelp, tone: "text-muted-foreground", label: "Cannot tell" },
};

function Step({
  n,
  state,
  title,
  children,
}: {
  n: number;
  state: StepState;
  title: string;
  children: React.ReactNode;
}) {
  const { Icon, tone, label } = ICON[state];
  return (
    <li className="flex items-start gap-3" aria-current={state === "next" ? "step" : undefined}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone)} aria-hidden />
      <div className="min-w-0 space-y-0.5">
        <p className={cn("font-medium", state === "done" && "text-muted-foreground line-through decoration-1")}>
          {n}. {title} <span className="sr-only">({label})</span>
        </p>
        {(state !== "done" || n === 2) && <div className="text-sm text-muted-foreground">{children}</div>}
      </div>
    </li>
  );
}

function Steps({ org, progress }: { org: string; progress: FirstRunProgress }) {
  const app = progress.firstApp;
  return (
    <ol className="space-y-3 text-sm">
      <Step n={1} state={progress.app} title="Create an app">
        <p>One per platform. It opens the form here, in your organisation.</p>
        <Button asChild size="sm" className="mt-1.5">
          <Link href={createAppFormPath(org)}>Create an app</Link>
        </Button>
      </Step>
      <Step n={2} state={progress.device} title="Receive the first manifest request">
        {progress.device === "done" ? (
          <p>Connection observed; boot unconfirmed.</p>
        ) : progress.device === "unknown" ? (
          <p>
            This server cannot report the first manifest request, and no device telemetry is available. Check the SDK
            connection or refresh after updating the server.
          </p>
        ) : (
          <p>
            <a className="underline" href={GUIDE}>
              Wire the SDK
            </a>
            , set a compatible app version, rebuild the native app and open it once. This ticks when the SDK requests a
            manifest, even before a release exists. It does not confirm a successful boot.
          </p>
        )}
      </Step>
      <Step n={3} state={progress.release} title="Make the first release live">
        <p>
          Upload a package and create a targeted release, then make it live explicitly.
          {app && (
            <>
              {" "}
              <Link
                className="underline"
                href={progress.firstRelease ? releasePath(org, app, progress.firstRelease.id) : appPath(org, app)}
              >
                {progress.firstRelease ? `Open v${progress.firstRelease.version}` : "Open the app"}
              </Link>{" "}
              for <span className="font-mono text-xs">{app}</span>.
            </>
          )}
        </p>
      </Step>
    </ol>
  );
}

/**
 * The first-run checklist for one organisation, live from the overview. It appears for an organisation that has
 * not made a release live yet, and turns into a finished state once the three things have happened.
 */
export function FirstRunChecklist({
  org,
  progress,
  view,
  memory,
  remember,
}: {
  org: string;
  progress: FirstRunProgress;
  view: "checklist" | "finished" | "none";
  memory: FirstRunMemory;
  remember: (m: Exclude<FirstRunMemory, null>) => void;
}) {
  // An organisation seen mid-way is remembered, so finishing it is noticed even in another session.
  useEffect(() => {
    if (view === "checklist" && memory === null) remember("active");
  }, [view, memory, remember]);

  if (view === "none") return null;
  if (view === "finished") {
    return (
      <section
        className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4"
        aria-label="First release done"
      >
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">Your first release is live</p>
          <p className="text-muted-foreground">
            An app exists, the server recorded a manifest request or device report, and a release is live. Requests and
            reports are unverified; a successful device boot is not confirmed.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => remember("dismissed")}>
          Hide this
        </Button>
      </section>
    );
  }
  const done = [progress.app, progress.device, progress.release].filter((s) => s === "done").length;
  return (
    <section className="space-y-3 rounded-lg border p-5" aria-label="First release checklist">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Your first OTA release</h2>
        <span className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="tabular-nums">{done} of 3 done</span>
          <button type="button" className="underline" onClick={() => remember("dismissed")}>
            Hide
          </button>
        </span>
      </div>
      <Steps org={org} progress={progress} />
    </section>
  );
}
