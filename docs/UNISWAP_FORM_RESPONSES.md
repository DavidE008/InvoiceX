# Uniswap Developer Feedback Form — copy-ready responses

Form: https://developers.uniswap.org/hackathon-feedback

These answers reflect the implementation that was executed on Sepolia. Replace the bracketed personal fields and choose the two ratings yourself. The project owner must personally accept the Terms of Service and Privacy Policy before submitting.

| Form field | Response |
| --- | --- |
| First name | `[your first name]` |
| Last name | `[your last name, optional]` |
| Email | `[your email]` |
| Telegram handle | `@[your handle]` |
| Which hackathon? | `ETHOnline 2026` |
| Did you complete a project? | `Yes` |
| What did you build? | `InvoiceX is an invoice-financing marketplace with a reusable Uniswap v3 exact-output treasury adapter. It compares all four fee tiers with QuoterV2, applies an upward-rounded maximum-input bound, and executes through SwapRouter02 with a deadline. Public project: https://github.com/DavidE008/InvoiceX — required feedback: https://github.com/DavidE008/InvoiceX/blob/main/FEEDBACK.md` |
| AI-powered or agentic? | `No` |
| Successfully integrate Uniswap? | `Yes` |
| Time to first successful integration | Choose the truthful elapsed-time option from the form. |
| Biggest blocker | `Sepolia contract availability did not guarantee a liquid pool. We created a reproducible MockUSDC/WETH fixture with the official NonfungiblePositionManager, then validated quote and swap behavior against actual Uniswap contracts.` |
| Hardest part of an agentic app | `Not applicable; InvoiceX is not presented as an agentic application.` |
| Documentation helpfulness | `[choose your own 1–5 rating]` |
| Overall support | `[choose your own 1–5 rating]` |
| Continue building? | `Yes` |
| Support used | `Technical docs` and `Code examples / templates` if these match your experience; select only what you actually used. |
| What support could improve? | `Add a current Sepolia exact-output SwapRouter02 example, including deadline-bearing multicall, testnet liquidity discovery, and wrapping only the WETH deficit.` |
| Additional feedback | `The per-chain deployment table was useful. A maintained testnet fixture guide would make end-to-end integration much faster. Full technical feedback: https://github.com/DavidE008/InvoiceX/blob/main/FEEDBACK.md` |
| Follow-up permission | Choose `Yes` or `No` yourself. |
| Terms and Privacy | Review and accept personally if you agree. |

After submission, save the confirmation URL or screenshot, then check the corresponding item in `docs/SUBMISSION.md`. Do not commit personal contact details to the repository.
