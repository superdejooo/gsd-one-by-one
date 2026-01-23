# Skills System Documentation

This document describes the skill system for the GSD GitHub Action, which allows users to load specialized Claude Code skills when executing commands.

## Overview

Skills are pre-configured Claude Code plugins that provide domain-specific expertise. When you invoke a `@gsd-bot` command, you can optionally specify a skill to enhance the AI's capabilities for that particular task.

## Available Skills

| Alias | Full Name | Description |
|-------|-----------|-------------|
| `--manager` | `github-project-management` | GitHub project board management, issue tracking, sprint planning |
| `--testing` | `github-actions-testing` | GitHub Actions workflow validation, CI/CD debugging |
| `--templates` | `github-actions-templates` | GitHub Actions workflow templates and best practices |
| `--livewire` | `livewire-principles` | Laravel Livewire component development patterns |
| `--refactor` | `refactor` | Code refactoring with Laravel Pint, PHPStan, Pest |

## Skill-Command Compatibility

Not all skills work with all commands. The table below shows which skills are valid for each command:

| Skill | `new-milestone` | `plan-phase` | `execute-phase` | `complete-milestone` |
|-------|:---------------:|:------------:|:---------------:|:--------------------:|
| `--testing` | ✅ | ✅ | ✅ | ✅ |
| `--manager` | ✅ | ✅ | ✅ | ✅ |
| `--templates` | ❌ | ✅ | ✅ | ❌ |
| `--livewire` | ❌ | ✅ | ✅ | ❌ |
| `--refactor` | ❌ | ✅ | ✅ | ❌ |

**Note**: `--testing` (github-actions-testing) is the default skill and is always loaded automatically.

## Usage Examples

### Basic Usage (Default Skill)

```markdown
@gsd-bot plan-phase 7
```

This loads the default `github-actions-testing` skill.

### With Explicit Skill

```markdown
@gsd-bot plan-phase 7 --manager
```

This loads `github-project-management` for enhanced project board integration.

### Phase Execution with Refactoring Skill

```markdown
@gsd-bot execute-phase 5 --refactor
```

This loads the `refactor` skill for code quality improvements with Laravel Pint, PHPStan, and Pest.

### Livewire Development

```markdown
@gsd-bot plan-phase 3 --livewire
```

This loads `livewire-principles` for Laravel Livewire component patterns.

## API Reference

### Parser Functions

#### `parseSkillArg(argsString)`

Parses the skill flag from command arguments.

```javascript
import { parseSkillArg } from './src/lib/parser.js';

parseSkillArg('7 --manager');      // Returns: 'github-project-management'
parseSkillArg('5 --refactor');     // Returns: 'refactor'
parseSkillArg('3');                // Returns: null (uses default)
```

### Validator Functions

#### `isValidSkillForCommand(skill, command)`

Checks if a skill is valid for a specific command.

```javascript
import { isValidSkillForCommand } from './src/lib/validator.js';

isValidSkillForCommand('refactor', 'plan-phase');      // true
isValidSkillForCommand('refactor', 'new-milestone');   // false
isValidSkillForCommand(null, 'any-command');           // true (no skill is always valid)
```

#### `getValidSkillsForCommand(command)`

Returns all valid skills for a given command.

```javascript
import { getValidSkillsForCommand } from './src/lib/validator.js';

getValidSkillsForCommand('plan-phase');
// Returns: ['github-actions-templates', 'github-actions-testing',
//           'github-project-management', 'livewire-principles', 'refactor']

getValidSkillsForCommand('new-milestone');
// Returns: ['github-actions-testing', 'github-project-management']
```

### CCR Command Formatting

#### `formatCcrCommand(gsdCommand, prompt, skill)`

Formats the CCR command with optional prompt and skill.

```javascript
import { formatCcrCommand } from './src/llm/ccr-command.js';

formatCcrCommand('/gsd:plan-phase 7', null, null);
// Returns: 'ccr code --print "/gsd:plan-phase 7 /github-actions-testing"'

formatCcrCommand('/gsd:plan-phase 7', null, 'github-project-management');
// Returns: 'ccr code --print "/gsd:plan-phase 7 /github-project-management /github-actions-testing"'

formatCcrCommand('/gsd:plan-phase 7', 'Focus on API design', 'refactor');
// Returns: 'ccr code --print "/gsd:plan-phase 7 /refactor /github-actions-testing Focus on API design"'
```

## Configuration

Skills are configured in `src/lib/validator.js`:

### SKILL_COMMAND_MAP

Maps skill names to allowed commands. Use `null` for skills that work with all commands.

```javascript
export const SKILL_COMMAND_MAP = {
  "github-actions-templates": ["plan-phase", "execute-phase"],
  "github-actions-testing": null, // All commands
  "github-project-management": ["new-milestone", "plan-phase", "execute-phase", "complete-milestone"],
  "livewire-principles": ["plan-phase", "execute-phase"],
  "refactor": ["plan-phase", "execute-phase"],
};
```

### SKILL_ALIASES

Short aliases for skill flags.

```javascript
export const SKILL_ALIASES = {
  manager: "github-project-management",
  testing: "github-actions-testing",
  templates: "github-actions-templates",
  livewire: "livewire-principles",
  refactor: "refactor",
};
```

## Adding New Skills

To add a new skill:

1. **Create the skill file** in `.claude/skills/your-skill-name/`

2. **Add to SKILL_COMMAND_MAP** in `src/lib/validator.js`:
   ```javascript
   export const SKILL_COMMAND_MAP = {
     // ... existing skills
     "your-skill-name": ["plan-phase", "execute-phase"], // or null for all commands
   };
   ```

3. **Add alias** in `src/lib/validator.js`:
   ```javascript
   export const SKILL_ALIASES = {
     // ... existing aliases
     yourskill: "your-skill-name",
   };
   ```

4. **Update tests** in `src/lib/validator.test.js` and `src/lib/parser.test.js`

## Suggested Additional Skills

The following skills could enhance GSD workflows:

| Skill Name | Alias | Purpose | Commands |
|------------|-------|---------|----------|
| `security-audit` | `--security` | OWASP compliance, vulnerability scanning, secure coding patterns | `plan-phase`, `execute-phase` |
| `performance-optimization` | `--perf` | Database query optimization, caching strategies, load testing | `plan-phase`, `execute-phase` |
| `api-design` | `--api` | REST/GraphQL API design, OpenAPI spec generation, versioning | `plan-phase`, `execute-phase` |
| `database-migration` | `--db` | Schema design, migration strategies, data integrity | `plan-phase`, `execute-phase` |
| `testing-strategies` | `--test` | Unit/integration/E2E test patterns, TDD workflows | `plan-phase`, `execute-phase` |
| `documentation` | `--docs` | README generation, API docs, architecture diagrams | `plan-phase`, `execute-phase`, `complete-milestone` |
| `devops` | `--devops` | Docker, Kubernetes, infrastructure as code | `plan-phase`, `execute-phase` |
| `accessibility` | `--a11y` | WCAG compliance, screen reader support, semantic HTML | `plan-phase`, `execute-phase` |

### Priority Recommendations

For this project specifically:

1. **`--security`** — Essential for GitHub Actions handling tokens and API keys
2. **`--test`** — Improve test coverage and testing patterns
3. **`--docs`** — Auto-generate documentation for new features
4. **`--api`** — Useful when adding new bot commands or GitHub API integrations

## Error Handling

When an invalid skill is specified:

```markdown
@gsd-bot new-milestone Build auth system --refactor
```

Response:
```
❌ Skill 'refactor' is not valid for command 'new-milestone'.
Valid skills for this command: github-actions-testing, github-project-management
```

When an unknown skill alias is used:

```markdown
@gsd-bot plan-phase 7 --unknown
```

The `--unknown` flag is ignored and the default skill is used.
