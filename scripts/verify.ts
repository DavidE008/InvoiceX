import { compile } from "./compile.js";
import { readFileSync, writeFileSync } from "node:fs";
import solc from "solc";

if (process.argv[2] === "status") {
  const jobs = JSON.parse(
    readFileSync("deployments/verification.json", "utf8"),
  );
  for (const job of jobs) {
    const response = await fetch(
      `https://sourcify.dev/server/v2/verify/${job.result.verificationId}`,
    );
    if (!response.ok)
      throw new Error(`Verification lookup failed: ${response.status}`);
    job.verification = await response.json();
    console.log(job.name, job.verification.contract?.match || "pending");
  }
  writeFileSync("deployments/verification.json", JSON.stringify(jobs, null, 2));
} else {
  const input = compile().input;
  const targets = [
    {
      name: "TestUSD",
      address: "0x783b71AFBBfC814081E53bE19003b9400Fdd4EDb",
      hash: "0x24ebcdd0eb95db06f3e3151da779a454314a483c49ebbb87e39d825f17608687",
    },
    {
      name: "InvoiceMarketplace",
      address: "0x975B3eE7B0085d1FC3Ef286D5e95B25101D0f364",
      hash: "0x01744845c5c4196300712a96a08e287f87df79eee5939e030a09cc542d9c58c9",
    },
  ];
  const results = [];
  for (const target of targets) {
    const response = await fetch(
      `https://sourcify.dev/server/v2/verify/296/${target.address}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stdJsonInput: input,
          compilerVersion: solc.version().split(".Emscripten")[0],
          contractIdentifier: `contracts/${target.name}.sol:${target.name}`,
          creationTransactionHash: target.hash,
        }),
      },
    );
    const result = await response.json();
    results.push({
      name: target.name,
      address: target.address,
      status: response.status,
      result,
    });
    console.log(target.name, response.status, JSON.stringify(result));
    writeFileSync(
      "deployments/verification.json",
      JSON.stringify(results, null, 2),
    );
    if (!response.ok && response.status !== 409)
      throw new Error(`Verification submission failed: ${response.status}`);
  }
}
