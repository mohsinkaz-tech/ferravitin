# Connect Shajara Capital Leads

The private lead register has already been created:
https://docs.google.com/spreadsheets/d/1W7NmKlruQqEQJdIbckeBxoLPSeadwc799Ts0YoV2Zdk/edit

The website form is deliberately disabled until it has a verified Google web-app endpoint. The form must not report a successful registration without a confirmed Sheet row.

1. Open this spreadsheet in the owner’s Google account. Choose Extensions → Apps Script.
2. Replace the default script with `Code.gs` from this folder. It writes only the `Leads` tab of this spreadsheet.
3. Choose Deploy → New deployment → Web app. Execute as yourself; access: Anyone. Google may require authorization to write to your sheet. Complete authorization yourself. The sheet itself remains private; do not publish or publicly share it.
4. Copy the web-app URL ending in `/exec`. Return that URL in this chat so the site configuration can be updated and deployed. Do not send a password or OAuth token.
5. We will submit a synthetic test inquiry, confirm a row in the sheet, verify retry deduplication and remove the test row before enabling the public form.

The script accepts a normal form POST and returns an explicit receipt. It validates required reply consent, optional updates consent, inquiry type, field lengths and honeypot. It escapes spreadsheet formula prefixes and deduplicates retry submission IDs. Per-email and global limits reduce spam, although they are not a substitute for a managed anti-bot service if traffic grows. GET never exposes lead data. No notification email or bulk outreach is configured.

[Google’s web-app deployment instructions](https://developers.google.com/apps-script/guides/web)