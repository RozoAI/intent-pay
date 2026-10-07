import test from "tape";
import { apiClient } from "../src/api/base";
import { buildCheckoutPayload, getFee, createPayment } from "../src/api/payment";
import { PaymentResponse } from "../src/api/types";
import { baseUSDC } from "../src/token";
import { base, solana, stellar } from "../src/chain";

const VALID_EVM_ADDRESS = "0xdC4313EfB37836615d820F38A6016EE76598887B";

/**
 * Core invariant: getFee builds the same request body as createPayment
 * for the same CreateNewPaymentParams input (minus the dryrun query param).
 * Every fee quote the user sees must match what createPayment will actually
 * charge — this is the invariant the whole intent-propagation-to-getFee
 * refactor rests on.
 */
test("getFee and createPayment use identical request body", (t) => {
  const params = {
    appId: "test-app",
    toChain: base.chainId,
    toToken: baseUSDC.token,
    toAddress: VALID_EVM_ADDRESS,
    preferredChain: base.chainId,
    preferredTokenAddress: baseUSDC.token,
    toUnits: "1",
    feeType: "EXACT_IN" as const,
    title: "Test Payment",
  };

  const bodies: unknown[] = [];
  const options: unknown[] = [];

  const originalPost = apiClient.post;
  apiClient.post = function <T>(url: string, body: unknown, opts?: Record<string, unknown>) {
    bodies.push(body);
    options.push(opts);
    // createPayment throws if data.id is missing; getFee checks for error in data
    return Promise.resolve({ data: { id: "mock-id" }, error: null, status: 200 });
  };

  createPayment(params)
    .then(() => getFee(params))
    .then(() => {
      apiClient.post = originalPost;

      t.equal(bodies.length, 2, "both functions made exactly one API call each");

      // Same request body — the core invariant
      t.deepEqual(
        bodies[0],
        bodies[1],
        "request body is identical between getFee and createPayment",
      );

      // getFee carries dryrun param; createPayment does not
      t.equal(
        (options[0] as Record<string, { dryrun: string }> | undefined)?.params?.dryrun,
        undefined,
        "createPayment has no dryrun param",
      );
      t.equal(
        (options[1] as Record<string, { dryrun: string }> | undefined)?.params?.dryrun,
        "true",
        "getFee has dryrun=true",
      );

      t.end();
    })
    .catch((err: Error) => {
      apiClient.post = originalPost;
      t.fail(`unexpected error: ${err.message}`);
      t.end();
    });
});

test("getFee and createPayment send backend-native source and destination addresses", (t) => {
  const sources = [
    { chain: 8453, address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "ETH", backendAddress: "0x0000000000000000000000000000000000000000", sourceAmount: "0.0025" },
    { chain: 56, address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "BNB", backendAddress: "0x0000000000000000000000000000000000000000", sourceAmount: "0.0025" },
    { chain: 137, address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "POL", backendAddress: "0x0000000000000000000000000000000000000000", sourceAmount: "5" },
    { chain: 501, address: "11111111111111111111111111111111", symbol: "SOL", backendAddress: "native", sourceAmount: "0.04" },
    { chain: 1500, address: "XLM", symbol: "XLM", backendAddress: "XLM", sourceAmount: "5" },
  ];
  type Body = { source: { chainId: number; tokenSymbol: string; tokenAddress: string; amount: string }; destination: { tokenAddress: string } };
  const originalPost = apiClient.post;
  const requests: Array<{ body: Body; dryrun?: string }> = [];
  apiClient.post = function <T>(url: string, body: unknown, opts?: Record<string, unknown>) {
    const dryrun = (opts?.params as { dryrun?: string })?.dryrun;
    requests.push({ body: body as Body, dryrun });
    return Promise.resolve({ data: dryrun ? { status: "ok" } : { id: "mock-id" }, error: null, status: 200 });
  };
  Promise.all(sources.map(async (source) => {
    const params = {
      appId: "test-app",
      toChain: base.chainId,
      toToken: baseUSDC.token,
      toAddress: VALID_EVM_ADDRESS,
      preferredChain: source.chain,
      preferredTokenAddress: source.address,
      // Native sources quote in source-token units, never the USD destination amount.
      preferredAmountUnits: source.sourceAmount,
      toUnits: "5",
    };
    await createPayment(params);
    return getFee(params);
  }))
    .then((responses) => {
      t.ok(responses.every((response) => !response.error), "native quotes reached API transport");
      t.equal(requests.length, sources.length * 2, "one create and one dryrun per source");
      for (const source of sources) {
        const create = requests.find((request) => request.body.source.tokenSymbol === source.symbol && !request.dryrun);
        const quote = requests.find((request) => request.body.source.tokenSymbol === source.symbol && request.dryrun === "true");
        t.ok(create && quote, `${source.symbol} create and quote both posted`);
        if (!create || !quote) continue;
        t.deepEqual(create.body, quote.body, `${source.symbol} getFee/createPayment body matches`);
        t.equal(quote.body.source.chainId, source.chain === 501 ? 900 : source.chain, `${source.symbol} source chain`);
        t.equal(quote.body.source.tokenAddress, source.backendAddress, `${source.symbol} backend source address`);
        t.equal(quote.body.source.amount, source.sourceAmount, `${source.symbol} source amount is native units, not USD`);
        t.equal(quote.body.destination.tokenAddress, baseUSDC.token, `${source.symbol} destination tokenAddress`);
      }
    })
    .catch((error: Error) => t.fail(error.message))
    .finally(() => {
      apiClient.post = originalPost;
      t.end();
    });
});

test("native source without a source amount is refused before transport", async (t) => {
  const originalPost = apiClient.post;
  let posted = 0;
  apiClient.post = function <T>() {
    posted += 1;
    return Promise.resolve({ data: { id: "mock-id" }, error: null, status: 200 });
  };
  try {
    await createPayment({
      appId: "test-app",
      toChain: base.chainId,
      toToken: baseUSDC.token,
      toAddress: VALID_EVM_ADDRESS,
      preferredChain: base.chainId,
      preferredTokenAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      toUnits: "5",
    });
    t.fail("native source without preferredAmountUnits should throw");
  } catch (error) {
    t.ok(
      (error as Error).message.includes("preferredAmountUnits"),
      "throws a source-amount error",
    );
  } finally {
    t.equal(posted, 0, "no request posted for an under-specified native source");
    apiClient.post = originalPost;
    t.end();
  }
});

test("getFee and createPayment — body matches for cross-chain payment with intent", (t) => {
  const params = {
    appId: "test-app",
    toChain: base.chainId,
    toToken: baseUSDC.token,
    toAddress: VALID_EVM_ADDRESS,
    preferredChain: 137 as const, // Polygon
    preferredTokenAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // Polygon USDC
    toUnits: "1",
    feeType: "EXACT_IN" as const,
    intent: "stellar_direct" as const,
    title: "Cross-chain Payment",
  };

  const originalPost = apiClient.post;
  const bodies: unknown[] = [];

  apiClient.post = function <T>(url: string, body: unknown) {
    bodies.push(body);
    // Return a mock with data.id on the first call (createPayment needs it),
    // and a fee response on the second call (getFee checks for error in data)
    return Promise.resolve(
      bodies.length === 1
        ? { data: { id: "mock-id" }, error: null, status: 200 }
        : {
            data: {
              status: "ok",
              type: "EXACT_IN",
              source: { chainId: "137", tokenSymbol: "USDC", amount: "1", fee: "0.01" },
              destination: { chainId: "8453", tokenSymbol: "USDC", amount: "1" },
              feeInfo: { feePercentage: "1", minimumFee: "0" },
            },
            error: null,
            status: 200,
          },
    );
  };

  createPayment(params)
    .then(() => getFee(params))
    .then(() => {
      apiClient.post = originalPost;

      t.equal(bodies.length, 2, "both functions made one call each");
      t.deepEqual(bodies[0], bodies[1], "cross-chain payment with intent: body is identical");

      t.end();
    })
    .catch((err: Error) => {
      apiClient.post = originalPost;
      t.fail(`unexpected error: ${err.message}`);
      t.end();
    });
});

test("buildCheckoutPayload emits backend-native source addresses", (t) => {
  const payment = {
    id: "pay-1",
    appId: "test-app",
    type: "EXACT_IN",
    source: {
      chainId: base.chainId,
      tokenSymbol: "ETH",
      tokenAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      amount: "0.7",
    },
    destination: {
      chainId: base.chainId,
      receiverAddress: VALID_EVM_ADDRESS,
      tokenSymbol: "USDC",
      tokenAddress: baseUSDC.token,
      amount: "0.7",
    },
    display: { currency: "USD", title: "Pay" },
    metadata: { appId: "test-app" },
  } as unknown as PaymentResponse;

  const cases = [
    {
      chainId: base.chainId,
      tokenSymbol: "ETH",
      tokenAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      expectedChain: base.chainId,
      expected: "0x0000000000000000000000000000000000000000",
    },
    {
      chainId: solana.chainId,
      tokenSymbol: "SOL",
      tokenAddress: "11111111111111111111111111111111",
      expectedChain: 900,
      expected: "native",
    },
    {
      chainId: stellar.chainId,
      tokenSymbol: "XLM",
      tokenAddress: "XLM",
      expectedChain: 1500,
      expected: "XLM",
    },
    {
      chainId: base.chainId,
      tokenSymbol: "USDC",
      tokenAddress: baseUSDC.token,
      expectedChain: base.chainId,
      expected: baseUSDC.token,
    },
  ];

  for (const c of cases) {
    const payload = buildCheckoutPayload(payment, {
      chainId: c.chainId,
      tokenSymbol: c.tokenSymbol,
      tokenAddress: c.tokenAddress,
      amount: "1",
    });
    t.equal(payload.source.chainId, c.expectedChain, `${c.tokenSymbol} source chain`);
    t.equal(payload.source.tokenAddress, c.expected, `${c.tokenSymbol} backend source address`);
  }
  t.end();
});
