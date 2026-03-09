# DAUB Layout Principles

> Distilled from *Practical UI* (2nd Edition) by Adham Dannaway.
> Use these rules when generating UI specs to produce professional, well-structured layouts.

---

## 1. Spacing System (8pt Grid)

### Spacing Tokens
| Token | Size | Use |
|-------|------|-----|
| XS | 8px | Inline padding, icon gaps |
| S | 16px | Inner content spacing |
| M | 24px | Between related groups |
| L | 32px | Between sections |
| XL | 48px | Major section breaks |
| XXL | 80px | Page-level margins |

### DAUB Gap Mapping
| gap | px | Use |
|-----|-----|-----|
| 1 | 4px | Tight inline (label+icon) |
| 2 | 8px | Within groups |
| 3 | 12px | Between items in a group |
| 4 | 16px | Between groups |
| 5 | 24px | Between sections |
| 6 | 32px | Major breaks |

### Rules
- Inner content gaps are the smallest; increase outward
- Related elements = less space; unrelated = more space
- When in doubt, use the next size up — generous whitespace beats cramped layouts
- Maintain consistent spacing throughout — no arbitrary pixel values
- Padding inside containers should be proportional to the container size

---

## 2. Layout Grid

- Use a 12-column grid (divisible by 1, 2, 3, 4, 6, 12)
- Gutters are fixed (32px desktop, 16px mobile); columns are fluid
- Margins: XL-XXL on desktop, S on mobile — content never touches viewport edges
- Interfaces are rectangles within rectangles — every element lives inside a clear container
- Sidebar layouts: use 3+9, 4+8, or fixed-width sidebar + fluid main
- Card grids: 2-4 columns desktop, 1-2 mobile. Cards in a row must be equal height

---

## 3. Grouping & Proximity

### Four Grouping Methods
1. **Containers** — borders, cards, backgrounds
2. **Proximity** — close items feel related
3. **Similarity** — same style = same group
4. **Continuity** — alignment creates implicit groups

### Rules
- Space between groups must be >= 2x space within groups
- Don't over-containerize: if 3 of 4 grouping signals are present, drop the border
- Use whitespace as a grouping mechanism before reaching for borders
- Every element must belong to a visual group — no orphan elements floating alone
- Labels belong to their fields, not to the space between fields

---

## 4. Visual Hierarchy

### Hierarchy Signals (strongest to weakest)
1. Size — larger = more important
2. Color/contrast — high contrast = primary
3. Weight — bolder = more important
4. Position — top-left reads first (LTR)
5. Spacing — more space around = more emphasis
6. Depth — elevated elements draw attention

### Rules
- Most important content comes first: top, larger, bolder, higher contrast
- Squint test: blur the UI — can you still identify the key elements?
- One focal point per view — don't compete for attention
- Secondary content should be visually subordinate (smaller, lighter, less contrast)
- Depth levels: flat (default) -> subtle shadow (cards) -> medium (dropdowns) -> elevated (modals)
- Progressive disclosure: show summary first, details on demand

---

## 5. Typography

### Typeface
- One sans-serif typeface per project
- Two weights maximum: regular (400) and bold (700)
- Use weight, not new fonts, to create contrast

### Type Scale
- Apps/UI: Minor Third (1.2 ratio) — 12, 14, 16, 20, 24, 28
- Marketing/landing pages: Perfect Fourth (1.333) — 14, 18, 24, 32, 42, 56
- Maximum 4-5 font sizes per page

### Size Rules
- Body text: minimum 16px
- Long-form content: minimum 18px
- Captions/labels: minimum 12px
- Headings decrease in size as depth increases (h1 > h2 > h3)

### Line Height
- Body text: >= 1.5
- Headings: 1.1-1.3 (tighter as size increases)
- Captions: 1.4

### Line Length
- Optimal: 45-75 characters per line
- Maximum: 65ch (use max-width)
- Narrow columns: 20-40ch

### Alignment
- Left-align by default (matches reading direction)
- Center only for short hero text (< 3 lines)
- Never justify body text on screens
- Right-align numbers in tables

---

## 6. Color

### Design Greyscale First
- Establish hierarchy through size, weight, and spacing before adding color
- If the greyscale version has clear hierarchy, color will enhance it
- If it doesn't, color will just mask the problem

### Brand Color Usage
- Brand color = interactive elements only (buttons, links, toggles, active states)
- Don't use brand color for backgrounds or decorative elements
- One accent color is enough — more creates visual noise

### Foreground Opacity Levels
| Level | Opacity | Use |
|-------|---------|-----|
| Strong | 90% | Primary text, headings |
| Medium | 75% | Body text |
| Weak | 60% | Secondary text, placeholders |
| Stroke | 45% | Borders, dividers |
| Stroke-weak | 10% | Subtle separators |
| Fill | 4% | Background tints |

### Contrast
- Text: minimum 4.5:1 contrast ratio (WCAG AA)
- Large text (18px+ bold, 24px+ regular): minimum 3:1
- UI elements (borders, icons): minimum 3:1
- Don't rely on color alone — use shape, position, or text as well

---

## 7. Components

### Buttons
- One primary button per screen/view
- Three button weights: filled (primary), outlined (secondary), text (tertiary)
- Button hierarchy matches action importance
- Minimum 16px gap between adjacent buttons
- Primary action on the right in button groups (confirmation dialogs)
- Destructive actions use danger variant, not primary

### Touch Targets
- Minimum 48x48px touch target (even if visual element is smaller)
- Minimum 8px gap between touch targets

### Visual Consistency
- Similar-looking elements must function similarly
- Don't style non-interactive elements like buttons
- Active/selected states must be visually distinct from hover states
- Disabled elements: reduce opacity, remove pointer cursor

### Forms
- Label above input (not inline or to the left for most cases)
- Helper text below input
- Group related fields in sections with section headings
- One column for forms (two-column forms reduce completion rates)
- Required fields marked, or mark optional fields instead (whichever is fewer)

---

## 8. Density & Completeness

### Element Counts
- Non-trivial UI: 12-25 elements minimum
- Dashboards: 4+ stat cards, 2+ charts/tables, sidebar navigation
- Landing pages: hero + 3-5 content sections + CTA + footer
- Forms: labels, helpers, validation, submit + cancel

### Content Rules
- Fill with realistic data — never Lorem ipsum
- Use real-looking names, numbers, dates, and descriptions
- Empty states need purpose: placeholder text, illustration, or CTA
- Never leave blank areas — they look broken, not clean

### Information Density
- Remove anything that doesn't reduce functionality
- Every element should earn its space
- Prefer data tables over repeated cards for > 5 items
- Use progressive disclosure for complex interfaces

---

## 9. Layout Patterns

### Dashboard
1. Sidebar navigation (if > 5 sections)
2. Stat cards row (3-4 KPIs)
3. Chart/visualization area
4. Data table or detail list
5. Action buttons in headers, not floating

### Form Page
1. Page heading with context
2. Grouped input sections
3. Helper/validation text per field
4. Sticky footer with submit/cancel

### Landing Page
1. Hero with single CTA
2. Social proof (logos, testimonials)
3. Feature sections (3-column grid or alternating layout)
4. Pricing (if applicable)
5. Final CTA
6. Footer with links

### Settings/Profile
1. Sidebar categories or tabs
2. Section headings within each category
3. Description text for each setting
4. Save/cancel per section or global

---

## 10. Copy & Microcopy

- Active voice: "Install the CLI" not "The CLI will be installed"
- Specific button labels: "Save API Key" not "Continue" or "Submit"
- Numerals for counts: "8 deployments" not "eight deployments"
- Error messages include the fix, not just the problem: "File too large (max 5 MB)" not "Upload failed"
- Loading states end with ellipsis: "Saving..." not "Please wait"
- Empty state text tells the user what to do next, not what's missing

---

## Quick Reference: Common Mistakes

| Mistake | Fix |
|---------|-----|
| Equal spacing everywhere | Inner gaps < outer gaps |
| Multiple primary buttons | One primary per view |
| Center-aligned paragraphs | Left-align body text |
| Full-width text | max-width: 65ch |
| Empty containers | Add placeholder content or CTA |
| Orphan elements | Group into cards or sections |
| Color-only hierarchy | Size + weight + spacing first |
| Tiny touch targets | Minimum 48x48px |
| Lorem ipsum | Realistic sample data |
| No visual hierarchy | Squint test — fix until it passes |
