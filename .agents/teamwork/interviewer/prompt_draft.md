use main agent under that subagent to complete this designing part - first decide how you are gonna assign task to each subagents their task and whats your role for this work. Redesign the frontend for PayGuardian into a production-grade Agent Workspace and Delegation Dashboard based on the specification, synthesizing TurboStarter for structure, Efferd for visual styling, and Ferrow for 3D multi-agent architecture visualization.

Working directory: /home/anas/myspace/AI/PayGuardian
Integrity mode: development

## References
- TurboStarter: https://demo.turbostarter.dev/ (structure, layout, components, navigation, interactions)
- Efferd: https://efferd.com/ (visual identity: colors, backgrounds, typography, sizes, spacing, borders, shadows)
- Ferrow: https://illos-ferrow-template.vercel.app/#start (3D agent architecture visualization, node positioning, animations, lighting, depth, interactions)
- Frontend Specification: Agent Workspace and Delegation Dashboard
- Taste Skill guidelines: locate and read installed SKILL.md before implementation

## Verification Resources
- Test suites: Vitest unit tests in repository and Playwright end-to-end tests
- Visual and interaction verification: Chrome DevTools Protocol (CDP) inspection comparing local implementation with the 3 live reference websites

## Requirements

### R1. Design System and Reference Synthesis
Inspect the existing codebase and all three references, locate and review the Taste Skill guideline, and establish a cohesive, premium design system without generic AI-generated aesthetics before writing UI code. Preserve existing business logic and reuse existing components and dependencies wherever appropriate.

### R2. App Shell, Authentication, and Environment Management
Implement the application shell with environment switcher, status pill, navigation, and live reconnect banner; authentication flows supporting passkeys with fallback; and the 5-step create-environment wizard with budget, guardrails, and mandate-derived consent generation. Scope implementation to P0 (core MVP) and P1 specification items, treating P2 as optional stretch.

### R3. Three-Panel Workspace and Interactive 3D Agent Network Canvas
Build the three-panel workspace containing session management, main and subagent chat with streaming responses and gateway-verified cards (budget plan, payment result, rejection with plain-language reason, delegation, memory with undo), and an interactive 3D network canvas showing the orchestrator and connected subagents with node positioning, animations, lighting, depth, and live state updates, alongside an accessible keyboard list view.

### R4. Approvals, Payment Traces, Mandates, and Activity Auditing
Deliver the mobile-first approval inbox with card details, plain-language reasons, and approve/reject actions; payment trace views displaying vertical chains, lifecycle timelines, and gateway verification checklists; AG Grid-powered tables for mandates, policies, and activity audit logs with server-side paging and filtering; and the security center with environment pause, authority revocation, and security event logs.

### R5. Agent Library, Developer Connect, Simulator, and Backend Integration
Deliver the agent library for browsing, detail inspection, and attaching agents; the developer connection portal with MCP endpoint snippets, key management, and connection testing; and the attack simulator for sandbox environments. Integrate with existing repository services and endpoints, creating or updating necessary endpoints and operations, with mock fallbacks for external dependencies.

## Acceptance Criteria

### Visual and Architectural Verification
- [ ] UI combines TurboStarter layout, Efferd visual styling, and Ferrow 3D agent network visualization into a single cohesive design system following Taste Skill guidelines.
- [ ] CDP inspection of the running frontend confirms visual fidelity, responsive layout (desktop-first three panels, tablet/mobile adaptations), and interaction consistency against the reference sites.
- [ ] Visual distinction between solid (authorized) and dashed (unfunded) nodes is maintained across all graph states.

### Authority and Security Integrity
- [ ] Gateway-verified facts (budgets, decisions, traces) render strictly through dedicated components distinct from agent chat text.
- [ ] Agent-written and third-party text is escaped and cannot inject markup or render gateway cards.
- [ ] Currency amounts are handled as minor units with zero floating-point arithmetic in the frontend.
- [ ] Environment switching completely resets chat, graph, and selection state to prevent cross-environment leakage.

### Functional Deliverables
- [ ] Create-environment wizard generates consent text dynamically from mandate values and persists environment upon explicit approval.
- [ ] 3D agent network canvas renders the orchestrator and subagents with interactive navigation, live state animations (authority flow, pulse on payment, red flash on rejection, grey on revocation), and a keyboard list view.
- [ ] Approval inbox displays request details with plain-language reasons and functional Approve/Reject actions.
- [ ] Payment trace displays the vertical authorization chain, lifecycle stage timeline, and gateway verification checklist.
- [ ] Mandate and activity tables use AG Grid with server-side paging, filtering, and row-click trace navigation.
- [ ] Developer portal provides MCP server URL, setup snippets, and connection testing.
- [ ] Sandbox attack simulator triggers simulated rule violations streaming into graph and activity feed with simulation badges.

### Automated Testing
- [ ] Component tests (Vitest) pass for money display, authority badges, and gateway verification components.
- [ ] End-to-end tests (Playwright) pass for core flows: create environment, attach agent, approve budget plan, payment success/rejection, revoke subtree, and approval flow.
