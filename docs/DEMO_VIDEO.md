# InvoiceX four-minute demo recording guide

Target length: 4:00. Hard limit: 5:00. Record the live app and the linked explorer pages; do not show `.env`, private keys, ignored files, or wallet recovery phrases.

## 0:00–0:25 — problem and product

Open https://davide008.github.io/InvoiceX/ in Demo workspace.

Say: “Businesses wait 30 to 90 days for invoices to settle. InvoiceX turns a synthetic approved receivable into an ATS-issued asset that a compliant investor can finance at a discount.”

## 0:25–1:20 — ATS issuance and configuration

Switch to Testnet workspace and open the connected receivable. Show:

- ATS contract `0.0.10506750` on HashScan;
- asset name, symbol, face value and maturity in `deployments/connected-lifecycle.json`;
- issuer, SSI manager and KYC roles plus internal KYC in `deployments/ats-setup-0.0.10506750.json`.

Say: “This asset was created and issued through Asset Tokenization Studio 8 on Hedera testnet. The test identities and credentials are synthetic; the onchain role and KYC checks are real.”

## 1:20–2:05 — ENSv2 as authorization

Open Business identity. Show `inv-001.invoicex-2026.eth`, verify the publication, and point to the successful status. Then show the publication and revocation transactions linked from the README.

Say: “The invoice commitment is published by a delegated finance officer using an ENSv2 Permissioned Resolver. The officer can edit only the InvoiceX record. Tampered terms, unrelated record writes, and writes after revocation were rejected.”

## 2:05–3:10 — secondary-market lifecycle and compliance

Open the Marketplace and the settled testnet invoice. Show the financing and redemption links from the README.

Say: “The seller listed one ATS unit at a discount. Financing atomically exchanged TestUSD for the receivable, repayment funded the contract, and the current holder returned the asset to claim the face value. A non-KYC finance attempt was rejected. This is the secondary market missing from ATS today.”

## 3:10–3:40 — Uniswap treasury operation

Open Integrations and request the live 0.1 MockUSDC quote. Show expected input, maximum input, fee tier and expiry, then open the confirmed swap receipt.

Say: “The treasury adapter compares all four Uniswap v3 fee tiers with QuoterV2 and executes an exact-output SwapRouter02 trade with bounded spend and a deadline. It is a separate Sepolia treasury action, not a bridge to Hedera.”

## 3:40–4:00 — close

Show the README judge verification map and public repository.

Say: “InvoiceX combines an ATS-issued receivable, ENSv2 permissioned publication, a compliance-aware secondary market, and Uniswap treasury execution. The repository includes reproducible scripts, ten automated tests, source verification, and live testnet receipts.”

## Before uploading

- Confirm the recording is no longer than five minutes.
- Verify every explorer page and the live quote are readable at the recorded resolution.
- Trim wallet approval delays and any dead time.
- Upload the video publicly or unlisted, add its URL to the README, and add both the live demo and video to the ETHGlobal showcase.
- Check the video item in `docs/SUBMISSION.md` only after the uploaded URL works in a signed-out browser.
