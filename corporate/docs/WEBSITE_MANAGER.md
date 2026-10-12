# BioScience Global / Ferravitin™ website — management handoff

Production contact update (2026-10-12): the main site runs on AWS Amplify at https://www.biosciglobal.ca. Follow [corporate contact activation](../integrations/google/CORPORATE_CONTACT_SETUP.md) for the separate Google Sheet, owner Apps Script steps, dedicated runtime secret and acceptance checklist. Current production source is GitHub `mohsinkaz-tech/ferravitin`, branch `amplify-production`, folder `corporate/`. The Higgsfield source origin below is historical. Keep Amplify-specific contact changes in GitHub and preserve the separate `pharmacy/` flow.
Site: https://bioscience-global-ferravitin.higgsfield.app
Higgsfield website ID: 88349e69-978e-49f6-9c04-66a6cb71823a
## How to manage using ChatGPT
Ask ChatGPT to use Higgsfield to update this existing website, specifying this website ID. It can change pages, manage editorial source, check deployments and deploy. Use connected Google Drive/Sheets for permitted live sheet editing when connected; this is not automatically connected to the website.
## Google Sheets and email
Install integrations/google/Code.gs in a Google Apps Script bound to a Google Sheet, and follow integrations/google/SETUP.md. Server secret names: GOOGLE_SHEETS_WEBHOOK_URL, GOOGLE_SHEETS_SHARED_SECRET, GOOGLE_BLOG_FEED_URL. Higgsfield website secrets are not configured at delivery. While unconfigured the form deliberately returns 503 with a direct email fallback. No silent submissions.
## Scientific and legal publication gate
Canada Health Product Licence entries: Daily Maintenance NPN 80143362 (6 mg iron, 400 mcg folate, 200 mg inulin, 2.4 mcg B12, 150 mg C; adults 18+, 1 cap/day), Pregnancy NPN 80143356 (16 mg iron, 600 mcg folate, 200 mg inulin, 2.6 mcg B12, 150 mg C; adults 18+, 1 cap/day). Active licence; product status Not Marketed per registry. Includes Egg Yolk, Hypromellose, Microcrystalline cellulose, Silicon dioxide as listed nonmedicinal ingredients. Confirm packaging and US compliance separately; no FDA approval implied.
Official records:
https://health-products.canada.ca/lnhpd-bdpsnh/info?licence=80143362
https://health-products.canada.ca/lnhpd-bdpsnh/info?licence=80143356
Research reference:
https://doi.org/10.1111/j.1750-3841.2011.02291.x
https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/
Submitted Meletis commentary is an uploaded author manuscript, NOT independently verified as a published Townsend Letter article. Full source in content/source-review; educational adaptation at /insights/peptides-and-iron. Current formal scientific advisory title, compensation arrangement, endorsement, use-of-likeness licence should be signed off before external promotion. Reported N=9 observation remains restricted as unsupported clinical efficacy claim.
## Hosting portability
This package contains the full React 19 / TanStack Start project source and public assets. Deploys directly within the existing Higgsfield Worker environment. AWS Amplify deployment requires adapting the TanStack Start server target, cloud runtime and env var bindings; not a direct static S3 upload. Separate API routes /api/lead and /api/blog require a server runtime. Source is portable, but a provider-specific build configuration is required for Amplify. Avoid exposing secret values in any Git repository or client code.
## Review prior to campaign launch
- Configure Google Apps Script and secrets; submit a test lead and verify Sheet row + notification inbox.
- Add published articles to Articles sheet after scientific and regulatory review.
- Approve Meletis photo rights/profile role, corporate DBA legal statement and privacy policy.
- Cross-check live NPN language and US territory claims; label inventory and promotional copy separately.
- Configure spam protection and response rate limits for high-volume traffic; request accessibility testing.
- Keep the Higgsfield community gallery listing OFF.
