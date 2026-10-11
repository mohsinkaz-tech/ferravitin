# BioScience Global — AWS Amplify production deployment

**Status:** Two fully exported, Amplify SSR-compatible websites are on the `amplify-production` branch. Both compile locally to `.amplify-hosting` with Node.js 22 compute. The existing Higgsfield sites remain unchanged and active. No AWS account deployment or Namecheap DNS modifications have been performed.

## Project layout

| Folder | AWS Amplify app | Domain |
| --- | --- | --- |
| `corporate/` | `bioscience-global-main` | `www.biosciglobal.ca` |
| `pharmacy/` | `ferravitin-bc-pharmacy-partner` | `partners.biosciglobal.ca` |

The `amplify.yml` in the repository root contains **both** app build definitions. Each project has the Nitro AWS Amplify adapter configured in its `vite.config.ts`.

## Create AWS Amplify application 1 — corporate site

1. Open https://console.aws.amazon.com/amplify/.
2. Choose **Create new app → GitHub** and authorize the `mohsinkaz-tech/ferravitin` repository.
3. Select the `amplify-production` branch.
4. **Check "My app is a monorepo"** and enter **`corporate`** as the application root.
5. Name it `bioscience-global-main`; retain Node 22 SSR build settings from `amplify.yml`.
6. Save and deploy. Verify the temporary `amplifyapp.com` URL and route `/products`, `/platform`, `/announcements`, `/insights/peptides-and-iron`, `/contact`, and `/api/blog`.

## Create AWS Amplify application 2 — BC Pharmacy Partner

1. Create another Amplify app from the **same** GitHub repository and **same** branch `amplify-production`.
2. Choose monorepo application root **`pharmacy`**.
3. Name it `ferravitin-bc-pharmacy-partner`; save and deploy.
4. Test the temporary AWS URL, both Ferravitin product images, Nadeem photo, downloadable PO PDF, and `/api/order-request` endpoint.
5. Before Google configuration the order API intentionally returns HTTP 503 and a readable email fallback. It must not silently report success.

## Link Namecheap after both AWS preview domains pass

- Primary corporate: `www.biosciglobal.ca`.
- Primary pharmacy: `partners.biosciglobal.ca`.
- Secondary corporate: `www.biosciglobal.net`, redirected to `.ca` if desired.
- Secondary partner: `partners.biosciglobal.net`, redirected to `partners.biosciglobal.ca`.

Within each AWS Amplify app, select Hosting → Custom domains → Add domain. Request managed HTTPS and the relevant hostname. Obtain **exact AWS-generated** verification/hosting CNAME records (per domain). Open Namecheap Domain List → Manage → Advanced DNS for the authoritative DNS provider and enter only those records. Do **not** change existing MX, SPF, DKIM, DMARC or nameservers. Verify HTTPS and mail delivery before redirecting live traffic.

Reference: https://docs.aws.amazon.com/amplify/latest/userguide/to-add-a-custom-domain-managed-by-a-third-party-dns-provider.html

## Google workflow configuration

The server endpoints remain part of the source and built SSR compute:
- `corporate/src/routes/api.lead.tsx` — enquiries and Google Sheets lead registration.
- `corporate/src/routes/api.blog.tsx` — published Google-managed articles.
- `pharmacy/src/routes/api.order-request.tsx` — pharmacy orders with quantity validation and Google Sheets handoff.

The Apps Script integration scripts and instructions are in `corporate/integrations/google/` and `pharmacy/integrations/google-apps-script/`. They require Google account authorization.

The runtime configuration keys are:
- Corporate: `GOOGLE_SHEETS_WEBHOOK_URL`, `GOOGLE_SHEETS_SHARED_SECRET`, `GOOGLE_BLOG_FEED_URL`
- Pharmacy: `GOOGLE_ORDER_WEBHOOK_URL`, `GOOGLE_ORDER_SHARED_SECRET`

**Do not put real credentials in this public repository or commit them in .env files.** Amplify environment variables configured for build are **not automatically available to the deployed SSR runtime**. Configure a properly secured runtime secret delivery approach, preferably an SSR compute IAM role with AWS Secrets Manager (or provider-supported secure runtime environment configuration), and test end-to-end delivery before enabling paid campaigns. No production secret wiring is completed in this repository. See https://docs.aws.amazon.com/amplify/latest/userguide/ssr-environment-variables.html and https://docs.aws.amazon.com/amplify/latest/userguide/amplify-SSR-compute-role.html.

## Editing workflow

1. Continue design and copy updates in Higgsfield.
2. Validate the updated content, and **re-export the revised source** into `corporate/` or `pharmacy/`.
3. Commit the source update to the `amplify-production` branch (ideally through a reviewed PR from a working branch).
4. Amplify will rebuild the relevant application automatically when the branch changes.

Important: The source import workflow in `.github/workflows/import-websites.yml` imported a **pinned, hash-checked snapshot** of the two Higgsfield exports. Re-running it does **not** fetch new Higgsfield changes; update the pinned source URLs and SHA-256 values only when a new verified export is deliberately approved.

## Launch gates

- AWS Amplify build/deploy status shows success for both apps.
- Each custom domain has a valid TLS certificate and resolves correctly.
- Corporate pages and pharmacy order page display all images and the original PO PDF.
- Google Sheet row arrives AND the notification email is delivered for a test request.
- NPN claims and current labels verified against authorized Health Canada licences.
- Commercial terms and privacy notices reviewed.
- Existing corporate email routing continues working.
- Higgsfield remains the design/dev environment, AWS Amplify is public production.

**Note:** GitHub source code is PUBLIC because the repository was explicitly authorized for public publishing. Do not add private research source documents or customer data to this repo.
