---
title: Confirm customer recovery
---

A successful rollback API response means **server change completed**. It does not prove an already-running application restarted, that a client fetched the new manifest, that its retained configuration is compatible, or that the customer's journey recovered. Keep **customer recovery confirmed** separate.

Copy this into the incident record before handoff:

```text
Incident/link:
Incident owner (named person):
Recovery verifier (named person):
Verification deadline (date, time, timezone):
Affected application/platform/native versions/cohorts:
Customer impact and journey to retest:
Server operation/release ID and completion timestamp:
Server change completed: yes / no / unknown
Customer recovery confirmed: yes / no / unknown
Evidence links, sample size and observation window:
Retained config keys reviewed for predecessor compatibility:
Next action, owner and next update deadline:
```

- Confirm the release operation's terminal state and fetch the public manifest for each affected native-version/cohort context. Record release and package versions.
- Review locale overrides and retained config keys; a previous bundle may encounter configuration introduced since it shipped.
- Observe a fresh launch on a representative affected client. Record booted package, platform, native version, time and outcome. Already-running clients may continue using old code.
- Repeat the actual affected journey, including a safe payment test when relevant. Boot success alone does not establish payment recovery.
- Check scoped telemetry and support/customer evidence over a stated window. Missing reports are unknown, not successes. Keep synthetic drills separate from device reports.
- If evidence is missing or the deadline expires, leave recovery unconfirmed, name the next action's owner and set the next update deadline. Emergency server action must not wait for telemetry.
- Close only when the incident owner records customer recovery evidence or explicitly transfers responsibility with a deadline.
