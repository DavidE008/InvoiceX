import { test } from "node:test";
import assert from "node:assert/strict";
import {
  moneyToUnits,
  invoiceCommitment,
  validateInvoice,
  transition,
} from "../src/domain/invoice.js";
import { seedInvoices } from "../src/domain/demo.js";

test("currency uses exact six-decimal units and rejects ambiguous inputs", () => {
  assert.equal(moneyToUnits("9700.01"), 9_700_010_000n);
  for (const value of ["0", "-1", "NaN", "1e3", "1.001", " 2", "1000000001"])
    assert.throws(() => moneyToUnits(value));
});
test("terms commitment is canonical and binds every economic field", () => {
  const item = seedInvoices()[0],
    original = invoiceCommitment(item);
  assert.equal(invoiceCommitment({ ...item, price: "9700.00" }), original);
  assert.notEqual(invoiceCommitment({ ...item, price: "9699" }), original);
  assert.notEqual(
    invoiceCommitment({ ...item, ensName: "inv-002.acme.eth" }),
    original,
  );
  assert.notEqual(
    invoiceCommitment({
      ...item,
      debtor: "0x2222222222222222222222222222222222222222",
    }),
    original,
  );
  assert.notEqual(
    invoiceCommitment({ ...item, dueDate: "2027-01-01" }),
    original,
  );
});
test("invoice validation rejects excess pricing, expired dates and non-subnames", () => {
  const item = seedInvoices()[0];
  assert.doesNotThrow(() => validateInvoice(item));
  assert.throws(() => validateInvoice({ ...item, price: "10001" }));
  assert.throws(() => validateInvoice({ ...item, dueDate: "2020-01-01" }));
  assert.throws(() => validateInvoice({ ...item, ensName: "acme.eth" }));
});
test("demo lifecycle is immutable and rejects replay and expired financing", () => {
  const item = seedInvoices()[0];
  const funded = transition(item, "finance");
  assert.equal(item.status, "Open");
  assert.equal(
    transition(transition(funded, "repay"), "claim").status,
    "Settled",
  );
  assert.throws(() => transition(funded, "finance"));
  assert.throws(() => transition(item, "claim"));
  assert.throws(() =>
    transition({ ...item, dueDate: "2020-01-01" }, "finance"),
  );
  assert.equal(transition(item, "cancel").status, "Cancelled");
});
