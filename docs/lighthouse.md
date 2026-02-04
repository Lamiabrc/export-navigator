# Lighthouse checks

1) Open Chrome DevTools → Lighthouse
2) Mode: **Mobile** + **SEO** + **Performance**
3) URL: `https://exportfrancefacile.com/`
4) Run and note:
   - SEO (target > 90)
   - LCP/CLS
   - Total blocking time

Notes:
- `robots.txt` and `sitemap.xml` are updated to the production domain.
- `X-Robots-Tag` is **index, follow** on production and **noindex** on preview.
- Hero video is lazy-loaded with poster + webm/mp4 sources.
- Logo uses lightweight SVG.
