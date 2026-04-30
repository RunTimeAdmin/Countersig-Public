# @countersig/react

> **Status: In Development** — This package is not yet published to npm.

This package will provide React components for displaying Countersig trust badges, reputation scores, and capability lists. It is under active development as part of Countersig 2.0.

For current integration, use the REST API directly. See the [API Reference](../../docs/API_REFERENCE.md).

React components for displaying [Countersig](https://countersig.com) trust badges, reputation scores, and capability lists. Zero Tailwind dependency — all styles are self-contained inline CSS.

## Installation

```bash
npm install @countersig/react react react-dom
```

## Peer Dependencies

- `react` >= 18.0.0
- `react-dom` >= 18.0.0

## Components

### TrustBadge

Displays an agent's trust status, verification tier, and score. Fetches badge data from the Countersig API.

```tsx
import { TrustBadge } from '@countersig/react';

<TrustBadge
  agentId="your-agent-id"
  apiUrl="https://api.countersig.com"
  theme="dark"
  size="md"
  showScore={true}
  showChain={true}
  showActions={true}
  showDate={true}
  onClick={() => window.open('https://countersig.com/agent/your-agent-id')}
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `agentId` | `string` | required | Agent identifier |
| `apiUrl` | `string` | `https://api.countersig.com` | API base URL |
| `theme` | `'light' \| 'dark'` | `'light'` | Visual theme |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Badge size |
| `showScore` | `boolean` | `true` | Show reputation score |
| `showChain` | `boolean` | `true` | Show chain type indicator |
| `showActions` | `boolean` | `false` | Show total actions count |
| `showDate` | `boolean` | `false` | Show registration date |
| `className` | `string` | `''` | Custom CSS class |
| `onClick` | `() => void` | — | Click handler |

---

### ReputationBreakdown

Displays the 5-factor reputation score breakdown with animated progress bars. Can fetch from the API or accept pre-fetched data.

```tsx
import { ReputationBreakdown } from '@countersig/react';

// Fetch from API
<ReputationBreakdown
  agentId="your-agent-id"
  theme="dark"
  showHeader={true}
  showLegend={true}
/>

// With pre-fetched data
<ReputationBreakdown
  breakdown={{
    feeActivity: { score: 22, max: 30 },
    successRate: { score: 20, max: 25 },
    age: { score: 15, max: 20 },
    saidTrust: { score: 10, max: 15 },
    community: { score: 5, max: 10 }
  }}
  theme="light"
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `agentId` | `string` | — | Agent ID (fetches from API) |
| `breakdown` | `Record<string, number \| { score: number; max: number }>` | — | Pre-fetched breakdown data |
| `apiUrl` | `string` | `https://api.countersig.com` | API base URL |
| `theme` | `'light' \| 'dark'` | `'light'` | Visual theme |
| `showHeader` | `boolean` | `true` | Show score header |
| `showLegend` | `boolean` | `true` | Show color legend |
| `className` | `string` | `''` | Custom CSS class |

---

### CapabilityList

Displays agent capabilities as styled tags/pills with category-specific colors and icons. Can fetch from the API or accept pre-provided data.

```tsx
import { CapabilityList } from '@countersig/react';

// Fetch from API
<CapabilityList
  agentId="your-agent-id"
  theme="dark"
  showLabel={true}
  maxDisplay={5}
/>

// With pre-provided capabilities
<CapabilityList
  capabilities={['bags.swap', 'bags.fee', 'bags.launch', 'infra']}
  theme="light"
  maxDisplay={3}
/>
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `agentId` | `string` | — | Agent ID (fetches from API) |
| `capabilities` | `string[]` | — | Pre-provided capabilities |
| `apiUrl` | `string` | `https://api.countersig.com` | API base URL |
| `theme` | `'light' \| 'dark'` | `'light'` | Visual theme |
| `showLabel` | `boolean` | `true` | Show "Capabilities" label |
| `maxDisplay` | `number` | — | Max items to show (with "+N more") |
| `className` | `string` | `''` | Custom CSS class |

---

### ChainBadge

Displays the blockchain/chain type as a compact colored badge.

```tsx
import { ChainBadge } from '@countersig/react';

<ChainBadge chainType="solana-bags" size="md" theme="dark" />
<ChainBadge chainType="ethereum" size="sm" theme="light" />
<ChainBadge chainType="base" />
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `chainType` | `string` | required | Chain type identifier |
| `size` | `'sm' \| 'md'` | `'md'` | Badge size |
| `theme` | `'light' \| 'dark'` | `'light'` | Visual theme |
| `className` | `string` | `''` | Custom CSS class |

#### Supported Chain Types

| chainType | Display | Color |
|-----------|---------|-------|
| `solana-bags` | Solana/BAGS | #9945FF |
| `solana` | Solana | #14F195 |
| `ethereum` | Ethereum | #627EEA |
| `base` | Base | #0052FF |
| `polygon` | Polygon | #8247E5 |

---

## Theme Support

All components support `theme="light"` and `theme="dark"`. The dark theme uses dark backgrounds with light text, matching the Countersig platform aesthetic.

## Self-Contained Styles

All components use inline CSS styles with no external CSS imports, Tailwind dependencies, or CSS-in-JS runtime. They work in any React project out of the box.

## TypeScript Support

Full TypeScript type definitions are included. Import component and prop types:

```typescript
import type { TrustBadgeProps, ReputationBreakdownProps, CapabilityListProps, ChainBadgeProps } from '@countersig/react';
```

## Links

- [Countersig Platform](https://countersig.com)
- [SDK Package](https://www.npmjs.com/package/@countersig/sdk)
- [GitHub Repository](https://github.com/RunTimeAdmin/AgentID-2.0-Public)

## License

MIT
