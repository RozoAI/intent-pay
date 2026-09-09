import test from "tape";
import { solana } from "../src/chain";
import { getKnownToken, solanaUSDT } from "../src/token";

test("finds Solana USDT by its native chain ID", (t) => {
  t.equal(solanaUSDT.chainId, solana.chainId, "Solana USDT belongs to Solana");
  t.equal(
    getKnownToken(solana.chainId, solanaUSDT.token)?.fiatISO,
    "USD",
    "Solana USDT resolves with its fiat currency",
  );
  t.end();
});
