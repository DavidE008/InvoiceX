# InvoiceX

InvoiceX is an onchain invoice-financing marketplace that helps businesses unlock working capital from unpaid invoices.

## Problem

Businesses often wait 30, 60, or 90 days for invoices to be paid, creating cash-flow gaps that can delay payroll, inventory purchases, and growth.

## Solution

InvoiceX lets a business tokenize an approved receivable and sell it to an investor at a discount. The business receives capital immediately, while the investor receives the invoice payment at maturity.

## Sponsor integrations

- **Hedera Asset Tokenization Studio:** Actual ATS 8 SDK bond creation/issuance, role and KYC configuration, atomic asset/payment exchange, repayment and holder redemption. [SDK CLI](scripts/ats.ts), [testnet setup](scripts/ats-demo-setup.ts), [marketplace contract](contracts/InvoiceMarketplace.sol), [receipts](deployments/).
- **ENSv2:** Per-invoice `org.invoicex.invoice` authorization through the Permissioned Resolver; grant/revoke finance-officer access and verify canonical invoice commitments before listing and financing. [Adapter](src/chain/ens.ts), [identity screen](src/components/Identity.tsx). Live Sepolia delegation/publication proof is pending a funded wallet and configured ENSv2 name.
- **Uniswap:** Exact-output treasury swaps using QuoterV2 and SwapRouter02, four fee tiers, bounded input/approval and deadlines. [Reusable adapter](src/chain/uniswap.ts), [treasury screen](src/components/Integrations.tsx), [developer feedback](FEEDBACK.md). Live Sepolia swap and feedback-form submission remain pending.

Uniswap is a separate Sepolia treasury operation, not liquidity for the restricted ATS asset and not a bridge to Hedera. This MVP does not claim cross-chain atomic settlement.

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

The custom contracts have exact creation/runtime source matches on [Sourcify](https://repo.sourcify.dev/296/0x975B3eE7B0085d1FC3Ef286D5e95B25101D0f364). The ATS asset was created through the official factory, not our compliance test double.

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

See [track requirements](docs/REQUIREMENTS.md) and [submission checklist](docs/SUBMISSION.md). Live ENS/Uniswap evidence, feedback submission and the video remain required before claiming completion across all tracks. Eligibility is decided by the organizers.
