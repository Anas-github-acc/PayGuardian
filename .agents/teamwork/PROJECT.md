# Project: PayGuardian Agent Workspace & Delegation Dashboard Redesign

See authoritative blueprint in:
`.agents/teamwork/orchestrator_1/PROJECT.md`

## Architecture Summary
- **TurboStarter Architecture**: 3-panel responsive layout (Left: Sessions/Memory, Center: 3D Spatial Canvas + Budget Strip + Live Feed, Right: Chat & Decision Stream), sticky top navigation bar with environment switcher, status pill, reconnect banner.
- **Efferd Visual Identity**: True obsidian ground (`#000000`), `#0d0d0d` cards, hairline 1px borders (`#ffffff1c`), `.top-shade` specular rim lighting, Geist typography, restrained color palette (<4% colored pixels).
- **Ferrow 3D Multi-Agent Canvas**: Three.js spatial agent network canvas with solid (funded authority) vs dashed (unfunded attachment) edges, live state micro-animations (authority flow, payment pulse, rejection flash, revocation desaturation), and a keyboard-accessible list view.
- **Two Voices Chat Pipeline**: Strictly separate `AgentSays` (escaped text) from `VerifiedBlock` (gateway cards).
- **Zero Floating-Point Financials**: Exact integer minor unit math.
- **Environment Isolation**: Atomic workspace state reset on environment change.
