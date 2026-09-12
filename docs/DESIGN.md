# InvoiceX interface

Primary reference: generated 1536 × 1024 marketplace concept, September 12, 2026.

White content canvas; cool near-white sidebar; charcoal #101827 text; muted #647084; emerald #12634b actions; #deebe7 selected rows; #dce2e7 dividers. No imagery, overlays or gradients. The wordmark is plain text. Use a sans-serif system font, 40px page heading, 28px section headings, 16px content, 14px labels, 14–16px explicitly sized controls. At smaller desktop widths scale the heading to 32px.

The layout consists of a 256px sidebar, 72px header, 32px content gutters, an open summary strip, and a table with a 348px detail rail. Navigation: Marketplace, My invoices, Business identity, Integrations. Mobile uses compact navigation and stacks the detail rail below the list. Repeated primitives: buttons, inputs, status chips, table rows, definition lists and bordered sections. Icons use consistent 20px outlined Lucide symbols.

Allowed marketplace copy: InvoiceX; Workspace / Marketplace; Connect wallet; Put working capital in motion.; Finance approved receivables. Follow every step from issuance to repayment.; New invoice; Demo mode · Sample invoices, no real funds; Available to finance; Invoice face value; Open invoices; Invoice marketplace; Search businesses or invoices; All statuses; Business / Invoice; Face value; Finance price; Due date; Status; Invoice terms; Discount; Due in; Invoice lifecycle; Issued; Financed; Repaid; Finance invoice; Repayment depends on the debtor paying.; ETHOnline 2026; Demo workspace.

Required functional extensions: invoice creation dialog (business, namespace, debtor, face value, price, due date); explicit demo/testnet selector; transaction/error feedback; identity record delegation and revocation; testnet deployment configuration; treasury swap form; repayment and cancellation controls; activity receipts. These extend the same design system. Demo labels and balances must never appear as live chain evidence.

Architecture: App composition, Shell/navigation, Marketplace/table/detail, InvoiceForm, Identity, Integrations, invoice-domain helpers and separate chain adapters. All interface text and controls remain HTML/React.
