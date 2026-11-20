# Verification

| Check | Result |
|---|---|
| Local HTTP API suite | 7 tests passed with a temporary SQLite database and independent HTTP cookie sessions. |
| Session and permissions | Unauthorized dashboard, elevated role in citizen signup, disallowed transitions, access by unassigned officer, private photo authorization, admin-only CSV and logout checked. |
| Complaint workflow | Report → review → assignment → in progress → proof → reopen → reassignment → proof → citizen resolution checked. Invalid coordinates, wrong photo signature and missing after photo rejected. |
| Duplicate handling | Nearby match returned, duplicate support counted once and separate submission available. |
| Green Revolt | Zero sample points, one-time scan confirmation, daily limit, concurrent redemption with insufficient balance and retry idempotency checked. |
| Gemini | Missing configuration and invalid-provider-response error paths checked. Structured provider response normalization tested with a stub. Local configuration creation, validation, loading and environment precedence checked. Live Google credentials and live classification were unavailable. |
| AI evaluation helper | Ran with two synthetic rows to check the output shape. No accuracy benchmark was performed. |
| JavaScript render smoke | Sign-in, citizen/officer/admin dashboards, scanner key status and category correction rendered with a mocked DOM. |
| Static checks | Browser JavaScript parsed with Node. Python and SQL loaded by the HTTP suite. ZIP integrity checked before delivery. |
| Chromium UI | This runtime denies UNIX sockets required by Chromium, so a real browser run was unavailable. Visual QA, mobile layout, browser E2E, accessibility tooling, offline install and GPS permission behavior remain unverified. |

Re-run the HTTP tests with `python -m unittest discover -s tests -v`. Re-run the role-based browser walkthrough in README on a machine with Chrome or Brave.
