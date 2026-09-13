# Submission checklist

- [x] Public repository with incremental commits.
- [x] Public live demo at https://davide008.github.io/InvoiceX/ (wallet-free demo plus testnet workspace).
- [x] Actual ATS SDK receivable creation, permissions, synthetic KYC and issuance receipts.
- [x] Custom contracts deployed and exact-match source-verified.
- [x] Contract tests: atomic payment, compliance rollback, current-holder claims, expiry and replay protection.
- [x] Browser demo lifecycle, creation, validation and search; desktop/mobile inspection.
- [x] Final live Hedera lifecycle evidence reports `Settled` in `deployments/hedera-lifecycle.json`, with non-KYC finance rejection checked by simulation.
- [x] Fund/configure Sepolia wallet and ENSv2 namespace `invoicex-2026.eth`.
- [x] Capture ENSv2 grant → officer publication → commitment check → revoke → rejected publication.
- [x] Settle the ENSv2-published ATS receivable on Hedera; see `deployments/connected-lifecycle.json`.
- [x] Execute a Uniswap exact-output swap against a seeded Sepolia test pool and save receipt.
- [ ] Submit the Uniswap feedback form linking to `FEEDBACK.md`; use `docs/UNISWAP_FORM_RESPONSES.md`, add personal details and ratings, review the terms, and save confirmation evidence.
- [ ] Record and publish a demo video of at most five minutes using `docs/DEMO_VIDEO.md`; add its URL to README and ETHGlobal, then verify it while signed out.

## Four-minute video outline

1. **0:00–0:30:** Cash-flow problem and discounted-receivable example.
2. **0:30–1:20:** Actual ATS asset, issuance and testnet KYC configuration; explain synthetic credentials.
3. **1:20–2:10:** ENSv2 finance-officer delegation, publication, revocation and rejected unauthorized update.
4. **2:10–3:20:** Hedera listing, investor financing, repayment and holder claim with receipts; show KYC rejection.
5. **3:20–4:00:** Separate Uniswap treasury quote/swap, maximum input and receipt. Explain the no-bridge boundary.

Use actual testnet evidence for track claims. The wallet-free demo is an interface walkthrough, not deployment proof. Never describe an unexecuted step as demonstrated.
