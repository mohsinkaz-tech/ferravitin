# Corporate contact activation

This is a separate bridge for https://www.biosciglobal.ca/contact. Do not install this source in the BC pharmacy Apps Script project or replace the legacy Articles bridge.

## Already provisioned

- Dedicated private Sheet: https://docs.google.com/spreadsheets/d/1dL_7ErV0KA0LWJtXf6N43sc-7ogr2Qrrz9vga-CiP-M/edit
- Destination tab: `Corporate Leads`, with the 12 headers in `CorporateContact.gs`.
- AWS region: `ca-central-1`; Amplify app: `d3l733upn467ky`; branch: `amplify-production`.
- Dedicated server secret: `ferravitin/prod/corporate/contact`. Its JSON contains `webhookUrl` and a generated `sharedSecret`. The URL is intentionally empty until owner activation. Secret values never enter GitHub, client code, build output, or chat.
- Corporate branch compute role: `FerravitinCorporateContactSSR`, restricted to reading this one secret. Pharmacy has its own role and secrets.

## Required Google account owner steps

1. Open the Sheet under its owning account (`mohsinkaz@gmail.com`) or transfer ownership to an approved corporate Workspace account first. Keep sharing restricted to authorized staff. Grant the people monitoring `info@biosciglobal.net` access to the Sheet if needed; notification mail does not itself grant access.
2. Open **Extensions → Apps Script**. In this NEW bound project, install `CorporateContact.gs` from this directory. Do not paste `Code.gs`, which belongs to the separate legacy blog workflow.
3. In **Project Settings → Script Properties**, set `SPREADSHEET_ID` to `1dL_7ErV0KA0LWJtXf6N43sc-7ogr2Qrrz9vga-CiP-M`. In the AWS Secrets Manager console in Canada Central, open `ferravitin/prod/corporate/contact`, retrieve its value privately, and copy `sharedSecret` into the Script Property `WEBHOOK_SHARED_SECRET`. Never paste the value into chat. Notification destination is fixed in source to `info@biosciglobal.net`.
4. Run `setupCorporateContact` once. Approve Google permissions to read/write this spreadsheet, send email on the owner's behalf, and create a five-minute retry trigger. No email is sent by setup. Confirm the `retryContactNotifications` trigger exists. Workspace admin restrictions may require administrator approval.
5. **Deploy → New deployment → Web app**, execute as **Me**, access **Anyone**. Public ingress permits the website server to call it; every write requires the secret and validated payload. GET never returns leads. Copy the deployed `/exec` URL (never `/dev`). For later script changes use **Manage deployments → Edit → New version → Deploy**.
6. Privately edit the AWS secret JSON: set `webhookUrl` to that `/exec` URL and preserve `sharedSecret`. The running corporate server reads this secret using temporary AWS credentials. It caches a valid config for 60 seconds; no rebuild is required. If rotating the secret, update both Google and AWS, and wait for cache expiry.

## Acceptance test after activation

1. At the live contact page submit `Corporate integration test`, organization `BioScience Global QA`, an authorized test email, category `General corporate enquiry`, message `Test lead — please ignore`, and check consent. Confirm the visible success receipt and matching `Submission ID` in exactly one Sheet row. Verify inbox receipt at `info@biosciglobal.net` (check spam). Record the receipt, time, and deployed Git commit in the release report without retaining contact details in logs.
2. Confirm invalid email and unchecked consent prevent submission; deliberately oversized / foreign-origin requests fail. Network or unconfigured errors must preserve the user's input and show the direct email option.
3. Test retries with the same submission ID: one row and one normal notification. If the owner temporarily exhausts/disables mail permission in a TEST copy, submission remains saved with `Pending`; restore permission and run the retry function to verify `Sent` without a second row.
4. A duplicate submission ID with different content is rejected. A new ID is allowed up to five submissions per email per hour and 100 corporate enquiries per 24 hours. These shared limits query persisted timestamps under a script lock. The site also has a per-instance burst limit (10 requests/minute); it is not a distributed IP limiter. Add AWS WAF rate rules if traffic volume warrants it.
5. Anonymous GET at the Apps Script URL must return only `{ok:false}`. Google Sheet remains private. Confirm the BC pharmacy order form and its receipt are unchanged; do not send a pharmacy test order as part of corporate acceptance.

## Delivery and privacy behavior

The browser reports success only after a matching saved receipt from Google. Email is a minimal notification containing the receipt and restricted Sheet link, not the enquiry content. An email failure leaves `Pending`, returns an honest saved receipt, and retries every five minutes (up to 20 pending rows per run). A crash between successful email transmission and marking `Sent` can cause another notification on retry; email and Sheet writes cannot be one atomic transaction. Lead rows are deduplicated by submission ID and payload hash. Editing the form creates a new submission ID; retrying unchanged data in the same page reuses it. Reloading the page starts a new attempt.

Never log request bodies, tokens, email addresses, or message contents. Staff should use least-privilege Sheet sharing, remove integration test rows after verification, and approve retention/access/deletion procedures and the current privacy notice before campaign activation. Do not collect patient information. Review Apps Script executions and Pending rows for quota/permission failures; no automatic email forwards or customer auto-replies are configured.

Sources: [Google web app deployments](https://developers.google.com/apps-script/guides/web), [Google authorization](https://developers.google.com/apps-script/guides/services/authorization), [Amplify compute roles](https://docs.aws.amazon.com/amplify/latest/userguide/amplify-SSR-compute-role.html).
