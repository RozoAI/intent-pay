import {
  ModalBody,
  ModalContent,
  ModalH1,
  PageContent,
} from "../../Common/Modal/styles";

import { useEffect, useMemo } from "react";
import { AlertIcon } from "../../../assets/icons";
import { ROUTES } from "../../../constants/routes";
import { useRozoPay } from "../../../hooks/useDaimoPay";
import { usePayContext } from "../../../hooks/usePayContext";
import styled from "../../../styles/styled";
import { categorizeError, ErrorType } from "../../../utils/errorParser";
import {
  getDetailedValidationError,
  ValidationError,
} from "../../../utils/validatePayoutToken";
import Button from "../../Common/Button";
import PoweredByFooter from "../../Common/PoweredByFooter";

type ErrorCategory = {
  title: string;
  message: string;
  canRetry: boolean;
  showSupport: boolean;
};

export default function ErrorPage() {
  const pay = useRozoPay();
  const context = usePayContext();

  const errorCategory = useMemo((): ErrorCategory => {
    // Check if this is a validation error from route meta
    const validationError = context.routeMeta?.validationError as
      | ValidationError
      | undefined;

    if (validationError) {
      const { title, message } = getDetailedValidationError(validationError);
      return {
        title,
        message,
        canRetry: false,
        showSupport: false,
      };
    }

    if (pay.paymentState !== "error") {
      return {
        title: "Unknown Error",
        message: "An unexpected error occurred",
        canRetry: true,
        showSupport: true,
      };
    }

    const errorMsg = pay.paymentErrorMessage || "";
    const errorType = categorizeError(errorMsg);

    // Map error types to UI configuration
    switch (errorType) {
      case ErrorType.TRUSTLINE:
        return {
          title: "Trustline Not Set Up",
          message: errorMsg,
          canRetry: false,
          showSupport: true,
        };
      case ErrorType.LIQUIDITY:
        return {
          title: "Insufficient Liquidity",
          message: errorMsg,
          canRetry: false,
          showSupport: true,
        };
      case ErrorType.PAYMENT_FAILED:
        return {
          title: "Payment Failed",
          message: errorMsg,
          canRetry: true,
          showSupport: true,
        };
      case ErrorType.NETWORK:
        return {
          title: "Network Error",
          message: errorMsg,
          canRetry: true,
          showSupport: true,
        };
      case ErrorType.INSUFFICIENT_FUNDS:
        return {
          title: "Insufficient Funds",
          message: errorMsg,
          canRetry: false,
          showSupport: true,
        };
      case ErrorType.REJECTED:
        return {
          title: "Transaction Rejected",
          message: errorMsg,
          canRetry: true,
          showSupport: true,
        };
      default:
        return {
          title: "Payment Unavailable",
          message: errorMsg,
          canRetry: true,
          showSupport: true,
        };
    }
  }, [
    pay.paymentState,
    pay.paymentErrorMessage,
    context.routeMeta?.validationError,
  ]);

  const handleRetry = () => {
    context.setRoute(ROUTES.SELECT_METHOD);
    pay.reset();
    if (context.paymentState.payParams) {
      pay.createPreviewOrder(context.paymentState.payParams);
    }
  };

  const handleCancel = () => {
    context.setOpen(false);
    pay.reset();
    if (context.paymentState.payParams) {
      pay.createPreviewOrder(context.paymentState.payParams);
    }
  };

  useEffect(() => {
    context.triggerResize();
  }, [errorCategory]);

  return (
    <PageContent>
      <ModalContent
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          paddingBottom: 0,
          position: "relative",
        }}
      >
        <CenterContainer>
          <FailIcon />
          <ErrorTitle>{errorCategory.title}</ErrorTitle>
          <ErrorBody>{errorCategory.message}</ErrorBody>

          {errorCategory.canRetry && (
            <Button onClick={handleRetry} variant="primary">
              Try Another Method
            </Button>
          )}
          <Button onClick={handleCancel} variant="secondary">
            Cancel
          </Button>
        </CenterContainer>
        <PoweredByFooter
          preFilledMessage={`Error: ${errorCategory.message}`}
          showSupport={errorCategory.showSupport}
        />
      </ModalContent>
    </PageContent>
  );
}

const CenterContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 16px;
  max-width: 100%;
  width: 100%;
`;

const ErrorTitle = styled(ModalH1)`
  text-align: center;
  margin-top: 8px;
  margin-bottom: 12px;
`;

const ErrorBody = styled(ModalBody)`
  max-width: 100%;
  text-align: center;
  color: var(--ck-body-color-muted);
  line-height: 1.5;
  margin-bottom: 8px;
`;

const FailIcon = styled(AlertIcon)`
  color: var(--ck-body-color-alert);
  width: 48px;
  height: 48px;
  margin-top: auto;
  margin-bottom: 8px;
  margin-inline: auto;
`;
