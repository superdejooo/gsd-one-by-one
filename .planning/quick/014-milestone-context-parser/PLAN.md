---
phase: "quick-014"
plan: "01"
type: "execute"
wave: 1
autonomous: true
---

<objective>
Add parser for MILESTONE-CONTEXT.md format created by GSD's QUESTIONING phase.
When GSD enters multi-turn questioning mode, it creates this handover file instead of
REQUIREMENTS.md/ROADMAP.md. The parser needs to extract milestone metadata from this format.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Add parseMilestoneContext function</name>
  <files>src/lib/planning-parser.js</files>
  <action>
    Create new parser function that extracts:
    - version from "# v{version} Planning Context"
    - goal from "## Milestone Goal" section
    - status from "**Status:**" line
    - requirements from "- **REQ-01**: description" patterns
  </action>
  <verify>Parser extracts all fields correctly</verify>
  <done>Function added with proper regex patterns</done>
</task>

<task type="auto">
  <name>Task 2: Update parseMilestoneMetadata to fall back to context</name>
  <files>src/lib/planning-parser.js</files>
  <action>
    Modify parseMilestoneMetadata to:
    1. Call parseMilestoneContext in parallel with other parsers
    2. Fall back to context.title/version/goal when requirements not found
    3. Use context.goal as coreValue fallback
  </action>
  <verify>Metadata populated from context when requirements missing</verify>
  <done>Fallback chain implemented</done>
</task>

<task type="auto">
  <name>Task 3: Add unit tests for new parser</name>
  <files>src/lib/planning-parser.test.js</files>
  <action>
    Add tests for:
    - parseMilestoneContext format parsing
    - Requirements extraction from bullet list
    - Fallback behavior in parseMilestoneMetadata
    - All files missing scenario
  </action>
  <verify>npm test passes all 32 tests</verify>
  <done>Tests added and passing</done>
</task>
</tasks>
