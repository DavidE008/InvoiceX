# InvoiceX

InvoiceX is an onchain invoice-financing marketplace that helps businesses unlock working capital from unpaid invoices.

**[Open the live demo](https://davide008.github.io/InvoiceX/)** · ETHOnline 2026 · Test funds only

## Problem

Businesses often wait 30, 60, or 90 days for invoices to be paid, creating cash-flow gaps that can delay payroll, inventory purchases, and growth.

## Solution

InvoiceX lets a business tokenize an approved receivable and sell it to an investor at a discount. The business receives capital immediately, while the investor receives the invoice payment at maturity.

## Sponsor integrations

- **Hedera Asset Tokenization Studio:** Actual ATS 8 SDK bond creation/issuance, role and KYC configuration, atomic asset/payment exchange, repayment and holder redemption. [SDK CLI](scripts/ats.ts), [testnet setup](scripts/ats-demo-setup.ts), [marketplace contract](contracts/InvoiceMarketplace.sol), [receipts](deployments/).
- **ENSv2:** Per-invoice `org.invoicex.invoice` authorization through the Permissioned Resolver; grant/revoke finance-officer access and verify canonical invoice commitments before listing and financing. [Adapter](src/chain/ens.ts), [identity screen](src/components/Identity.tsx), [live permission evidence](deployments/ensv2-permissions.json). Delegated publication, unrelated-record rejection, tampered-terms rejection and revoked-publication rejection all verified on Sepolia.
- **Uniswap:** Exact-output treasury swaps using QuoterV2 and SwapRouter02, four fee tiers, bounded input/approval and deadlines. [Reusable adapter](src/chain/uniswap.ts), [treasury screen](src/components/Integrations.tsx), [live swap evidence](deployments/uniswap-sepolia.json), [developer feedback](FEEDBACK.md). An exact-output swap is confirmed on Sepolia; the feedback form still requires submission.

Uniswap is a separate Sepolia treasury operation, not liquidity for the restricted ATS asset and not a bridge to Hedera. This MVP does not claim cross-chain atomic settlement.

### Judge verification map

| Track | What to inspect | Live proof |
| --- | --- | --- |
| Hedera | [ATS asset creation](scripts/ats.ts#L77-L115), [KYC grant](scripts/ats.ts#L117-L136), [secondary-market listing and settlement](contracts/InvoiceMarketplace.sol#L48-L105) | [ATS-issued receivable](https://hashscan.io/testnet/contract/0.0.10506750), [finance transaction](https://hashscan.io/testnet/transaction/0xba17c61f9563d19d7b0557d5e17d6c7bd9de053f37d7d19acfb5c5fdf6c4bcbe), [holder redemption](https://hashscan.io/testnet/transaction/0x4e183e7abc705425809384b06d8c183509fcab31f0ebbc3c7e7b6a9dddee8be3) |
| ENSv2 | [Permissioned Resolver delegation](src/chain/ens.ts#L26-L55), [authorized publication](src/chain/ens.ts#L57-L80), [live commitment verification](src/chain/ens.ts#L82-L100) | [Officer publication](https://sepolia.etherscan.io/tx/0x6d7256f1276d5554131f44ace079306dc97b843344e4fde9f45d4256183b6302), [permission revocation](https://sepolia.etherscan.io/tx/0x3e0d89770cda678046d4caad9ae083f967d6027e5bb027c5f750f6df62ce987e) |
| Uniswap | [four-tier QuoterV2 selection](src/chain/uniswap.ts#L40-L109), [bounded SwapRouter02 execution](src/chain/uniswap.ts#L111-L174), [treasury UI](src/components/Integrations.tsx#L126-L210) | [Confirmed exact-output swap](https://sepolia.etherscan.io/tx/0x9ad7537b92e6c504178224b572df5560739e5f063b5076fb01608a575b5243a0), [saved evidence](deployments/uniswap-sepolia.json), [feedback](FEEDBACK.md) |

## MVP Flow

1. A business creates an invoice with its amount, debtor, due date, and financing price.
2. InvoiceX tokenizes the receivable on Hedera and links it to the business's ENSv2 identity.
3. An investor reviews the invoice and purchases it at a discount.
4. Ownership of the receivable transfers to the investor.
5. After the debtor pays, the current ATS holder returns the unit and claims repayment. Early repayment is supported; payment is not guaranteed.

## Run locally

Requires Node.js 22 or later.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The default **Demo workspace** works without wallets: create, search, finance, repay, claim or cancel sample invoices. Demo state stays in your browser. **Testnet workspace** uses wallet confirmations and actual testnet contracts; failures are never replaced with simulated success.

The public site is published from `gh-pages`. Source development remains on `main`. The optional [verification/publishing workflow](docs/verify-and-publish.yml) is a template, not an active CI workflow: installing it requires a GitHub login with workflow permission. The current published build passed all 10 local automated tests and a production build before publishing.

```sh
npm test          # contract and domain tests
npm run build    # type-check and production bundle
npm run compile  # Solidity artifacts and complete standard JSON input
```

## Hedera testnet deployment

| Contract           | EVM address                                  | Explorer                                                          |
| ------------------ | -------------------------------------------- | ----------------------------------------------------------------- |
| InvoiceMarketplace | `0x975B3eE7B0085d1FC3Ef286D5e95B25101D0f364` | [0.0.10506252](https://hashscan.io/testnet/contract/0.0.10506252) |
| TestUSD            | `0x783b71AFBBfC814081E53bE19003b9400Fdd4EDb` | [0.0.10506250](https://hashscan.io/testnet/contract/0.0.10506250) |
| ATS receivable     | `0x48b2db5a2eaf3d99ab65d265f410854668ace50b` | [0.0.10506298](https://hashscan.io/testnet/contract/0.0.10506298) |

The custom contracts have exact creation/runtime source matches on [Sourcify](https://repo.sourcify.dev/296/0x975B3eE7B0085d1FC3Ef286D5e95B25101D0f364). The ATS assets were created through the official factory, not our compliance test double. The connected receivable is [0.0.10506750](https://hashscan.io/testnet/contract/0.0.10506750), asset `0x94a777e32bc8dc5d7dcb1f59d1ab08a7b14bacae`.

### Live ENSv2 and Uniswap evidence

- Business name: `invoicex-2026.eth`; invoice: `inv-001.invoicex-2026.eth` on **Sepolia**, not mainnet.
- [Finance officer publication](https://sepolia.etherscan.io/tx/0x6d7256f1276d5554131f44ace079306dc97b843344e4fde9f45d4256183b6302) and [revocation](https://sepolia.etherscan.io/tx/0x3e0d89770cda678046d4caad9ae083f967d6027e5bb027c5f750f6df62ce987e). The existing record remains readable after revocation; the officer cannot modify it.
- The published receivable completed [atomic financing](https://hashscan.io/testnet/transaction/0xba17c61f9563d19d7b0557d5e17d6c7bd9de053f37d7d19acfb5c5fdf6c4bcbe), repayment and [holder redemption](https://hashscan.io/testnet/transaction/0x4e183e7abc705425809384b06d8c183509fcab31f0ebbc3c7e7b6a9dddee8be3). [Connected lifecycle evidence](deployments/connected-lifecycle.json) records the completed flow and compliance rejection check.
- [Confirmed exact-output swap](https://sepolia.etherscan.io/tx/0x9ad7537b92e6c504178224b572df5560739e5f063b5076fb01608a575b5243a0): received exactly 0.1 freely mintable MockUSDC through actual Uniswap v3 contracts.
- The [test pool](https://sepolia.etherscan.io/address/0x63fd32b52bFAa9FdF89bc8257a092417406c5704) was seeded with 20 mock tokens and 0.01 test WETH. This artificial fixture ratio is not a market exchange rate. LP position #231987 belongs to the configured Sepolia owner.
- Reproduce with `scripts/ens-setup.ts`, `scripts/ens-demo.ts`, and `scripts/uniswap-demo.ts`, using `npx tsx --env-file-if-exists=.env`. Scripts are testnet-only and save public receipts. Do not create a second asset or LP position when resuming an existing run.

## Testnet setup

Copy `.env.example` to an ignored `.env` locally. Add keys there, **never in chat, browser forms, Git or a `VITE_` variable**. The browser app only needs public addresses; wallets sign transactions.

```sh
npm run check:chains
npm run deploy -- hedera  # deploys NEW contracts; unnecessary for the existing deployment
npm run ats -- create examples/ats-invoice.json  # creates a NEW asset
npm run ats -- inspect 0.0.10506298
npm run ats -- role <asset-id> <account-id> _ISSUER_ROLE
npm run ats -- issue <asset-id> <account-id>
```

For synthetic testnet onboarding, run `npx tsx --env-file-if-exists=.env scripts/ats-demo-setup.ts <asset-id>`. This enables actual ATS permissions and fixture KYC records; a generated investor key stays in ignored `work/`. Production onboarding must validate real credentials. The `ats kyc` command accepts an actual credential through the SDK.

For Sepolia, configure a funded wallet and an ENSv2 parent with a Permissioned Resolver. Use **Business identity** to inspect/grant/revoke invoice-record access. In **Integrations**, enter an output token with an actual liquid WETH v3 pool. Missing liquidity produces an error, not a fabricated rate.

## Scope and trust boundaries

- Testnets and synthetic receivables only. TestUSD is freely mintable and worthless. No real invoice assignment, debtor verification, legal enforceability, default recovery or guaranteed yield.
- ATS KYC fixtures demonstrate access controls, not identity verification or regulatory certification. Administrators can change compliance or pause transfers, potentially blocking redemption.
- ENS publication is enforced by the app, **not by the Hedera contract**. Direct contract callers can bypass it; no trustless Sepolia-to-Hedera proof is implemented. Root resolver authority may override narrower grants.
- A trusted admin verifies ATS provenance and approves assets. One unit per invoice; no fractional financing. Redeemed units stay in escrow and cannot be relisted.
- The UI loads the latest 100 listings. Browser storage is local, not a shared backend. Contracts are tested but unaudited. Keep the optional ATS CLI and its keys off public servers.

See [track requirements](docs/REQUIREMENTS.md), [submission checklist](docs/SUBMISSION.md), [copy-ready Uniswap form responses](docs/UNISWAP_FORM_RESPONSES.md), and the [four-minute recording guide](docs/DEMO_VIDEO.md). Feedback submission and the video remain required before claiming completion across all tracks. Eligibility is decided by the organizers.
