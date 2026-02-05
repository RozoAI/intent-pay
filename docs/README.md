# RozoAI Intent Pay SDK - Documentation

Welcome to the Intent Pay SDK documentation! This folder contains comprehensive guides for understanding, debugging, and extending the SDK.

## 📚 Documentation Index

### **For New Contributors**
Start here if you're new to the codebase:

1. **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Fast lookup for common operations
   - Payment state transitions
   - Error handling patterns
   - Code snippets for typical tasks
   - File location quick reference

2. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Deep dive into system design
   - Payment state machine explained
   - Multi-chain architecture (EVM, Solana, Stellar)
   - Cross-chain payment mechanism
   - Integration points & data flows
   - Performance considerations
   - Security model

### **For Debugging Issues**
Use these when things go wrong:

3. **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Solutions to common problems
   - Payment state issues
   - Cross-chain payment problems
   - Wallet connection issues
   - Token balance & loading
   - API & network errors
   - Performance optimization

### **For Specific Features**
Detailed guides for specialized topics:

4. **[ADDING_NEW_CHAIN_SUPPORT.md](./ADDING_NEW_CHAIN_SUPPORT.md)** - How to add new blockchain support
5. **[CHAIN_ADDRESS_USAGE.md](./CHAIN_ADDRESS_USAGE.md)** - Address handling across chains
6. **[STELLAR_EXTERNAL_KIT_AND_CONNECT.md](./STELLAR_EXTERNAL_KIT_AND_CONNECT.md)** - Using your own Stellar kit and connecting wallets (single confirmation)
7. **[STELLAR_PAYOUT_IMPLEMENTATION_ANALYSIS.md](./STELLAR_PAYOUT_IMPLEMENTATION_ANALYSIS.md)** - Stellar-specific implementation details

### **For Payment Flow Understanding**
8. **[../packages/connectkit/PAYMENT_FLOW.md](../packages/connectkit/PAYMENT_FLOW.md)** - Detailed payment flow diagrams and state transitions

---

## 🚀 Quick Start

### I want to...

**...understand how payments work**
→ Read [ARCHITECTURE.md](./ARCHITECTURE.md) sections 1-2 (State Machine & Data Flow)

**...fix a bug**
→ Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for known solutions

**...add a new feature**
→ Start with [ARCHITECTURE.md](./ARCHITECTURE.md) to understand existing patterns

**...integrate the SDK**
→ See [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) → "Component Integration" section

**...debug a stuck payment**
→ [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) → "Payment State Issues"

**...optimize performance**
→ [ARCHITECTURE.md](./ARCHITECTURE.md) section 7 (Performance Considerations)

**...add a new blockchain**
→ [ADDING_NEW_CHAIN_SUPPORT.md](./ADDING_NEW_CHAIN_SUPPORT.md)

---

## 🎯 Key Concepts

Before diving into the docs, understand these core concepts:

### 1. Payment State Machine (FSM)
The SDK uses a strict finite state machine to manage payment lifecycle:
```
preview → payment_unpaid → payment_started → payment_completed
```
**Rule:** You cannot skip states. All transitions must follow this flow.

### 2. Three Separate Wallet Systems
- **EVM chains** (Base, Polygon) via Wagmi v2
- **Solana** via @solana/wallet-adapter-react
- **Stellar** via @stellar/stellar-sdk

These run in **parallel** with no shared state except the payment store.

### 3. Cross-Chain = Backend
Cross-chain payments don't bridge on-chain. They go through Rozo's backend API:
1. User sends to deposit address on source chain
2. Rozo backend detects payment
3. Backend bridges funds internally
4. Backend sends to merchant on destination chain

### 4. Component State ≠ FSM State
There are **three layers** of state that can diverge:
- UI component state (`PayState.RequestingPayment`)
- Payment FSM state (`payment_started`)
- Backend API state (`"pending"`)

Always validate FSM state before critical operations.

---

## 📖 Reading Guide

### For Understanding the System
1. Start: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) (30 min read)
   - Skim code patterns
   - Note file locations
2. Deep Dive: [ARCHITECTURE.md](./ARCHITECTURE.md) (1-2 hours)
   - Read sections 1-4 fully
   - Skim sections 5-9 (reference material)
3. Practical: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) (bookmark for later)
   - Don't read cover-to-cover
   - Use as reference when issues arise

### For Fixing a Specific Issue
1. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) first
   - Search for error message
   - Follow debug steps
2. If not covered, check [ARCHITECTURE.md](./ARCHITECTURE.md)
   - Understand the subsystem involved
   - Trace data flow
3. Use [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) for code patterns
   - Copy-paste validated patterns
   - Avoid reinventing solutions

### For Adding Features
1. Review [ARCHITECTURE.md](./ARCHITECTURE.md) section 1-3
   - Understand state machine constraints
   - Check multi-chain implications
2. Use [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) for implementation
   - Follow established patterns
   - Reuse existing hooks/utilities
3. Test with [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) checklist
   - Verify no common issues introduced

---

## 🔍 Documentation Standards

These docs follow specific conventions:

### File Locations
Always specified with full path from repo root:
```
packages/connectkit/src/payment/paymentFsm.ts:168-198
```

### Code Patterns
Correct patterns marked with ✅, incorrect with ❌:
```typescript
// ✅ CORRECT
await setPaymentUnpaid(paymentId, order);

// ❌ WRONG
await setPaymentUnpaid(paymentId);
```

### Debug Steps
Numbered with code snippets:
```typescript
// 1. Check FSM state
console.log(store.getState().type);

// 2. Check component state
console.log(payState);
```

### Warnings
Critical information highlighted:
**CRITICAL:** Must provide order when recovering from error state.

---

## 🤝 Contributing to Docs

Found an issue or want to improve documentation?

### Reporting Issues
1. Check if issue already documented in [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. If new, create GitHub issue with:
   - What you were trying to do
   - What went wrong
   - How you fixed it (if you did)

### Adding New Documentation
1. **Quick fixes** → Update relevant existing doc
2. **New features** → Add section to [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
3. **Complex systems** → Add section to [ARCHITECTURE.md](./ARCHITECTURE.md)
4. **Common bugs** → Add to [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

### Documentation Principles
- **Actionable** - Every section should enable readers to do something
- **Searchable** - Use keywords developers will search for (error messages, symptoms)
- **Current** - Update when code changes (include file locations + line numbers)
- **Honest** - Document known limitations and bugs, not just successes

---

## 📝 Document Metadata

| Document | Last Updated | Codebase Version | Status |
|----------|--------------|------------------|--------|
| ARCHITECTURE.md | 2026-02-02 | v0.1.15+ | Living |
| TROUBLESHOOTING.md | 2026-02-02 | v0.1.15+ | Living |
| QUICK_REFERENCE.md | 2026-02-02 | v0.1.15+ | Living |
| ADDING_NEW_CHAIN_SUPPORT.md | (existing) | - | - |
| CHAIN_ADDRESS_USAGE.md | (existing) | - | - |

**Status:**
- **Living** - Updated as code evolves
- **Stable** - Rarely changes
- **Archived** - Historical reference only

---

## 🔗 Related Resources

### Project Files
- [CLAUDE.md](../CLAUDE.md) - AI assistant guidance (includes critical insights)
- [.cursorrules](../.cursorrules) - Comprehensive project patterns
- [CHANGELOG.md](../CHANGELOG.md) - Version history

### External Links
- [GitHub Repository](https://github.com/RozoAI/intent-pay)
- [NPM Package](https://www.npmjs.com/package/@rozoai/intent-pay)
- [Example App](../examples/nextjs-app/)

### Original Sources
- [Daimo Pay](https://github.com/daimo-eth/pay) - Original fork source
- [ConnectKit](https://family.co) - UI/UX inspiration

---

## 💡 Tips for Effective Documentation Use

1. **Use Search** - Cmd/Ctrl+F is your friend. Search for error messages, function names, symptoms.

2. **Follow Breadcrumbs** - Docs reference each other. If QUICK_REFERENCE mentions "see ARCHITECTURE.md section 3", follow that link.

3. **Copy Code Patterns** - The code snippets are tested and validated. Copy-paste and adapt rather than rewriting from scratch.

4. **Bookmark Troubleshooting** - Keep TROUBLESHOOTING.md open in a tab while developing. Reference frequently.

5. **Read Sequentially Once** - Read ARCHITECTURE.md front-to-back once to build mental model. Then use as reference.

6. **Update When You Learn** - If you discovered something not documented, add it! Future you (and others) will thank you.

---

**Questions?** Check the main [README.md](../README.md) or create an issue on GitHub.

**Happy coding!** 🚀
