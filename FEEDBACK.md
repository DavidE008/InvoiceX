# Uniswap developer feedback — InvoiceX

Project: https://github.com/DavidE008/InvoiceX

## What we built

An exact-output treasury adapter for businesses that know their target token amount. `src/chain/uniswap.ts` compares fee tiers 100, 500, 3000 and 10000 through QuoterV2, selects the lowest successful input quote, applies a slippage cap, and executes through Sepolia SwapRouter02. The UI displays expected input, maximum input, pool fee and expiry.

Sepolia treasury swaps are separate from Hedera invoice financing. We do not put permissioned ATS receivables in permissionless pools or claim a bridge exists.

## Developer experience

- The per-chain deployment table helps avoid assuming mainnet addresses work everywhere.
- An exact-output example specifically for **SwapRouter02** would help. Its `exactOutputSingle` tuple has no deadline field, unlike older router examples; our adapter uses deadline-bearing `multicall`.
- A maintained testnet fixture guide with known liquid pools and reproducible liquidity seeding would reduce onboarding uncertainty. Contract availability alone does not establish usable liquidity.
- Quotes cannot remove execution risk: pool state can change, so our UI uses short expiry and maximum spend limits.
- A shared recipe for wrapping only the WETH deficit before exact-output execution would help teams avoid unnecessarily wrapping the user's entire maximum input.

## Validation status

Implemented and type-checked; network and deployment-code presence checked. A funded Sepolia wallet, liquid output-token pool and executed swap receipt are still required before claiming live end-to-end success. These are implementation observations, not a completed liquidity benchmark.

## Required feedback form

Form: https://developers.uniswap.org/hackathon-feedback

File URL: https://github.com/DavidE008/InvoiceX/blob/main/FEEDBACK.md

**Not submitted yet.** No external submission or organizer acceptance is claimed.
