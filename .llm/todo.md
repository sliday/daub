# Roadmap Nav Fix — Ship & Deploy

- [ ] Commit the roadmap.html nav fix
   - Stage `roadmap.html`, commit with message about fixing nav to match index.html.
- [ ] Push to remote
   - `git push origin main`
- [ ] Update version references for v3.0.1 patch release
   - Bump version badge in README.md (3.0.0 → 3.0.1).
   - Update "Latest" line in README.md.
   - Update `?v=` cache-busters in roadmap.html if present.
   - Update `dateModified` in index.html JSON-LD if present.
- [ ] Commit version bump and push
   - Single commit with README + any version-touched files.
- [ ] Create GitHub release v3.0.1
   - `git tag v3.0.1 && git push origin v3.0.1`
   - `gh release create v3.0.1 --title "v3.0.1 — Roadmap nav fix" --notes "..."`
- [ ] Deploy to Cloudflare Pages via wrangler
   - `wrangler pages deploy . --project-name=daub`
- [ ] Verify deployment
   - Open https://daub.dev/roadmap and confirm nav matches index.html.
