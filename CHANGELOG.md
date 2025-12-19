# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.7] - 2025-12-19

### 🎉 What's New

This release introduces **EURC (Euro Coin) support** on Base and Stellar networks, along with enhanced preferred token configuration options and improved payment flow handling.

### ✨ New Features

#### EURC Token Support

- [`9f779ad3`](https://github.com/RozoAI/intent-pay/commit/9f779ad3) - **feat: add EURC support for Base and Stellar**
  - Added Base EURC token: `0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42`
  - Added Stellar EURC token: `EURC:GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2`
  - Enabled EURC bridging between Base and Stellar networks
  - Updated token type definitions to include `NATIVE_EURC` token type

#### Preferred Token Configuration

- [`ae3c88c5`](https://github.com/RozoAI/intent-pay/commit/ae3c88c5) - **feat: add preferredTokenAddress to wallet options**

  - Added support for `preferredTokenAddress` in wallet payment options
  - Enhanced bridge configuration to support preferred token addresses
  - Improved deposit address options with preferred token address support

- [`836fabfd`](https://github.com/RozoAI/intent-pay/commit/836fabfd) - **feat: improve preferredSymbol options**

  - Enhanced `preferredSymbol` to follow `supportedTokens` configuration
  - Improved token symbol validation and conversion logic

- [`f7615324`](https://github.com/RozoAI/intent-pay/commit/f7615324) - **feat: adjust preferredSymbol to follow supportedTokens**

  - Refined preferred symbol handling to properly filter payment options
  - Updated token utilities for better symbol-to-token conversion

- [`58f95fc9`](https://github.com/RozoAI/intent-pay/commit/58f95fc9) - **feat: detect preferredTokens and filtered for payment options**
  - Improved automatic detection of preferred tokens across all chains
  - Enhanced token filtering for Solana and Stellar payment options
  - Updated token options to respect preferred tokens configuration

### 🔧 Improvements

- [`df0274f8`](https://github.com/RozoAI/intent-pay/commit/df0274f8) - **feat: improve evm options fetching, and latest version**

  - Enhanced EVM payment options fetching logic for better efficiency
  - Improved reliability of payment options retrieval
  - Updated to latest package versions

- [`ef501897`](https://github.com/RozoAI/intent-pay/commit/ef501897) - **feat: improve eurc warning on demo**
  - Enhanced EURC-specific warning messages in demo pages
  - Improved user guidance for EURC payment flows
  - Better validation feedback for EURC transactions

### 🐛 Bug Fixes

- [`88fca8f2`](https://github.com/RozoAI/intent-pay/commit/88fca8f2) - **fix: preferredTokens props**
  - Fixed handling of `preferredTokens` props to properly respect explicit token preferences
  - Resolved issues with token filtering logic across different payment methods
  - Fixed component dependencies and import issues

### 📦 Dependencies

- Updated `@rozoai/intent-common` to v0.1.7
- Optimized bundle size and tree-shaking
- Enhanced dependency management across packages

---

## Breaking Changes

⚠️ **No breaking changes** in this release. All existing APIs remain compatible.

---

## Security

- No security vulnerabilities reported
- All dependencies updated to latest secure versions
- Enhanced input validation for token addresses
- Improved error handling for malformed configurations

---

## Contributors

- [@akbarsaputrait](https://github.com/akbarsaputrait) - EURC support, preferred tokens, and performance improvements

---

## Support

For questions and support:

- 📧 [GitHub Issues](https://github.com/RozoAI/intent-pay/issues)
- 📖 [Documentation](https://github.com/RozoAI/intent-pay)
- 💬 [Discord Community](https://discord.gg/rozoai)
