import { erc20Abi, parseAbi, parseUnits, isAddress, type Address } from 'viem';
import { publicClient, walletFor, confirmed, requireCode, sepolia, type Config } from './clients';
// Official Sepolia deployment table: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-ethereum-deployments
export const UNISWAP = {
  factory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c',
  quoter: '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3',
  router: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
  weth: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14',
} as const;
export const quoterAbi = parseAbi(['function quoteExactOutputSingle((address tokenIn,address tokenOut,uint256 amount,uint24 fee,uint160 sqrtPriceLimitX96) params) returns (uint256 amountIn,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)']);
export const routerAbi = parseAbi([
  'function exactOutputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountOut,uint256 amountInMaximum,uint160 sqrtPriceLimitX96) params) payable returns (uint256 amountIn)',
  'function multicall(uint256 deadline,bytes[] data) payable returns (bytes[] results)',
]);
export interface TreasuryQuote { tokenOut: Address; amountOut: bigint; amountIn: bigint; maxInput: bigint; fee: number; expiresAt: number; decimals: number; symbol: string; rpc: string }
export function maximumInput(amount: bigint, slippageBps: number) {
  if (!Number.isInteger(slippageBps) || slippageBps < 1 || slippageBps > 300) throw new Error('Slippage must be between 0.01% and 3%.');
  return (amount * BigInt(10_000 + slippageBps) + 9_999n) / 10_000n;
}
export async function quoteTreasury(amount: string, slippageBps: number, config: Config): Promise<TreasuryQuote> {
  if (!isAddress(config.outputToken) || config.outputToken.toLowerCase() === UNISWAP.weth) throw new Error('Set a valid Sepolia output token, different from WETH, in Integrations.');
  if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) throw new Error('Enter a positive output amount.');
  const tokenOut = config.outputToken;
  await requireCode(tokenOut, sepolia, config);
  const client = publicClient(sepolia, config);
  const [decimals, symbol] = await Promise.all([
    client.readContract({ address: tokenOut, abi: erc20Abi, functionName: 'decimals' }),
    client.readContract({ address: tokenOut, abi: erc20Abi, functionName: 'symbol' }),
  ]);
  if ((amount.split('.')[1]?.length ?? 0) > decimals) throw new Error(`Output token supports ${decimals} decimals.`);
  const amountOut = parseUnits(amount, decimals);
  const quotes = await Promise.allSettled([100, 500, 3000, 10000].map(async fee => {
    const result = await client.simulateContract({ address: UNISWAP.quoter, abi: quoterAbi, functionName: 'quoteExactOutputSingle',
      args: [{ tokenIn: UNISWAP.weth, tokenOut, amount: amountOut, fee, sqrtPriceLimitX96: 0n }] });
    return { fee, amountIn: result.result[0] };
  }));
  const available = quotes.flatMap(q => q.status === 'fulfilled' && q.value.amountIn > 0n ? [q.value] : []).sort((a, b) => a.amountIn < b.amountIn ? -1 : 1);
  if (!available.length) throw new Error('No executable Uniswap v3 liquidity found for this amount on Sepolia. Try a smaller amount or another output token.');
  return { ...available[0], tokenOut, amountOut, maxInput: maximumInput(available[0].amountIn, slippageBps), expiresAt: Date.now() + 120_000, decimals, symbol, rpc: config.sepoliaRpc };
}
export async function executeTreasury(quote: TreasuryQuote, config: Config) {
  if (Date.now() >= quote.expiresAt) throw new Error('Quote expired. Request a fresh quote.');
  if (quote.tokenOut.toLowerCase() !== config.outputToken.toLowerCase() || quote.rpc !== config.sepoliaRpc) throw new Error('Configuration changed. Request a fresh quote.');
  const client = publicClient(sepolia, config), wallet = await walletFor(sepolia);
  const balance = await client.readContract({ address: UNISWAP.weth, abi: erc20Abi, functionName: 'balanceOf', args: [wallet.account.address] });
  if (balance < quote.maxInput) {
    const hash = await wallet.writeContract({ address: UNISWAP.weth, abi: parseAbi(['function deposit() payable']), functionName: 'deposit', value: quote.maxInput - balance });
    await confirmed(hash, sepolia, config);
  }
  const allowance = await client.readContract({ address: UNISWAP.weth, abi: erc20Abi, functionName: 'allowance', args: [wallet.account.address, UNISWAP.router] });
  if (allowance < quote.maxInput) await confirmed(await wallet.writeContract({ address: UNISWAP.weth, abi: erc20Abi, functionName: 'approve', args: [UNISWAP.router, quote.maxInput] }), sepolia, config);
  if (Date.now() >= quote.expiresAt) throw new Error('Quote expired during wallet approvals. Wrapped ETH remains in your wallet; request a fresh quote.');
  const { encodeFunctionData } = await import('viem');
  const data = encodeFunctionData({ abi: routerAbi, functionName: 'exactOutputSingle', args: [{ tokenIn: UNISWAP.weth, tokenOut: quote.tokenOut,
    fee: quote.fee, recipient: wallet.account.address, amountOut: quote.amountOut, amountInMaximum: quote.maxInput, sqrtPriceLimitX96: 0n }] });
  const { request } = await client.simulateContract({ address: UNISWAP.router, abi: routerAbi, functionName: 'multicall',
    args: [BigInt(Math.floor(quote.expiresAt / 1000)), [data]], account: wallet.account });
  return confirmed(await wallet.writeContract(request), sepolia, config);
}
