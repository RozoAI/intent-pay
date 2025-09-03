import {
  DepositAddressPaymentOptionMetadata,
  DepositAddressPaymentOptions,
  RozoPayOrderMode,
} from "@rozoai/intent-common";
import { useEffect, useState } from "react";
import { TrpcClient } from "../utils/trpc";

export function useDepositAddressOptions({
  trpc,
  usdRequired,
  mode,
}: {
  trpc: TrpcClient;
  usdRequired: number | undefined;
  mode: RozoPayOrderMode | undefined;
}) {
  const [options, setOptions] = useState<DepositAddressPaymentOptionMetadata[]>(
    []
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const refreshDepositAddressOptions = async (
      usd: number,
      mode: RozoPayOrderMode
    ) => {
      setLoading(true);
      try {
        // const options = await trpc.getDepositAddressOptions.query({
        //   usdRequired: usd,
        //   mode,
        // });
        const options: DepositAddressPaymentOptionMetadata[] = [
          // {
          //   id: "USDT on Tron",
          //   logoURI: "https://pay.daimo.com/chain-logos/tronusdt.svg",
          //   minimumUsd: 1,
          // },
          // {
          //   id: "Arbitrum",
          //   logoURI: "https://pay.daimo.com/chain-logos/arbitrum.svg",
          //   minimumUsd: 0,
          // },
          {
            id: DepositAddressPaymentOptions.BASE,
            logoURI: "https://pay.daimo.com/chain-logos/base.svg",
            minimumUsd: 0,
          },
          // {
          //   id: "Optimism",
          //   logoURI: "https://pay.daimo.com/chain-logos/optimism.svg",
          //   minimumUsd: 0,
          // },
          // {
          //   id: "Polygon",
          //   logoURI: "https://pay.daimo.com/chain-logos/polygon.svg",
          //   minimumUsd: 0,
          // },
          // {
          //   id: "Ethereum",
          //   logoURI: "https://pay.daimo.com/chain-logos/ethereum.svg",
          //   minimumUsd: 10,
          // },
        ];
        setOptions(options);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    if (usdRequired != null && mode != null) {
      refreshDepositAddressOptions(usdRequired, mode);
    }
  }, [usdRequired, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  return { options, loading };
}
