# Competitor Policy Research (SizeTune)

Fetched: 2026-11-13. All entries are paraphrases from the pages fetched on that date; policies change, so re-verify before relying on them. Not legal advice.

Sources (all fetched 2026-11-13):
- S1 https://github.com/GoogleChromeLabs/squoosh (README, Privacy section) and https://squoosh.app (footer/"Secure" blurb)
- S2 https://policies.google.com/privacy (effective 2026-10-16)
- T1 https://tinypng.com/privacy (no date shown) and T2 https://tinypng.com/terms (no date shown)
- I1 https://www.ilovepdf.com/help/privacy (updated 2026-02-19; sister-site policy used for iLoveIMG, since iloveimg.com/privacy-policy and /terms-and-conditions returned 404)
- I2 https://www.ilovepdf.com/help/terms (first ~100k of 158k chars read)
- I3 https://www.iloveimg.com/help/security (via search result summary, not fetched directly)
- P1 https://www.photopea.com/privacy.html (no date shown). Photopea terms page could not be located (404 on guessed URLs), so its liability/law/age rows are unverified.

## Comparison

| Dimension | Squoosh | TinyPNG/TinyJPG (Tinify B.V.) | iLoveIMG (iLovePDF S.L.) | Photopea |
|---|---|---|---|---|
| Architecture | Client-side; README says images are not uploaded (S1) | Server upload; images stored only to optimise (T1) | Server upload; processed on platform (I1, I3) | Client-side; files stay on device (P1) |
| Privacy promise | "Images never leave your device" (S1 site blurb) | Content shared only with listed providers unless legally compelled (T1) | Won't inspect content beyond need; no AI training on content (I1) | Nothing uploaded; unsaved work lost (P1) |
| Data collected | Google Analytics: visitor data, before/after size values, PWA install type/time (S1). Google-wide policy is broad (account, device, IP, location, activity) but its applicability to squoosh.app is not stated (S2) | Account (name/email/purchases), VAT no.; logs: browser, IP, API key, time, file fingerprint (T1) | Registration/enquiry data; usage data (e.g. signing data); content processing as processor for third-party personal data (I1) | Free: one preferences cookie (language, theme, colours). Logged in: name, email, synced prefs, payment record, login token (P1) |
| Hosting / third parties | Google (project is GoogleChromeLabs) | Google Cloud; Stripe, Mailgun, Campaign Monitor, Groove, VIES, Google Analytics, WideAngle, Cookiebot (T1) | Hosting and payment vendors; mostly EEA, SCCs elsewhere (I1) | None named; optional cloud-drive connectors, HTTPS (P1) |
| Ads / cookies | Analytics only; no ads mentioned (S1). Google policy discusses personalised ads generally (S2) | Cookiebot consent + analytics; no ads mentioned (T1) | Non-essential cookies need consent; separate cookie policy; ad-free for education accounts (I1) | One pref cookie; ads not mentioned in policy (P1) |
| Retention | Nothing stored server-side per README; analytics retention unstated | Images deleted within 48h; logs 31 days (T1, T2) | Files deleted within 2h of processing (I1, I3); signed docs up to 5 yrs (I3) | Accounts deleted after 6 months inactivity (P1) |
| User rights | Via Google account tools (S2); none specific to Squoosh | Access, correction, portability, erasure (T1) | Access, rectification, objection, erasure, restriction, portability, withdraw consent; complain to AEPD (I1) | Deletion on email request (P1) |
| Liability | Not found for Squoosh itself | "As is"; cap = fees paid in prior 12 months; no indirect loss (T2) | No warranties; free users waive damages except fraud/gross negligence; paid caps; indemnity (I2) | Unverified |
| Governing law / disputes | Not stated for Squoosh | Netherlands; Amsterdam courts (T2) | Spanish law; Barcelona courts for business users; consumers keep local rights; mandatory negotiation period (I2) | Not stated in privacy page |
| Age rules | Google: references under-13 / local-age threshold (S2) | Not addressed (T1, T2) | 18+, or 16+ if independent; minors under supervision (I1, I2) | Not addressed |
| Contact / grievance | Google privacy form (S2) | support@tinify.com; postal address in NL (T1) | DPO email + Barcelona postal address (I1) | support@photopea.com (P1) |

## Accurate vs marketing

- Squoosh "never leaves your device": consistent with the README's local-compression statement, but the README also discloses Google Analytics that sends size values, so "nothing leaves" is true for image bytes, not for all telemetry. Also, I could not verify by network inspection; this is a documentary reading only.
- Photopea "nothing uploaded": plausible and consistent with its cookie-only disclosure; it silently omits ads/third-party detail, so the policy is thin rather than false.
- TinyPNG 48h deletion and iLoveIMG 2h deletion: stated clearly and specifically; not independently verified. Both sit alongside logs that live longer (31 days) or exceptions (signed docs), so the headline is accurate but incomplete without the fine print.
- iLoveIMG "does not retain documents" (I3) is marketing-flavoured next to the 2h window and the signed-doc 5-year carve-out.
- The Squoosh and Photopea documents are short READMEs/pages, not full legal terms; absence of liability/law/age clauses means weaker legal protection, not stronger privacy.

## Takeaways for SizeTune

1. State the architecture precisely: image bytes are processed in the browser and are not sent to SizeTune servers. Avoid absolutes like "100% private" or "zero data" because analytics, hosting logs, and ads still exist.
2. Separately list what does leave the device: page-view analytics, ad/consent cookies, server access logs (IP, user agent), and any error reporting. Squoosh's disclosure of size values in analytics is the model for honesty.
3. Name every third party (host/CDN, analytics, ad network, consent tool) with its purpose, as Tinify does. Update the list whenever a vendor changes.
4. Disclose advertising and cookies explicitly, with consent where required (India DPDP Act 2023 notice and consent; also GDPR/ePrivacy for EU visitors). Offer a cookie preferences control; do not copy the "not mentioned" gap seen at Photopea.
5. Avoid specific deletion-window language (2h, 48h) since there is no server upload; instead say files are never stored by SizeTune and vanish on tab close. Do add retention periods for logs and analytics.
6. Provide user rights under DPDP (access, correction, erasure, grievance) with a working email address and a named grievance officer and response time; iLovePDF's named DPO and postal address are a good pattern.
7. Terms: "as is" disclaimer, no liability for output quality or for rejection by government/exam portals (size, dimension, format specs change), and a cap at nominal amount since the service is free. Competitor caps reference fees paid, so adapt to free use. Keep consumer-protection carve-outs honest and avoid excluding liability that cannot lawfully be excluded.
8. Governing law India, courts at a stated city, with an optional short good-faith negotiation step as iLovePDF does. Have counsel confirm; do not copy competitor text.
9. Age: state a minimum (e.g. 18, or younger with parent/guardian supervision), and a DPDP-compliant note on verifiable parental consent for under-18s if any personal data is collected; students applying for exams are likely minors, so no tracking or behavioural ads aimed at under-18 users.
10. Cover signature images specifically: they are biometric-adjacent personal identifiers; promise they are not uploaded, but warn users that downloaded files and browser extensions are outside SizeTune's control. Do not claim legal validity or acceptance of resized documents by any authority.
