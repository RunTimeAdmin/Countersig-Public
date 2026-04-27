# AgentID Widget Integration Guide

**Version:** 1.0.0  
**Author:** David Cooper (CCIE #14019)

---

## Overview

The AgentID Widget provides a **visual trust indicator** that can be embedded in any web application, documentation, or marketplace listing. It displays real-time reputation data including:

- **Verification status** (Verified, Unverified, Flagged)
- **Trust score** (0-100 BAGS Score)
- **Action statistics** (total actions, success rate)
- **Registration metadata** (registration date, capabilities)

### Why Use the Widget?

1. **Build User Trust** - Display your agent's reputation transparently
2. **Real-time Updates** - Badge refreshes automatically every 60 seconds
3. **Multiple Formats** - iframe, SVG, or JSON API for custom implementations
4. **Zero Dependencies** - Standalone HTML/CSS with no external dependencies
5. **Responsive Design** - Adapts to container size automatically

---

## Quick Start

### 1. iframe Embed (Recommended)

The simplest integration method. Add this HTML to any page:

```html
<iframe 
  src="https://agentid.provenanceai.network/widget/{AGENT_PUBKEY}"
  width="400"
  height="300"
  frameborder="0"
  style="border-radius: 12px; overflow: hidden;"
  title="AgentID Trust Badge"
></iframe>
```

Replace `{AGENT_PUBKEY}` with your agent's public key.

### 2. Live Example

```html
<!-- Example: Trading Agent Widget -->
<iframe 
  src="https://agentid.provenanceai.network/widget/AgentPubkey111111111111111111111111111111111"
  width="400"
  height="300"
  frameborder="0"
  style="border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);"
  title="AgentID Trust Badge"
></iframe>
```

---

## Customization Options

### Size Variations

The widget is responsive but works best at these dimensions:

| Use Case | Width | Height | Notes |
|----------|-------|--------|-------|
| **Compact** | 320px | 200px | Minimal display, sidebar placement |
| **Standard** | 400px | 300px | Recommended for most use cases |
| **Full** | 100% | 400px | Dashboard or profile pages |

### URL Parameters

The widget endpoint accepts these query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `theme` | string | `auto` | Color theme: `dark`, `light`, `auto` |
| `compact` | boolean | `false` | Compact mode (smaller fonts, tighter spacing) |

**Example with parameters:**
```html
<iframe 
  src="https://agentid.provenanceai.network/widget/{PUBKEY}?theme=dark&compact=true"
  width="320"
  height="200"
  frameborder="0"
></iframe>
```

### CSS Styling

The iframe can be styled via the container:

```html
<div class="widget-container">
  <iframe 
    src="https://agentid.provenanceai.network/widget/{PUBKEY}"
    width="400"
    height="300"
    frameborder="0"
  ></iframe>
</div>

<style>
.widget-container {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  transition: transform 0.2s ease;
}

.widget-container:hover {
  transform: translateY(-2px);
}

.widget-container iframe {
  display: block;
  width: 100%;
  border: none;
}
</style>
```

---

## Self-Hosted Widget Setup

For applications requiring complete control over the widget appearance, you can build a custom widget using the JSON API.

### 1. Fetch Badge Data

```javascript
async function fetchBadgeData(pubkey) {
  const response = await fetch(`https://agentid.provenanceai.network/badge/${pubkey}`);
  if (!response.ok) {
    throw new Error('Failed to fetch badge data');
  }
  return response.json();
}

// Usage
const badgeData = await fetchBadgeData('AgentPubkey111111111111111111111111111111111');
```

### 2. Response Structure

```json
{
  "pubkey": "AgentPubkey111111111111111111111111111111111",
  "name": "My Trading Agent",
  "status": "verified",
  "badge": "✅",
  "label": "VERIFIED AGENT",
  "score": 75,
  "bags_score": 75,
  "saidTrustScore": 85,
  "saidLabel": "HIGH",
  "registeredAt": "2024-01-15T10:30:00.000Z",
  "lastVerified": "2024-01-20T14:22:00.000Z",
  "totalActions": 150,
  "successRate": 0.94,
  "capabilities": ["trading", "analytics"],
  "tokenMint": "TokenMint1111111111111111111111111111111111",
  "widgetUrl": "https://agentid.provenanceai.network/widget/AgentPubkey111111111111111111111111111111111"
}
```

### 3. Status Configuration

Map status values to visual themes:

```javascript
const statusConfig = {
  verified: {
    icon: '✅',
    label: 'VERIFIED AGENT',
    bgColor: '#1a2e1a',
    accentColor: '#22c55e',
    textColor: '#22c55e'
  },
  unverified: {
    icon: '⚠️',
    label: 'UNVERIFIED',
    bgColor: '#2e2a1a',
    accentColor: '#f59e0b',
    textColor: '#f59e0b'
  },
  flagged: {
    icon: '🔴',
    label: 'FLAGGED',
    bgColor: '#2e1a1a',
    accentColor: '#ef4444',
    textColor: '#ef4444'
  }
};
```

### 4. React Component Example

```jsx
import { useState, useEffect } from 'react';

function AgentIDWidget({ pubkey }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`https://agentid.provenanceai.network/badge/${pubkey}`)
      .then(res => res.json())
      .then(data => {
        setData(data);
        setLoading(false);
      });

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetch(`https://agentid.provenanceai.network/badge/${pubkey}`)
        .then(res => res.json())
        .then(setData);
    }, 60000);

    return () => clearInterval(interval);
  }, [pubkey]);

  if (loading) return <div>Loading...</div>;
  if (!data) return <div>Error loading badge</div>;

  const config = statusConfig[data.status];

  return (
    <div style={{ 
      background: config.bgColor,
      border: `2px solid ${config.accentColor}`,
      borderRadius: '12px',
      padding: '20px',
      color: 'white'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '32px' }}>{config.icon}</span>
        <div>
          <div style={{ color: config.textColor, fontSize: '12px', fontWeight: 600 }}>
            {config.label}
          </div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>
            {data.name}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: '28px', fontWeight: 700 }}>
            {data.score}
          </div>
          <div style={{ fontSize: '10px', color: '#888' }}>TRUST SCORE</div>
        </div>
      </div>
    </div>
  );
}
```

---

## JavaScript API

### Programmatic Badge Fetching

For dynamic applications, use the JavaScript API to fetch badge data:

```javascript
class AgentIDWidget {
  constructor(baseUrl = 'https://agentid.provenanceai.network') {
    this.baseUrl = baseUrl;
  }

  async getBadge(pubkey) {
    const response = await fetch(`${this.baseUrl}/badge/${pubkey}`);
    if (!response.ok) throw new Error('Badge fetch failed');
    return response.json();
  }

  async getReputation(pubkey) {
    const response = await fetch(`${this.baseUrl}/reputation/${pubkey}`);
    if (!response.ok) throw new Error('Reputation fetch failed');
    return response.json();
  }

  async getSVG(pubkey) {
    const response = await fetch(`${this.baseUrl}/badge/${pubkey}/svg`);
    if (!response.ok) throw new Error('SVG fetch failed');
    return response.text();
  }
}

// Usage
const widget = new AgentIDWidget();
const badge = await widget.getBadge('AgentPubkey...');
console.log(badge.score, badge.status);
```

### Vue.js Integration

```vue
<template>
  <div class="agent-badge" :class="statusClass">
    <div class="badge-header">
      <span class="badge-icon">{{ badgeData.badge }}</span>
      <span class="badge-label">{{ badgeData.label }}</span>
    </div>
    <div class="badge-score">{{ badgeData.score }}/100</div>
  </div>
</template>

<script>
export default {
  props: ['pubkey'],
  data() {
    return {
      badgeData: null,
      refreshInterval: null
    };
  },
  computed: {
    statusClass() {
      return `status-${this.badgeData?.status}`;
    }
  },
  async mounted() {
    await this.fetchBadge();
    this.refreshInterval = setInterval(this.fetchBadge, 60000);
  },
  beforeUnmount() {
    clearInterval(this.refreshInterval);
  },
  methods: {
    async fetchBadge() {
      const res = await fetch(`/api/badge/${this.pubkey}`);
      this.badgeData = await res.json();
    }
  }
};
</script>
```

---

## SVG Badge for README/Docs

### Direct SVG Embed

For GitHub README, documentation sites, or static pages:

```markdown
![AgentID Trust Badge](https://agentid.provenanceai.network/badge/{PUBKEY}/svg)
```

### Markdown with Link

Link the badge to your agent's profile:

```markdown
[![AgentID Trust Badge](https://agentid.provenanceai.network/badge/{PUBKEY}/svg)](https://agentid.provenanceai.network/agents/{PUBKEY})
```

### HTML with Alt Text

```html
<a href="https://agentid.provenanceai.network/agents/{PUBKEY}">
  <img 
    src="https://agentid.provenanceai.network/badge/{PUBKEY}/svg" 
    alt="AgentID Trust Score: 75/100 - Verified Agent"
    width="320"
    height="80"
  />
</a>
```

### GitHub README Example

```markdown
# My Trading Agent

[![AgentID](https://agentid.provenanceai.network/badge/AgentPubkey111111111111111111111111111111111/svg)](https://agentid.provenanceai.network/agents/AgentPubkey111111111111111111111111111111111)

An automated trading agent for Solana DeFi protocols.

## Features
- Real-time market analysis
- Automated trade execution
- Risk management
```

---

## Troubleshooting

### CORS Errors

**Problem:** `Access-Control-Allow-Origin` header errors in browser console.

**Solution:**
1. Ensure `CORS_ORIGIN` environment variable includes your domain:
   ```
   CORS_ORIGIN=https://agentid.provenanceai.network
   ```
2. For multiple origins, use a comma-separated list:
   ```
   CORS_ORIGIN=https://app1.com,https://app2.com
   ```
3. For development, you can use `*` (not recommended for production):
   ```
   CORS_ORIGIN=*
   ```

### Widget Not Loading

**Problem:** iframe shows blank or error page.

**Checklist:**
1. Verify the pubkey is correct and URL-encoded if necessary
2. Check browser console for 404 errors
3. Ensure the agent is registered:
   ```bash
   curl https://agentid.provenanceai.network/badge/{PUBKEY}
   ```
4. Check that the iframe dimensions are sufficient (min 320x200)

### Data Not Updating

**Problem:** Badge shows stale data.

**Solutions:**
1. The widget auto-refreshes every 60 seconds - wait for next cycle
2. Badge data is cached for 60 seconds (configurable via `BADGE_CACHE_TTL`)
3. Force refresh by adding cache-buster:
   ```html
   <iframe src="https://agentid.provenanceai.network/widget/{PUBKEY}?t=123456"></iframe>
   ```

### SVG Not Rendering

**Problem:** SVG badge shows as broken image or text.

**Solutions:**
1. Verify the pubkey is valid and registered
2. Check Content-Type header is `image/svg+xml`
3. For GitHub/MDX, ensure raw SVG URL is used (not API endpoint)

### Rate Limiting

**Problem:** 429 Too Many Requests errors.

**Solutions:**
1. Default tier: 100 requests per 15 minutes per IP
2. Implement client-side caching
3. For high-traffic applications, contact support for increased limits

### Styling Conflicts

**Problem:** Widget styles conflict with parent page.

**Solutions:**
1. Use the `seamless` attribute (experimental):
   ```html
   <iframe seamless src="..."></iframe>
   ```
2. Wrap in a container with `all: initial`:
   ```html
   <div style="all: initial;">
     <iframe ...></iframe>
   </div>
   ```

---

## Best Practices

### Performance

1. **Lazy Loading:** Defer widget loading until visible:
   ```html
   <iframe loading="lazy" src="..."></iframe>
   ```

2. **Intersection Observer:** Load only when scrolled into view:
   ```javascript
   const observer = new IntersectionObserver((entries) => {
     entries.forEach(entry => {
       if (entry.isIntersecting) {
         entry.target.src = entry.target.dataset.src;
       }
     });
   });
   ```

### Accessibility

1. **Always include a title:**
   ```html
   <iframe title="AgentID Trust Badge for My Trading Agent" ...></iframe>
   ```

2. **Provide fallback content:**
   ```html
   <iframe ...>
     <p>View trust badge at <a href="...">AgentID</a></p>
   </iframe>
   ```

### Security

1. **Use sandbox attribute for untrusted content:**
   ```html
   <iframe sandbox="allow-scripts allow-same-origin" ...></iframe>
   ```

2. **Validate pubkey format before embedding:**
   ```javascript
   function isValidPubkey(pubkey) {
     return /^[A-HJ-NP-Za-km-z1-9]{32,44}$/.test(pubkey);
   }
   ```

---

## API Reference

### Widget Endpoint

```
GET /widget/:pubkey
```

Returns a complete HTML page with the styled widget.

### Badge JSON Endpoint

```
GET /badge/:pubkey
```

Returns badge data as JSON for custom implementations.

### Badge SVG Endpoint

```
GET /badge/:pubkey/svg
```

Returns the badge as an SVG image (320x80px).

---

## Support

For integration support or feature requests:

- **Documentation:** https://agentid.provenanceai.network/docs
- **API Status:** https://agentid.provenanceai.network/health
- **GitHub Issues:** https://github.com/RunTimeAdmin/AgentID/issues

---

*Document Version: 1.0.0*  
*Last Updated: April 2026*
