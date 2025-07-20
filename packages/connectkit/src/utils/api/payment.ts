import { useState, useCallback, useEffect } from "react";
import { apiClient, ApiResponse, RequestState } from "./base";
import { ROZO_DAIMO_APP_ID } from "../../constants/rozoConfig";

/**
 * Payment display information
 */
export interface PaymentDisplay {
  intent: string;
  paymentValue: string;
  currency: string;
}

/**
 * Payment destination information
 */
export interface PaymentDestination {
  destinationAddress?: string;
  chainId: string;
  amountUnits: string;
  tokenSymbol: string;
  tokenAddress?: string;
  txHash?: string | null;
}

/**
 * Payment source information
 */
export interface PaymentSource {
  sourceAddress?: string;
  [key: string]: unknown;
}

/**
 * Payment request data type
 */
export interface PaymentRequestData {
  appId: string;
  display: PaymentDisplay;
  destination: PaymentDestination;
  externalId?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Payment response data type
 */
export interface PaymentResponseData {
  id: string;
  status: string;
  createdAt: string;
  display: PaymentDisplay;
  source: PaymentSource | null;
  destination: PaymentDestination;
  externalId: string;
  metadata: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Creates a new payment
 * @param paymentData - Payment data to send
 * @returns Promise with payment response
 */
export const createPayment = (
  paymentData: PaymentRequestData
): Promise<ApiResponse<PaymentResponseData>> => {
  return apiClient.post<PaymentResponseData>("/payment-api", paymentData);
};

/**
 * Gets payment details by ID
 * @param paymentId - Payment ID
 * @returns Promise with payment response
 */
export const getPayment = (
  paymentId: string
): Promise<ApiResponse<PaymentResponseData>> => {
  return apiClient.get<PaymentResponseData>(`/payment-api/${paymentId}`);
};

/**
 * Gets payment details by external ID
 * @param externalId - External payment ID
 * @returns Promise with payment response
 */
export const getPaymentByExternalId = (
  externalId: string
): Promise<ApiResponse<PaymentResponseData>> => {
  return apiClient.get<PaymentResponseData>(
    `/payment-api/external/${externalId}`
  );
};

/**
 * Updates an existing payment
 * @param paymentId - Payment ID
 * @param paymentData - Updated payment data
 * @returns Promise with payment response
 */
export const updatePayment = (
  paymentId: string,
  paymentData: Partial<PaymentRequestData>
): Promise<ApiResponse<PaymentResponseData>> => {
  return apiClient.patch<PaymentResponseData>(
    `/payment-api/${paymentId}`,
    paymentData
  );
};

/**
 * Cancels a payment
 * @param paymentId - Payment ID
 * @returns Promise with payment response
 */
export const cancelPayment = (
  paymentId: string
): Promise<ApiResponse<PaymentResponseData>> => {
  return apiClient.delete<PaymentResponseData>(`/payment-api/${paymentId}`);
};

/**
 * Lists all payments with optional filtering
 * @param params - Query parameters for filtering
 * @returns Promise with payment list response
 */
export const listPayments = (
  params?: Record<string, string>
): Promise<ApiResponse<PaymentResponseData[]>> => {
  return apiClient.get<PaymentResponseData[]>("/payment-api", { params });
};

/**
 * React hook for creating a payment
 * @param paymentData - Payment data to send
 * @param autoSubmit - Whether to submit automatically
 * @returns Request state and submit function
 */
export const useCreatePayment = (
  paymentData?: PaymentRequestData,
  autoSubmit = false
): [
  RequestState<PaymentResponseData>,
  (data: PaymentRequestData) => Promise<ApiResponse<PaymentResponseData>>
] => {
  const [state, setState] = useState<RequestState<PaymentResponseData>>({
    data: null,
    error: null,
    status: null,
    isLoading: false,
    isError: false,
    isSuccess: false,
  });

  const submitPayment = useCallback(async (data: PaymentRequestData) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = await createPayment(data);

      setState({
        data: response.data,
        error: response.error,
        status: response.status,
        isLoading: false,
        isError: !!response.error,
        isSuccess: !response.error && !!response.data,
      });

      return response;
    } catch (error) {
      const errorObj =
        error instanceof Error ? error : new Error(String(error));

      setState({
        data: null,
        error: errorObj,
        status: null,
        isLoading: false,
        isError: true,
        isSuccess: false,
      });

      throw errorObj;
    }
  }, []);

  useEffect(() => {
    if (autoSubmit && paymentData) {
      submitPayment(paymentData);
    }
  }, [autoSubmit, paymentData, submitPayment]);

  return [state, submitPayment];
};

/**
 * React hook for fetching payment details
 * @param paymentId - Payment ID
 * @param enabled - Whether to enable the fetch
 * @returns Request state and refetch function
 */
export const usePayment = (
  paymentId: string,
  enabled = true
): [
  RequestState<PaymentResponseData>,
  () => Promise<ApiResponse<PaymentResponseData> | void>
] => {
  const [state, setState] = useState<RequestState<PaymentResponseData>>({
    data: null,
    error: null,
    status: null,
    isLoading: enabled,
    isError: false,
    isSuccess: false,
  });

  const fetchPayment = useCallback(async () => {
    if (!paymentId) return;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = await getPayment(paymentId);

      setState({
        data: response.data,
        error: response.error,
        status: response.status,
        isLoading: false,
        isError: !!response.error,
        isSuccess: !response.error && !!response.data,
      });

      return response;
    } catch (error) {
      setState({
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
        status: null,
        isLoading: false,
        isError: true,
        isSuccess: false,
      });
    }
  }, [paymentId]);

  useEffect(() => {
    if (enabled && paymentId) {
      fetchPayment();
    }
  }, [enabled, paymentId, fetchPayment]);

  return [state, fetchPayment];
};

/**
 * React hook for fetching payment details by external ID
 * @param externalId - External payment ID
 * @param enabled - Whether to enable the fetch
 * @returns Request state and refetch function
 */
export const usePaymentByExternalId = (
  externalId: string,
  enabled = true
): [
  RequestState<PaymentResponseData>,
  () => Promise<ApiResponse<PaymentResponseData> | void>
] => {
  const [state, setState] = useState<RequestState<PaymentResponseData>>({
    data: null,
    error: null,
    status: null,
    isLoading: enabled,
    isError: false,
    isSuccess: false,
  });

  const fetchPayment = useCallback(async () => {
    if (!externalId) return;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = await getPaymentByExternalId(externalId);

      setState({
        data: response.data,
        error: response.error,
        status: response.status,
        isLoading: false,
        isError: !!response.error,
        isSuccess: !response.error && !!response.data,
      });

      return response;
    } catch (error) {
      setState({
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
        status: null,
        isLoading: false,
        isError: true,
        isSuccess: false,
      });
    }
  }, [externalId]);

  useEffect(() => {
    if (enabled && externalId) {
      fetchPayment();
    }
  }, [enabled, externalId, fetchPayment]);

  return [state, fetchPayment];
};

/**
 * React hook for listing payments
 * @param params - Query parameters for filtering
 * @param enabled - Whether to enable the fetch
 * @returns Request state and refetch function
 */
export const usePayments = (
  params?: Record<string, string>,
  enabled = true
): [
  RequestState<PaymentResponseData[]>,
  () => Promise<ApiResponse<PaymentResponseData[]> | void>
] => {
  const [state, setState] = useState<RequestState<PaymentResponseData[]>>({
    data: null,
    error: null,
    status: null,
    isLoading: enabled,
    isError: false,
    isSuccess: false,
  });

  const fetchPayments = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = await listPayments(params);

      setState({
        data: response.data,
        error: response.error,
        status: response.status,
        isLoading: false,
        isError: !!response.error,
        isSuccess: !response.error && !!response.data,
      });

      return response;
    } catch (error) {
      setState({
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
        status: null,
        isLoading: false,
        isError: true,
        isSuccess: false,
      });
    }
  }, [JSON.stringify(params)]);

  useEffect(() => {
    if (enabled) {
      fetchPayments();
    }
  }, [enabled, fetchPayments]);

  return [state, fetchPayments];
};

/**
 * Creates a payment request payload
 * @param options Payment options
 * @returns Payment request data
 */
export const createPaymentRequest = (options: {
  intent: string;
  paymentValue: string;
  currency: string;
  destinationAddress?: string;
  chainId: string;
  amountUnits: string;
  tokenSymbol: string;
  tokenAddress?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
  appId: string;
}): PaymentRequestData => {
  const {
    intent,
    paymentValue,
    currency,
    destinationAddress,
    chainId,
    amountUnits,
    tokenSymbol,
    tokenAddress = "",
    externalId,
    metadata = {},
    appId,
  } = options;

  return {
    appId,
    display: {
      intent,
      paymentValue,
      currency,
    },
    destination: {
      destinationAddress,
      chainId,
      amountUnits,
      tokenSymbol,
      tokenAddress,
    },
    externalId,
    metadata,
  };
};
