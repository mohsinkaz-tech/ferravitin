# Shajara Capital — Namecheap DNS cutover

**Current state:** AWS site deployed; custom domains pending DNS verification. This file supersedes the earlier fundraiser-only DNS setup. Do not point `justgiving` at the old `d3varhiitd7sd5.cloudfront.net` value.

## shajara.capital — primary website

Namecheap → Manage `shajara.capital` → Advanced DNS → Host Records:

| Type | Host | Value | TTL |
|---|---|---|---|
| CNAME | `_029fc5f34edadebc066716562b4189e4` | `_1225c0eee5112c802d1077265106249a.wzccmgtwzk.acm-validations.aws` | Automatic |
| ALIAS | `@` | `d26t4zqaamzfx7.cloudfront.net` | Automatic |
| CNAME | `www` | `d26t4zqaamzfx7.cloudfront.net` | Automatic |

## shajara.ca — same main website

| Type | Host | Value | TTL |
|---|---|---|---|
| CNAME | `_09d356f646b41b947dd2b91955807933` | `_e7ae7d98b199709ceb2505b286883c80.wzccmgtwzk.acm-validations.aws` | Automatic |
| ALIAS | `@` | `d3bah2z498pi7q.cloudfront.net` | Automatic |
| CNAME | `www` | `d3bah2z498pi7q.cloudfront.net` | Automatic |
| CNAME | `justgiving` | `d3bah2z498pi7q.cloudfront.net` | Automatic |

AWS maps both root domains and www hosts to the new main site. `justgiving.shajara.ca` remains mapped to the fundraising share page. Main pages use `shajara.capital` as canonical. Do not configure a wildcard hostname or replace nameservers.

## Cutover order

1. Add only the two certificate-validation records first. Keep them permanently for renewal.
2. Complete the owner’s final website-copy review and Google lead-form connection. Verify a real synthetic lead appears in the private sheet.
3. Replace only the existing website records for `@`, `www`, and `justgiving` as applicable. Remove conflicting A/AAAA/CNAME/URL Redirect records at those same hosts; never remove unrelated records.
4. Preserve all MX, SPF, DKIM, DMARC and other email/service records. These DNS changes are for the website only.
5. Verify the domain certificates, home and community pages, video, donation button, sharing and form registration on both domains. Keep the Framer project intact until the new site is confirmed.

## Recorded rollback values

Observed October 14, 2026:

- `shajara.capital` root A: `31.43.160.6`, `31.43.161.6`.
- `www.shajara.capital` CNAME: `sites.framer.app`.
- `shajara.ca` resolved A: `162.255.119.199` (likely Namecheap redirect/parking service; inspect the actual dashboard record before changing it).
- `www.shajara.ca` CNAME: `parkingpage.namecheap.com`.
- Both domains use Namecheap `dns1.registrar-servers.com` and `dns2.registrar-servers.com`.

Capture the complete Namecheap record list before replacing anything, including any root redirect target that DNS alone cannot reveal. Restore the prior record types and values if cutover fails.

Connected Namecheap tools do not expose DNS editing. No account DNS record has been changed by this task.

[Namecheap ALIAS guidance](https://www.namecheap.com/support/knowledgebase/article.aspx/10128/2237/how-to-create-an-alias-record/)