import test from "tape";
import { apiClient } from "../src/api/base";
import { getFee, createPayment } from "../src/api/payment";
import { baseUSDC } from "../src/token";
import { base } from "../src/chain";

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
    { chain: 8453, address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "ETH", backendAddress: "0x0000000000000000000000000000000000000000" },
    { chain: 56, address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "BNB", backendAddress: "0x0000000000000000000000000000000000000000" },
    { chain: 137, address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "POL", backendAddress: "0x0000000000000000000000000000000000000000" },
    { chain: 501, address: "11111111111111111111111111111111", symbol: "SOL", backendAddress: "native" },
    { chain: 1500, address: "XLM", symbol: "XLM", backendAddress: "XLM" },
  ];
  type Body = { source: { chainId: number; tokenSymbol: string; tokenAddress: string }; destination: { tokenAddress: string } };
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
        t.equal(quote.body.destination.tokenAddress, baseUSDC.token, `${source.symbol} destination tokenAddress`);
      }
    })
    .catch((error: Error) => t.fail(error.message))
    .finally(() => {
      apiClient.post = originalPost;
      t.end();
    });
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
