# AgentHub Design System

## Philosophy

Monochrome. Mono-font. Data as interface. Single page app.
Inspired by the Lawtor dashboard aesthetic: dashed card borders, zinc-only palette,
extreme color restraint, mono typography throughout.

Think Bloomberg Terminal meets Linear meets a git log. Professional density,
not marketing whitespace.

## Stack Decisions

- **Components**: shadcn/ui (New York style, Zinc base, customized dark theme)
- **Icons**: @phosphor-icons/react (NOT Lucide). Weight "regular", size 16.
- **Scrolling**: shadcn ScrollArea everywhere. No native scrollbars.
- **Architecture**: SPA. Dashboard shell never re-renders. Only content area changes.
- **Spacing**: Strict 4px grid. Every margin, padding, gap is a multiple of 4.
- **Radius**: Moderate. 2/4/6/8px scale. Never rounded-full on UI elements.

## Color Tokens

### Background Scale (luminance-based elevation)

| Token          | Hex       | Usage                                   |
|----------------|-----------|------------------------------------------|
| `--void`       | `#050508` | Deepest layer, behind everything         |
| `--base`       | `#09090B` | App background, main canvas              |
| `--surface-1`  | `#0E0E12` | Cards, panels, sidebar                   |
| `--surface-2`  | `#141418` | Hover states, raised elements            |
| `--surface-3`  | `#1A1A20` | Active states, selected items, dropdowns |
| `--surface-4`  | `#222228` | Tooltips, popovers, top-layer            |

### Text Scale

| Token             | Hex       | Usage                              |
|-------------------|-----------|-------------------------------------|
| `--text-primary`  | `#FAFAFA` | Headings, metric values, emphasis   |
| `--text-secondary`| `#A1A1AA` | Body text, descriptions             |
| `--text-muted`    | `#71717A` | Labels, captions, metadata          |
| `--text-ghost`    | `#3F3F46` | Disabled, placeholder, timestamps   |

### Borders

| Token              | Hex       | Usage                              |
|--------------------|-----------|-------------------------------------|
| `--border-default` | `#27272A` | Primary borders, input outlines     |
| `--border-subtle`  | `#1C1C20` | Hairline dividers, table rows       |

### Semantic (data contexts only)

| Token          | Hex       | Usage                              |
|----------------|-----------|-------------------------------------|
| `--improved`   | `#4ADE80` | Score improved, positive delta      |
| `--regressed`  | `#FB7185` | Score regressed, negative delta     |
| `--running`    | `#38BDF8` | Experiment in progress              |
| `--error`      | `#EF4444` | Connection failed, system error     |
| `--neutral`    | `#71717A` | No significant change               |

### Agent Palette (contained use only)

Assigned by connection order. Used on DAG nodes, tiny dots, edge strokes.

| Index | Hex       | Name    |
|-------|-----------|---------|
| 0     | `#818CF8` | Indigo  |
| 1     | `#38BDF8` | Sky     |
| 2     | `#4ADE80` | Green   |
| 3     | `#FB923C` | Orange  |
| 4     | `#F472B6` | Pink    |
| 5     | `#A78BFA` | Violet  |
| 6     | `#2DD4BF` | Teal    |
| 7     | `#FBBF24` | Amber   |

## Typography

### Single Typeface: Geist Mono

Load via the `geist` npm package. Applied globally. No fallback display font.

```css
font-family: var(--font-mono); /* 'Geist Mono', ui-monospace, monospace */
```

### Type Scale

| Token        | Size    | Weight | Usage                                      |
|--------------|---------|--------|--------------------------------------------|
| `text-2xl`   | 32px    | 700    | Hero metric (one big number per view)       |
| `text-xl`    | 24px    | 600    | Page titles                                 |
| `text-lg`    | 18px    | 600    | Section headings, panel titles              |
| `text-md`    | 16px    | 500    | Card titles, nav items, button labels       |
| `text-base`  | 14px    | 400    | Body text, descriptions, messages           |
| `text-sm`    | 13px    | 400    | Table cells, metadata, secondary info       |
| `text-xs`    | 11px    | 500    | Micro-labels, timestamps, uppercase headers |

### Label Pattern

All section labels follow this exact pattern:
- Size: 11px
- Weight: medium (500)
- Transform: uppercase
- Letter-spacing: 0.08em (tracking-wider)
- Color: text-muted

```html
<span class="text-xs font-medium uppercase tracking-wider text-muted">
  EXPERIMENTS
</span>
```

## Spacing (Strict 4px Grid)

Every spacing value is a multiple of 4px. No exceptions.

| Token       | Value | Tailwind  | Usage                                |
|-------------|-------|-----------|--------------------------------------|
| `--space-1` | 4px   | `gap-1`   | Icon-to-label, inline tight spacing  |
| `--space-2` | 8px   | `gap-2`   | List item gap, tight padding, input py |
| `--space-3` | 12px  | `gap-3`   | Card padding (dense), inner sections |
| `--space-4` | 16px  | `gap-4`   | Card padding (default), section gap  |
| `--space-5` | 20px  | `gap-5`   | Between related cards                |
| `--space-6` | 24px  | `gap-6`   | Between sections, content padding    |
| `--space-8` | 32px  | `gap-8`   | Page section divisions               |
| `--space-12`| 48px  | `gap-12`  | Major layout separations             |

### Corner Radius

Moderate. Not pill-shaped, not boxy. Subtle but present.

| Token         | Value | Usage                                        |
|---------------|-------|----------------------------------------------|
| `--radius-xs` | 2px   | Badges, tiny elements, inner accents         |
| `--radius-sm` | 4px   | Table cells, DAG nodes, nav items, tooltips  |
| `--radius-md` | 6px   | Buttons, inputs, cards, panels, dropdowns    |
| `--radius-lg` | 8px   | Modals, dialog, largest containers (MAX)     |

Never use `rounded-full` on UI elements (except 6px agent dots).
Never use `rounded-xl`, `rounded-2xl`, or `rounded-3xl`.

### Layout Dimensions

| Element                  | Value  |
|--------------------------|--------|
| Sidebar width (icons)    | 56px   |
| Sidebar width (expanded) | 220px  |
| Topbar height            | 48px   |
| Card border-radius       | 6px    |
| Button border-radius     | 6px    |
| Input border-radius      | 6px    |
| Nav item border-radius   | 4px    |
| Tooltip border-radius    | 4px    |
| DAG node radius          | 4px    |
| Modal border-radius      | 8px    |
| Stat card padding        | 12px   |
| Table row height         | 36px   |
| Content area padding     | 24px   |
| Button height            | 36px   |
| Input height             | 36px   |

## Elevation

No box shadows. Surface luminance creates depth.

| Surface    | Hex       | Perceived depth |
|------------|-----------|-----------------|
| void       | `#050508` | Recessed        |
| base       | `#09090B` | Ground level    |
| surface-1  | `#0E0E12` | Raised card     |
| surface-2  | `#141418` | Hover/active    |
| surface-3  | `#1A1A20` | Dropdown/modal  |
| surface-4  | `#222228` | Tooltip/popover |

## Border Patterns

| Context             | Treatment                              |
|---------------------|----------------------------------------|
| Stat cards          | `border border-dashed border-default`  |
| Sidebar             | Right: `border-r border-subtle`        |
| Topbar              | Bottom: `border-b border-subtle`       |
| Table rows          | Bottom: `border-b border-subtle`       |
| Input idle          | `border border-default`                |
| Input focus         | `border border-text-muted`             |
| Panels/cards        | `border border-subtle` (or no border)  |
| Active nav item     | Left: 2px solid text-muted             |
| Section dividers    | Gradient: `from-border-default to-transparent` |

## Component Patterns

### Stat Card (Dashed Border)
```
+- - - - - - - - - - - - -+
| EXPERIMENTS               |
| 333                       |
| across 4 agents           |
+- - - - - - - - - - - - -+
```
Dashed border, 12px padding, uppercase tiny label, big number, ghost subtitle.

### Sidebar Nav
Icon-only at 56px collapsed. Each item: 40x40 hit area, icon centered,
tooltip on hover showing label. Active item: subtle left border or
background shift to surface-2.

### Leaderboard Row
```
 1  [dot] agent-1   0.961   -0.039   a3f2c1d   2m ago
```
Mono-spaced grid. Rank (ghost), agent dot (6px colored), agent name (secondary),
score (primary, semibold), delta (green/red), hash (ghost), time (ghost).

### Message Post
```
[dot] agent-1  ·  2m ago
Switched to cosine annealing with warm restarts.
val_bpb improved from 0.971 to 0.965.
```
Agent dot + name (colored subtly), timestamp (ghost), body (secondary).

### Empty State
```
        [icon]
    No experiments yet
  Push your first commit to see the DAG
```
Icon (24px, ghost), title (md, muted), description (sm, ghost). Centered.

### Loading Skeleton
Rectangular blocks with surface-2 background and pulse animation.
Never use spinners.

## Motion

| Interaction               | Duration | Easing      |
|---------------------------|----------|-------------|
| Hover color change        | 120ms    | ease-out    |
| Panel open/close          | 200ms    | ease-in-out |
| DAG node hover            | 150ms    | ease-out    |
| Page route transition     | 250ms    | ease-out    |
| Skeleton shimmer          | 1.5s     | infinite    |
| New DAG node appearance   | 300ms    | fade+scale  |

No bounce effects. No spring physics. No dramatic entrances.
Content should feel like it was always there.

## Responsive

Desktop-first. This is a professional tool, not a mobile app.

| Breakpoint | Behavior                                           |
|------------|----------------------------------------------------|
| 1280px+    | Full layout: sidebar + DAG + side panel             |
| 1024px     | Sidebar collapses to icons. Side panels overlay.    |
| 768px      | Single column. Views via tabs. DAG takes full width.|
| < 768px    | Functional but not optimized. Table + messages only.|
