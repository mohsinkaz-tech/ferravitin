# Pharmacy acknowledgements and private lead dashboard

The production app uses TanStack Start/React/Nitro on AWS Amplify, from `amplify-production`, application root `pharmacy`. Higgsfield website-builder sandbox is the editing environment. Do not use Higgsfield deploy_website for this Amplify branch or re-run the pinned website import workflow.

## Google Apps Script activation (manual, required)

1. Open the **existing** Apps Script project used by the pharmacy intake `/exec` endpoint. Back up its current script and the private Sheet before replacing `Code.gs` with this repository version. Do not create another intake Sheet.
2. Retain Script Properties `SHEET_ID` and `SHARED_SECRET`; preserve the current AWS intake secret. Never copy secret values into GitHub, chat, screenshots or public frontend settings.
3. Dashboard credentials are configured. Copy `bridgeSecret` privately from AWS Secrets Manager to the Apps Script property `DASHBOARD_SHARED_SECRET`. This is a separate credential from public intake.
4. Optional `NOTIFICATION_EMAIL` overrides the existing internal notification destination `bcpharmacyorders@biosciglobal.net`. Confirm the mailbox is accessible to Nadeem. Pharmacy acknowledgement is sent to the submitted business email with reply-to `nadeem.zia@biosciglobal.net`.
5. **Deploy → Manage deployments → Edit existing Web app deployment → New version → Deploy.** Retain Execute as Me / Anyone access. Authentication is verified on every POST before Sheet access. Never add a public doGet data feed. Authorize Sheets and Mail permissions if prompted. Keeping the deployment preserves its `/exec` URL; if changed, update the website's server-side webhook URL and redeploy.
6. Create one time-driven trigger for `retryPendingEmails`, every 10 minutes. Authorize it. Monitor trigger failures and Workspace mail quotas.
7. The script retains the original 18 intake columns and appends six pipeline/delivery columns. If columns 19–24 already contain different headers, it refuses to overwrite them: resolve the schema privately before activation. Format Follow-up date column as plain text (YYYY-MM-DD) to avoid locale-dependent date conversion. Keep the Sheet restricted to authorized staff.
8. Test with a pharmacy email address you control: verify the Sheet row, on-page reference, acknowledgement email and internal notification. Email failure leaves a successful saved receipt with pending delivery. Do not resubmit merely because mail is pending.

Emails acknowledge **nonbinding interest**, not an accepted PO, invoice, payment request, reservation or guaranteed delivery. They contain no wholesale prices, negotiated terms or internal notes. Mail delivery is at-least-once: a crash after sending but before marking sent may duplicate an email. Rows are deduplicated by reference; a new manual submission creates a new reference. Legacy rows are not automatically emailed by the retry trigger.

## Internal credentials (provisioned on 2026-10-12)

Dashboard: `/internal/leads`. Data/update endpoint: `/api/internal-leads`.

AWS Secrets Manager secret **`ferravitin/prod/pharmacy/dashboard-auth`** is provisioned in **ca-central-1**. Retrieve its `password` privately in the AWS Console for secure handoff to Nadeem, and copy `bridgeSecret` privately to the existing Apps Script property `DASHBOARD_SHARED_SECRET`. Credentials are not published in this repository or chat. The JSON fields are:

- `username`: `nadeem.zia@biosciglobal.net`
- `passwordSha256`: lowercase SHA-256 hex digest of a **cryptographically random password generated from at least 32 random bytes**. Do not use a human-chosen password with this fast hash.
- `bridgeSecret`: independently generated random secret, at least 48 random bytes, copied privately to Apps Script `DASHBOARD_SHARED_SECRET`.

Hand the password to Nadeem through a secure private channel/password manager; never put it in this public repository or chat. The application only needs the hash, not the plaintext password. Optional secure-console handoff may store a `password` field temporarily; remove it after handoff.

After explicit user approval, the existing Amplify compute role `FerravitinPharmacyOrderSSR` received policy `ReadPharmacyDashboardSecretOnly`, granting **only** `secretsmanager:GetSecretValue` on the exact ARN of the dashboard secret. Its intake-secret permission is preserved. Both live internal URLs reject incorrect credentials with HTTP 401 and private/no-store headers. Apps Script activation and a controlled end-to-end email/dashboard test remain pending.

Authentication uses HTTPS browser Basic authentication with a high-entropy individual credential, validated server-side with constant-time digest comparison. Both the HTML and every API request are checked. Updates require same-origin JSON requests. There is no anonymous lead feed, public dashboard link or client-side secret. Missing/invalid configuration fails closed. HTML/API responses are private/no-store and noindex; API data is loaded after authentication and is not embedded into public SSR HTML. On shared devices use a private browser window and close it after use; Basic credentials remain cached for the browser session. Rotate the password after suspected exposure. Secret caching lasts up to 60 seconds.

This initial dashboard does not include SSO/MFA or a persistent audit log. Use a managed MFA identity provider for a future multi-user rollout. Keep private terms in the restricted Sheet/private correspondence; they are never added to public MSRP content.

## Validation and rollout

Run `bun test tests/leads.test.ts`, then `bun run build` from `pharmacy/`. GitHub CI runs these tests on pharmacy changes. Nitro builds the AWS SDK into SSR compute rather than assuming it exists in the hosting runtime. Test anonymous and incorrect-password requests to both internal URLs: neither must return dashboard HTML or lead data. Check private cache headers and origin rejection on writes.

After activating Apps Script and credentials, sign in as Nadeem, confirm counts, edit status/notes/follow-up, reload and verify persistence in the Sheet. A concurrent edit must require refresh instead of silently overwriting another update. Verify a controlled live submission end-to-end, including both mailboxes. The live acknowledgement and authenticated Sheet operations cannot be confirmed until these manual steps are complete.

Rollback: revert the code commit through GitHub and let Amplify rebuild; restore the previous Apps Script deployment version if needed. Preserve all Sheet rows and added pipeline data. Do not remove the existing intake secret.
