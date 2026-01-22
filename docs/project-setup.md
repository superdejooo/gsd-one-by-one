# GitHub Project Board Setup Guide

This guide walks you through setting up a GitHub Project board for visual milestone tracking with the GSD GitHub Action.

## Overview

GSD uses a **labels + projects architecture** for organizing work:

- **Labels = Source of Truth** — The GSD Action manages issue status through labels (`status:pending`, `status:in-progress`, `status:complete`, `status:blocked`). These labels are API-controlled and automatically applied as work progresses.

- **Project Board = Visual Organization** — GitHub Projects provides a visual board that reacts to label changes. The project board is purely for human readability — status changes happen through labels, and the board updates automatically via GitHub's built-in workflow automations.

- **One Iteration per Milestone** — Each milestone (e.g., `v1`, `v1.1`, `v2`) gets its own iteration in the project board, allowing you to filter and organize work by release version.

This separation keeps the API-driven automation simple while providing powerful visual organization for teams.

## Prerequisites

Before setting up your project board, ensure you have:

- **Repository admin or write access** — Required to create labels and link repositories to projects
- **Organization owner access** — Required if creating an organization-level project (recommended for team repos)
- **Workflow permissions configured** — Add the following to your `.github/workflows/gsd.yml`:

```yaml
permissions:
  contents: write
  issues: write
  pull-requests: write
  # Note: project: write only needed if future API iteration creation is added
  # Currently, iterations are created manually in the UI
```

## Creating the Project Board

Follow these steps to create your GitHub Project board:

### Step 1: Navigate to Projects

**For Organization Projects (Recommended):**
1. Go to your organization's main page (e.g., `github.com/your-org`)
2. Click the **Projects** tab in the top navigation
3. Click **New project**

**For Repository Projects:**
1. Go to your repository (e.g., `github.com/your-org/your-repo`)
2. Click the **Projects** tab
3. Click **New project**

### Step 2: Select Template

1. GitHub will show several project templates
2. Select **Board** (recommended for status-based workflows)
   - Alternative: **Table** if you prefer spreadsheet-like views
3. Click **Create**

### Step 3: Name Your Project

1. Enter a descriptive name:
   - Examples: "GSD Milestones", "{Repo} Work Tracking", "v1.x Development"
2. Optionally add a description
3. Click **Create project**

### Step 4: Link Repository to Project

1. In your new project, click the **⋯** menu (top right)
2. Select **Settings**
3. In the left sidebar, click **Manage access**
4. Under "Base repository", ensure your repository is linked
   - If not, click **Add repository** and select your repo
5. Verify that the repository has **Admin** or **Write** access

Your project board is now created and linked to your repository.

## Adding Iterations (Milestones)

Iterations group work by milestone version (e.g., `v1`, `v1.1`, `v2`). You must create these manually in the UI.

### Step 1: Access Project Settings

1. Open your project board
2. Click the **⋯** menu (top right)
3. Select **Settings**

### Step 2: Create Iteration Field

If the project doesn't already have an Iteration field:

1. In Settings, scroll to **Fields**
2. Click **+ New field**
3. Select **Iteration** as the field type
4. Name it "Iteration" (or "Sprint", "Milestone", etc.)
5. Click **Save**

### Step 3: Add Iterations

1. In Settings, find the **Iteration** field you just created
2. Click on the field to expand configuration
3. Click **+ Add iteration**
4. Enter iteration details:
   - **Title**: Match your milestone version (e.g., `v1`, `v1.1`, `v2.0`)
   - **Start date**: (Optional) When the milestone begins
   - **Duration**: (Optional) Set end date or duration (e.g., 2 weeks)
5. Click **Save**
6. Repeat for each milestone you're planning

**Example iterations:**
- `v1` — Start: 2026-01-01, End: 2026-02-01
- `v1.1` — Start: 2026-02-01, End: 2026-02-15
- `v2` — Start: 2026-03-01, End: 2026-04-01

### Why Manual Setup?

The GitHub Projects v2 GraphQL API does not provide a safe way to add individual iterations programmatically. The only available mutation (`updateProjectV2Field`) **replaces all iterations**, causing existing issues to lose their iteration assignments (data loss).

To avoid this risk, GSD requires manual iteration creation through the UI. The workflow validates that iterations exist but does not attempt to create them via API.

For more details, see: [GitHub Community Discussion #157957](https://github.com/orgs/community/discussions/157957)

## Configuring Label Automations

GitHub Projects has built-in workflow automations that move cards between columns based on label changes. This eliminates the need for manual card movement.

### Step 1: Access Workflow Settings

1. In your project board, click **⋯** (top right)
2. Select **Settings**
3. In the left sidebar, click **Workflows**

### Step 2: Enable Auto-Add Workflow

This automatically adds new issues/PRs from your repository to the project:

1. Find **Auto-add to project**
2. Toggle it **ON**
3. Configure filters (optional):
   - Add repository filter if you have multiple repos
   - Add label filters if you only want certain issues

### Step 3: Configure Initial Status

When items are added, set their initial status:

1. Find **Item added to project**
2. Toggle it **ON**
3. Set the default status (usually "Todo" or "Backlog")

### Step 4: Create Label-Based Status Workflows

Configure automations to move cards when status labels change:

**For "status:pending" → Todo column:**
1. Click **+ New workflow**
2. Select **Item edited**
3. Add condition: **Label added** = `status:pending`
4. Add action: **Set status** = `Todo`
5. Save the workflow

**For "status:in-progress" → In Progress column:**
1. Create new workflow (Item edited)
2. Condition: **Label added** = `status:in-progress`
3. Action: **Set status** = `In Progress`
4. Save

**For "status:complete" → Done column:**
1. Create new workflow (Item edited)
2. Condition: **Label added** = `status:complete`
3. Action: **Set status** = `Done`
4. Save

**For "status:blocked" → Blocked column (optional):**
1. Create new workflow (Item edited)
2. Condition: **Label added** = `status:blocked`
3. Action: **Set status** = `Blocked`
4. Save
5. Note: You may need to create a "Blocked" column in your board first

These automations ensure that when GSD (or you manually) adds a status label to an issue, the project board automatically moves the card to the correct column.

## Label Setup

GSD automatically creates these status labels when needed, so **no manual label creation is required**:

| Label | Color | Description | Column |
|-------|-------|-------------|---------|
| `status:pending` | Purple (`d4c5f9`) | Task is queued, not yet started | Todo |
| `status:in-progress` | Yellow (`fbca04`) | Task is actively being worked on | In Progress |
| `status:complete` | Green (`0e8a16`) | Task is finished | Done |
| `status:blocked` | Red (`d93f0b`) | Task cannot proceed | Blocked |

The GSD Action will create these labels in your repository the first time they're needed. The colors follow GitHub's standard palette for semantic meaning.

## Verifying Setup

Use this checklist to ensure everything is configured correctly:

- [ ] Project created and visible in Projects tab
- [ ] Repository linked to project (Settings → Manage access)
- [ ] Iteration field created with at least one iteration (e.g., `v1.1`)
- [ ] Auto-add workflow enabled (new issues/PRs join project automatically)
- [ ] Label automations configured for all status labels
- [ ] Test: Manually add `status:pending` label to an issue
- [ ] Verify: Issue appears in project board under "Todo" column

### Quick Test

1. Create a test issue in your repository
2. Manually add the `status:pending` label (create it if it doesn't exist yet)
3. Go to your project board
4. Verify the issue appears in the "Todo" column
5. Change the label to `status:in-progress`
6. Verify the card moves to "In Progress" column
7. Delete the test issue when done

If this works, your setup is complete!

## Configuration (Optional)

If you want to explicitly configure which project GSD uses, create or update `.github/gsd-config.json`:

```json
{
  "project": {
    "number": 1,
    "isOrg": true
  }
}
```

**Configuration options:**
- `number` — The project number from the URL (e.g., `github.com/orgs/your-org/projects/1` → number is `1`)
- `isOrg` — Set to `true` for organization projects, `false` for user-owned projects

**Note:** Currently, GSD does not automatically update project items via API. This configuration is reserved for future features. The primary integration is through label-based automations.

## Troubleshooting

### "Iteration not found" warning in workflow logs

**Cause:** The iteration for the milestone doesn't exist in the project board.

**Fix:**
1. Go to your project Settings
2. Navigate to the Iteration field
3. Click "Add iteration"
4. Create an iteration matching your milestone version (e.g., `v1.1`)
5. Retry the workflow

### Labels not moving cards automatically

**Cause:** Label-based workflow automations are not configured.

**Fix:**
1. Go to project Settings → Workflows
2. Verify automations exist for each status label
3. Check that conditions use exact label names: `status:pending`, `status:in-progress`, etc.
4. Ensure actions map to correct Status values: `Todo`, `In Progress`, `Done`
5. Test by manually adding a label to see if automation triggers

### Permission errors when workflow runs

**Cause:** Missing required permissions in workflow file.

**Fix:**
1. Open `.github/workflows/gsd.yml`
2. Verify the `permissions:` section includes:
   ```yaml
   permissions:
     contents: write
     issues: write
     pull-requests: write
   ```
3. Commit and push changes
4. Retry the workflow

### Cards appear in project but don't have iteration assigned

**Cause:** Iterations created after issues were added, or manual assignment needed.

**Fix:**
1. Open an issue in the project board
2. Click on the issue card
3. In the side panel, find the "Iteration" field
4. Select the appropriate iteration from the dropdown
5. Repeat for other issues, or use bulk edit:
   - Select multiple cards (Shift+Click)
   - Right-click → Set iteration → Select iteration

### Project not showing new issues automatically

**Cause:** Auto-add workflow not enabled.

**Fix:**
1. Go to project Settings → Workflows
2. Find "Auto-add to project"
3. Toggle it ON
4. Optionally configure filters (repository, labels)
5. New issues should now appear automatically

## Next Steps

Once your project board is set up:

1. **Start a milestone:** Comment `@gsd-bot new-milestone 1` on any issue
2. **GSD will apply labels automatically** as work progresses
3. **Watch the project board update** as cards move between columns
4. **Filter by iteration** to see work grouped by milestone

Your project board provides visual organization while GSD handles the automation. The labels are the source of truth, and the board reacts to keep everything in sync.

---

**Need help?** Check the [GSD GitHub Action README](../README.md) or open an issue in the [repository](https://github.com/superdejooo/gsd-one-by-one).
