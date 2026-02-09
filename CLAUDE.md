# AionUi - Project Guide for Claude

## Project Overview

**AionUi** is a unified AI agent graphical interface that transforms command-line AI agents into a modern, efficient chat interface. It supports multiple CLI AI tools including Gemini CLI, Claude Code, CodeX, Qwen Code, OpenClaw, and more.

- **Version**: 1.8.5
- **License**: Apache-2.0
- **Platform**: Cross-platform (macOS, Windows, Linux)

## Tech Stack

### Core

- **Electron 37.x** - Desktop application framework
- **React 19.x** - UI framework
- **TypeScript 5.8.x** - Programming language
- **Express 5.x** - Web server (for WebUI remote access)

### Build Tools

- **Webpack 6.x** - Module bundler (via @electron-forge/plugin-webpack)
- **Electron Forge 7.8.x** - Build tooling
- **Electron Builder 26.x** - Application packaging

### UI & Styling

- **Arco Design 2.x** - Enterprise UI component library
- **UnoCSS 66.x** - Atomic CSS engine (presetMini + presetExtra + presetWind3)
- **Monaco Editor 4.x** - Code editor
- **CodeMirror 6.x** - Secondary code editor (CSS, JSON, Markdown)

### AI Integration

- **Anthropic SDK** - Claude API
- **Google GenAI** - Gemini API
- **OpenAI SDK** - OpenAI/Codex API
- **MCP SDK** - Model Context Protocol
- **AionCLI Core** - Shared agent core library

### Data & Storage

- **Better SQLite3** - Local database (migration-based schema, currently v5)
- **Zod** - Data validation

### Messaging & Channels

- **Grammy** - Telegram bot framework
- **Lark SDK** (`@larksuiteoapi/node-sdk`) - Lark/Feishu integration

## Project Structure

```
src/
├── index.ts                 # Main process entry
├── preload.ts               # Electron preload (IPC bridge)
├── adapter/                 # Runtime environment adapters (browser, main)
├── agent/                   # AI agent implementations
│   ├── acp/                 # ACP protocol agent (Claude, Qwen, etc.)
│   ├── codex/               # OpenAI Codex agent
│   ├── gemini/              # Google Gemini agent (with CLI tools subsystem)
│   └── openclaw/            # OpenClaw Gateway agent
├── channels/                # External messaging channel system
│   ├── actions/             # Chat, Platform, System actions
│   ├── agent/               # Event bus, message service
│   ├── core/                # Channel & session management
│   ├── gateway/             # Action executor, plugin manager
│   ├── pairing/             # Device/account pairing service
│   ├── plugins/             # Channel plugins
│   │   ├── telegram/        # Telegram bot integration
│   │   └── lark/            # Lark (Feishu) integration
│   └── utils/               # Credential crypto & utilities
├── common/                  # Shared utilities & types
│   ├── adapters/            # Protocol converters (OpenAI↔Anthropic, OpenAI↔Gemini)
│   ├── codex/               # Codex-specific types
│   ├── document/            # Document processing
│   └── approval/            # Approval flow utilities
├── process/                 # Main process services
│   ├── database/            # SQLite operations & migrations
│   ├── bridge/              # IPC communication (24+ bridge modules)
│   ├── task/                # Agent managers & middleware
│   │   ├── AcpAgentManager.ts
│   │   ├── CodexAgentManager.ts
│   │   ├── GeminiAgentManager.ts
│   │   ├── OpenClawAgentManager.ts
│   │   ├── BaseAgentManager.ts
│   │   ├── MessageMiddleware.ts
│   │   └── ThinkTagDetector.ts
│   └── services/            # Backend services
│       ├── mcpServices/     # MCP protocol (multi-agent)
│       └── cron/            # Task scheduling
├── renderer/                # UI application
│   ├── pages/               # Page components
│   │   ├── conversation/    # Chat interface (main feature)
│   │   │   ├── acp/         # ACP agent chat UI
│   │   │   ├── codex/       # Codex agent chat UI
│   │   │   ├── gemini/      # Gemini agent chat UI
│   │   │   ├── openclaw/    # OpenClaw agent chat UI
│   │   │   ├── preview/     # File preview panel (diff, txt, etc.)
│   │   │   └── workspace/   # Workspace management
│   │   ├── settings/        # Settings management
│   │   │   ├── SecuritySettings.tsx  # Security & yolo mode settings
│   │   │   ├── CustomAcpAgent/       # Custom agent configuration
│   │   │   └── McpManagement/        # MCP server management
│   │   ├── cron/            # Scheduled tasks
│   │   ├── login/           # Authentication
│   │   ├── guid/            # GUID display page
│   │   └── test/            # Component showcase (dev only)
│   ├── components/          # Reusable UI components
│   ├── hooks/               # React hooks
│   ├── context/             # Global state (React Context)
│   ├── messages/            # Type-safe IPC message system
│   ├── services/            # Client-side services
│   ├── i18n/                # Internationalization
│   ├── bootstrap/           # App initialization
│   ├── config/              # Client configuration
│   ├── theme/               # Theme management
│   └── utils/               # Utility functions
├── webserver/               # Web server for remote access
│   ├── routes/              # HTTP routes (API, auth, static)
│   ├── websocket/           # Real-time communication
│   ├── middleware/           # CSRF, rate limiting, security
│   └── auth/                # JWT authentication
├── worker/                  # Background task workers
│   ├── acp.ts               # ACP worker
│   ├── codex.ts             # Codex worker
│   ├── gemini.ts            # Gemini worker
│   ├── openclaw-gateway.ts  # OpenClaw Gateway worker
│   └── fork/                # Generic fork-based task execution
├── shims/                   # Module shims (xterm-headless)
├── types/                   # TypeScript type definitions
└── utils/                   # Main process utilities
```

## Development Commands

```bash
# Development
npm start              # Start dev environment (Electron + webpack dev server)
npm run webui          # Start WebUI server (local access)
npm run webui:remote   # Start WebUI server (remote access)
npm run webui:prod     # Production WebUI (local)

# Code Quality
npm run lint           # Run ESLint
npm run lint:fix       # Auto-fix lint issues
npm run format         # Format with Prettier
npm run format:check   # Check formatting without writing

# Testing
npm test               # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
npm run test:contract  # Run contract tests only
npm run test:integration # Run integration tests only

# Building
npm run build          # Full build (macOS arm64 + x64)
npm run dist:mac       # macOS build
npm run dist:win       # Windows build
npm run dist:linux     # Linux build
npm run build-mac:arm64 # macOS ARM64 only
npm run build-mac:x64  # macOS x64 only

# Utilities
npm run resetpass      # Reset WebUI password via CLI
```

## Code Conventions

### Naming

- **Components**: PascalCase (`Button.tsx`, `Modal.tsx`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Constants**: UPPER_SNAKE_CASE
- **Unused params**: prefix with `_`

### TypeScript

- Strict mode enabled (`noImplicitAny: true`)
- Use path aliases: `@/*`, `@process/*`, `@renderer/*`, `@worker/*`
- Prefer `type` over `interface` (enforced by `@typescript-eslint/consistent-type-imports`)
- Use `type` imports: `import type { Foo } from './bar'`
- Semicolons in type member delimiters

### React

- Functional components only
- Hooks: `use*` prefix
- Event handlers: `on*` prefix
- Props type: `${ComponentName}Props`

### Styling

- UnoCSS atomic classes preferred
- CSS modules for component-specific styles: `*.module.css`
- Use Arco Design semantic colors
- Custom semantic colors defined in `uno.config.ts`: `t-primary`, `t-secondary`, `bg-base`, `bg-hover`, `brand`, etc.

### Comments

- English for code comments
- JSDoc for function documentation

## Linting & Formatting Rules

### ESLint Key Rules

- `prettier/prettier`: error (enforced via eslint-plugin-prettier)
- `@typescript-eslint/consistent-type-imports`: error (must use `type` imports)
- `@typescript-eslint/no-unused-vars`: warn (allows `_` prefix)
- `@typescript-eslint/no-explicit-any`: warn
- `@typescript-eslint/no-floating-promises`: error
- `@typescript-eslint/await-thenable`: error
- `max-len`: warn at 200 chars (URLs, strings, templates, regex ignored)
- Promise/async rules relaxed for: JS files, forge config, tests, gemini CLI code

### Prettier Settings

- Print width: 700 (intentionally wide to avoid unwanted wrapping)
- Semicolons: yes
- Single quotes: yes
- Trailing comma: es5
- Tab width: 2
- JSX single quotes: yes
- End of line: lf

## Git Conventions

### Commit Messages

- **Language**: English
- **Format**: `<type>(<scope>): <subject>` (subject max 50 chars, enforced by husky hook)
- **Types**: feat, fix, refactor, chore, docs, test, style, perf

Examples:

```
feat(cron): implement scheduled task system
fix(webui): correct modal z-index issue
chore: remove debug console.log statements
```

### Git Hooks (Husky)

- **commit-msg**: Validates commit message format (`^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .{1,50}`)
- **pre-commit**: Runs `lint-staged` (ESLint fix + Prettier on staged `.ts/.tsx/.js/.jsx` files)

### No AI Signature (MANDATORY)

**NEVER add any AI-related signatures to commits.** This includes but is not limited to:

- `Co-Authored-By: Claude` or any Claude-related attribution
- `Co-Authored-By: <any AI assistant>`
- `🤖 Generated with Claude` or similar markers
- Any other AI tool signatures or attributions

This is a strict rule. Violating this will pollute the git history.

## Architecture Notes

### Multi-Process Model

- **Main Process**: Application logic, database, IPC handling, agent managers
- **Renderer Process**: React UI (Arco Design + UnoCSS)
- **Worker Processes**: Background AI tasks (ACP, Gemini, Codex, OpenClaw Gateway)

### Agent Architecture

Each AI agent follows a consistent pattern:

| Agent | Directory | Worker | Manager |
|-------|-----------|--------|---------|
| ACP (Claude, Qwen, etc.) | `src/agent/acp/` | `src/worker/acp.ts` | `AcpAgentManager.ts` |
| Codex (OpenAI) | `src/agent/codex/` | `src/worker/codex.ts` | `CodexAgentManager.ts` |
| Gemini (Google) | `src/agent/gemini/` | `src/worker/gemini.ts` | `GeminiAgentManager.ts` |
| OpenClaw Gateway | `src/agent/openclaw/` | `src/worker/openclaw-gateway.ts` | `OpenClawAgentManager.ts` |

All agent managers extend `BaseAgentManager` in `src/process/task/`.

### IPC Communication

- Secure contextBridge isolation via `src/preload.ts`
- 24+ bridge modules in `src/process/bridge/` (conversation, database, file watch, model, etc.)
- Type-safe message system in `src/renderer/messages/`

### Database

- SQLite via better-sqlite3
- Migration-based schema (currently at v5)
- Database path: `{userData}/config/aionui.db`
- Operations in `src/process/database/`

### WebUI Server

- Express 5 + WebSocket
- JWT authentication with rate limiting
- CSRF protection
- Supports local and remote network access

### Channels System

- Plugin-based architecture for external messaging platforms
- Current plugins: **Telegram** (via Grammy) and **Lark/Feishu** (via Lark SDK)
- Supports conversation reuse with model matching
- Device pairing and credential encryption

### Cron System

- Based on `croner` library
- `CronService`: Task scheduling engine
- `CronBusyGuard`: Prevents concurrent execution
- `CronCommandDetector`: Detects cron-related commands in messages

## Supported AI Agents

- **ACP-based agents**: Claude, Qwen Code, Iflow, Custom agents via MCP protocol
- **Gemini** (Google AI) - with full CLI tools subsystem (file ops, web search, image gen)
- **Codex** (OpenAI)
- **OpenClaw** (via Gateway with device authentication)
- **New API** gateway platform with per-model protocol routing

## Internationalization

Supported languages: English (en-US), Chinese Simplified (zh-CN), Chinese Traditional (zh-TW), Japanese (ja-JP), Korean (ko-KR), Turkish (tr-TR)

Translation files: `src/renderer/i18n/locales/*.json`

---

## Skills Index

Detailed rules and guidelines are organized into Skills for better modularity:

| Skill    | Purpose                                                              | Triggers                                               |
| -------- | -------------------------------------------------------------------- | ------------------------------------------------------ |
| **i18n** | Key naming, sync checking, hardcoded detection, translation workflow | Adding user-facing text, creating components with text |

> Skills are located in `.claude/skills/` and loaded automatically when relevant.

## Key Configuration Files

| File                  | Purpose                     |
| --------------------- | --------------------------- |
| `tsconfig.json`       | TypeScript compiler options |
| `forge.config.ts`     | Electron Forge build config |
| `electron-builder.yml`| Electron Builder packaging  |
| `uno.config.ts`       | UnoCSS styling config       |
| `.eslintrc.json`      | Linting rules               |
| `.prettierrc.json`    | Code formatting             |
| `jest.config.js`      | Test configuration          |
| `.husky/commit-msg`   | Commit message validation   |
| `.husky/pre-commit`   | Pre-commit lint-staged      |

## Testing

- **Framework**: Jest 30 + ts-jest
- **Structure**: `tests/unit/` for unit tests, `tests/integration/`, `tests/contract/`
- **Path aliases**: Same as TypeScript (`@/*`, `@process/*`, `@renderer/*`, `@worker/*`, `@mcp/*`)
- **Timeout**: 10 seconds per test
- **Setup**: `tests/jest.setup.ts`
- Run with `npm test`

## Native Modules

The following require special handling during build (configured as Webpack externals and ASAR unpacked):

- `better-sqlite3` - Database
- `node-pty` - Terminal emulation
- `web-tree-sitter` - Code parsing
- `tree-sitter-bash` - Bash syntax parsing
