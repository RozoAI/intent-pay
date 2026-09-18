import test from "tape";
import { rozoStellar, solana } from "../src/chain";
import { getKnownToken, rozoStellarUSDT0, solanaUSDT } from "../src/token";

test("finds Solana USDT by its native chain ID", (t) => {
  t.equal(solanaUSDT.chainId, solana.chainId, "Solana USDT belongs to Solana");
  t.equal(
    getKnownToken(solana.chainId, solanaUSDT.token)?.fiatISO,
    "USD",
    "Solana USDT resolves with its fiat currency",
  );
  t.end();
});

test("finds Stellar USDT0 by its Rozo Stellar chain ID", (t) => {
  t.equal(rozoStellarUSDT0.chainId, rozoStellar.chainId, "USDT0 belongs to Rozo Stellar");
  t.equal(
    getKnownToken(rozoStellar.chainId, rozoStellarUSDT0.token)?.symbol,
    "USDT0",
    "Stellar USDT0 resolves by CODE:ISSUER address",
  );
  t.end();
});
