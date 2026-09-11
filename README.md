# InvoiceX

InvoiceX is an onchain invoice-financing marketplace that helps businesses unlock working capital from unpaid invoices.

## Problem

Businesses often wait 30, 60, or 90 days for invoices to be paid, creating cash-flow gaps that can delay payroll, inventory purchases, and growth.

## Solution

InvoiceX lets a business tokenize an approved receivable and sell it to an investor at a discount. The business receives capital immediately, while the investor receives the invoice payment at maturity.

## Planned Sponsor Integrations

- **Hedera Asset Tokenization Studio:** Issue and manage tokenized invoices through their full lifecycle, including transfer controls and maturity settlement.
- **ENSv2:** Give businesses human-readable identities and hierarchical invoice names, such as `invoice-001.acme.eth`.
- **Uniswap:** Provide liquidity for exchanging tokenized receivables and stablecoins.

## MVP Flow

1. A business creates an invoice with its amount, debtor, due date, and financing price.
2. InvoiceX tokenizes the receivable on Hedera and links it to the business's ENSv2 identity.
3. An investor reviews the invoice and purchases it at a discount.
4. Ownership of the receivable transfers to the investor.
5. At maturity, the invoice is settled and the investor receives repayment.
