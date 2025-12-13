import React from "react";
import { ROUTES } from "../../../constants/routes";
import { usePayContext } from "../../../hooks/usePayContext";

import { ModalContent, ModalH1, PageContent } from "../../Common/Modal/styles";

import { RozoPayOrderMode } from "@rozoai/intent-common";
import { useRozoPay } from "../../../hooks/useDaimoPay";
import { OptionsList } from "../../Common/OptionsList";
import { OrderHeader } from "../../Common/OrderHeader";
import PoweredByFooter from "../../Common/PoweredByFooter";
import SelectAnotherMethodButton from "../../Common/SelectAnotherMethodButton";
import TokenChainLogo from "../../Common/TokenChainLogo";

const SelectDepositAddressChain: React.FC = () => {
  const { setRoute, paymentState } = usePayContext();
  const pay = useRozoPay();
  const { order } = pay;
  const {
    isDepositFlow,
    setSelectedDepositAddressOption,
    depositAddressOptions,
  } = paymentState;

  return (
    <PageContent>
      <OrderHeader
        minified
        excludeLogos={[
          "tron",
          "arbitrum",
          "optimism",
          "stellar",
          "polygon",
          "worldchain",
          "bsc",
        ]}
      />

      {!depositAddressOptions.loading &&
        depositAddressOptions.options?.length === 0 && (
          <ModalContent
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              paddingTop: 16,
              paddingBottom: 16,
            }}
          >
            <ModalH1>Chains unavailable.</ModalH1>
            <SelectAnotherMethodButton />
          </ModalContent>
        )}

      <OptionsList
        requiredSkeletons={4}
        isLoading={depositAddressOptions.loading}
        options={
          depositAddressOptions.options
            ?.filter((option) => !option.id.toLowerCase().includes("tron"))
            .map((option) => ({
              id: option.id,
              title: option.id,
              icons: [<TokenChainLogo key={option.id} token={option.token} />],
              disabled:
                option.minimumUsd <= 0 ||
                (order?.mode === RozoPayOrderMode.HYDRATED &&
                  order.usdValue < option.minimumUsd) ||
                (order?.mode === RozoPayOrderMode.SALE &&
                  order.destFinalCallTokenAmount.usd < option.minimumUsd),
              onClick: () => {
                setSelectedDepositAddressOption(option as any);
                const meta = { event: "click-option", option: option.id };
                if (isDepositFlow) {
                  setRoute(ROUTES.SELECT_DEPOSIT_ADDRESS_AMOUNT, meta);
                } else {
                  setRoute(ROUTES.WAITING_DEPOSIT_ADDRESS, meta);
                }
              },
            }))
            // sort: enabled (disabled: false) appear first, then disabled (disabled: true) after
            .sort((a, b) => Number(a.disabled) - Number(b.disabled)) ?? []
        }
      />
      <PoweredByFooter />
    </PageContent>
  );
};

export default SelectDepositAddressChain;
