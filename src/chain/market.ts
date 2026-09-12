import { erc20Abi, formatUnits, isAddress, parseAbi, type Address } from "viem";
import {
  publicClient,
  walletFor,
  confirmed,
  hederaTestnet,
  requireCode,
  type Config,
} from "./clients";
import {
  invoiceCommitment,
  moneyToUnits,
  type Invoice,
  type Status,
} from "../domain/invoice";
import { verifyInvoice } from "./ens";
export const marketAbi = parseAbi([
  "function invoiceCount() view returns (uint256)",
  "function paymentToken() view returns (address)",
  "function approvedIssuer(address) view returns (address)",
  "function invoices(uint256) view returns (address asset,address seller,address debtor,uint256 faceValue,uint256 price,uint64 dueDate,bytes32 commitment,string ensName,uint8 status)",
  "function list(address asset,address debtor,uint256 faceValue,uint256 price,uint64 dueDate,bytes32 commitment,string ensName) returns (uint256)",
  "function finance(uint256 id)",
  "function repay(uint256 id)",
  "function claim(uint256 id)",
  "function cancel(uint256 id)",
  "function approveAsset(address asset,address issuer)",
]);
export async function marketAddress(config: Config): Promise<Address> {
  if (!isAddress(config.market) || !isAddress(config.payment))
    throw new Error(
      "Set the deployed Hedera marketplace and payment token in Integrations.",
    );
  await requireCode(config.market, hederaTestnet, config);
  const client = publicClient(hederaTestnet, config);
  const payment = await client.readContract({
    address: config.market,
    abi: marketAbi,
    functionName: "paymentToken",
  });
  if (payment.toLowerCase() !== config.payment.toLowerCase())
    throw new Error(
      "Configured payment token differs from the marketplace payment token.",
    );
  const decimals = await client.readContract({
    address: payment,
    abi: erc20Abi,
    functionName: "decimals",
  });
  if (decimals !== 6)
    throw new Error("InvoiceX requires a six-decimal payment token.");
  return config.market;
}
export async function loadInvoices(config: Config): Promise<Invoice[]> {
  const address = await marketAddress(config),
    client = publicClient(hederaTestnet, config);
  const count = await client.readContract({
    address,
    abi: marketAbi,
    functionName: "invoiceCount",
  });
  const statuses: Status[] = [
    "Open",
    "Open",
    "Financed",
    "Repaid",
    "Settled",
    "Cancelled",
  ];
  const items: Invoice[] = [];
  // Bound each refresh; recent 100 listings suffice for the hackathon UI.
  for (
    let end = Number(count);
    end > Math.max(0, Number(count) - 100);
    end -= 10
  ) {
    const ids = Array.from(
      { length: Math.min(10, end, 100 - items.length) },
      (_, i) => end - i,
    );
    items.push(
      ...(await Promise.all(
        ids.map(async (id) => {
          const [
            asset,
            seller,
            debtor,
            faceValue,
            price,
            dueDate,
            commitment,
            ensName,
            state,
          ] = await client.readContract({
            address,
            abi: marketAbi,
            functionName: "invoices",
            args: [BigInt(id)],
          });
          const holder = await client.readContract({
            address: asset,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [seller],
          });
          return {
            id: String(id),
            business: ensName.split(".").slice(1).join("."),
            ensName,
            asset,
            seller,
            debtor,
            faceValue: formatUnits(faceValue, 6),
            price: formatUnits(price, 6),
            dueDate: new Date(Number(dueDate) * 1000).toISOString(),
            commitment,
            status: statuses[state],
            activity: [],
            ...(holder === 1n ? { holder: seller } : {}),
          };
        }),
      )),
    );
  }
  return items;
}
async function approve(token: Address, amount: bigint, config: Config) {
  const address = await marketAddress(config),
    wallet = await walletFor(hederaTestnet),
    client = publicClient(hederaTestnet, config);
  const current = await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [wallet.account.address, address],
  });
  if (current >= amount) return;
  if (current > 0n)
    await confirmed(
      await wallet.writeContract({
        address: token,
        abi: erc20Abi,
        functionName: "approve",
        args: [address, 0n],
      }),
      hederaTestnet,
      config,
    );
  await confirmed(
    await wallet.writeContract({
      address: token,
      abi: erc20Abi,
      functionName: "approve",
      args: [address, amount],
    }),
    hederaTestnet,
    config,
  );
}
export async function listInvoice(item: Invoice, config: Config) {
  await verifyInvoice(item, config);
  const address = await marketAddress(config),
    wallet = await walletFor(hederaTestnet),
    client = publicClient(hederaTestnet, config);
  if (wallet.account.address.toLowerCase() !== item.seller.toLowerCase())
    throw new Error("Connect the invoice issuer wallet.");
  await approve(item.asset, 1n, config);
  const { request } = await client.simulateContract({
    address,
    abi: marketAbi,
    functionName: "list",
    args: [
      item.asset,
      item.debtor,
      moneyToUnits(item.faceValue),
      moneyToUnits(item.price),
      BigInt(Math.floor(Date.parse(item.dueDate) / 1000)),
      invoiceCommitment(item),
      item.ensName,
    ],
    account: wallet.account,
  });
  return confirmed(await wallet.writeContract(request), hederaTestnet, config);
}
export async function actOnInvoice(
  item: Invoice,
  action: "finance" | "repay" | "claim" | "cancel",
  config: Config,
) {
  // ENS changes block new financing. They never block repayment/redemption of an existing position.
  if (action === "finance") await verifyInvoice(item, config);
  const address = await marketAddress(config);
  if (action === "finance" || action === "repay")
    await approve(
      config.payment as Address,
      moneyToUnits(action === "finance" ? item.price : item.faceValue),
      config,
    );
  if (action === "claim") await approve(item.asset, 1n, config);
  const wallet = await walletFor(hederaTestnet),
    client = publicClient(hederaTestnet, config);
  const { request } = await client.simulateContract({
    address,
    abi: marketAbi,
    functionName: action,
    args: [BigInt(item.id)],
    account: wallet.account,
  });
  return confirmed(await wallet.writeContract(request), hederaTestnet, config);
}
