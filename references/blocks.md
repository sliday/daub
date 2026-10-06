# DAUB block library

Blocks are self-contained page sections (a hero, a pricing table, a login screen, a dashboard row) written as json-render specs with realistic content. Each file holds `{ root, elements }` and no theme. Start from a block when the request matches one; it saves tokens and carries layout that already renders well.

## Use a block

1. Find candidates below by category, or ask the hosted MCP: `get_block_library` with `category` (it lists the blocks marked MCP).
2. Fetch the file: `https://daub.dev/blocks/<category>/<id>.json`.
3. Change the copy, numbers and images to fit the request. Keep the structure.
4. Combine several blocks into one page by prefixing their ids, then list the block roots as children of a page Stack.

```js
async function loadBlock(file, prefix) {
  const block = await (await fetch('https://daub.dev/blocks/' + file)).json();
  const re = id => prefix + id;
  const elements = {};
  for (const [id, el] of Object.entries(block.elements)) {
    const props = el.props && Array.isArray(el.props.footer) ? { ...el.props, footer: el.props.footer.map(re) } : el.props;
    elements[re(id)] = { ...el, props, children: el.children && el.children.map(re) };
  }
  return { root: re(block.root), elements };
}

const parts = await Promise.all([
  loadBlock('navigation/navbar-simple-01.json', 'nav-'),
  loadBlock('hero/hero-centered-01.json', 'hero-'),
  loadBlock('pricing/pricing-tiers-01.json', 'price-'),
  loadBlock('footer/footer-simple-01.json', 'foot-'),
]);
const spec = { theme: 'bone', root: 'page', elements: { page: { type: 'Stack', props: { direction: 'vertical', gap: 6 }, children: parts.map(p => p.root) } } };
for (const p of parts) Object.assign(spec.elements, p.elements);
```

Check the file names against the index below before you fetch. Some blocks carry props the renderers ignore (for example `align` or `weight` on Text); they do no harm.

Page recipes that combine blocks well:

- SaaS landing: navigation, hero, logo-bar, features, how-it-works, social-proof, pricing, faq, cta, footer.
- Product page: navigation, ecommerce, features, social-proof, faq, footer.
- App screen: navigation or a Sidebar layout, dashboard or data-display, then forms or modals-overlays as needed.

## Index

<!-- BEGIN GENERATED:index (tools/build-skill.mjs) -->
266 blocks in 34 categories. 266 of them are listed by the hosted MCP `get_block_library` (marked MCP); every file is served at `https://daub.dev/blocks/<file>`.

### app-specific (6)

- `api-keys-page-01` 11 el, MCP: Stack, Text, Button, Alert, DataTable. File `blocks/app-specific/api-keys-page-01.json`
- `billing-page-01` 21 el, MCP: Stack, Text, Button, Surface, Badge, Separator, DataTable. File `blocks/app-specific/billing-page-01.json`
- `changelog-page-01` 38 el, MCP: Stack, Text, Badge, Prose, Separator. File `blocks/app-specific/changelog-page-01.json`
- `onboarding-tour-01` 10 el, MCP: Stack, Text, Progress, List, Button. File `blocks/app-specific/onboarding-tour-01.json`
- `profile-page-01` 21 el, MCP: Stack, Avatar, Text, Badge, Button, Grid, StatCard, Separator, List. File `blocks/app-specific/profile-page-01.json`
- `settings-page-01` 22 el, MCP: Grid, Sidebar, Stack, Text, Select, Separator, Switch, Button. File `blocks/app-specific/settings-page-01.json`

### auth (48)

- `auth-page-01` 33 el, MCP: Grid, Surface, Stack, Text, List, Avatar, Button, Separator, Field, Switch, Link. File `blocks/auth/auth-page-01.json`
- `forgot-password-01` 11 el, MCP: Stack, Card, Alert, Field, Input, Button, Separator, Text, Link. File `blocks/auth/forgot-password-01.json`
- `forgot-password-check-email-01` 12 el, MCP: Stack, Icon, Text, Button, Link. File `blocks/auth/forgot-password-check-email-01.json`
- `forgot-password-form-01` 11 el, MCP: Stack, Icon, Text, Field, Input, Button, Link. File `blocks/auth/forgot-password-form-01.json`
- `forgot-password-new-password-01` 14 el, MCP: Stack, Icon, Text, Field, Input, Button, Link. File `blocks/auth/forgot-password-new-password-01.json`
- `forgot-password-success-01` 9 el, MCP: Stack, Icon, Text, Button, Link. File `blocks/auth/forgot-password-success-01.json`
- `login-form-01` 15 el, MCP: Stack, Card, Field, Input, Checkbox, Link, Button, Separator, Text. File `blocks/auth/login-form-01.json`
- `login-page-card-01` 20 el, MCP: Stack, Icon, Text, Card, Field, Input, Checkbox, Link, Button, Separator. File `blocks/auth/login-page-card-01.json`
- `login-page-card-02` 18 el, MCP: Stack, Card, Icon, Text, Input, Checkbox, Link, Button. File `blocks/auth/login-page-card-02.json`
- `login-page-illustration-01` 19 el, MCP: Stack, Icon, Text, Field, Input, Checkbox, Link, Button. File `blocks/auth/login-page-illustration-01.json`
- `login-page-minimal-01` 18 el, MCP: Stack, Icon, Text, Input, Button, Link. File `blocks/auth/login-page-minimal-01.json`
- `login-page-nav-01` 23 el, MCP: Stack, Icon, Text, Link, Field, Input, Checkbox, Button. File `blocks/auth/login-page-nav-01.json`
- `login-page-simple-01` 19 el, MCP: Stack, Icon, Text, Field, Input, Checkbox, Link, Button. File `blocks/auth/login-page-simple-01.json`
- `login-page-social-01` 17 el, MCP: Stack, Surface, Icon, Text, Input, Button, Separator, Link. File `blocks/auth/login-page-social-01.json`
- `login-page-social-leading-01` 12 el, MCP: Stack, Surface, Icon, Text, Button, Separator, Input. File `blocks/auth/login-page-social-leading-01.json`
- `login-split-carousel-01` 55 el, MCP: Grid, Stack, Icon, Text, Field, Input, Checkbox, Link, Button, Surface, Badge. File `blocks/auth/login-split-carousel-01.json`
- `login-split-geometric-01` 29 el, MCP: Grid, Stack, Icon, Text, Field, Input, Checkbox, Link, Button, Surface. File `blocks/auth/login-split-geometric-01.json`
- `login-split-image-01` 26 el, MCP: Grid, Stack, Text, Field, Input, Checkbox, Link, Button, Surface, Icon. File `blocks/auth/login-split-image-01.json`
- `login-split-image-quote-01` 31 el, MCP: Grid, Stack, Icon, Text, Field, Input, Checkbox, Link, Button, Surface. File `blocks/auth/login-split-image-quote-01.json`
- `login-split-mockup-01` 39 el, MCP: Grid, Stack, Text, Field, Input, Checkbox, Link, Button, Surface. File `blocks/auth/login-split-mockup-01.json`
- `login-split-mockup-quote-01` 46 el, MCP: Grid, Stack, Text, Field, Input, Checkbox, Link, Button, Surface, Avatar. File `blocks/auth/login-split-mockup-quote-01.json`
- `login-split-quote-01` 31 el, MCP: Grid, Surface, Stack, Icon, Text, Avatar, Field, Input, Checkbox, Link, Button. File `blocks/auth/login-split-quote-01.json`
- `register-form-01` 20 el, MCP: Stack, Card, Grid, Field, Input, Checkbox, Button, Separator, Text, Link. File `blocks/auth/register-form-01.json`
- `reset-password-01` 15 el, MCP: Stack, Card, Field, Input, Progress, Text, Button, Separator, Link. File `blocks/auth/reset-password-01.json`
- `signup-card-01` 21 el, MCP: Surface, Stack, Icon, Text, Card, Field, Input, Button, Link. File `blocks/auth/signup-card-01.json`
- `signup-card-02` 25 el, MCP: Surface, Stack, Card, Icon, Text, Field, Input, Button, Link. File `blocks/auth/signup-card-02.json`
- `signup-nav-01` 28 el, MCP: Stack, Icon, Text, Link, Field, Input, Button. File `blocks/auth/signup-nav-01.json`
- `signup-progress-01` 20 el, MCP: Stack, Icon, Text, Field, Input, Button, Separator. File `blocks/auth/signup-progress-01.json`
- `signup-progress-02` 32 el, MCP: Stack, Icon, Text, Field, Input, Button, Surface, Grid. File `blocks/auth/signup-progress-02.json`
- `signup-progress-03` 25 el, MCP: Stack, Icon, Text, Field, Input, Button, Grid. File `blocks/auth/signup-progress-03.json`
- `signup-sidebar-progress-01` 48 el, MCP: Grid, Stack, Icon, Text, Avatar, Field, Input, Button, Separator. File `blocks/auth/signup-sidebar-progress-01.json`
- `signup-sidebar-progress-02` 43 el, MCP: Grid, Stack, Icon, Text, Separator, Avatar, Field, Input, Button. File `blocks/auth/signup-sidebar-progress-02.json`
- `signup-sidebar-progress-03` 43 el, MCP: Grid, Stack, Icon, Text, Badge, Separator, Avatar, Field, Input, Button. File `blocks/auth/signup-sidebar-progress-03.json`
- `signup-simple-01` 19 el, MCP: Stack, Icon, Text, Field, Input, Button, Link. File `blocks/auth/signup-simple-01.json`
- `signup-social-01` 19 el, MCP: Stack, Icon, Text, Field, Input, Button, Separator, Link. File `blocks/auth/signup-social-01.json`
- `signup-social-leading-01` 18 el, MCP: Stack, Icon, Text, Button, Separator, Field, Input, Link. File `blocks/auth/signup-social-leading-01.json`
- `signup-split-app-mockup-01` 41 el, MCP: Grid, Stack, Icon, Text, Field, Input, Button, Link, Surface, List. File `blocks/auth/signup-split-app-mockup-01.json`
- `signup-split-arrow-01` 37 el, MCP: Grid, Stack, Icon, Text, Field, Input, Button, Link, Surface, Avatar. File `blocks/auth/signup-split-arrow-01.json`
- `signup-split-carousel-01` 52 el, MCP: Grid, Stack, Icon, Text, Field, Input, Button, Link, Surface, Badge. File `blocks/auth/signup-split-carousel-01.json`
- `signup-split-gradient-01` 29 el, MCP: Grid, Stack, Icon, Text, Field, Input, Button, Link, Surface, List. File `blocks/auth/signup-split-gradient-01.json`
- `signup-split-image-bg-01` 37 el, MCP: Grid, Surface, Stack, Icon, Text, Avatar, Field, Input, Button, Link. File `blocks/auth/signup-split-image-bg-01.json`
- `signup-split-mockup-01` 42 el, MCP: Grid, Stack, Icon, Text, Field, Input, Button, Link, Surface. File `blocks/auth/signup-split-mockup-01.json`
- `signup-split-mockup-quote-01` 49 el, MCP: Grid, Stack, Icon, Text, Field, Input, Button, Link, Surface, Avatar. File `blocks/auth/signup-split-mockup-quote-01.json`
- `signup-split-quote-carousel-01` 40 el, MCP: Grid, Surface, Stack, Icon, Text, Avatar, Button, Badge, Field, Input, Link. File `blocks/auth/signup-split-quote-carousel-01.json`
- `signup-split-quote-image-01` 29 el, MCP: Grid, Stack, Icon, Text, Field, Input, Button, Link, Surface, Avatar. File `blocks/auth/signup-split-quote-image-01.json`
- `signup-split-quote-image-02` 34 el, MCP: Grid, Stack, Icon, Text, Field, Input, Button, Link, Surface, Card, Avatar. File `blocks/auth/signup-split-quote-image-02.json`
- `social-login-01` 18 el, MCP: Stack, Card, Button, Separator, Text, Field, Input, Link. File `blocks/auth/social-login-01.json`
- `two-factor-01` 14 el, MCP: Stack, Card, Button, Label, InputOTP, Separator, Text, Link. File `blocks/auth/two-factor-01.json`

### banners (3)

- `banner-bottom-sticky-01` 9 el, MCP: Surface, Stack, Text, ButtonGroup, Button. File `blocks/banners/banner-bottom-sticky-01.json`
- `banner-inline-01` 11 el, MCP: Stack, Surface, Grid, Chip, Text, Button, Image. File `blocks/banners/banner-inline-01.json`
- `banner-top-01` 6 el, MCP: Surface, Stack, Badge, Text, Button. File `blocks/banners/banner-top-01.json`

### blog (6)

- `blog-featured-01` 13 el, MCP: Surface, Stack, Image, Badge, Text, Avatar, Button. File `blocks/blog/blog-featured-01.json`
- `blog-grid-01` 46 el, MCP: Stack, Text, Grid, Card, Image, Chip. File `blocks/blog/blog-grid-01.json`
- `blog-list-01` 34 el, MCP: Stack, Text, Image, Chip, Separator. File `blocks/blog/blog-list-01.json`
- `blog-newsletter-01` 26 el, MCP: Stack, Text, Grid, Card, Image, Surface, InputGroup, Input, Button. File `blocks/blog/blog-newsletter-01.json`
- `blog-post-header-01` 17 el, MCP: Stack, Breadcrumbs, Chip, Text, Avatar, ButtonGroup, Button, Image. File `blocks/blog/blog-post-header-01.json`
- `blog-sidebar-01` 37 el, MCP: Grid, Stack, Text, Card, Image, Search, NavMenu, Chip, List. File `blocks/blog/blog-sidebar-01.json`

### comparison (3)

- `before-after-01` 16 el, MCP: Stack, Text, Grid, Card, Badge, AspectRatio, Image. File `blocks/comparison/before-after-01.json`
- `comparison-table-01` 4 el, MCP: Stack, Text, DataTable. File `blocks/comparison/comparison-table-01.json`
- `vs-layout-01` 13 el, MCP: Stack, Text, Grid, Card, List, Separator, Surface, Badge. File `blocks/comparison/vs-layout-01.json`

### contact (5)

- `contact-form-simple-01` 18 el, MCP: Stack, Text, Surface, Grid, Field, Input, Textarea, Button. File `blocks/contact/contact-form-simple-01.json`
- `contact-info-01` 20 el, MCP: Stack, Text, Grid, Card, Button. File `blocks/contact/contact-info-01.json`
- `contact-offices-01` 26 el, MCP: Stack, Text, Grid, Card, Badge. File `blocks/contact/contact-offices-01.json`
- `contact-split-01` 35 el, MCP: Stack, Text, Grid, Surface, Field, Input, Textarea, Button, Separator. File `blocks/contact/contact-split-01.json`
- `contact-with-map-01` 26 el, MCP: Stack, Text, Grid, Image, Surface, Field, Input, Textarea, Button. File `blocks/contact/contact-with-map-01.json`

### content (6)

- `content-numbered-steps-01` 35 el, MCP: Stack, Text, Avatar, Separator, Button. File `blocks/content/content-numbered-steps-01.json`
- `content-quote-highlight-01` 19 el, MCP: Stack, Chip, Text, Surface, Avatar, StatCard. File `blocks/content/content-quote-highlight-01.json`
- `content-section-01` 12 el, MCP: Stack, Chip, Text, Image, Button. File `blocks/content/content-section-01.json`
- `content-split-01` 13 el, MCP: Stack, Text, Grid, Badge, List. File `blocks/content/content-split-01.json`
- `content-video-embed-01` 20 el, MCP: Stack, Badge, Text, AspectRatio, Surface, Image, Icon, List, Separator. File `blocks/content/content-video-embed-01.json`
- `content-with-image-01` 20 el, MCP: Stack, Image, Badge, Text, ButtonGroup, Button. File `blocks/content/content-with-image-01.json`

### cta (30)

- `cta-abstract-images-01` 17 el, MCP: Stack, Grid, Text, ButtonGroup, Button, Image. File `blocks/cta/cta-abstract-images-01.json`
- `cta-banner-01` 8 el, MCP: Surface, Stack, Text, Button. File `blocks/cta/cta-banner-01.json`
- `cta-card-horizontal-01` 10 el, MCP: Stack, Card, Text, ButtonGroup, Button. File `blocks/cta/cta-card-horizontal-01.json`
- `cta-card-horizontal-split-01` 11 el, MCP: Stack, Surface, Card, Text, ButtonGroup, Button. File `blocks/cta/cta-card-horizontal-split-01.json`
- `cta-card-vertical-01` 10 el, MCP: Stack, Card, Text, ButtonGroup, Button. File `blocks/cta/cta-card-vertical-01.json`
- `cta-download-01` 17 el, MCP: Grid, Stack, Badge, Text, Button, Image, Chip. File `blocks/cta/cta-download-01.json`
- `cta-floating-01` 10 el, MCP: Surface, Stack, Badge, Text, Button. File `blocks/cta/cta-floating-01.json`
- `cta-iphone-mockup-01` 14 el, MCP: Stack, Grid, Text, List, ButtonGroup, Button, Image. File `blocks/cta/cta-iphone-mockup-01.json`
- `cta-iphone-mockup-02` 9 el, MCP: Stack, Text, ButtonGroup, Button, Image. File `blocks/cta/cta-iphone-mockup-02.json`
- `cta-iphone-mockup-03` 9 el, MCP: Stack, Text, ButtonGroup, Button, Image. File `blocks/cta/cta-iphone-mockup-03.json`
- `cta-iphone-mockup-04` 14 el, MCP: Stack, Grid, Image, Text, List, ButtonGroup, Button. File `blocks/cta/cta-iphone-mockup-04.json`
- `cta-screen-mockup-01` 14 el, MCP: Stack, Grid, Text, List, ButtonGroup, Button, Image. File `blocks/cta/cta-screen-mockup-01.json`
- `cta-screen-mockup-02` 9 el, MCP: Stack, Text, ButtonGroup, Button, Image. File `blocks/cta/cta-screen-mockup-02.json`
- `cta-screen-mockup-03` 9 el, MCP: Stack, Text, ButtonGroup, Button, Image. File `blocks/cta/cta-screen-mockup-03.json`
- `cta-screen-mockup-04` 20 el, MCP: Stack, Grid, Image, Text, Badge, ButtonGroup, Button. File `blocks/cta/cta-screen-mockup-04.json`
- `cta-simple-01` 6 el, MCP: Stack, Text, ButtonGroup, Button. File `blocks/cta/cta-simple-01.json`
- `cta-simple-centered-01` 8 el, MCP: Stack, Text, ButtonGroup, Button. File `blocks/cta/cta-simple-centered-01.json`
- `cta-simple-left-01` 8 el, MCP: Stack, Text, ButtonGroup, Button. File `blocks/cta/cta-simple-left-01.json`
- `cta-simple-logos-01` 17 el, MCP: Stack, Text, ButtonGroup, Button, Separator, Icon. File `blocks/cta/cta-simple-logos-01.json`
- `cta-simple-logos-02` 25 el, MCP: Stack, Grid, Text, ButtonGroup, Button, Icon. File `blocks/cta/cta-simple-logos-02.json`
- `cta-split-01` 21 el, MCP: Stack, Badge, Text, Surface, Field, Input, Button. File `blocks/cta/cta-split-01.json`
- `cta-split-image-01` 9 el, MCP: Grid, Stack, Text, List, ButtonGroup, Button, Image. File `blocks/cta/cta-split-image-01.json`
- `cta-split-image-02` 9 el, MCP: Grid, Image, Stack, Text, ButtonGroup, Button. File `blocks/cta/cta-split-image-02.json`
- `cta-split-image-03` 11 el, MCP: Stack, Image, Card, Text, ButtonGroup, Button. File `blocks/cta/cta-split-image-03.json`
- `cta-split-image-04` 10 el, MCP: Grid, Image, Stack, Text, List, ButtonGroup, Button. File `blocks/cta/cta-split-image-04.json`
- `cta-split-image-quote-01` 27 el, MCP: Grid, Stack, Text, Badge, Button, Image, Surface, Avatar. File `blocks/cta/cta-split-image-quote-01.json`
- `cta-split-image-quote-02` 18 el, MCP: Grid, Stack, Image, Surface, Text, Avatar, Button. File `blocks/cta/cta-split-image-quote-02.json`
- `cta-split-image-quote-03` 15 el, MCP: Grid, Stack, Text, Button, Image, Avatar. File `blocks/cta/cta-split-image-quote-03.json`
- `cta-split-image-quote-04` 16 el, MCP: Stack, Image, Surface, Text, Avatar, Button. File `blocks/cta/cta-split-image-quote-04.json`
- `cta-with-form-01` 11 el, MCP: Stack, Text, Field, Input, Button, AvatarGroup. File `blocks/cta/cta-with-form-01.json`

### dashboard (12)

- `activity-feed-01` 5 el, MCP: Stack, Text, Link, List. File `blocks/dashboard/activity-feed-01.json`
- `chart-panel-01` 22 el, MCP: Stack, Text, Badge, Select, Button, ChartCard, Chart, Grid, StatCard, Separator, List. File `blocks/dashboard/chart-panel-01.json`
- `chart-section-01` 5 el, MCP: Grid, ChartCard, Chart. File `blocks/dashboard/chart-section-01.json`
- `dashboard-header-01` 8 el, MCP: Stack, Text, DatePicker, Button. File `blocks/dashboard/dashboard-header-01.json`
- `data-table-01` 11 el, MCP: Stack, Search, Select, ButtonGroup, Button, DataTable, Pagination. File `blocks/dashboard/data-table-01.json`
- `empty-state-panel-01` 6 el, MCP: Surface, Stack, EmptyState, Button. File `blocks/dashboard/empty-state-panel-01.json`
- `header-01` 28 el, MCP: Stack, Navbar, Avatar, Text, Search, Button, Badge, Separator, Breadcrumbs, Tabs. File `blocks/dashboard/header-01.json`
- `kanban-board-01` 20 el, MCP: Grid, Stack, Text, Badge, Card. File `blocks/dashboard/kanban-board-01.json`
- `notification-panel-01` 8 el, MCP: Stack, Text, Badge, Button, List. File `blocks/dashboard/notification-panel-01.json`
- `sidebar-layout-01` 31 el, MCP: Stack, Sidebar, Text, Search, Button, Avatar, Grid, StatCard, Separator, ButtonGroup, DataTable, Card, List. File `blocks/dashboard/sidebar-layout-01.json`
- `stats-cards-row-01` 5 el, MCP: Grid, StatCard. File `blocks/dashboard/stats-cards-row-01.json`
- `stats-row-01` 5 el, MCP: Grid, StatCard. File `blocks/dashboard/stats-row-01.json`

### data-display (3)

- `empty-state-01` 3 el, MCP: Stack, EmptyState, Button. File `blocks/data-display/empty-state-01.json`
- `notification-center-01` 5 el, MCP: Stack, Text, Button, List. File `blocks/data-display/notification-center-01.json`
- `profile-01` 13 el, MCP: Stack, Avatar, Text, Button, StatCard, Tabs, List. File `blocks/data-display/profile-01.json`

### ecommerce (9)

- `category-grid-01` 29 el, MCP: Stack, Text, Grid, Card, Image, Badge. File `blocks/ecommerce/category-grid-01.json`
- `checkout-form-01` 44 el, MCP: Stack, Text, Stepper, Field, Input, Select, Separator, Checkbox, Surface, List, Button. File `blocks/ecommerce/checkout-form-01.json`
- `order-summary-01` 51 el, MCP: Stack, Badge, Text, Grid, Surface, Separator, DataTable, Button. File `blocks/ecommerce/order-summary-01.json`
- `product-card-01` 20 el, MCP: Card, Stack, AspectRatio, Image, Badge, Text, ToggleGroup, Button. File `blocks/ecommerce/product-card-01.json`
- `product-carousel-01` 37 el, MCP: Stack, Text, ButtonGroup, Button, Grid, Card, Image, Badge. File `blocks/ecommerce/product-carousel-01.json`
- `product-detail-01` 32 el, MCP: Grid, Stack, AspectRatio, Image, Breadcrumbs, Text, Link, Badge, Separator, ToggleGroup, Select, Button, Alert, List. File `blocks/ecommerce/product-detail-01.json`
- `product-grid-01` 22 el, MCP: Stack, Text, Select, Chip, Grid, Card, Button. File `blocks/ecommerce/product-grid-01.json`
- `shopping-cart-01` 56 el, MCP: Stack, Text, Badge, Image, Select, Button, Separator, Surface, Input. File `blocks/ecommerce/shopping-cart-01.json`
- `wishlist-01` 39 el, MCP: Stack, Text, Badge, Button, Grid, Card, Image, Alert. File `blocks/ecommerce/wishlist-01.json`

### error-pages (16)

- `404-illustration-01` 10 el, MCP: Stack, Text, Button, Image. File `blocks/error-pages/404-illustration-01.json`
- `404-illustration-02` 10 el, MCP: Stack, Text, Search, Button, Image. File `blocks/error-pages/404-illustration-02.json`
- `404-illustration-03` 10 el, MCP: Stack, Text, Button, Image. File `blocks/error-pages/404-illustration-03.json`
- `404-illustration-04` 10 el, MCP: Stack, Text, Search, Button, Image. File `blocks/error-pages/404-illustration-04.json`
- `404-page-01` 16 el, MCP: Stack, Image, Text, Search, Button, ButtonGroup, Link. File `blocks/error-pages/404-page-01.json`
- `404-simple-01` 8 el, MCP: Stack, Text, Button. File `blocks/error-pages/404-simple-01.json`
- `404-simple-02` 18 el, MCP: Stack, Text, Button, Link. File `blocks/error-pages/404-simple-02.json`
- `404-simple-03` 8 el, MCP: Stack, Icon, Text, Button. File `blocks/error-pages/404-simple-03.json`
- `404-simple-04` 28 el, MCP: Stack, Text, Button, Card, Icon, Link. File `blocks/error-pages/404-simple-04.json`
- `404-split-image-01` 9 el, MCP: Grid, Stack, Text, Button, Image. File `blocks/error-pages/404-split-image-01.json`
- `404-split-image-02` 9 el, MCP: Grid, Stack, Text, Search, Button, Image. File `blocks/error-pages/404-split-image-02.json`
- `404-split-image-03` 10 el, MCP: Stack, Text, Button, Image. File `blocks/error-pages/404-split-image-03.json`
- `404-split-image-04` 20 el, MCP: Stack, Text, Search, Button, Link, Image. File `blocks/error-pages/404-split-image-04.json`
- `500-page-01` 15 el, MCP: Stack, Image, Text, Surface, ButtonGroup, Button, Alert. File `blocks/error-pages/500-page-01.json`
- `coming-soon-01` 27 el, MCP: Stack, Badge, Text, Progress, Chip, Surface, Input, Button, Grid, Card. File `blocks/error-pages/coming-soon-01.json`
- `maintenance-page-01` 26 el, MCP: Stack, Image, Text, Separator, Progress, Input, Button. File `blocks/error-pages/maintenance-page-01.json`

### event-schedule (3)

- `event-countdown-01` 28 el, MCP: Surface, Stack, Badge, Text, Chip, ButtonGroup, Button. File `blocks/event-schedule/event-countdown-01.json`
- `schedule-tabs-01` 7 el, MCP: Stack, Text, Tabs, List. File `blocks/event-schedule/schedule-tabs-01.json`
- `speaker-grid-01` 41 el, MCP: Stack, Text, Grid, Card, Image, Chip. File `blocks/event-schedule/speaker-grid-01.json`

### faq (4)

- `faq-accordion-01` 4 el, MCP: Stack, Text, Accordion. File `blocks/faq/faq-accordion-01.json`
- `faq-grid-01` 10 el, MCP: Stack, Text, Grid, Card. File `blocks/faq/faq-grid-01.json`
- `faq-simple-01` 22 el, MCP: Stack, Text, Separator. File `blocks/faq/faq-simple-01.json`
- `faq-with-sidebar-01` 13 el, MCP: Stack, Text, Grid, NavMenu, Accordion, Surface, Button. File `blocks/faq/faq-with-sidebar-01.json`

### features (9)

- `feature-alternating-01` 25 el, MCP: Stack, Text, Image, Chip, Button. File `blocks/features/feature-alternating-01.json`
- `feature-bento-01` 33 el, MCP: Stack, Chip, Text, Grid, Surface, Image. File `blocks/features/feature-bento-01.json`
- `feature-centered-01` 17 el, MCP: Stack, Badge, Text, Image, Separator. File `blocks/features/feature-centered-01.json`
- `feature-comparison-01` 20 el, MCP: Stack, Text, Grid, Surface, Separator, List, Badge. File `blocks/features/feature-comparison-01.json`
- `feature-grid-01` 18 el, MCP: Stack, Badge, Text, Grid, Card. File `blocks/features/feature-grid-01.json`
- `feature-icon-grid-01` 41 el, MCP: Stack, Text, Grid. File `blocks/features/feature-icon-grid-01.json`
- `feature-list-01` 34 el, MCP: Stack, Text, Separator. File `blocks/features/feature-list-01.json`
- `feature-tabs-01` 29 el, MCP: Stack, Text, Tabs, List, Image. File `blocks/features/feature-tabs-01.json`
- `feature-with-code-01` 23 el, MCP: Stack, Badge, Text, Separator, Surface, CustomHTML, Button. File `blocks/features/feature-with-code-01.json`

### footer (5)

- `footer-columns-01` 23 el, MCP: Stack, Separator, Grid, Text, NavMenu, ButtonGroup, Button. File `blocks/footer/footer-columns-01.json`
- `footer-mega-01` 33 el, MCP: Stack, Separator, Grid, Text, NavMenu, Surface, Input, Button, ButtonGroup. File `blocks/footer/footer-mega-01.json`
- `footer-minimal-01` 5 el, MCP: Stack, Separator, Text, NavMenu. File `blocks/footer/footer-minimal-01.json`
- `footer-simple-01` 9 el, MCP: Stack, Separator, Text, NavMenu, ButtonGroup, Button. File `blocks/footer/footer-simple-01.json`
- `footer-with-cta-01` 30 el, MCP: Stack, Surface, Text, ButtonGroup, Button, Separator, Grid, NavMenu. File `blocks/footer/footer-with-cta-01.json`

### forms (12)

- `checkout-01` 35 el, MCP: Stack, Text, Grid, Field, Select, Card, Separator, Button. File `blocks/forms/checkout-01.json`
- `contact-01` 13 el, MCP: Stack, Text, Field, Select, Label, Textarea, Button. File `blocks/forms/contact-01.json`
- `file-upload-01` 29 el, MCP: Stack, Text, Surface, Button, Badge, Progress. File `blocks/forms/file-upload-01.json`
- `form-inline-01` 11 el, MCP: Stack, Field, Search, Select, Button. File `blocks/forms/form-inline-01.json`
- `form-multi-step-01` 18 el, MCP: Stack, Stepper, Surface, Text, Field, Input, Checkbox, Button. File `blocks/forms/form-multi-step-01.json`
- `form-stacked-01` 33 el, MCP: Stack, Text, Grid, Field, Input, Separator, Select, Textarea, Button. File `blocks/forms/form-stacked-01.json`
- `form-with-sidebar-01` 20 el, MCP: Grid, Stack, Text, Field, Input, Textarea, Select, RadioGroup, DatePicker, Button, Separator, List, Alert. File `blocks/forms/form-with-sidebar-01.json`
- `login-01` 18 el, MCP: Stack, Card, Text, Field, Checkbox, Button, Separator. File `blocks/forms/login-01.json`
- `search-bar-01` 13 el, MCP: Stack, Search, Button, Chip, Surface, List. File `blocks/forms/search-bar-01.json`
- `settings-01` 23 el, MCP: Stack, Text, Field, Label, Textarea, Separator, Switch, Button. File `blocks/forms/settings-01.json`
- `settings-form-01` 24 el, MCP: Stack, Text, Switch, Select, Separator, ToggleGroup, Button. File `blocks/forms/settings-form-01.json`
- `signup-01` 16 el, MCP: Stack, Card, Text, Grid, Field, Checkbox, Button, Link. File `blocks/forms/signup-01.json`

### hero (8)

- `hero-centered-01` 14 el, MCP: Stack, Badge, Text, Button, AvatarGroup, Avatar. File `blocks/hero/hero-centered-01.json`
- `hero-fullscreen-01` 10 el, MCP: Stack, Avatar, Text, Button. File `blocks/hero/hero-fullscreen-01.json`
- `hero-minimal-01` 7 el, MCP: Stack, Text, Separator, Button. File `blocks/hero/hero-minimal-01.json`
- `hero-split-01` 20 el, MCP: Grid, Stack, Chip, Text, Badge, Button, Surface, Image. File `blocks/hero/hero-split-01.json`
- `hero-video-background-01` 9 el, MCP: Stack, CustomHTML, Text, Button. File `blocks/hero/hero-video-background-01.json`
- `hero-with-app-screenshot-01` 16 el, MCP: Stack, Text, Button, Surface, Image. File `blocks/hero/hero-with-app-screenshot-01.json`
- `hero-with-form-01` 13 el, MCP: Grid, Stack, Text, List, Card, Field, Input, Select, Button. File `blocks/hero/hero-with-form-01.json`
- `hero-with-stats-01` 13 el, MCP: Stack, Badge, Text, Button, Grid, StatCard. File `blocks/hero/hero-with-stats-01.json`

### how-it-works (3)

- `process-alternating-01` 23 el, MCP: Stack, Text, Grid, Chip, Image, Button. File `blocks/how-it-works/process-alternating-01.json`
- `steps-horizontal-01` 21 el, MCP: Stack, Text, Stepper, Grid, Surface, Avatar. File `blocks/how-it-works/steps-horizontal-01.json`
- `steps-vertical-01` 29 el, MCP: Stack, Text, Avatar, Chip, Button. File `blocks/how-it-works/steps-vertical-01.json`

### integrations (3)

- `api-reference-01` 37 el, MCP: Stack, Text, Surface, Badge, Chip, Separator, Button. File `blocks/integrations/api-reference-01.json`
- `integration-grid-01` 55 el, MCP: Stack, Text, Grid, Surface, Avatar, Button. File `blocks/integrations/integration-grid-01.json`
- `integration-showcase-01` 24 el, MCP: Stack, Badge, Text, Grid, Surface, Image, List, Separator, ButtonGroup, Button. File `blocks/integrations/integration-showcase-01.json`

### landing (5)

- `features-grid-01` 10 el, MCP: Stack, Text, Grid, Card. File `blocks/landing/features-grid-01.json`
- `footer-01` 22 el, MCP: Stack, Grid, Text, NavMenu, Separator, Button. File `blocks/landing/footer-01.json`
- `hero-01` 20 el, MCP: Stack, Badge, Text, Button, Image, Grid, StatCard. File `blocks/landing/hero-01.json`
- `pricing-01` 34 el, MCP: Stack, Text, Grid, Surface, Separator, Button, Badge. File `blocks/landing/pricing-01.json`
- `testimonials-01` 31 el, MCP: Stack, Text, Grid, Surface, Separator, Avatar. File `blocks/landing/testimonials-01.json`

### logo-bar (3)

- `logo-cloud-scrolling-01` 16 el, MCP: Stack, Text, ScrollArea. File `blocks/logo-bar/logo-cloud-scrolling-01.json`
- `logo-cloud-simple-01` 23 el, MCP: Stack, Text, Grid, Surface. File `blocks/logo-bar/logo-cloud-simple-01.json`
- `logo-cloud-with-heading-01` 23 el, MCP: Stack, Badge, Text, Separator, Grid, Surface. File `blocks/logo-bar/logo-cloud-with-heading-01.json`

### media (4)

- `gallery-carousel-01` 29 el, MCP: Stack, Text, ButtonGroup, Button, Card, Image, Grid. File `blocks/media/gallery-carousel-01.json`
- `gallery-grid-01` 11 el, MCP: Stack, Text, Grid, Image. File `blocks/media/gallery-grid-01.json`
- `media-with-text-01` 23 el, MCP: Grid, Surface, AspectRatio, Image, Stack, Badge, Text, Separator, ButtonGroup, Button. File `blocks/media/media-with-text-01.json`
- `video-section-01` 20 el, MCP: Stack, Text, Grid, Surface, AspectRatio, Image, Button, Chip. File `blocks/media/video-section-01.json`

### misc (8)

- `back-to-top-01` 2 el, MCP: Stack, Button. File `blocks/misc/back-to-top-01.json`
- `divider-01` 4 el, MCP: Stack, Separator, Text. File `blocks/misc/divider-01.json`
- `language-switcher-01` 3 el, MCP: Stack, Icon, Select. File `blocks/misc/language-switcher-01.json`
- `scroll-indicator-01` 2 el, MCP: Stack, Progress. File `blocks/misc/scroll-indicator-01.json`
- `skip-link-01` 2 el, MCP: Stack, Button. File `blocks/misc/skip-link-01.json`
- `social-links-01` 9 el, MCP: Stack, Text, ButtonGroup, Button. File `blocks/misc/social-links-01.json`
- `table-of-contents-01` 3 el, MCP: Stack, Text, NavMenu. File `blocks/misc/table-of-contents-01.json`
- `theme-toggle-01` 8 el, MCP: Stack, Card, Icon, Text, Toggle. File `blocks/misc/theme-toggle-01.json`

### mobile (1)

- `app-shell-01` 28 el, MCP: Stack, Navbar, Avatar, Text, Grid, Button, StatCard, Separator, Chip, List, BottomNav. File `blocks/mobile/app-shell-01.json`

### modals-overlays (7)

- `command-palette-01` 6 el, MCP: Stack, Card, Input, Separator, List. File `blocks/modals-overlays/command-palette-01.json`
- `cookie-consent-01` 9 el, MCP: Surface, Stack, Text, Button. File `blocks/modals-overlays/cookie-consent-01.json`
- `drawer-01` 17 el, MCP: Drawer, Stack, Text, Field, Input, Select, Checkbox, Button. File `blocks/modals-overlays/drawer-01.json`
- `lightbox-01` 15 el, MCP: Card, Stack, AspectRatio, Image, Button, Text. File `blocks/modals-overlays/lightbox-01.json`
- `modal-confirm-01` 6 el, MCP: Card, Surface, List, Stack, Button. File `blocks/modals-overlays/modal-confirm-01.json`
- `modal-dialog-01` 19 el, MCP: Card, Stack, Avatar, Button, Field, Input, Textarea, Grid, DatePicker. File `blocks/modals-overlays/modal-dialog-01.json`
- `toast-notification-01` 5 el, MCP: Stack, Alert. File `blocks/modals-overlays/toast-notification-01.json`

### navigation (11)

- `bottom-nav-01` 1 el, MCP: BottomNav. File `blocks/navigation/bottom-nav-01.json`
- `breadcrumbs-01` 3 el, MCP: Stack, Breadcrumbs, Text. File `blocks/navigation/breadcrumbs-01.json`
- `navbar-mega-menu-01` 30 el, MCP: Stack, Surface, Text, Link, Button, Grid. File `blocks/navigation/navbar-mega-menu-01.json`
- `navbar-mobile-drawer-01` 14 el, MCP: Stack, Surface, Button, Sheet, Text, Separator, NavMenu. File `blocks/navigation/navbar-mobile-drawer-01.json`
- `navbar-simple-01` 12 el, MCP: Stack, Surface, Text, Link, Button. File `blocks/navigation/navbar-simple-01.json`
- `navbar-with-auth-01` 13 el, MCP: Stack, Surface, Text, Link, Button. File `blocks/navigation/navbar-with-auth-01.json`
- `navbar-with-search-01` 13 el, MCP: Stack, Surface, Text, Link, Search, Button, Avatar. File `blocks/navigation/navbar-with-search-01.json`
- `pagination-01` 5 el, MCP: Stack, Text, Select, Pagination. File `blocks/navigation/pagination-01.json`
- `sidebar-nav-01` 1 el, MCP: Sidebar. File `blocks/navigation/sidebar-nav-01.json`
- `tab-nav-01` 20 el, MCP: Stack, Text, Button, Tabs, Field, Input, Select, Switch. File `blocks/navigation/tab-nav-01.json`
- `topbar-announcement-01` 5 el, MCP: Surface, Stack, Badge, Text, Link. File `blocks/navigation/topbar-announcement-01.json`

### newsletter (4)

- `newsletter-card-01` 12 el, MCP: Card, Stack, Badge, Field, Input, Button, Text. File `blocks/newsletter/newsletter-card-01.json`
- `newsletter-footer-01` 15 el, MCP: Surface, Stack, Text, Button, InputGroup, Input. File `blocks/newsletter/newsletter-footer-01.json`
- `newsletter-inline-01` 7 el, MCP: Stack, Text, InputGroup, Input, Button. File `blocks/newsletter/newsletter-inline-01.json`
- `newsletter-popup-01` 10 el, MCP: Stack, Card, Icon, Text, Input, Button. File `blocks/newsletter/newsletter-popup-01.json`

### portfolio (3)

- `portfolio-carousel-01` 32 el, MCP: Stack, Text, ButtonGroup, Button, Card, Image, Chip, Grid. File `blocks/portfolio/portfolio-carousel-01.json`
- `portfolio-case-study-01` 33 el, MCP: Stack, Breadcrumbs, Badge, Text, Image, Grid, StatCard, Prose, List, Surface, Avatar, Button. File `blocks/portfolio/portfolio-case-study-01.json`
- `portfolio-grid-01` 53 el, MCP: Stack, Text, ToggleGroup, Grid, Card, Image, Chip. File `blocks/portfolio/portfolio-grid-01.json`

### pricing (6)

- `pricing-calculator-01` 36 el, MCP: Stack, Text, Surface, Slider, Separator, Button. File `blocks/pricing/pricing-calculator-01.json`
- `pricing-comparison-table-01` 8 el, MCP: Stack, Text, DataTable, Button. File `blocks/pricing/pricing-comparison-table-01.json`
- `pricing-faq-01` 10 el, MCP: Stack, Text, Accordion, ButtonGroup, Button. File `blocks/pricing/pricing-faq-01.json`
- `pricing-single-01` 23 el, MCP: Stack, Surface, Text, Badge, Separator, Grid, Button. File `blocks/pricing/pricing-single-01.json`
- `pricing-tiers-01` 35 el, MCP: Stack, Text, Grid, Surface, Button, Separator, List, Badge. File `blocks/pricing/pricing-tiers-01.json`
- `pricing-toggle-01` 38 el, MCP: Stack, Text, ToggleGroup, Grid, Surface, Button, Separator, List, Badge. File `blocks/pricing/pricing-toggle-01.json`

### social-proof (8)

- `case-study-card-01` 25 el, MCP: Stack, Badge, Text, Surface, Grid, StatCard, Separator, Avatar. File `blocks/social-proof/case-study-card-01.json`
- `press-mentions-01` 22 el, MCP: Stack, Text, Separator, Grid, Surface. File `blocks/social-proof/press-mentions-01.json`
- `review-stars-01` 42 el, MCP: Stack, Text, Progress, Separator. File `blocks/social-proof/review-stars-01.json`
- `social-proof-bar-01` 18 el, MCP: Surface, Stack, Text, Separator. File `blocks/social-proof/social-proof-bar-01.json`
- `testimonial-carousel-01` 33 el, MCP: Stack, Text, Card, Avatar, Grid, ButtonGroup, Button. File `blocks/social-proof/testimonial-carousel-01.json`
- `testimonial-grid-01` 30 el, MCP: Stack, Badge, Text, Grid, Surface, Avatar. File `blocks/social-proof/testimonial-grid-01.json`
- `testimonial-single-01` 10 el, MCP: Stack, Text, Separator, Avatar. File `blocks/social-proof/testimonial-single-01.json`
- `testimonial-wall-01` 39 el, MCP: Stack, Text, Grid, Surface, Avatar. File `blocks/social-proof/testimonial-wall-01.json`

### stats (4)

- `stats-counter-01` 17 el, MCP: Surface, Stack, Text, Grid. File `blocks/stats/stats-counter-01.json`
- `stats-grid-01` 8 el, MCP: Stack, Text, Grid, StatCard. File `blocks/stats/stats-grid-01.json`
- `stats-strip-01` 16 el, MCP: Stack, Text, Separator. File `blocks/stats/stats-strip-01.json`
- `stats-with-description-01` 27 el, MCP: Stack, Badge, Text, Button, Grid, Surface, Chip. File `blocks/stats/stats-with-description-01.json`

### team (4)

- `team-carousel-01` 25 el, MCP: Stack, Text, Grid, Card, Avatar, Chip, ButtonGroup, Button. File `blocks/team/team-carousel-01.json`
- `team-featured-01` 12 el, MCP: Surface, Stack, Image, Badge, Text, Prose, Button. File `blocks/team/team-featured-01.json`
- `team-grid-01` 34 el, MCP: Stack, Text, Grid, Card, Avatar. File `blocks/team/team-grid-01.json`
- `team-list-01` 31 el, MCP: Stack, Text, Avatar, Badge, Separator. File `blocks/team/team-list-01.json`

### timeline (4)

- `changelog-01` 37 el, MCP: Stack, Text, Badge, Prose, Separator. File `blocks/timeline/changelog-01.json`
- `roadmap-01` 22 el, MCP: Stack, Text, Stepper, Grid, Surface, Badge, List, Progress. File `blocks/timeline/roadmap-01.json`
- `timeline-horizontal-01` 24 el, MCP: Stack, Text, ScrollArea, Card, Badge. File `blocks/timeline/timeline-horizontal-01.json`
- `timeline-vertical-01` 4 el, MCP: Stack, Text, List. File `blocks/timeline/timeline-vertical-01.json`
<!-- END GENERATED:index -->
