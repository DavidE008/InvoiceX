import assert from "node:assert/strict";
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  parseEther,
  ZeroAddress,
} from "ethers";
import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { defaultConfig } from "../src/chain/clients.js";
import {
  UNISWAP,
  quoteTreasury,
  executeTreasury,
} from "../src/chain/uniswap.js";

// 0.01 test ETH and 20 freely mintable ENS MockUSDC seed a real Uniswap v3 pool.
// The ratio is an artificial test fixture, not an exchange rate or real-dollar quote.
const provider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
if ((await provider.getNetwork()).chainId !== 11155111n)
  throw new Error("Sepolia only.");
const signer = new Wallet(process.env.SEPOLIA_PRIVATE_KEY!, provider);
const tokenAddress = "0x768f42455a2d082e23ceef7d51e5787c82d67a39";
const managerAddress = "0x1238536071E1c677A632429e3655c799b22cDA52";
const token = new Contract(
  tokenAddress,
  [
    "function mint(address,uint256)",
    "function approve(address,uint256) returns(bool)",
    "function balanceOf(address) view returns(uint256)",
  ],
  signer,
);
const weth = new Contract(
  UNISWAP.weth,
  [
    "function deposit() payable",
    "function approve(address,uint256) returns(bool)",
    "function balanceOf(address) view returns(uint256)",
  ],
  signer,
);
const factory = new Contract(
  UNISWAP.factory,
  ["function getPool(address,address,uint24) view returns(address)"],
  provider,
);
const manager = new Contract(
  managerAddress,
  [
    "function createAndInitializePoolIfNecessary(address token0,address token1,uint24 fee,uint160 sqrtPriceX96) payable returns(address pool)",
    "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline)) payable returns(uint256 tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)",
    "event IncreaseLiquidity(uint256 indexed tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)",
  ],
  signer,
);
const file = "deployments/uniswap-sepolia.json";
const state = existsSync(file)
  ? JSON.parse(readFileSync(file, "utf8"))
  : {
      chainId: 11155111,
      owner: signer.address,
      tokenOut: tokenAddress,
      positionManager: managerAddress,
      note: "Real Uniswap contracts, synthetic test liquidity. No monetary value or bridge.",
      transactions: [],
    };
assert.equal(state.owner, signer.address);
const save = () => writeFileSync(file, JSON.stringify(state, null, 2));
async function record(label: string, pending: Promise<any>) {
  const tx = await pending;
  state.transactions.push({ label, hash: tx.hash, status: "pending" });
  save();
  const receipt = await tx.wait();
  assert.equal(receipt.status, 1);
  state.transactions.at(-1).status = "success";
  save();
  console.log(`${label}: ${tx.hash}`);
  return receipt;
}
function sqrt(value: bigint): bigint {
  if (value < 2n) return value;
  let x = value,
    y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + value / x) / 2n;
  }
  return x;
}
const tokenAmount = 20_000_000n,
  wethAmount = parseEther("0.01");
if (!state.positionId) {
  if ((await token.balanceOf(signer.address)) < tokenAmount)
    await record(
      "Mint free test USDC",
      token.mint(signer.address, tokenAmount),
    );
  const balance = await weth.balanceOf(signer.address);
  if (balance < wethAmount)
    await record(
      "Wrap 0.01 test ETH liquidity",
      weth.deposit({ value: wethAmount - balance }),
    );
  if (
    (await factory.getPool(tokenAddress, UNISWAP.weth, 3000)) === ZeroAddress
  ) {
    await record(
      "Initialize synthetic test pool",
      manager.createAndInitializePoolIfNecessary(
        tokenAddress,
        UNISWAP.weth,
        3000,
        sqrt((wethAmount << 192n) / tokenAmount),
      ),
    );
  }
  state.pool = await factory.getPool(tokenAddress, UNISWAP.weth, 3000);
  save();
  await record(
    "Approve test USDC liquidity",
    token.approve(managerAddress, tokenAmount),
  );
  await record(
    "Approve WETH liquidity",
    weth.approve(managerAddress, wethAmount),
  );
  const receipt = await record(
    "Mint full-range LP position",
    manager.mint({
      token0: tokenAddress,
      token1: UNISWAP.weth,
      fee: 3000,
      tickLower: -887220,
      tickUpper: 887220,
      amount0Desired: tokenAmount,
      amount1Desired: wethAmount,
      amount0Min: (tokenAmount * 9n) / 10n,
      amount1Min: (wethAmount * 9n) / 10n,
      recipient: signer.address,
      deadline: Math.floor(Date.now() / 1000) + 600,
    }),
  );
  const event = receipt.logs
    .map((log: any) => {
      try {
        return manager.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((log: any) => log?.name === "IncreaseLiquidity");
  assert.ok(event);
  state.positionId = String(event.args.tokenId);
  save();
}
if (!state.swapReceipt) {
  const config = {
    ...defaultConfig,
    outputToken: tokenAddress,
    sepoliaRpc: process.env.SEPOLIA_RPC_URL!,
  };
  const quote = await quoteTreasury("0.1", 50, config);
  state.quote = JSON.parse(
    JSON.stringify(quote, (_, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  );
  save();
  const before = await token.balanceOf(signer.address);
  const wallet = createWalletClient({
    account: privateKeyToAccount(signer.privateKey as Hex),
    chain: sepolia,
    transport: http(config.sepoliaRpc),
  });
  const hash = await executeTreasury(quote, config, wallet);
  state.swapReceipt = hash;
  save();
  const after = await token.balanceOf(signer.address);
  assert.equal(after - before, 100_000n);
  state.received = String(after - before);
  state.exactOutputVerified = true;
  save();
  console.log(`Verified exact-output swap: ${hash}`);
}
console.log(
  JSON.stringify({
    pool: state.pool,
    positionId: state.positionId,
    swapReceipt: state.swapReceipt,
    exactOutputVerified: state.exactOutputVerified,
  }),
);
