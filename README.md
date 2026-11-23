# Arc Wallet Desk

A USDC wallet dashboard for Arc Testnet. Connect a wallet, see your USDC balance, send USDC, follow each transaction to confirmation, explore your transfer analytics, manage a wallet profile and keep a list of contracts to inspect.

Built with [Arc Studio](https://studio.arc.io)

## Features

- Connect a browser wallet and see one USDC balance (network fees are paid in USDC on Arc).
- Send USDC with address and amount checks, a live fee estimate, a Max button that leaves room for the fee, and a step-by-step status with an explorer link.
- Analytics: pick 24 hours, 7 days or all loaded history, then see received and sent totals, net flow, volume split, volume per period, busiest hours and top counterparties.
- History: the full USDC transfer history, grouped by day, with Received and Sent filters, search, expandable details, a CSV export and Load older transfers.
- Background tracking: every USDC transfer you send is followed by the backend until it settles. History shows a Recent sends list with Pending, Confirmed or Failed, the fee paid, and it keeps updating even if you reload or close the tab. Your wallet still signs every transfer; the backend never holds keys.
- Balance card shows 7-day received and sent with a trend line, and a network card shows the latest Arc Testnet block.
- Profile: a display name and bio saved with a free wallet signature, plus onchain stats. Any wallet address can be looked up.
- Contracts: add a contract by address (with an optional ABI) and read its state. Saving and removing is signed by your wallet.

## Tech stack

React, Vite, TypeScript, Tailwind CSS, wagmi, viem, ConnectKit. A small Node-compatible HTTP API (run with Bun) serves activity, profiles and saved contracts.

## Development

Prerequisites: [Bun](https://bun.sh).

```bash
bun install
bun run dev      # frontend on port 5173; also starts the backend API on port 3001
```

The frontend proxies `/api` to the backend. To run the backend on its own, use `bun run server`. Other scripts:

```bash
bun run check    # lint and typecheck
```

### Environment variables

All optional.

- `API_PORT`: port for the backend API (default 3001).
- `RPC_URL_Arc_Testnet`: your own Arc Testnet RPC URL for the backend. Without it the backend uses the public RPC.
- `RPC_PROXY_BASE_URL`, `RPC_PROXY_TOKEN`, `RPC_PROXY_CHAINS`: provisioned by Arc Studio. Optional outside Arc Studio.

## Getting test USDC

In Arc Studio, use **Get test USDC** in the sidebar. Your balance updates on its own once the funds arrive.

## Data

Profiles, saved contracts and tracked transfers are stored in `server/data/db.json` on the machine running the backend. Transfer history is read from the Arc Testnet explorer.
