# ETHOnline 2026 track requirements

Verified against the official prize pages on September 12, 2026. All implementation work follows the initial README-only commit.

## Hedera — Tokenization of Anything

Source: https://ethglobal.com/events/ethonline2026/prizes/hedera

- Use Asset Tokenization Studio to issue/manage receivables.
- Demonstrate on Hedera testnet, including issuance, configuration and a lifecycle operation.
- Public repository; verify applicable contracts on HashScan.
- Provide a video of at most five minutes.

Implementation: ATS bond issuance, KYC and transfer controls; a delivery-versus-payment marketplace contract; repayment to the current financed position holder. Testnet receipts and video are required evidence, not satisfied by unit tests or demo fixtures.

## ENS — Best Use of ENSv2

Source: https://ethglobal.com/events/ethonline2026/prizes/ens

- Use ENSv2 on Sepolia as a central, functional product dependency.
- Public code and a video or live demo (ideally both).

Implementation: invoice metadata commitments published through the business's Permissioned Resolver; per-record authority delegated to a finance officer with authorizeTextRoles; revocation prevents further publication. Resolve live through the Universal Resolver and discover the current resolver before every write. No legacy NameWrapper integration.

## Uniswap — Best Uniswap Stack Contribution

Source: https://ethglobal.com/events/ethonline2026/prizes/uniswap-foundation

- A meaningful integration with the Uniswap stack.
- Public open-source code, FEEDBACK.md and submitted Developer Feedback Form linking to that file.
- README pointers to the integration code/contracts.

Implementation: reusable exact-output treasury funding using Uniswap v3 QuoterV2 and SwapRouter02 on Sepolia, with bounded input, expiring quotes and confirmed swaps. Funds remain on Sepolia: this is not a bridge to Hedera and does not mark a Hedera invoice financed.

## Delivery milestones

1. Requirements, architecture and reproducible project scaffold.
2. Invoice lifecycle contracts and meaningful adversarial tests.
3. ATS, ENSv2 and Uniswap adapters with deployment tooling.
4. Marketplace UI and wallet-driven flows.
5. Browser verification, setup guide, feedback and submission evidence checklist.

Push each verified milestone separately. Never claim live deployment, contract verification, feedback submission or video completion without evidence.
