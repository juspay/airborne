---
title: Maker-checker defaults and tradeoffs
description: The default maker-checker behaviour, what each choice costs, and the settings to revisit in team review.
---

These defaults keep a release moving during an incident while stopping one person, or one stolen token, from changing production alone. They are starting points for team review, not final policy.

| Area | Default | Benefit | Cost | When to change it |
| --- | --- | --- | --- | --- |
| Availability | Off per application | Existing flows do not change | Teams must opt in | Turn it on for production applications |
| Separation of duties | Nobody approves their own request, including owners and super admins | A single account cannot approve its own change | Very small teams can get stuck | Keep this rule. Add people rather than exempt anyone |
| Scope | Set per application, with a group action to apply it to all platforms | Android, iOS, and web can differ when they need to | More policies to review | Revisit if platforms always share one policy |
| Roster | Explicit makers and checkers per application | One person can hold both duties | Lists need upkeep | Add group sync if lists drift |
| Approval | Approval executes the action immediately | No gap between approval and rollout | A checker cannot approve now and schedule later | Add scheduling if release windows need it |
| Stale requests | A request goes stale if any application release/config/protection revision changes before approval | An old approval cannot overwrite newer work | Unrelated app changes can make requests stale, so busy apps may need to raise requests again | Relax only with a clear merge rule |
| Expiry | 24 hours, set per application | Old requests do not linger | Slow reviewers can miss the window | Raise it for teams across few time zones |
| Direct actions | Lowering a target, discarding, and rolling back a ramping release need no approval | Reducing a bad rollout is never delayed | A stolen maker token can pause a rollout without review | Require approval if pausing a rollout is itself a serious risk |
| Sensitive releases | Direct actions above are blocked for releases marked `security` or `one_way_migration` | Stops a quiet downgrade to a vulnerable version, and protects migrated data | Slower response if such a release is itself bad | Use emergency rollback in that case, or widen the list of markers |
| Emergency rollback | On by default. One checker can restore the previous release with a required reason | A bad release does not stay live waiting for a second person | It is a deliberate single-person path | Turn it off if compliance allows no single-person change |

## Sensitive releases

"Reduces exposure" describes the new release, not the users. Lowering the target of a security fix sends more users back to the vulnerable version. Rolling back a one-way migration can leave devices running JS that cannot read their data.

So a release can carry a `rollback_sensitive` marker with a reason of `security` or `one_way_migration`. On such a release, lowering the target and rolling back need a request, or an emergency rollback. Setting or clearing the marker is an edit, so it needs approval too.

The marker is declared by people. An unmarked security release has no protection, and the server does not detect vulnerabilities or migrations.

## Emergency rollback

- Only a member of the checker set can use it.
- It only restores the predecessor of the latest live release.
- It requires a reason, and on a sensitive release the operator must confirm the risk.
- It appears in the timeline and stays "needs review" until a different checker acknowledges it.

It reduces the time a bad release stays live, but a stolen checker token can use it once, so the review step detects misuse rather than prevents it.

## What this does not protect against

- Anyone with direct database or Superposition access bypasses all of it.
- Org owners and admins can change the policy. Changes are audited, not prevented.
- An API token acts as its owner, so a CI token owned by a person counts as that person.
- The on-device boot guard rolls back without any approval, by design.

## Questions for team review

1. Does compliance allow a single-person emergency rollback?
2. Should a sensitive release's emergency rollback need a second checker within a set time, or is review afterwards enough?
3. Should automated CI use a dedicated service identity, so it cannot be both maker and checker with a person's account?
4. Is 24 hours the right expiry?
5. Should pausing a rollout require approval on regulated applications?
