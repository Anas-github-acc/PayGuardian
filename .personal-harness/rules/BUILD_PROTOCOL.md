---
name: build-protocol
description: Use when starting, planning, or scoping a new project, product, SDK, MCP server, or website
---

# Build Protocol

Work through the steps in order. Do not start a step until I approve the previous one. Save each step's output to `/docs/<step>.md`. Put assumptions and open questions at the top of every output. Keep outputs concise.

## 0. Input
- first check if their is any `input.md` file in the root if so then that the input file containing problem statement, functional and non-functional requirements.
- Ask me for a problem statement, functional and non-functional requirements, or any file (PRD, notes, sketch, repo, spreadsheet) from any location.
- If I give a file path, read it first. Ask only for what is still missing.
- Done when: the problem and requirements are restated in `input.md` and I confirm them.

## 1. Delivery Format
- Recommend one or more of: SDK, MCP server, website, API, CLI. Give reasons.
- Done when: I choose the format.

## 2. Project Spec
- Write the user flows and create an acceptance checklist (functional and non-functional requirements).
- Output: `/docs/spec.md`.

## 3. Architecture
- Define the data structures, APIs, services, and data flow. Add a diagram where it helps.
- Output: `/docs/architecture.md`.

## 4. Tech Decisions
- Recommend the stack, libraries, DataBase, hosting, and tools. Give a short trade-off note for each, with recommended option.
- Ask me to choose before continuing.
- Output: `/docs/tech.md`.

## 5. Engineering Standards
- Propose the folder structure, coding conventions, and security practices (secrets, auth, input validation, dependency hygiene).
- Ask me to confirm.
- Output: `/docs/standards.md`.

## 6. Phases
- Split the work into small, shippable phases.
- Each phase has a goal, scope, and definition of done.
- Output: `/docs/phases.md`.

## 7. Testing (every phase)
- Automated: decide what test need for each phase like unit tests and e2e tests or manual test for the phase.
- Manual: a step-by-step checklist I can run.
- A phase is not done until passes test. Show me the results before starting the next phase.

## 8. Logging and Metrics
- This should be the last part, define structured logging, error tracking, and key metrics (latency, error rate, usage).
- Output: `/docs/observability.md`.

## Rules
- Ask me before any major or irreversible decision.
- Never invent requirements. If something is unclear, list it as an open question.
