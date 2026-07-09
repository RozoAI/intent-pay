import React from "react";

import { FeeResponseData, WalletPaymentOption } from "@rozoai/intent-common";
import defaultTheme from "../../../constants/defaultTheme";
import styled from "../../../styles/styled";
import { roundTokenAmount } from "../../../utils/format";
import { ModalBody } from "../../Common/Modal/styles";
import { Spinner } from "../Spinner";
import { SpinnerContainer } from "../Spinner/styles";

const PaymentBreakdown: React.FC<{
  paymentOption: WalletPaymentOption;
  feeData?: FeeResponseData | null;
  feeLoading?: boolean;
}> = ({ paymentOption, feeData, feeLoading }) => {
  const tokenSymbol = paymentOption.required.token.symbol;

  const feeDisplay = (() => {
    if (feeLoading) return null;
    if (feeData) {
      const feeAmount = parseFloat(feeData.source.fee);
      if (feeAmount === 0) return "free";
      return `${feeData.source.fee} ${feeData.source.tokenSymbol}`;
    }
    const feesUsd = paymentOption.fees.usd;
    if (feesUsd === 0) return "free";
    return `${roundTokenAmount(paymentOption.fees.amount, paymentOption.fees.token, "nearest")} ${tokenSymbol}`;
  })();

  const totalDisplay = (() => {
    if (feeData) {
      return `${feeData.source.amount} ${feeData.source.tokenSymbol}`;
    }
    return `${roundTokenAmount(paymentOption.required.amount, paymentOption.required.token, "nearest")} ${tokenSymbol}`;
  })();

  return (
    <FeesContainer>
      <FeeRow>
        <ModalBody>Fees</ModalBody>
        {feeLoading ? (
          <ModalBody>
            <SpinnerContainer>
              <Spinner />
            </SpinnerContainer>
          </ModalBody>
        ) : feeDisplay === "free" ? (
          <Badge>Free</Badge>
        ) : (
          <ModalBody>{feeDisplay}</ModalBody>
        )}
      </FeeRow>
      <FeeRow style={{ marginTop: 8 }}>
        <ModalBody style={{ fontWeight: 600 }}>Total</ModalBody>
        <ModalBody style={{ fontWeight: 600 }}>
          {feeLoading ? (
            <SpinnerContainer>
              <Spinner />
            </SpinnerContainer>
          ) : (
            totalDisplay
          )}
        </ModalBody>
      </FeeRow>
    </FeesContainer>
  );
};

const FeesContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  gap: 4px;
  margin: 16px 0;

  @media only screen and (max-width: ${defaultTheme.mobileWidth}px) {
    & ${ModalBody} {
      margin: 0 !important;
      max-width: 100% !important;
      text-align: left !important;
    }
  }
`;
const FeeRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 60%;
`;
const Badge = styled.span`
  display: inline-block;
  padding: 3px 8px;
  border-radius: var(--ck-primary-button-border-radius);
  font-size: 14px;
  font-weight: 400;
  background: var(
    --ck-secondary-button-background,
    var(--ck-body-background-secondary)
  );
  color: var(--ck-body-color-muted);
`;

export default PaymentBreakdown;
