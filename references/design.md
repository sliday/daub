# Designing DAUB pages

These are the layout, density and hierarchy rules the playground and MCP prompts give their models (`LAYOUT_RULES` and the guidelines in playground.html, `LAYOUT_RULES_COMPACT` and `PAGE_FORMULAS` in functions/api/mcp.js, `tools/LAYOUT-RULES.md`). They come from *Practical UI* by Adham Dannaway.

> Status: a validated design playbook, tested against blind visual judging, is in progress and will replace this file. Until then, treat these rules as defaults and let the request win when they conflict.

## Spacing

DAUB spaces on an 8-point grid. `gap` on Stack and Grid takes a token:

| gap | px | Use |
|---|---|---|
| 0 | 0 | Flush rows, sidebar plus content |
| 1 | 4 | Icon next to its label |
| 2 | 8 | Inside a group (the default) |
| 3 | 12 | Items in a list or form |
| 4 | 16 | Between groups, card grids |
| 5 | 24 | Between sections |
| 6 | 32 | Major breaks, page sections on landing pages |

- Space grows from the inside out: the gap between groups is at least twice the gap inside them.
- Related things sit close; unrelated things sit far apart. When unsure, take the next size up.
- Page width: set `container` on the root, always. `"narrow"` (640 px) for forms and articles, `true` (960 px) for most pages, `"wide"` (1200 px) for dashboards and grids of 3+ columns. Without it the page has no side gutters.

## Grouping and hierarchy

- Group with proximity first, then similarity, then containers. Don't wrap everything in a Card: when spacing already groups a block, drop the border.
- Every element belongs to a group. No lone buttons or captions floating between sections.
- One focal point per view. Hierarchy comes from size, then contrast, weight, position, spacing and depth, in that order.
- Squint test: blurred, the page should still show its headline, its primary action and its main data.
- Headings: one `h1` per page, `h2` per section, `h3` inside cards. Body text stays left-aligned; center only short hero lines (under 3 lines).
- Keep text columns under about 65 characters wide.

## Color and actions

- Design in grayscale first. The theme's accent belongs to interactive elements: buttons, links, toggles, active nav items.
- One primary button per view. Secondary actions use `secondary` or `ghost`.
- Destructive actions use an `icon-danger` Button (red label, no fill) and confirm through an AlertDialog.
- Status colors carry meaning: Badge `success`/`warning`/`error`, Alert `type`, StatCard `trend`. Don't use them for decoration.

## Density and content

- Non-trivial pages need 12-25 or more elements. A dashboard with two cards and a heading reads as unfinished.
- Tables get 5-8 rows, lists 4-6 items, charts 4-8 bars, sidebars their full navigation.
- Real content only: full names, plausible numbers, real dates, product-specific copy. No lorem ipsum, "Item 1" or "...".
- Every page has a header or navigation, main content, and a footer or action area.
- Empty states have a purpose: EmptyState with an icon, a message and an action.
- Images: `Image` with a real URL, or a labeled placeholder such as `https://dummyimage.com/600x400/e0e0e0/666.png&text=Product+photo`. Card `media` takes the same URL.

## Page formulas

- Dashboard: navigation (Sidebar when there are more than 5 sections), a row of 3-4 StatCards, a primary chart or table, secondary data, recent activity.
- Settings: Sidebar or Tabs for sections, one Card per section, Switch for on/off, Select for choices, Save and Cancel at the bottom.
- Onboarding: Stepper, then one task per step, then a completion screen. Minimal navigation.
- Profile: Avatar, a stats row, Tabs (posts, activity, settings), content.
- Inbox or list: Search, filter Chips, a scrollable List, a detail panel.
- Pricing: ToggleGroup for monthly and yearly, 3 plan Cards, a comparison Table, an FAQ Accordion.
- SaaS landing: hero, how it works, main benefit, features, integrations, testimonial, use cases, pricing, FAQ, closing CTA, footer.

## Landing pages

- The hero holds a headline, a subhead, a visual and a call to action. No carousel in the hero.
- Headlines talk to the customer ("Close your books in a day"), not about the company ("We are Acme").
- CTA text starts with a verb and never says "Submit". Repeat the main CTA at the bottom.
- Put proof (numbers, logos, quotes) next to the claim it supports, and start it early.

## Forms

- Label above the input, helper text below. One column.
- Use the right input type: `email`, `password`, `number`, `date`.
- Edit forms show current values with `value` (`Field([], "Email", value: "maya@lumen.studio")`); a `placeholder` is only a muted hint.
- Group long forms into sections (Card or Separator with a label). One primary submit button.

## Mobile screens

- Single column. Grid at most 2 columns.
- BottomNav with up to 5 tabs for top-level sections; a horizontal Stack for the title, back arrow and at most 2 actions (a Navbar hides its children on phones).
- Sheet (bottom) for filters and contextual actions instead of Modal; Drawer for settings menus.
- Touch targets at least 48 px with 8 px between them; 16 px page gutters.

## Common mistakes

- Equal spacing everywhere, so nothing groups.
- Several primary buttons competing in one view.
- Centered paragraphs and full-width text blocks.
- Empty containers: ChartCard without data, Card with only a title.
- Color as the only signal of state or hierarchy.
- Placeholder copy.
