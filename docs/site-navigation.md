# Site Navigation

`site-nav.js` defines the shared header links and route selection. It upgrades the
`.db-nav` fallback on the homepage, documentation, layout gallery, theme gallery,
theme preview, playground, roadmap, and case studies. `site-nav.css` owns the
header's spacing, typography, responsive menu, and Resources disclosure.

| Destination | Route |
| --- | --- |
| Docs | `components.html#getting-started` |
| Components | `components.html` |
| Layouts | `demo.html` |
| Themes | `themes.html` |
| Playground | `playground.html` |
| Resources / Chat demo | `chat-demo.html` |
| Resources / Roadmap | `roadmap.html` |
| Resources / Case studies | `case-studies.html` |
| Resources / AI docs | `llms.txt` |

Docs and Components share one reference interface. The sidebar contains setup
guides and component categories; the header contains site destinations. The old
`docs.html` entry preserves query strings and anchors when forwarding to this
interface. Theme Preview selects Themes in the header. The chat demo retains its
workspace header as a standalone example.

Run `node --test tests/library/navigation.test.mjs tests/library/browser.test.mjs`
to check route selection, mobile disclosures, focus handling, and reference navigation.
