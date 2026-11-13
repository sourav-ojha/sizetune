# SizeTune legal review (India-first), research as of 2026-11-13

Status: research notes for the owner and their counsel. **This is not legal advice.** Every row gives the source that was actually opened in this session. Anything that could not be opened is marked **UNVERIFIED**.
Facts assumed: an individual developer in India runs SizeTune (sizetune.com). It is free and static (Cloudflare Workers static assets). Images are processed only in the browser and never uploaded. There are no accounts, cookies, analytics or ads today; AdSense is planned. Contact is by `mailto:` only. See `docs/legal/TECHNICAL_PRIVACY_AUDIT.md`.

Labels: **MANDATORY NOW**, **MANDATORY LATER (date)**, **RECOMMENDED**, **NOT APPLICABLE**. "Conservative" means: where applicability is arguable, treat the duty as applying.

---

## 0. Key dates (verified from the Gazette PDFs on meity.gov.in)

| Instrument | Gazette | What it does |
|--|--|--|
| DPDP Act commencement | **G.S.R. 843(E)**, dated 13 Nov 2025 (CG-DL-E-14112025-267647, digitally signed 14 Nov 2025). https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf | **In force from publication:** s.1(2), s.2, ss.18–26, ss.35, 38–43, s.44(1) and (3). **One year after publication:** s.6(9) and s.27(1)(d) (Consent Managers only). **18 months after publication:** ss.3–5, s.6(1)–(8) and (10), ss.7–17, s.27 (except (1)(d)), ss.28–34, 36, 37 and **s.44(2), which omits IT Act s.43A**. |
| Data Protection Board | **G.S.R. 844(E)**, 13 Nov 2025. https://www.meity.gov.in/static/uploads/2025/11/cc217843dc3bcb37b2b05bcc3b4e031f.pdf | Establishes the Board, with its head office in the NCR. |
| DPDP Rules, 2025 | **G.S.R. 846(E)**, 13 Nov 2025 (Gazette No. 760, CG-DL-E-14112025-267650). https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf | Rule 1(2): Rules 1, 2 and 17–21 apply from publication (they cover the Board). Rule 1(3): **Rule 4 (Consent Managers) applies one year later**. Rule 1(4): **Rules 3, 5–16, 22 and 23 apply 18 months later.** |

- **Date ambiguity:** the Gazette is dated 13 Nov 2025 but was uploaded and signed on 14 Nov 2025. PIB gives both dates: PRID 2190014 and the 17 Nov 2025 backgrounder say 14 Nov, while PRID 2198217 says 13 Nov. The core obligations therefore start on **13 May 2027 (or 14 May 2027)**. Plan for **13 May 2027**. The one-year date (Rule 4, s.6(9)) is **today, 13/14 Nov 2026**, and it concerns only Consent Managers.
- **Proposed acceleration:** MeitY consulted in Jan–Feb 2026 on cutting the 18-month period to 12 months, according to secondary reports (ssrana.in, takshashila.org.in, Mar 2026 press). **I found no Gazette amendment to Rule 1 or G.S.R. 843(E).** I could not search egazette.gov.in exhaustively, so the absence of an amendment is **UNVERIFIED**. Check egazette.gov.in and meity.gov.in again before launch.
- **DPDP (Removal of Difficulties) Order, 2026, S.O. 5458(E), 5 Oct 2026:** reported by legal500.com (secondary source; **primary not opened**). It makes word-level fixes to s.9(1) and s.10(2)(c)(ii) and changes no dates.

---

## 1. DPDP Act, 2023 (Act 22 of 2023)
Source: https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf. Also PIB https://www.pib.gov.in/PressReleasePage.aspx?PRID=2190014

| Provision | In force today? | What it means for SizeTune | Label |
|--|--|--|--|
| s.2(t) "personal data" means *any* data about an individual who is identifiable by or in relation to it. The Act has no carve-out for "purely technical" data. | Yes (definitions) | IP addresses and user agents in hosting logs, and senders' email addresses, can be personal data. The Act does not mention IP addresses. **Conservative: treat them as personal data.** | Interpretation |
| s.2(i) Data Fiduciary (decides purpose and means, "alone or in conjunction with other persons"). s.2(k) Data Processor (processes on behalf of a Fiduciary). | Yes | **Images:** SizeTune's code never receives them; the user processes them on their own device. A user handling their own files falls under **s.3(c)(i)** (personal or domestic purpose), so SizeTune is not a Fiduciary for images. **Hosting logs:** the owner chooses Cloudflare and the purpose, so the owner is likely the **Fiduciary** and Cloudflare the **Processor**. Cloudflare describes itself as a processor for Customer Logs, per its privacy policy and DPA as cited in TECHNICAL_PRIVACY_AUDIT.md; I did not re-open those pages. **Email:** the owner is the Fiduciary. **AdSense (later):** Google is a Fiduciary for its own ad processing; whether the publisher is a joint Fiduciary is **unsettled**. | Interpretation |
| s.3(a)/(b) territorial scope. s.3(c)(ii) exempts data the Data Principal made public. | 13 May 2027 | Applies because the operator processes in India. | MANDATORY LATER (13 May 2027) |
| s.4 lawful grounds: consent or s.7 legitimate uses. **s.7(a)**: data the Data Principal "voluntarily provided" for a specified purpose, where she has not objected. | 13 May 2027 | Replying to emails fits s.7(a). Hosting logs fit no ground cleanly; they are best covered by notice plus minimal retention. Counsel should confirm the lawful basis for logs. | MANDATORY LATER |
| s.5 notice (+ Rule 3). It is required with every *consent* request: itemised data, purpose, how to withdraw or exercise rights, how to complain to the Board. | 13 May 2027 | No consent is collected today. **Once AdSense or cookies are added, a Rule 3 notice is required** before consent is requested, including for Indian users. | MANDATORY LATER (13 May 2027), RECOMMENDED now |
| s.6 consent: free, specific, informed, unambiguous; withdrawal must be as easy as giving it. | 13 May 2027 | Relevant to any ad or cookie consent banner (Rule 3(c)(i)). | MANDATORY LATER |
| s.8(1): the Fiduciary is responsible "irrespective of any agreement to the contrary". | 13 May 2027 | **The Terms cannot contract out of DPDP duties.** | MANDATORY LATER |
| s.8(5) security safeguards (+ Rule 6). Rule 6(1)(e) requires keeping logs **for one year**; Rule 6(1)(f) requires a contract with the Processor. | 13 May 2027 | Needs the Cloudflare DPA (accepted through Cloudflare's terms; owner to confirm) and protected account access (2FA). | MANDATORY LATER |
| s.8(6) breach intimation (+ Rule 7). Notify affected individuals without delay, and the Board without delay **plus a detailed report within 72 h**. | 13 May 2027 | Covers anything that leaks hosting logs or the mailbox. Keep a one-page breach runbook. | MANDATORY LATER |
| s.8(7)/(8) erase data once the purpose is served (+ Rule 8(1), Third Schedule). The Third Schedule covers only large e-commerce, gaming and social platforms. | 13 May 2027 | The general erasure duty still applies (for example, old emails). | MANDATORY LATER |
| **Rule 8(3)**: keep personal data, "associated traffic data and other logs of the processing" for **at least one year** (Seventh Schedule purposes), including processing done by a Processor (Illustration, Case 2). | 13 May 2027 | **Critical:** read literally, any hosting or request logs of SizeTune's processing must be kept for at least one year. This conflicts with short or no log retention on Cloudflare's free tier, and with any "we keep nothing" claim. **Counsel must decide** whether the operator "processes" visitor personal data at all. Do not promise in the policy that logs are never kept. | MANDATORY LATER (13 May 2027), **needs counsel** |
| s.8(9) + Rule 9: publish the contact details of someone who can answer questions about processing. s.8(10) + Rule 14(3): grievance redressal within **≤ 90 days**. Rule 14(1): publish how to make rights requests. | 13 May 2027 | A published `hello@`/privacy email and a stated response time meet this. A Data Protection Officer is not needed: DPOs apply only to Significant Data Fiduciaries (s.10). | MANDATORY LATER; RECOMMENDED now |
| s.9 children (under 18). s.9(1) requires verifiable parental consent (+ Rule 10). **s.9(3): no tracking, behavioural monitoring or targeted advertising directed at children.** | 13 May 2027 | The tool collects no child data, so s.9(1) has little effect. **Critical once ads run:** the audience includes exam applicants, many of them under 18 (s.2(f)). After 13 May 2027, configure ads as non-personalised, or get counsel's view on s.9(3). Fourth Schedule Part B item 6 lets a Fiduciary process data to confirm a user is *not* a child. | MANDATORY LATER (13 May 2027) |
| s.10 Significant Data Fiduciary; s.16 cross-border transfer (+ Rule 15). | 13 May 2027 | s.10: NOT APPLICABLE (nothing has been notified). s.16: transfers are allowed unless restricted, and no restriction applicable to SizeTune was found. | NOT APPLICABLE / monitor |
| s.17(3) exemption for notified Fiduciaries "including startups". The Explanation limits "startup" to a **company, partnership or LLP**. | Notification needed | An **individual is not a "startup"** under s.17(3), and I found no s.17(3) notification. PIB PRID 2198217 (3 Dec 2025) mentions a "simplified compliance framework" in general terms only. | NOT APPLICABLE (as of today) |
| Penalties (Schedule): up to ₹250 cr for security failures; ₹200 cr for breach-notice and children's-data failures; ₹50 cr otherwise. | 13 May 2027 | The Board must weigh proportionality (s.33). | Context |

## 2. DPDP Rules, 2025: what applies to a small Fiduciary
Source: G.S.R. 846(E), link in §0. In force today: Rules 1, 2 and 17–21 (the Board). **None of them place duties on SizeTune.** Rule 4 (Consent Managers, from 13/14 Nov 2026) does not apply because SizeTune will not be a Consent Manager. Everything else applies from **13 May 2027**: Rule 3 notice, Rule 6 security plus one-year log retention, Rule 7 breach, Rule 8(3) one-year retention, Rule 9 contact, Rule 10 children, Rule 14 rights and 90-day grievance, Rule 15 transfers. The Rules have no size threshold; small Fiduciaries are covered. **Label: MANDATORY LATER (13 May 2027).**

## 3. IT Act, 2000
Text: PRS copy of the amended Act, https://prsindia.org/files/bills_acts/bills_parliament/2021/IT%20Act,%202000.pdf. India Code (indiacode.nic.in) was **unreachable** this session (403/504 errors). The PRS copy is dated 2021, so check later amendments on India Code.

| Section | Effect | SizeTune | Label |
|--|--|--|--|
| s.10A | An electronic contract is not unenforceable merely because it is electronic | Supports click-wrap and browse-wrap Terms | Context |
| **s.43A** compensation for negligent handling of *sensitive* personal data by a "body corporate". The Explanation (i) definition includes a **sole proprietorship** "engaged in commercial or professional activities". | **In force until s.44(2) DPDP commences (13 May 2027)** | SizeTune collects no sensitive personal data. Exposure is low, but once monetised the operator is plausibly a "body corporate". | MANDATORY NOW (conservative) until 13 May 2027 → NOT APPLICABLE after |
| s.2(1)(w) "intermediary" means one who, on behalf of another, "receives, stores or transmits" a record or provides a service for it. **s.79** gives intermediaries safe harbour if they meet due diligence. | In force | SizeTune receives, stores and transmits no user records; images never leave the device. It is **probably not an intermediary**, so it gets no s.79 safe harbour but also has no intermediary duties. If uploads, sharing or hosting are ever added, this flips. | NOT APPLICABLE (today) |
| s.69 / s.69A: government directions to intercept or decrypt, and blocking | In force | Nothing to do. **Do not promise** in the policy "we will never disclose to authorities". | Context |
| s.70B(6)/(7) CERT-In directions; non-compliance can bring up to 1 year's imprisonment or a ₹1 lakh fine | In force | See §7 | See §7 |
| s.72A disclosing personal information in breach of a lawful contract | In force | Keep the privacy policy's promises accurate and keep them | MANDATORY NOW |
| s.66C identity theft (misusing "electronic signature … or any other unique identification feature"); s.66D cheating by personation using a computer resource; s.66E privacy (images of private areas) | In force | Basis for an acceptable-use clause: do not use the tool to forge or impersonate. These bind users. SizeTune does not police content it never sees. | RECOMMENDED (Terms) |
| s.75 offences outside India involving a computer in India | In force | Context | — |

## 4. SPDI Rules, 2011 (G.S.R. 313(E), 11 Apr 2011, under s.43A / s.87(2)(ob))
- Official text: India Code PDF https://upload.indiacode.nic.in/showfile?actid=AC_CEN_45_76_00001_200021_1517807324077&type=rule&filename=GSR313E_10511%281%29_0.pdf. **The connection was refused this session, so the text is UNVERIFIED.** Rule content below comes from secondary sources: Rule 3 lists SPDI (passwords, financial, health, biometric and similar); Rule 4 requires a body corporate that handles information to publish a privacy policy; Rule 5(9) requires a Grievance Officer whose name and contact are published, with redress "within one month".
- **Status:** still in force today. DPDP s.44(2) omits s.43A and s.87(2)(ob) (verified in the Act text) with effect from **13 May 2027** (verified in G.S.R. 843(E)). After that the Rules lose their parent provision. My **inference** is that they stop applying; this is not an express Gazette statement.
- **SizeTune:** collects no SPDI. As a conservative reading for a sole proprietor, **publish a privacy policy (Rule 4) and a named grievance contact (Rule 5(9)) now.** **MANDATORY NOW (conservative) until 13 May 2027.** IT Rules 2021 r.3(1)(i) also points intermediaries to these Rules, which does not apply to SizeTune.

## 5. IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021
Source: MeitY consolidated text "updated as on 10.02.2026", https://www.meity.gov.in/static/uploads/2026/02/550681ab908f8afb135b0ad42816a1c9.pdf (G.S.R. 139(E), 25 Feb 2021, last amended by **G.S.R. 120(E), 10 Feb 2026**).
- Rule 3(1)(a) requires publishing rules, privacy policy and user agreement. Rule 3(2) requires a Grievance Officer: acknowledge within 24 h and resolve within **7 days**; content-removal complaints within **36 h**; non-consensual intimate or impersonation imagery within **2 h** (all as amended 10 Feb 2026). Rule 3(1)(g)/(h) require 180-day preservation. **These bind only "intermediaries".**
- New rule 2(1)(wa) and rule 3(3) (synthetically generated information) cover a resource that "may enable … modification" of images. The definition **excludes "routine or good-faith editing, formatting, enhancement … or compression"** that does not materially alter meaning. Resizing and compression fall in that exclusion, and SizeTune is likely not an intermediary anyway.
- **SizeTune (stores nothing, transmits nothing on users' behalf): NOT APPLICABLE today.** It is still **RECOMMENDED** to publish a grievance or contact person with a target response time (for example 7 days). This costs nothing and also meets SPDI r.5(9) and DPDP r.9/r.14. **Re-assess** if any feature uploads, stores, shares or AI-generates content (for example background removal on a server, or signature "generation").

## 6. Consumer Protection Act, 2019 and E-Commerce Rules, 2020
- CPA 2019 (Act 35 of 2019), https://egazette.gov.in/WriteReadData/2019/210422.pdf. **s.2(42) "service" … "does not include the rendering of any service free of charge"**. s.2(7) "consumer" requires consideration paid or promised. s.2(46) "unfair contract" applies only between a service provider and a *consumer*, and lists unilateral termination without reasonable cause, unreasonable charges and conditions, and similar terms. s.2(1)/(28) cover advertisement and misleading advertisement.
  - **SizeTune: NOT APPLICABLE while it is free.** Ads shown to non-paying users do not obviously make them "consumers". That point is untested, so it is **UNVERIFIED** case law. **RECOMMENDED:** avoid absolute claims ("100 % accepted by every portal", "guaranteed"), which would be risky misleading claims if the CPA were ever held to apply.
- Consumer Protection (E-Commerce) Rules, 2020, **G.S.R. 462(E)**, https://egazette.gov.in/WriteReadData/2020/220661.pdf. Rule 2(1) applies to "goods and services bought or sold over digital or electronic network". **NOT APPLICABLE** (nothing is bought or sold).
- CCPA Dark Patterns Guidelines, 2023 (30 Nov 2023): they apply to "platforms systematically offering goods or services" and borrow the E-Commerce Rules' definition of "platform". This comes from secondary sources; I did not open the primary text. **NOT APPLICABLE (likely)**, but **RECOMMENDED** to avoid dark patterns in any future consent banner. Google's EU policy and GDPR expect the same.
- **Liability exclusions that will not hold, or should not be attempted** (sources: Contract Act provisions as reported by secondary sources; India Code was unreachable, so the statutory text is **not re-verified today**):
  - excluding liability for fraud or for your own wilful misconduct (Contract Act s.17/s.23, public policy);
  - excluding statutory duties: DPDP s.8(1) applies "irrespective of any agreement to the contrary" (verified), and IT Act s.43A/72A cannot be waived;
  - a total bar on suing, or shortening the limitation period (Contract Act s.28, void);
  - excluding criminal liability;
  - grossly one-sided standard-form terms (Supreme Court, *Central Inland Water Transport v. Brojo Nath Ganguly*, 1986; **case not re-checked this session**).
  - What is safe: "as is", no warranty of acceptance by any portal, a reasonable cap for a free service, "to the extent permitted by law".

## 7. CERT-In Directions under s.70B(6), 28 Apr 2022
Sources: https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf and FAQ (May 2022) https://www.cert-in.org.in/PDF/FAQs_on_CyberSecurityDirections_May2022.pdf. Effective 60 days after issue.
- Applies to "service providers, intermediaries, data centres, **body corporate** and Government organisations". FAQ Q25 uses the s.43A definition, which includes a sole proprietorship engaged in commercial or professional activities. FAQ Q7: "**Individual citizens are not covered**".
- Duties:
  - (ii) report listed incidents (including website intrusion or defacement and data breaches) **within 6 hours** of noticing them;
  - (iii) designate a Point of Contact;
  - (i) sync clocks to NIC/NPL NTP;
  - **(iv) enable logs of "all their ICT systems" and keep them for a rolling 180 days.** The Direction says the logs must be kept in India, but FAQ Q35 says they "may be stored outside India also" if they can be produced in reasonable time. FAQ Q37 lists examples such as web server logs.
- **SizeTune:** before monetisation, a free, non-commercial project by an individual is arguably outside scope. With AdSense it is plausibly a "body corporate". The operator runs no servers of its own, so its ICT systems are the Cloudflare account, GitHub, the registrar and the mailbox.
- **Labels:** 6-hour incident reporting is **MANDATORY NOW (conservative)**. 180-day log retention is **MANDATORY NOW (conservative)**, but **feasibility is doubtful** on Cloudflare's free plan. Keep whatever account and audit logs the providers offer, document why request logs are not available, and get counsel's view. This also interacts with DPDP Rule 8(3) (one year, from May 2027).

## 8. Contract law, and criminal law on signature misuse
- **Click-wrap vs browse-wrap:** IT Act s.10A (verified) validates electronic contracts. Indian case law on browse-wrap is thin; I did **not** verify any judgment this session. **RECOMMENDED:** put a visible "By using this tool you agree to the Terms" link next to the upload control. Do not rely on a footer link alone. Do not add a forced checkbox unless counsel advises it, because it creates friction and makes no clear difference for a free tool.
- Indian Contract Act, 1872: s.23 (object opposed to public policy is void); s.28 (absolute restraint on legal proceedings and shortened limitation are void; arbitration is an exception). Text **not re-fetched** because India Code was unreachable.
- Bharatiya Nyaya Sanhita, 2023 (Act 45 of 2023, in force 1 Jul 2024), **verified in the Gazette text** https://egazette.gov.in/WriteReadData/2023/250883.pdf:
  - s.318 cheating;
  - **s.319** cheating by personation (up to 5 years);
  - **s.335** making a false document or false electronic record;
  - **s.336** forgery (s.336(2): 2 years; s.336(3): forgery for cheating, 7 years; s.336(4): harm to reputation, 3 years);
  - **s.340** using a forged document or electronic record as genuine.
  - Together with IT Act ss.66C and 66D, these support a Terms clause that says: "only resize your own signature or one you are authorised to use; forging or impersonating is a crime; SizeTune is a formatting tool and does not verify, authenticate or certify signatures."
  - A Feb 2026 Gazette item proposing a BNS amendment (a Rajya Sabha Bill introduced on 6 Feb 2026, amending s.103) is irrelevant here.

## 9. Advertising and cookie consent
| Item | Source | In force | SizeTune | Label |
|--|--|--|--|--|
| India cookie-consent statute | No India-specific cookie statute was found in any search. DPDP covers cookie data only if it is personal data. | — | Absence of such a law is **UNVERIFIED** (proving a negative). From 13 May 2027, personalised-ad cookies used on Indian users need a DPDP basis (consent plus a Rule 3 notice). | NOT APPLICABLE now; MANDATORY LATER (13 May 2027) when ads run |
| AdSense **Required content** (privacy policy disclosures) | https://support.google.com/adsense/answer/1348695 | When AdSense is used | Disclose that third-party vendors including Google use cookies to serve ads based on prior visits; that Google's ad cookies enable ads based on visits to this and other sites; opt-out at google.com/settings/ads (and aboutads.info); and list any other ad vendors. | MANDATORY LATER (when ads are added; contractual) |
| Google Publisher Policies: privacy | https://support.google.com/adsense/answer/10502938 (search-result text only; **page not fully read**) | When AdSense is used | Have and follow a privacy policy that discloses data collection from use of Google products (cookies, web beacons, IP addresses, identifiers). COPPA: flag child-directed content; no interest-based ads to known under-13s. | MANDATORY LATER (contractual) |
| AdSense Program policies | https://support.google.com/adsense/answer/48182 | When AdSense is used | No clicking your own ads and no "click/support us" prompts; no ads on non-content pages or pages made only for ads. **Tool-only pages need real content**, which the guide pages provide. | MANDATORY LATER (contractual) |
| **Google EU User Consent Policy** | https://www.google.com/about/company/user-consent-policy/ | When incorporated by the AdSense terms | EEA, UK and CH users: obtain consent for cookies or local storage where legally required and for personal data used in ad personalisation; identify each party; keep consent records; give clear revocation instructions. | MANDATORY LATER (when ads are added) |
| **Google-certified CMP (IAB TCF)** | https://support.google.com/adsense/answer/13554116 | EEA/UK from 16 Jan 2024; CH from 31 Jul 2024 | Needed for **personalised** ads to EEA, UK and CH traffic. Without one, only non-personalised or limited ads are eligible. Options: (a) a certified CMP (Google's own "Privacy & messaging" CMP is one); (b) accept non-personalised or limited ads in those regions. The CMP will change the CSP and the "no cookies" claims. | MANDATORY LATER (when ads are added), if personalised EEA/UK/CH ads are wanted |
| **GDPR Art 3(2) / UK GDPR** | https://gdpr-info.eu/art-3-gdpr/ (EUR-Lex fetch failed with a TLS error) | — | Applies to a non-EU controller only if it (a) **offers** goods or services to people in the EU (payment irrelevant; Recital 23 says mere accessibility is not enough) or (b) **monitors** their behaviour in the EU. **Today:** an India-targeted tool with no tracking is **likely outside scope**. **With personalised ads and cookies on EEA/UK visitors:** plausibly "monitoring". Treat as in scope for EEA/UK ad traffic (or serve no personalised ads there). Article 27 (EU representative) has an exemption for occasional, low-risk processing; its text was **not re-checked**. | NOT APPLICABLE now; decide before ads |

## 10. Governing law and jurisdiction (the owner decides)
- Convention for an Indian individual operator: "These Terms are governed by the laws of India. Subject to applicable law, the courts at **[city chosen by owner]** have exclusive jurisdiction." Indian courts generally allow choosing one court among several that already have jurisdiction (Contract Act s.28 jurisprudence; not re-verified). The usual choice is the city where the owner resides or carries on business, because that court already has jurisdiction.
- A clause **cannot oust** statutory forums: the Data Protection Board under DPDP s.27, consumer commissions where the CPA applies, or criminal jurisdiction. Say "subject to any mandatory rights you have under applicable law", which also protects EU/UK users.
- An arbitration clause is possible but usually disproportionate for a free tool. **Owner to decide** whether to have one at all, and if so the seat and venue.

---

## Clause list: Privacy Policy (conservative)
1. **Who we are:** the operator's legal name, or trade name plus "an individual based in India" (see owner facts), and a contact email.
2. **The short version:** images are processed in your browser and never uploaded. No accounts. No cookies, analytics or ads *today* (date-stamped).
3. **What we do not collect:** images, file names, metadata, and the contents of anything you resize.
4. **What is processed anyway:** the hosting provider (Cloudflare) receives ordinary request data (IP address, user agent, URL, time, approximate location) to deliver and protect the site. Cloudflare acts as our processor. Retention is per Cloudflare's settings and terms. **Do not state a retention period that has not been verified. Do not say "no logs are kept."**
5. **Email:** what is received when you write, the purpose (replying), the s.7(a) DPDP basis (voluntarily provided), how long it is kept (the owner sets this; ≥1 year from 13 May 2027 under Rule 8(3) unless counsel says otherwise), and deletion on request.
6. **Third parties and transfers:** Cloudflare (global network), the email provider, Google Search Console (if used). Data may be processed outside India.
7. **Cookies and local storage:** none set by our code. Note that Cloudflare security features may set strictly necessary cookies (owner to confirm the zone settings).
8. **Your rights (DPDP ss.11–14):** access, correction, erasure, grievance and nomination; how to exercise them (email); response within **30 days** (target; the legal maximum is 90 days under Rule 14(3)); the right to complain to the **Data Protection Board of India** after using our grievance channel (s.13(3)).
9. **Grievance and contact person** (DPDP r.9, SPDI r.5(9)): name or role and email, with a response time.
10. **Children:** the service is not directed at children; we knowingly collect no personal data from children; once ads run, they will not be personalised for children (s.9(3)).
11. **Security:** HTTPS, no server-side storage, 2FA on accounts. Keep it factual.
12. **Breach:** we will notify affected users and authorities as required by law (CERT-In within 6 h; DPDP Board/users from May 2027).
13. **Disclosure to authorities:** we may disclose where required by law (e.g. IT Act s.69, CERT-In directions under s.70B). No absolute promise.
14. **Future ads section (activate before AdSense goes live):** Google and third-party vendor cookies, the AdSense required statements, opt-out links, the EEA/UK/CH consent mechanism (CMP), and the vendor list.
15. **Changes:** a dated version; material changes take effect before any new processing starts.
16. **Effective date** and the law the policy is written under (DPDP Act 2023 / IT Act 2000).

## Clause list: Terms of Use (conservative)
1. Acceptance by use; a visible notice near the tool (s.10A IT Act).
2. A description of the service: a free, browser-based formatting tool; no upload; no account.
3. **No guarantee of acceptance:** portal rules (size, dimensions, format) vary; the user must check the portal's current requirements; SizeTune is not affiliated with any government or exam body.
4. **Signature and photo use:** only process images you own or are authorised to use; SizeTune does not verify, authenticate or certify signatures; forgery and impersonation are offences (BNS ss.319, 336, 340; IT Act ss.66C, 66D); do not use the tool for unlawful purposes.
5. The user is responsible for keeping the original and checking the output.
6. Intellectual property: the site's code, text and brand belong to the owner; the user keeps all rights in their images.
7. **"As is" disclaimer** to the extent permitted by law.
8. **Limitation of liability:** excludes indirect loss and caps total liability at a modest fixed sum (owner chooses, e.g. ₹1,000), "to the extent permitted by law". It carves out fraud, wilful misconduct and any liability that cannot be excluded by law. It contains no limitation-period shortening and no bar on suing.
9. No indemnity demanded from users, or a narrow one limited to the user's unlawful use (owner decides; keep it proportionate).
10. Availability: the service may change or stop without notice; it is free, so there are no refunds.
11. Third-party links and, later, ads: not endorsed.
12. Privacy: by reference to the Privacy Policy.
13. Governing law: India; courts at **[owner's city]**; subject to mandatory consumer and data rights.
14. Contact and grievance (same as the Privacy Policy).
15. Severability, entire terms, changes (dated), effective date.

## Facts only the owner can supply
1. The legal name to publish, or a decision to use a trade name plus a contact address. The grievance contact must be a real person or role.
2. A postal address, or a decision not to publish one. Counsel should check whether DPDP/IT Act grievance duties need one; nothing found requires a street address for a non-intermediary.
3. The city for jurisdiction, and whether to have arbitration.
4. Whether SizeTune is or will be run "commercially" (AdSense, sponsorships), and when. This drives the s.43A, SPDI and CERT-In "body corporate" questions.
5. Cloudflare dashboard state: Workers Logs/observability, Logpush, Web Analytics, Bot Fight Mode (sets `__cf_bm`), NEL, the plan tier and its log retention; and whether the Cloudflare DPA is accepted.
6. The email provider for `hello@sizetune.com`, how long mail is kept, and whether it is forwarded.
7. Whether Google Search Console is or will be used (the placeholder in privacy.astro).
8. The ad plan: personalised or not; whether EEA/UK/CH traffic gets ads; which CMP; whether India users get non-personalised ads after 13 May 2027 (s.9(3) and the student audience).
9. A liability cap figure and the target grievance response time.
10. A CERT-In Point of Contact and an incident runbook owner (the 6-hour reporting duty).
11. Whether any planned feature uploads, stores or AI-modifies images. That would trigger intermediary, IT Rules 2021 and synthetic-content duties.

## Could not verify / open items
- India Code (indiacode.nic.in) was unreachable, so these were **not read from primary text**: SPDI Rules, Indian Contract Act ss.23 and 28, and India Code's current consolidated IT Act. The IT Act was read from the PRS copy.
- Whether any Gazette notification after Mar 2026 shortened DPDP timelines. None was found.
- The primary text of S.O. 5458(E) (5 Oct 2026) and of the Dark Patterns Guidelines 2023.
- The full Google Publisher Policies privacy section (only search excerpts were seen).
- GDPR recitals 23/24 and Art 27(2) (EUR-Lex fetch failed). Art 3(2) was read via gdpr-info.eu.
- Case law on browse-wrap enforceability, *Brojo Nath Ganguly*, and forum selection under s.28. None was re-checked.
- Cloudflare's privacy policy and DPA were not re-opened; the processor role is cited from TECHNICAL_PRIVACY_AUDIT.md.
