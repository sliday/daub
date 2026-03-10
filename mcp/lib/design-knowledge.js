// Condensed design knowledge for MCP system prompt injection
// Sources: tools/LAYOUT-RULES.md (Practical UI), skill-landing-pages/references/ (Landing Page Cookbook)

export const LAYOUT_RULES_COMPACT = `LAYOUT RULES (8pt grid):
Spacing tokens: XS=8px, S=16px, M=24px, L=32px, XL=48px, XXL=80px
DAUB gap mapping: 0=0, 1=4px, 2=8px, 3=12px, 4=16px, 5=24px, 6=32px

Grouping: 4 methods — containers, proximity, similarity, continuity. Space between groups >= 2x within groups. Don't over-containerize: if 3/4 signals present, drop the border.

Visual hierarchy (strongest→weakest): size, color/contrast, weight, position, spacing, depth. One focal point per view. Squint test: blur UI, key elements must still be identifiable.

Typography: one sans-serif, two weights max (400/700). App scale 1.2 ratio (12-14-16-20-24-28), marketing scale 1.333 (14-18-24-32-42-56). Max 4-5 sizes/page. Body >=16px, line-height >=1.5 body / 1.1-1.3 headings. Max 65ch line length. Left-align body, center only short hero text (<3 lines).

Color: design greyscale first. Brand color = interactive only (buttons, links, toggles). One accent. Foreground opacity: 90% primary, 75% body, 60% secondary, 45% borders, 10% separators, 4% fills. Contrast: 4.5:1 text, 3:1 large text/UI.

Components: one primary button per view. Three weights: filled/outlined/text. Min 48x48px touch targets, 8px gap between. Label above input, helper below. One-column forms.

Common mistakes: equal spacing everywhere (fix: inner < outer) | multiple primary buttons | center-aligned paragraphs | full-width text (max 65ch) | empty containers | orphan elements | color-only hierarchy | tiny touch targets | lorem ipsum.`;

export const LANDING_PAGE_RULES = `LANDING PAGE PATTERNS:
Hero essentials: headline + subhead + hero image + CTA. No carousels in hero. Ever.

Headline→awareness mapping:
- Unaware: pain remover, problem/question ("Tired of X?")
- Problem-aware: benefit, easy way ("The fastest way to X")
- Solution-aware: product description, category ("Simple help desk software")
- Product-aware: comparison, social proof, double benefit
- Most aware: promise, testimonial ("You'll have X in Y days")
Rules: customer-focused (never "We..."), clear > clever, big visual weight.

Page formulas by product type:
- SaaS: Hero→How it works→Main benefit→Features→Integrations→Testimonial→Use cases→Pricing→Footer
- Physical: Hero→Description→Features→Proof gallery→More features→Cross-sell→Specs→Guarantees
- Mobile App (known): Hero + download CTA. Done.
- Mobile App (new): Hero→Benefits summary→Benefits detail→Features grid→Press→Testimonials→Logos+CTA→Footer
- Desktop App: Hero→Benefits→Use cases→Proof→Awards+CTA
- Book/Info: Hero (cover+proof)→About→Why buy→Contents→Author bio

Visitor inner monologue (section ordering):
1. What is this? → headline+image
2. Why should I care? → main benefit
3. How does it work? → how-it-works
4. What do I get? → features
5. Can I trust this? → proof
6. Will it work for me? → use cases/testimonials
7. What do others think? → more proof
8. How much? → pricing
9. What if it fails? → FAQ/guarantees
10. How do I start? → bottom CTA

CTA rules: one goal per page, verb-first text, never "Submit", big+contrasting+repeated, match aggressiveness to awareness. Always include bottom CTA.

Proof placement: adjacent to claims, not in a separate section. Start proof early (hero if possible). Specific > general ("23% churn reduction" > "great product").

Red lines: no carousels in hero, no "Submit" CTA, no company-name-only headlines, mandatory bottom CTA, no lorem ipsum, no low-quality images.`;

export function detectLandingIntent(prompt) {
  return /landing\s*page|hero\s*section|marketing|pricing\s*(page|table)|signup\s*page|\bcta\b|conversion|above.?the.?fold|sales\s*page|lead\s*gen/i.test(prompt || '');
}
