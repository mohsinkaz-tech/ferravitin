# Ferravitin™ Google Sheets order leads — production connection
This integration is NOT active until the Google Apps Script is deployed and both secrets are configured in Higgsfield.

1. Create a dedicated Google Sheet using an authorized BSG Google Workspace account, e.g. "Ferravitin BC Founding Pharmacy Leads". Copy its spreadsheet ID from the URL.
2. At script.google.com create a project and paste Code.gs. Project Settings → Script Properties:
   - SHEET_ID = the exact spreadsheet ID
   - SHARED_SECRET = a strong random secret (32+ bytes), generated outside the repo.
3. Deploy → New deployment → Web app; Execute as: Me; Who has access: Anyone (server-to-server HTTP POST with high-entropy shared secret checked server-side).
4. Authorize Google Sheets and Mail permissions, record the /exec web app URL.
5. Higgsfield partner website > Settings > Secrets: configure GOOGLE_ORDER_WEBHOOK_URL (the /exec URL) and GOOGLE_ORDER_SHARED_SECRET (the exact same secret).
6. Redeploy the partner website, then submit a test order through the site. Verify BOTH: a new row in the "Pharmacy Order Leads" tab AND arrival in nadeemzialeads@biosciglobal.net. Check spam/quarantine if needed.
7. Revoke previous deployment/secrets when rotating credentials. Use a service-owned mailbox to avoid dependency on an individual's Workspace account.
8. Site form shows an error (and email fallback) until configured, and it never reports successful delivery without the Apps Script returning {ok:true}.
9. Security hardening before broad advertising: add server-side rate limiting and bot mitigation (Cloudflare Turnstile/WAF), monitor abuse, use minimum Workspace sharing rights, publish an appropriate privacy notice and retention schedule.

IMPORTANT: MailApp.sendEmail may be subject to Workspace quotas. Appending the Sheet row happens before sending notification. If MailApp fails, the server may return an error even though the row exists; review the sheet for duplicate references before resubmitting. For stricter delivery guarantees, use a queued notification worker with retry status.
