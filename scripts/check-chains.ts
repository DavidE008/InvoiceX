import { createPublicClient, http } from "viem";
import { hederaTestnet, sepolia } from "viem/chains";
const targets = [
  {
    chain: hederaTestnet,
    url: process.env.HEDERA_RPC_URL || "https://testnet.hashio.io/api",
    address: "0x474a6b1fa5dcfb636ad0fdf7373f323c9d41bd6e" as const,
  },
  {
    chain: sepolia,
    url:
      process.env.SEPOLIA_RPC_URL ||
      "https://ethereum-sepolia-rpc.publicnode.com",
    address: "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3" as const,
  },
];
for (const target of targets) {
  try {
    const client = createPublicClient({
      chain: target.chain,
      transport: http(target.url, { timeout: 15_000, retryCount: 0 }),
    });
    const [chainId, block] = await Promise.all([
      client.getChainId(),
      client.getBlockNumber(),
    ]);
    if (chainId !== target.chain.id) throw new Error("Wrong chain");
    const code = await client.getCode({ address: target.address });
    console.log(
      `${target.chain.name}: chain ${chainId}, block ${block}, ${target.address}: ${code && code !== "0x" ? "contract present" : "account"}`,
    );
  } catch (error) {
    console.error(
      `${target.chain.name}: ${(error as Error).message.split("\n")[0]}`,
    );
    process.exitCode = 1;
  }
}
