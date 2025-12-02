import { XMarkIcon } from "@heroicons/react/24/outline";
import {
  getChainById,
  supportedPayoutTokens,
  Token,
} from "@rozoai/intent-common";
import {
  isEvmChain,
  isSolanaChain,
  isStellarChain,
  validateAddressForChain,
} from "@rozoai/intent-pay";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isAddress } from "viem";

// Define the possible configuration types
export type ConfigType = "payment" | "deposit";

// Base configuration interface - unified address field
interface BaseConfig {
  recipientAddress: string; // Unified: EVM Address or Solana/Stellar string
  chainId: number; // Destination chain ID (EVM, Solana, or Stellar)
  tokenAddress: string; // Token address or identifier
  amount: string;
}

// Payment extends base with amount
export interface PaymentConfig extends BaseConfig {
  amount: string;
}

// Deposit uses base config directly
export interface DepositConfig extends BaseConfig {
  amount: "";
}

// Common props for the config panel
interface ConfigPanelProps {
  configType: ConfigType;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: PaymentConfig | DepositConfig) => void;
  defaultRecipientAddress?: string;
}

export function ConfigPanel({
  configType,
  isOpen,
  onClose,
  onConfirm,
  defaultRecipientAddress = "",
}: ConfigPanelProps) {
  // Initialize with default values
  const [config, setConfig] = useState<PaymentConfig>({
    recipientAddress: defaultRecipientAddress,
    chainId: 0,
    tokenAddress: "",
    amount: "",
  });

  // Load saved config after mount
  useEffect(() => {
    const storageKey =
      configType === "payment" ? "rozo-basic-config" : "rozo-deposit-config";
    try {
      const savedConfig = localStorage.getItem(storageKey);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        const parsedConfig = { ...parsed };

        // Validate token address based on chain type
        if (parsed.chainId !== 0) {
          const isEvm = isEvmChain(parsed.chainId);
          if (isEvm && !isAddress(parsed.tokenAddress)) {
            Object.assign(parsedConfig, {
              tokenAddress: "",
            });
          }
        }

        // Validate recipient address based on chain type
        if (parsed.chainId !== 0 && parsed.recipientAddress) {
          const isValid = validateAddressForChain(
            parsed.chainId,
            parsed.recipientAddress
          );
          if (!isValid) {
            // Reset invalid address
            Object.assign(parsedConfig, {
              recipientAddress: "",
            });
          }
        }

        if (
          parsedConfig &&
          typeof parsedConfig === "object" &&
          "recipientAddress" in parsedConfig &&
          "chainId" in parsedConfig &&
          "tokenAddress" in parsedConfig
        ) {
          setConfig(parsedConfig);
        }
      }
    } catch (e) {
      console.error("Failed to load saved config:", e);
    }
  }, [configType]); // Only run when configType changes

  // Add error state for recipient address
  const [addressError, setAddressError] = useState<string>("");

  // Extract unique chains from supportedPayoutTokens
  const chains = useMemo(() => {
    return Array.from(supportedPayoutTokens.keys())
      .map((chainId) => getChainById(chainId))
      .filter((chain): chain is NonNullable<typeof chain> => chain !== null)
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
  }, []);

  // Get tokens for selected chain from supportedPayoutTokens
  const tokens = useMemo((): Token[] => {
    if (config.chainId === 0) return [];

    // Get tokens directly from supportedPayoutTokens
    const tokensForChain = supportedPayoutTokens.get(config.chainId);
    return tokensForChain || [];
  }, [config.chainId]);

  // Validate address on change based on chain type
  const validateAddress = useCallback((address: string, chainId: number) => {
    if (!address) {
      setAddressError("Address is required");
      return false;
    }

    if (chainId === 0) {
      setAddressError("");
      return true; // No validation if chain not selected
    }

    const isValid = validateAddressForChain(chainId, address);
    if (!isValid) {
      if (isEvmChain(chainId)) {
        setAddressError("Invalid EVM address");
      } else if (isSolanaChain(chainId)) {
        setAddressError("Invalid Solana address");
      } else if (isStellarChain(chainId)) {
        setAddressError("Invalid Stellar address");
      } else {
        setAddressError("Invalid address format");
      }
      return false;
    }

    setAddressError("");
    return true;
  }, []);

  // Update address handler
  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAddress = e.target.value;
    setConfig((prev) => ({
      ...prev,
      recipientAddress: newAddress,
    }));
    validateAddress(newAddress, config.chainId);
  };

  // Update form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!config.recipientAddress) {
      if (isEvmChain(config.chainId)) {
        alert("Please enter a valid EVM address");
      } else if (isSolanaChain(config.chainId)) {
        alert("Please enter a valid Solana address");
      } else if (isStellarChain(config.chainId)) {
        alert("Please enter a valid Stellar address");
      } else {
        alert("Please enter a valid recipient address");
      }
      return;
    }

    // Validate recipient address based on chain type
    const isValid = validateAddressForChain(
      config.chainId,
      config.recipientAddress
    );
    if (!isValid) {
      if (isEvmChain(config.chainId)) {
        alert("Please enter a valid EVM address (0x... format)");
      } else if (isSolanaChain(config.chainId)) {
        alert("Please enter a valid Solana address (Base58 format)");
      } else if (isStellarChain(config.chainId)) {
        alert("Please enter a valid Stellar address (G... format)");
      } else {
        alert("Please enter a valid address");
      }
      return;
    }

    // Create the appropriate config object based on type
    if (configType === "payment") {
      onConfirm(config);
    } else {
      onConfirm({ ...config, amount: "" });
    }

    onClose();
  };

  // Determine if the form is valid based on config type
  const isFormValid = () => {
    if (config.chainId === 0 || !config.tokenAddress) {
      return false;
    }

    const addressValid = validateAddressForChain(
      config.chainId,
      config.recipientAddress
    );
    const baseValid =
      addressValid && config.chainId > 0 && config.tokenAddress !== "";

    // Payment requires amount field
    if (configType === "payment") {
      return baseValid && config.amount !== "";
    }

    // Deposit doesn't need amount
    return baseValid;
  };

  return (
    <div
      className={`
      fixed right-0 top-0 h-full w-96 shadow-lg transform transition-transform z-50 bg-white
      ${isOpen ? "translate-x-0" : "translate-x-full"}
    `}
    >
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-primary-dark">
            {configType === "payment"
              ? "Payment Configuration"
              : "Deposit Configuration"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-primary-dark hover:text-primary-medium"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Receiving Chain
            </label>
            <select
              value={config.chainId}
              onChange={(e) => {
                const newChainId = Number(e.target.value);
                setConfig((prev) => ({
                  ...prev,
                  chainId: newChainId,
                  recipientAddress: "", // Reset address when chain changes
                  tokenAddress: "", // Reset token when chain changes
                }));
                setAddressError(""); // Clear error when chain changes
              }}
              className="w-full p-2 border border-gray-300 focus:border-primary-medium focus:ring focus:ring-primary-light focus:ring-opacity-50 rounded"
            >
              <option value={0}>Select Chain</option>
              {chains.map((chain) => (
                <option key={chain.chainId} value={chain.chainId}>
                  {chain.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Receiving Token
            </label>
            {config.chainId === 0 && (
              <span className="text-sm text-gray-500">
                Select a chain to see tokens
              </span>
            )}
            {config.chainId > 0 && (
              <select
                value={config.tokenAddress}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    tokenAddress: e.target.value,
                  }))
                }
                className="w-full p-2 border border-gray-300 focus:border-primary-medium focus:ring focus:ring-primary-light focus:ring-opacity-50 rounded"
              >
                <option value="">Select Token</option>
                {tokens.map((token) => (
                  <option key={token.token} value={token.token}>
                    {token.symbol}
                  </option>
                ))}
              </select>
            )}
          </div>

          {config.chainId === 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipient Address
              </label>
              <span className="text-sm text-gray-500">
                Select a chain to fill in the recipient address
              </span>
            </div>
          )}

          {config.chainId > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Recipient Address
                {isEvmChain(config.chainId) && " (EVM)"}
                {isSolanaChain(config.chainId) && " (Solana)"}
                {isStellarChain(config.chainId) && " (Stellar)"}
              </label>
              <input
                type="text"
                value={config.recipientAddress}
                onChange={handleAddressChange}
                className={`w-full p-2 border rounded ${
                  addressError
                    ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                    : "border-gray-300 focus:border-primary-medium focus:ring-primary-light"
                } focus:ring focus:ring-opacity-50`}
                placeholder={
                  isEvmChain(config.chainId)
                    ? "0x..."
                    : isSolanaChain(config.chainId)
                    ? "Base58 address..."
                    : isStellarChain(config.chainId)
                    ? "G..."
                    : "Enter address..."
                }
                formNoValidate
              />
              {addressError && (
                <p className="mt-1 text-sm text-red-500">{addressError}</p>
              )}
              {config.chainId > 0 && !addressError && (
                <p className="mt-1 text-xs text-gray-500">
                  {isEvmChain(config.chainId) &&
                    "Enter a valid EVM address (0x followed by 40 hex characters)"}
                  {isSolanaChain(config.chainId) &&
                    "Enter a valid Solana address (Base58 encoded, 32-44 characters)"}
                  {isStellarChain(config.chainId) &&
                    "Enter a valid Stellar address (starts with G, 56 characters)"}
                </p>
              )}
            </div>
          )}

          {/* {configType === "payment" &&
            config.chainId === base.chainId &&
            config.tokenAddress === baseUSDC.token && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stellar Recipient Address (Optional)
                </label>
                <input
                  type="text"
                  value={config.recipientStellarAddress}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      recipientStellarAddress: e.target.value,
                    }))
                  }
                  className={`w-full p-2 border rounded border-gray-300 focus:border-primary-medium focus:ring-primary-light focus:ring focus:ring-opacity-50`}
                  placeholder="G..."
                  formNoValidate
                />
                <span className="text-xs text-gray-500 leading-[10px]">
                  This field is optional. Enter this only if you want the
                  recipient to receive funds on Stellar (bridged from Base USDC
                  to Stellar USDC).
                </span>
              </div>
            )} */}

          {/* Amount field only shown for payment config */}
          {configType === "payment" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount
              </label>
              <input
                type="number"
                value={config.amount}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    amount: e.target.value,
                  }))
                }
                step="0.01"
                className="w-full p-2 border border-gray-300 focus:border-primary-medium focus:ring focus:ring-primary-light focus:ring-opacity-50 rounded"
                placeholder="Enter amount..."
                formNoValidate
              />
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-primary-dark text-white py-2 px-4 rounded hover:bg-primary-medium transition-colors"
            // disabled={!isFormValid()}
          >
            Confirm
          </button>
        </form>
      </div>
    </div>
  );
}
