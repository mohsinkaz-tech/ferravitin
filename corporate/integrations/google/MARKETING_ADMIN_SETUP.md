# Corporate lead dashboard

Dashboard: https://www.biosciglobal.ca/internal/marketing
Login email: `uzma.saiyed@biosciglobal.net`

The dashboard is a separate staff session protected by a signed eight-hour HttpOnly, Secure, SameSite=Strict cookie. It includes corporate lead search, category/status/owner filters, Vancouver follow-up dates, private notes, notification status and an update audit. Counts refer to loaded leads; load additional pages to include older records. Updates use a version check under a Google script lock so stale editors cannot overwrite another update. It has no delete, mass email, auto-marketing, export, or pharmacy operations.

## Password handoff

In AWS Secrets Manager, region Canada Central (`ca-central-1`), open `ferravitin/prod/corporate/marketing-admin` and retrieve its value privately. `initialPassword` is the generated strong password. Give it to the authorized user through an approved private channel, not GitHub or chat. The login email is a username; no welcome email has been sent.

The secret also holds `sessionSecret` and `dashboardBridgeSecret`. The corporate compute role can read only the corporate contact secret and this admin secret. Do not reuse the pharmacy credentials. A missing/invalid config fails closed. Login has a per-instance five-attempt/15-minute burst limit; add AWS WAF rules or federated identity/MFA if wider staff access is needed. This release has one shared configured identity, not multiple staff accounts.

For credential rotation, generate a new strong password privately and replace `initialPassword` in this secret (or set its SHA-256 digest in `passwordSha256` and remove `initialPassword`). If both exist, `passwordSha256` takes precedence. Also replace `sessionSecret` to invalidate issued sessions. Wait 60 seconds for config cache expiry. Logout clears the browser cookie; it does not revoke a copied token server-side. Never place credential values in source or a VITE_ environment variable.

## Activate the private Google bridge

1. Open the dedicated corporate Sheet: https://docs.google.com/spreadsheets/d/1dL_7ErV0KA0LWJtXf6N43sc-7ogr2Qrrz9vga-CiP-M/edit . Use its owning account and keep sharing restricted.
2. Open its bound Apps Script project. Replace the corporate script with the latest `CorporateContact.gs` from this directory. Do not edit the pharmacy or legacy Articles projects.
3. In Script Properties, preserve `SPREADSHEET_ID` and `WEBHOOK_SHARED_SECRET`. Add `DASHBOARD_SHARED_SECRET`, copying the private `dashboardBridgeSecret` value from the new AWS admin secret. This is a distinct secret: the public contact write secret cannot list or update dashboard records.
4. Run `setupCorporateContact`. It preserves the first 12 intake columns and appends columns M:S: Lead status, Assigned owner, Follow-up date, Private notes, Updated at, Version, Updated by. Existing enquiry rows initially display `New`, unassigned, and version `0`. New follow-up changes write only these seven columns.
5. Review any Google authorization prompt. For an existing deployment select Deploy → Manage deployments → Edit → New version → Deploy, retaining Execute as Me / access Anyone. If no deployment exists, follow `CORPORATE_CONTACT_SETUP.md` first and save the resulting `/exec` URL in the corporate contact AWS secret.
6. Sign in at `/internal/marketing`. A bridge error means activation is incomplete; it is not an empty inbox. If no leads exist, submit an authorized test enquiry through `/contact`, then refresh the dashboard.
7. Open the test lead, set status `Contacted`, owner `Uzma Saiyed`, a valid follow-up date, and a test note. Save, then confirm columns M:S in the same Sheet row changed, the intake columns stayed intact, and the updated-by field names the configured login.
8. Test two browser views of the same lead: save one, then save the stale view. It must report an edit conflict. Refresh before reviewing and reapplying changes. Verify invalid dates and oversized notes fail; sign out and confirm lead data is no longer accessible. Never use actual patient data for tests.

The web-app GET still returns only `{ok:false}`. Private list/update operations are authenticated POST requests from the corporate server; no Google or AWS secrets reach the browser. Notifications continue to go to `info@biosciglobal.net`. Review retention and staff access procedures before using the dashboard for live marketing work.
