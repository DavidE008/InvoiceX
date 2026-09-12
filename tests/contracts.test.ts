import { test } from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import { BrowserProvider, ContractFactory, keccak256, toUtf8Bytes } from 'ethers';
import { compile } from '../scripts/compile.js';

const compiled = compile().contracts;
async function fixture() {
  const chain = ganache.provider({ logging: { quiet: true }, chain: { chainId: 1337 } });
  const provider = new BrowserProvider(chain as any);
  provider.pollingInterval = 10;
  const [admin, investor, debtor, secondary] = await Promise.all([0, 1, 2, 3].map(i => provider.getSigner(i)));
  async function deploy(path: string, name: string, args: unknown[] = []) {
    const artifact = compiled[path][name];
    const contract = await new ContractFactory(artifact.abi, artifact.evm.bytecode.object, admin).deploy(...args);
    await contract.waitForDeployment();
    return contract as any;
  }
  const usd = await deploy('contracts/TestUSD.sol', 'TestUSD');
  const asset = await deploy('contracts/test/ComplianceAsset.sol', 'ComplianceAsset', [admin.address]);
  const market = await deploy('contracts/InvoiceMarketplace.sol', 'InvoiceMarketplace', [await usd.getAddress(), admin.address]);
  const marketAddress = await market.getAddress();
  await (await asset.setKyc(marketAddress, true)).wait();
  await (await market.approveAsset(await asset.getAddress(), admin.address)).wait();
  await (await asset.approve(marketAddress, 1)).wait();
  const due = BigInt((await provider.getBlock('latest'))!.timestamp + 86400);
  const commitment = keccak256(toUtf8Bytes('invoice-one'));
  const terms = [await asset.getAddress(), debtor.address, 10_000_000n, 9_700_000n, due, commitment];
  await (await usd.mint(investor.address, 30_000_000n)).wait();
  await (await usd.connect(investor).approve(marketAddress, 30_000_000n)).wait();
  return { chain, admin, investor, debtor, secondary, usd, asset, market, marketAddress, terms };
}

test('atomic financing, compliant secondary transfer, and repayment to current holder', async () => {
  const f = await fixture();
  try {
    await (await f.market.list(...f.terms)).wait();
    await (await f.asset.setKyc(f.investor.address, true)).wait();
    await (await f.market.connect(f.investor).finance(1)).wait();
    assert.equal(await f.usd.balanceOf(f.admin.address), 9_700_000n);
    assert.equal(await f.asset.balanceOf(f.investor.address), 1n);
    await (await f.asset.setKyc(f.secondary.address, true)).wait();
    await (await f.asset.connect(f.investor).transfer(f.secondary.address, 1)).wait();
    await (await f.usd.mint(f.debtor.address, 10_000_000n)).wait();
    await (await f.usd.connect(f.debtor).approve(f.marketAddress, 10_000_000n)).wait();
    await (await f.market.connect(f.debtor).repay(1)).wait();
    await assert.rejects(f.market.connect(f.investor).claim.staticCall(1));
    await (await f.asset.connect(f.secondary).approve(f.marketAddress, 1)).wait();
    await (await f.market.connect(f.secondary).claim(1)).wait();
    assert.equal(await f.usd.balanceOf(f.secondary.address), 10_000_000n);
    assert.equal((await f.market.invoices(1)).status, 4n);
    await assert.rejects(f.market.connect(f.secondary).claim.staticCall(1));
    await assert.rejects(f.market.connect(f.debtor).repay.staticCall(1));
  } finally { await f.chain.disconnect(); }
});

test('ATS compliance failure rolls back funds, ownership, and state', async () => {
  const f = await fixture();
  try {
    await (await f.market.list(...f.terms)).wait();
    await assert.rejects(f.market.connect(f.investor).finance.staticCall(1));
    assert.equal(await f.usd.balanceOf(f.investor.address), 30_000_000n);
    assert.equal(await f.usd.balanceOf(f.admin.address), 0n);
    assert.equal(await f.asset.balanceOf(f.marketAddress), 1n);
    assert.equal((await f.market.invoices(1)).status, 1n);
  } finally { await f.chain.disconnect(); }
});

test('reject unauthorized issuer, duplicate listing, invalid terms, self-finance and non-seller cancellation', async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.market.connect(f.investor).list.staticCall(...f.terms));
    await assert.rejects(f.market.list.staticCall(...f.terms.slice(0, 3), 0, ...f.terms.slice(4)));
    await (await f.market.list(...f.terms)).wait();
    await assert.rejects(f.market.list.staticCall(...f.terms));
    await assert.rejects(f.market.finance.staticCall(1));
    await assert.rejects(f.market.connect(f.investor).cancel.staticCall(1));
    await (await f.market.cancel(1)).wait();
    assert.equal(await f.asset.balanceOf(f.admin.address), 1n);
    await assert.rejects(f.market.connect(f.investor).finance.staticCall(1));
  } finally { await f.chain.disconnect(); }
});

test('expired invoices cannot be financed and non-open invoices cannot be cancelled', async () => {
  const f = await fixture();
  try {
    await (await f.market.list(...f.terms)).wait();
    await f.chain.request({ method: 'evm_increaseTime', params: [86401] });
    await f.chain.request({ method: 'evm_mine', params: [] });
    await assert.rejects(f.market.connect(f.investor).finance.staticCall(1));
    await assert.rejects(f.market.repay.staticCall(1));
    await assert.rejects(f.market.cancel.staticCall(999));
  } finally { await f.chain.disconnect(); }
});
