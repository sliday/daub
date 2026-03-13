#!/bin/bash
# Regenerate screenshots for all blocks fixed during QA review
# Run from: /Users/stas/Playground/daub
set -e

NODE="/opt/homebrew/bin/node"
TOOL="tools/block-screenshot.js"

echo "=== Regenerating screenshots for fixed blocks ==="

# Fixed in this session
echo "--- Navigation fixes ---"
$NODE $TOOL --id navbar-simple-01 --force
$NODE $TOOL --id navbar-with-search-01 --force
$NODE $TOOL --id tab-nav-01 --force

echo "--- Carousel → Grid conversions ---"
$NODE $TOOL --id testimonial-carousel-01 --force
$NODE $TOOL --id team-carousel-01 --force
$NODE $TOOL --id product-carousel-01 --force

echo "--- Tabs prop fix ---"
$NODE $TOOL --id feature-tabs-01 --force

echo "--- Footer copyright + content fixes ---"
$NODE $TOOL --id footer-minimal-01 --force
$NODE $TOOL --id footer-simple-01 --force
$NODE $TOOL --id footer-mega-01 --force
$NODE $TOOL --id footer-columns-01 --force
$NODE $TOOL --id footer-with-cta-01 --force
$NODE $TOOL --id content-video-embed-01 --force

echo "--- Missing screenshots (stats/dashboard) ---"
$NODE $TOOL --id stats-row-01 --force
$NODE $TOOL --id empty-state-01 --force

# Fixed in previous session
echo "--- Previous session fixes ---"
$NODE $TOOL --id newsletter-popup-01 --force
$NODE $TOOL --id gallery-grid-01 --force
$NODE $TOOL --id gallery-carousel-01 --force
$NODE $TOOL --id portfolio-carousel-01 --force
$NODE $TOOL --id schedule-tabs-01 --force

echo "--- Auth block fixes (data URI → native content) ---"
$NODE $TOOL --id social-login-01 --force
$NODE $TOOL --id login-page-illustration-01 --force
$NODE $TOOL --id login-split-image-01 --force
$NODE $TOOL --id login-split-geometric-01 --force
$NODE $TOOL --id login-split-carousel-01 --force
$NODE $TOOL --id login-split-mockup-01 --force
$NODE $TOOL --id login-split-mockup-quote-01 --force
$NODE $TOOL --id signup-split-app-mockup-01 --force
$NODE $TOOL --id signup-split-carousel-01 --force
$NODE $TOOL --id signup-split-gradient-01 --force
$NODE $TOOL --id signup-split-mockup-01 --force
$NODE $TOOL --id signup-split-mockup-quote-01 --force

echo "--- Hero + Modal + Misc fixes ---"
$NODE $TOOL --id hero-with-app-screenshot-01 --force
$NODE $TOOL --id command-palette-01 --force
$NODE $TOOL --id lightbox-01 --force
$NODE $TOOL --id modal-confirm-01 --force
$NODE $TOOL --id modal-dialog-01 --force
$NODE $TOOL --id divider-01 --force
$NODE $TOOL --id theme-toggle-01 --force
$NODE $TOOL --id language-switcher-01 --force

echo "=== Generating all missing CTA screenshots ==="
$NODE $TOOL --category cta

echo "=== Generating all missing error-pages screenshots ==="
$NODE $TOOL --category error-pages

echo "=== Done! ==="
echo "Check for any failures above."
