# Widget Guide

<cite>
**Referenced Files in This Document**
- [WIDGET_GUIDE.md](file://docs/WIDGET_GUIDE.md)
- [AGENT_OWNER_GUIDE.md](file://docs/AGENT_OWNER_GUIDE.md)
- [Widget.jsx](file://frontend/src/widget/Widget.jsx)
- [widget-entry.jsx](file://frontend/src/widget/widget-entry.jsx)
- [widget.css](file://frontend/src/widget/widget.css)
- [widget.js](file://backend/src/routes/widget.js)
- [badgeBuilder.js](file://backend/src/services/badgeBuilder.js)
- [queries.js](file://backend/src/models/queries.js)
- [api.js](file://frontend/src/lib/api.js)
- [index.js](file://backend/src/config/index.js)
- [server.js](file://backend/server.js)
- [transform.js](file://backend/src/utils/transform.js)
- [bagsReputation.js](file://backend/src/services/bagsReputation.js)
- [widget.html](file://frontend/widget.html)
- [README.md](file://README.md)
- [API_REFERENCE.md](file://docs/API_REFERENCE.md)
</cite>

## Update Summary
**Changes Made**
- Enhanced practical examples section with comprehensive curl command integration
- Added detailed agent owner workflow examples from the Agent Owner Guide
- Expanded demonstration and testing section with practical registration scenarios
- Updated domain references to reflect the production environment
- Improved integration examples with real-world use cases

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Practical Integration Examples](#practical-integration-examples)
7. [Agent Owner Workflow](#agent-owner-workflow)
8. [Demonstration and Testing](#demonstration-and-testing)
9. [Dependency Analysis](#dependency-analysis)
10. [Performance Considerations](#performance-considerations)
11. [Troubleshooting Guide](#troubleshooting-guide)
12. [Conclusion](#conclusion)

## Introduction
This guide explains how to integrate and customize the AgentID Widget, a visual trust indicator that displays real-time reputation data for agents. The widget supports three delivery modes:
- iframe embed for quick integration
- Self-hosted React component using the JSON API
- Direct SVG badge for documentation and README files

Key features include automatic 60-second refresh, responsive design, and zero external dependencies for the iframe version.

**Updated** The guide now incorporates comprehensive practical examples from the Agent Owner Guide, providing real-world workflows for agent registration, verification, and badge display.

## Project Structure
The widget spans both frontend and backend components:
- Frontend: React-based widget renderer with Tailwind CSS styling
- Backend: Express routes that serve HTML, JSON, and SVG badges
- Shared configuration and utilities for caching, reputation computation, and data transformation

```mermaid
graph TB
subgraph "Frontend"
FE_Widget["Widget.jsx<br/>React Component"]
FE_Entry["widget-entry.jsx<br/>Entry Point"]
FE_CSS["widget.css<br/>Styling"]
FE_HTML["widget.html<br/>Container"]
FE_API["api.js<br/>Axios Wrapper"]
end
subgraph "Backend"
BE_Server["server.js<br/>Express App"]
BE_Routes["routes/widget.js<br/>Widget Route"]
BE_Builder["services/badgeBuilder.js<br/>HTML/SVG/JSON Builder"]
BE_Config["config/index.js<br/>Environment Config"]
BE_Transform["utils/transform.js<br/>Escaping & Validation"]
BE_Queries["models/queries.js<br/>Database Queries"]
BE_Reputation["services/bagsReputation.js<br/>Reputation Engine"]
end
FE_Widget --> FE_API
FE_Widget --> FE_CSS
FE_Entry --> FE_Widget
FE_HTML --> FE_Entry
BE_Server --> BE_Routes
BE_Routes --> BE_Builder
BE_Builder --> BE_Queries
BE_Builder --> BE_Reputation
BE_Builder --> BE_Transform
BE_Builder --> BE_Config
```

**Diagram sources**
- [server.js:1-104](file://backend/server.js#L1-L104)
- [widget.js:1-89](file://backend/src/routes/widget.js#L1-L89)
- [badgeBuilder.js:1-556](file://backend/src/services/badgeBuilder.js#L1-L556)
- [Widget.jsx:1-218](file://frontend/src/widget/Widget.jsx#L1-L218)
- [widget-entry.jsx:1-11](file://frontend/src/widget/widget-entry.jsx#L1-L11)
- [widget.css:1-70](file://frontend/src/widget/widget.css#L1-L70)
- [api.js:1-147](file://frontend/src/lib/api.js#L1-L147)
- [index.js:1-34](file://backend/src/config/index.js#L1-L34)
- [transform.js:1-103](file://backend/src/utils/transform.js#L1-L103)
- [queries.js:1-444](file://backend/src/models/queries.js#L1-L444)
- [bagsReputation.js:1-146](file://backend/src/services/bagsReputation.js#L1-L146)

**Section sources**
- [server.js:1-104](file://backend/server.js#L1-L104)
- [widget.js:1-89](file://backend/src/routes/widget.js#L1-L89)
- [badgeBuilder.js:1-556](file://backend/src/services/badgeBuilder.js#L1-L556)
- [Widget.jsx:1-218](file://frontend/src/widget/Widget.jsx#L1-L218)
- [widget-entry.jsx:1-11](file://frontend/src/widget/widget-entry.jsx#L1-L11)
- [widget.css:1-70](file://frontend/src/widget/widget.css#L1-L70)
- [api.js:1-147](file://frontend/src/lib/api.js#L1-L147)
- [index.js:1-34](file://backend/src/config/index.js#L1-L34)
- [transform.js:1-103](file://backend/src/utils/transform.js#L1-L103)
- [queries.js:1-444](file://backend/src/models/queries.js#L1-L444)
- [bagsReputation.js:1-146](file://backend/src/services/bagsReputation.js#L1-L146)

## Core Components
- Widget React Component: Fetches badge data, renders status, score, and metadata, and auto-refreshes every 60 seconds.
- Widget Entry Point: Initializes the React root and mounts the widget.
- Widget Styles: Tailwind-based CSS with dark theme and animations.
- Backend Widget Route: Validates agent existence and serves prebuilt HTML widget.
- Badge Builder Service: Generates JSON, SVG, and HTML widget content with caching and reputation computation.
- API Layer: Axios wrapper for frontend requests and backend route handlers.

**Section sources**
- [Widget.jsx:1-218](file://frontend/src/widget/Widget.jsx#L1-L218)
- [widget-entry.jsx:1-11](file://frontend/src/widget/widget-entry.jsx#L1-L11)
- [widget.css:1-70](file://frontend/src/widget/widget.css#L1-L70)
- [widget.js:1-89](file://backend/src/routes/widget.js#L1-L89)
- [badgeBuilder.js:1-556](file://backend/src/services/badgeBuilder.js#L1-L556)
- [api.js:1-147](file://frontend/src/lib/api.js#L1-L147)

## Architecture Overview
The widget pipeline integrates frontend and backend components to deliver a responsive, secure, and performant trust indicator.

```mermaid
sequenceDiagram
participant Browser as "Browser"
participant Frontend as "Widget.jsx"
participant API as "api.js"
participant Server as "server.js"
participant Route as "routes/widget.js"
participant Builder as "services/badgeBuilder.js"
participant DB as "models/queries.js"
participant Rep as "services/bagsReputation.js"
Browser->>Frontend : Load widget iframe
Frontend->>API : GET /badge/ : pubkey
API->>Server : Forward request
Server->>Route : Match /widget/ : pubkey
Route->>DB : getAgent(pubkey)
DB-->>Route : Agent record
Route->>Builder : getWidgetHTML(pubkey)
Builder->>Rep : computeBagsScore(pubkey)
Rep-->>Builder : Score breakdown
Builder->>DB : getAgentActions(pubkey)
DB-->>Builder : Action stats
Builder-->>Route : HTML widget
Route-->>Frontend : 200 OK HTML
Frontend-->>Browser : Render widget
Note over Frontend : Auto-refresh every 60 seconds
```

**Diagram sources**
- [Widget.jsx:73-102](file://frontend/src/widget/Widget.jsx#L73-L102)
- [api.js:52-56](file://frontend/src/lib/api.js#L52-L56)
- [server.js:66-76](file://backend/server.js#L66-L76)
- [widget.js:18-86](file://backend/src/routes/widget.js#L18-L86)
- [badgeBuilder.js:17-89](file://backend/src/services/badgeBuilder.js#L17-L89)
- [queries.js:36-202](file://backend/src/models/queries.js#L36-L202)
- [bagsReputation.js:16-122](file://backend/src/services/bagsReputation.js#L16-L122)

## Detailed Component Analysis

### Widget React Component
Responsibilities:
- Extract pubkey from URL path
- Fetch badge data via API with error handling
- Auto-refresh every 60 seconds
- Render status, score, and metadata with Tailwind classes
- Provide loading skeleton and error states

```mermaid
flowchart TD
Start(["Mount Widget"]) --> GetPubkey["Extract pubkey from pathname"]
GetPubkey --> HasPubkey{"Pubkey present?"}
HasPubkey --> |No| ShowError["Set error state"]
HasPubkey --> |Yes| Fetch["Fetch /badge/:pubkey"]
Fetch --> Success{"HTTP 200?"}
Success --> |No| HandleError["Set error state"]
Success --> |Yes| Render["Render widget with status and score"]
Render --> Schedule["Schedule interval (60s)"]
Schedule --> Fetch
ShowError --> End(["Exit"])
HandleError --> End
```

**Diagram sources**
- [Widget.jsx:61-102](file://frontend/src/widget/Widget.jsx#L61-L102)
- [Widget.jsx:73-94](file://frontend/src/widget/Widget.jsx#L73-L94)

**Section sources**
- [Widget.jsx:1-218](file://frontend/src/widget/Widget.jsx#L1-L218)

### Backend Widget Route
Responsibilities:
- Validate agent existence
- Return simple HTML error page for missing agents
- Generate and return HTML widget via builder service
- Apply rate limiting and sanitize inputs

```mermaid
flowchart TD
Req["GET /widget/:pubkey"] --> Validate["Validate pubkey"]
Validate --> Exists{"Agent exists?"}
Exists --> |No| ErrorHTML["Return 404 HTML"]
Exists --> |Yes| Build["getWidgetHTML(pubkey)"]
Build --> Send["Send HTML response"]
ErrorHTML --> End(["Exit"])
Send --> End
```

**Diagram sources**
- [widget.js:18-86](file://backend/src/routes/widget.js#L18-L86)
- [badgeBuilder.js:220-549](file://backend/src/services/badgeBuilder.js#L220-L549)

**Section sources**
- [widget.js:1-89](file://backend/src/routes/widget.js#L1-L89)

### Badge Builder Service
Responsibilities:
- Compute BAGS reputation score using multiple factors
- Aggregate action statistics and derive success rate
- Determine status (verified/unverified/flagged) and tier (verified/standard)
- Generate JSON, SVG, and HTML widget content
- Apply caching with configurable TTL

```mermaid
classDiagram
class BadgeBuilder {
+getBadgeJSON(pubkey) Promise~Object~
+getBadgeSVG(pubkey) Promise~string~
+getWidgetHTML(pubkey) Promise~string~
-escapeXml(text) string
}
class ReputationEngine {
+computeBagsScore(pubkey) Promise~Object~
+refreshAndStoreScore(pubkey) Promise~Object~
}
class DatabaseQueries {
+getAgent(pubkey) Promise~Object|null~
+getAgentActions(pubkey) Promise~Object~
+getUnresolvedFlagCount(pubkey) Promise~number~
+updateBagsScore(pubkey, score) Promise~Object|null~
}
BadgeBuilder --> ReputationEngine : "uses"
BadgeBuilder --> DatabaseQueries : "uses"
```

**Diagram sources**
- [badgeBuilder.js:17-89](file://backend/src/services/badgeBuilder.js#L17-L89)
- [bagsReputation.js:16-140](file://backend/src/services/bagsReputation.js#L16-L140)
- [queries.js:36-202](file://backend/src/models/queries.js#L36-L202)

**Section sources**
- [badgeBuilder.js:1-556](file://backend/src/services/badgeBuilder.js#L1-L556)
- [bagsReputation.js:1-146](file://backend/src/services/bagsReputation.js#L1-L146)
- [queries.js:1-444](file://backend/src/models/queries.js#L1-L444)

### Configuration and Environment
- Port, CORS origin, cache TTL, and verified threshold are configured via environment variables
- Agent base URL is used to construct widget URLs in generated HTML

**Updated** The agent base URL configuration now uses `agentIdBaseUrl` which defaults to the production domain `agentid.provenanceai.network`.

**Section sources**
- [index.js:1-34](file://backend/src/config/index.js#L1-L34)
- [badgeBuilder.js:59](file://backend/src/services/badgeBuilder.js#L59)

## Practical Integration Examples

### Direct API Integration with curl Commands
The AgentID platform provides comprehensive REST APIs that can be integrated directly using curl commands for testing and automation purposes.

**Basic Badge Retrieval**
```bash
# Get agent badge information
curl https://agentid.provenanceai.network/badge/{AGENT_PUBKEY}
```

**Widget Generation**
```bash
# Generate widget HTML for embedding
curl https://agentid.provenanceai.network/widget/{AGENT_PUBKEY}
```

**SVG Badge Creation**
```bash
# Download SVG badge for documentation
curl https://agentid.provenanceai.network/badge/{AGENT_PUBKEY}/svg
```

**Real-time Integration Pattern**
```bash
#!/bin/bash
# Example: Monitor agent reputation changes
AGENT_PUBKEY="AgentPubkey111111111111111111111111111111111"

while true; do
  echo "Checking reputation for $(date)"
  curl -s https://agentid.provenanceai.network/badge/$AGENT_PUBKEY | jq '.score'
  sleep 60
done
```

**Section sources**
- [AGENT_OWNER_GUIDE.md:121-142](file://docs/AGENT_OWNER_GUIDE.md#L121-L142)
- [WIDGET_GUIDE.md:527-552](file://docs/WIDGET_GUIDE.md#L527-L552)

## Agent Owner Workflow

### Complete Registration and Verification Process
The Agent Owner Guide provides a comprehensive workflow for agent registration and verification that demonstrates practical integration scenarios.

**Web Interface Registration Flow**
1. Navigate to https://agentid.provenanceai.network/register
2. Enter public key, agent name, and basic information
3. Complete challenge-response verification
4. Configure metadata and capabilities
5. Receive agent ID and verify status

**Demo Page Testing**
The demo page provides a guided walkthrough for understanding the complete registration flow:
- Automatic keypair generation in browser
- Step-by-step guidance through all registration stages
- Real-time badge display upon completion

**Direct API Integration**
Advanced users can integrate directly with the API using curl commands:
- Registration with cryptographic signatures
- Challenge-response verification workflow
- Badge data retrieval and display

**Section sources**
- [AGENT_OWNER_GUIDE.md:70-142](file://docs/AGENT_OWNER_GUIDE.md#L70-L142)
- [AGENT_OWNER_GUIDE.md:145-202](file://docs/AGENT_OWNER_GUIDE.md#L145-L202)

## Demonstration and Testing

### Interactive Demo Integration
The frontend demo page provides comprehensive examples of widget integration and testing scenarios.

**Step-by-Step Demo Process**
1. Generate temporary keypair in browser
2. Automatically complete registration workflow
3. Demonstrate verification process
4. Show live badge display and updates

**API Call Examples in Demo**
The demo includes collapsible sections showing complete curl command examples:
- Registration with proper signature format
- Challenge issuance and response submission
- Badge data retrieval and parsing

**Testing Best Practices**
- Use the demo page for initial integration testing
- Verify widget loading with minimal dimensions
- Test auto-refresh behavior and error handling
- Validate SVG badge rendering across different hosts

**Section sources**
- [AGENT_OWNER_GUIDE.md:107-120](file://docs/AGENT_OWNER_GUIDE.md#L107-L120)
- [Demo.jsx:58-87](file://frontend/src/pages/Demo.jsx#L58-L87)

## Dependency Analysis
The widget relies on a clear separation of concerns:
- Frontend depends on its own Axios wrapper and Tailwind CSS
- Backend routes depend on the badge builder service
- Badge builder depends on reputation computation and database queries
- Utilities provide escaping and validation

```mermaid
graph LR
FE_Widget["Widget.jsx"] --> FE_API["api.js"]
FE_Widget --> FE_CSS["widget.css"]
BE_Route["routes/widget.js"] --> BE_Builder["services/badgeBuilder.js"]
BE_Builder --> BE_Queries["models/queries.js"]
BE_Builder --> BE_Reputation["services/bagsReputation.js"]
BE_Builder --> BE_Transform["utils/transform.js"]
BE_Builder --> BE_Config["config/index.js"]
```

**Diagram sources**
- [Widget.jsx:1-218](file://frontend/src/widget/Widget.jsx#L1-L218)
- [api.js:1-147](file://frontend/src/lib/api.js#L1-L147)
- [widget.js:1-89](file://backend/src/routes/widget.js#L1-L89)
- [badgeBuilder.js:1-556](file://backend/src/services/badgeBuilder.js#L1-L556)
- [queries.js:1-444](file://backend/src/models/queries.js#L1-L444)
- [bagsReputation.js:1-146](file://backend/src/services/bagsReputation.js#L1-L146)
- [transform.js:1-103](file://backend/src/utils/transform.js#L1-L103)
- [index.js:1-34](file://backend/src/config/index.js#L1-L34)

**Section sources**
- [Widget.jsx:1-218](file://frontend/src/widget/Widget.jsx#L1-L218)
- [api.js:1-147](file://frontend/src/lib/api.js#L1-L147)
- [widget.js:1-89](file://backend/src/routes/widget.js#L1-L89)
- [badgeBuilder.js:1-556](file://backend/src/services/badgeBuilder.js#L1-L556)
- [queries.js:1-444](file://backend/src/models/queries.js#L1-L444)
- [bagsReputation.js:1-146](file://backend/src/services/bagsReputation.js#L1-L146)
- [transform.js:1-103](file://backend/src/utils/transform.js#L1-L103)
- [index.js:1-34](file://backend/src/config/index.js#L1-L34)

## Performance Considerations
- Caching: Badge data is cached with a configurable TTL to reduce database and upstream API load.
- Auto-refresh: The widget reloads every 60 seconds to balance freshness and performance.
- Lazy loading: For iframe embeds, use the native lazy loading attribute to defer rendering until visible.
- Minimizing payload: Prefer SVG badges for lightweight static displays in documentation.

**Updated** Performance considerations now include practical examples from the Agent Owner Guide showing real-world integration patterns and optimization techniques.

## Troubleshooting Guide
Common issues and resolutions:
- CORS errors: Ensure the frontend origin is included in the CORS configuration.
- Widget not loading: Verify the pubkey format and agent registration; confirm minimum iframe dimensions.
- Data staleness: Understand the 60-second cache TTL and consider adding a cache-busting parameter.
- SVG rendering: Confirm correct endpoint and content-type; use raw SVG URLs for static hosts.
- Rate limiting: Default limits apply; implement client-side caching and avoid excessive polling.
- Styling conflicts: Use the seamless attribute or reset inherited styles in the container.

**Updated** Domain migration affects CORS configuration and widget URLs. Ensure your CORS_ORIGIN includes the new domain `agentid.provenanceai.network` and update any hardcoded widget URLs to use the new domain.

**Section sources**
- [WIDGET_GUIDE.md:396-474](file://docs/WIDGET_GUIDE.md#L396-L474)
- [index.js:22-27](file://backend/src/config/index.js#L22-L27)
- [badgeBuilder.js:20-24](file://backend/src/services/badgeBuilder.js#L20-L24)

## Conclusion
The AgentID Widget provides a flexible, secure, and performant way to display agent trust indicators. Choose the iframe embed for simplicity, self-hosted React for customization, or SVG for static documentation. Leverage caching, auto-refresh, and proper error handling to ensure a smooth user experience.

**Updated** The comprehensive integration examples from the Agent Owner Guide demonstrate practical workflows for agent registration, verification, and badge display, making the Widget Guide suitable for both technical implementation and business adoption scenarios. The domain migration to `agentid.provenanceai.network` ensures production-ready deployment with proper SSL certificates and DNS configuration. All widget integrations should now use the new domain for reliable access to trust badges and reputation data.