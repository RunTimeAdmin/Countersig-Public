# AgentID Frontend

React 18 + Vite + Tailwind CSS frontend for the AgentID trust verification registry.

## Pages

- **Registry** — Browse all registered agents with filtering
- **Agent Detail** — Full agent profile with reputation breakdown
- **Register** — Self-registration flow for new agents
- **Discover** — A2A agent discovery explorer

## Components

- **TrustBadge** — Visual trust indicator component
- **ReputationBreakdown** — Detailed 5-factor score display
- **CapabilityList** — Agent capability tags
- **FlagModal** — Community flagging interface

## Widget

Standalone embeddable widget available at `/widget/:pubkey` for third-party integration.

## Setup

```bash
npm install && npm run dev
```

## Build

```bash
npm run build
```

## API Proxy

Configured to proxy API requests to `localhost:3002` during development.
