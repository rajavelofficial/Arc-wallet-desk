# Arc Wallet Desk

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

USDC wallet dashboard on Arc Testnet: connect wallet, USDC balance (ERC-20 view only), send USDC with tx status, analytics charts, activity, wallet profile, and a saved read-only contracts list. No custom Solidity contract is deployed; USDC is the native predeploy.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## Share links

- Starter apps already ship `getShareBase`, `buildShareLink` and `installShareSync` in `src/lib/share.ts`; import them instead of rewriting them.
- Keep shareable state in the URL path or query, not in the `#fragment`.
- Never put a secret (private key, claim secret, seed phrase, session token, API key) in the URL path or query, encoded or not: every in-app path and query is mirrored to the visitor's studio.arc.io address bar and browser history and reaches servers. A bearer claim secret goes only in the `#fragment` appended to the share link (`` `${await buildShareLink('/claim')}#${secret}` ``) and is read from `location.hash` on load. A link to the app's own share URL shown inside the app must be copy-only or open in a new tab with `target="_blank" rel="noopener noreferrer"`.
- Build every link a user copies or sends with `buildShareLink()` from `src/lib/share.ts`.
- Keep the `installShareSync()` call in `src/main.tsx` when editing it; it keeps the Studio address bar in step with in-app navigation.
- Navigate inside the app with relative links.

## To Run

```bash
bun install
bun run dev
```

## Architecture notes

- Backend: `server/` (node:http, port 3001). `bun run dev` starts it automatically through the `api-server` plugin in `vite.config.ts` and stops it with the dev server; `bun run server` runs it alone. Vite proxies `/api` to it and strips the prefix.
- History comes from the Arc Testnet Blockscout API (base URL derived from `explorerBase` in `@/onchain-facts`), newest ~400 USDC transfers; the RPC rejects wide `eth_getLogs` ranges, so it is not used for history.
- `/history/:address?filter=all|in|out&cursor=` pages the full transfer history (opaque cursor). Analytics ranges, charts and the balance-card trend are computed in the browser from the loaded transfers (`src/lib/analytics.ts`).
- Background tracker (`server/tracker.ts`): the browser POSTs a broadcast tx hash to `/transfers`; a 3s worker reads the tx and receipt from RPC, checks it is a direct USDC `transfer` from the claimed wallet, and stores pending/confirmed/failed/dropped plus the fee paid in `server/data/db.json`. It never signs or sends; transfers routed through other contracts are not tracked.
- Profile and contract writes are wallet-signed messages (`src/lib/auth.ts`), verified server-side with viem `verifyMessage` within a 5 minute window. Storage: `server/data/db.json` (gitignored).
- Balance is read from the 6-decimal ERC-20 view only; the native 18-decimal view is used only for fee estimation via `@/onchain-money`.
- Test funds: the Arc Studio sidebar "Get test USDC" button.
