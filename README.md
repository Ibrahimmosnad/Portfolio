# Designwave — Ibrahim Mosnad

Portfolio website for **Designwave**, the independent design studio of Ibrahim Mosnad (UX designer): web design, UX/UI, brand identity, logo design and motion graphics. The current focus is web design.

It's a static site with plain HTML, CSS and JavaScript. There's no build step and nothing to install.

## Run it locally

Open `index.html` in a browser, or serve the folder (recommended, so page transitions and the case-study template behave exactly like production):

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Pages

| File | What it is |
| --- | --- |
| `index.html` | Home: hero with generative wave canvas, expanding showreel, intro, services marquee, selected work, services accordion, numbers, pinned horizontal process, clients, testimonials slider, CTA |
| `work.html` | All projects: filter chips (with counts), grid/list toggle, parallax cards |
| `project.html` | Case-study template, filled from `assets/js/projects.js` via `?p=slug` |
| `services.html` | Detailed services (sticky titles), process, engagement models, FAQ |
| `about.html` | Bio, portrait, principles, experience timeline, toolkit |
| `contact.html` | Big email link with copy button, enquiry form (service + budget chips) |
| `404.html` | Not-found page (GitHub Pages uses it automatically) |

## Motion & interaction

All of it lives in `assets/js/main.js`. It's vanilla JS with no libraries:

- **Preloader** with a counter on the first visit of a session
- **Page transitions**: a curtain wipes between pages and shows the destination name
- **Smooth wheel scrolling** on desktop (native scrolling on touch devices)
- **Custom cursor**: a blend-mode dot plus a trailing ring that grows into a "View / Play / Drag" label over `data-cursor` elements
- **Magnetic buttons**: add `data-magnetic="0.3"` (the strength) to any element
- **Text reveals**: `data-split="chars"` or `data-split="words"` slides text up letter by letter or word by word
- **Scroll reveals**: `data-reveal="up" | "fade" | "clip" | "stagger" | "line"`, with an optional delay via `style="--d:200ms"`
- **Scroll-scrubbed highlight**: `data-highlight` darkens words as you scroll
- **Parallax media**: add `data-parallax="0.1"` to any `.media` box
- **Velocity marquee**: speeds up while you scroll and reverses with the scroll direction
- **Floating hover preview** on the home work list
- **Pinned horizontal scroll** for the process section (it stacks vertically on mobile)
- **Showreel** that grows from a card to full-bleed as you scroll, plus a lightbox
- Accordions, draggable testimonial slider, animated counters, live local clock, work filters

### Service animations (homepage)

Each service in the homepage services accordion has its own 10-second looping animation, built as inline SVG:

| Service | What the animation shows |
| --- | --- |
| Web Design | A website builds itself on a layout grid, then a cursor clicks the CTA, scrolls and hovers over the project cards |
| UX / UI Design | A user flow maps out while a phone wireframe becomes the finished UI, gets redline specs, is tapped and ends on a confirmed order |
| Brand Identity | A brand board fills in with logo, colours, type, pattern, business cards, app icon and voice, then one colour token re-themes the whole system |
| Logo Design | A construction grid and circles draw in, the pen tool traces the mark, the guides fade and the wordmark tracks in |
| Motion Graphics | A mini editor: a shape follows a motion path and morphs at each keyframe, with onion skins, squash and stretch, a live speed graph, kinetic type, a running timecode and a playhead that lights up keyframes on the timeline |
| Art Direction & Graphic Design | A poster is laid out on a grid (colour picked, sun dragged into place), then the view zooms out to a three-poster print proof with crop marks and colour bars |

A scene only plays while its service is open and on screen. It restarts each time the service is reopened, pauses when it scrolls away, and shows a still, finished frame to visitors who prefer reduced motion. The styles and keyframes live in `assets/css/service-anims.css`. The playback controller is `initServiceAnims()` in `main.js`.

To use your own video or Lottie file for a service instead, replace the `<svg>` inside that service's `.svc-anim__stage` with a `<video autoplay muted loop playsinline>` (or your Lottie player).

All of this respects `prefers-reduced-motion`, and the site stays fully readable with JavaScript turned off.

## Replacing the placeholders

Every image, video and animation slot is a striped placeholder labelled with what belongs there:

```html
<div class="media" data-reveal="clip" data-parallax="0.1">
  <div class="ph ph--1" data-ph="Aurora — cover image"></div>
</div>
```

Swap the `.ph` element for your asset. Sizing, cropping, reveal and parallax keep working:

```html
<div class="media" data-reveal="clip" data-parallax="0.1">
  <img src="assets/img/aurora-cover.jpg" alt="Aurora website on a laptop">
</div>

<!-- or a looping video / motion graphic -->
<div class="media">
  <video src="assets/video/reel-loop.mp4" autoplay muted loop playsinline></video>
</div>
```

Change a box's shape with `style="--ratio: 16 / 9"`. Search the HTML for `REPLACE:` and `EDIT:` comments to find every slot.

**Icons.** The service, process, client and toolkit icons are simple geometric SVG placeholders (the `glyph` spans). Replace the inline `<svg>` with your own icon set. The logo mark is in the header of every page and in `assets/img/favicon.svg`.

## Things you must edit before publishing

1. **Email.** Replace `hello@yourdomain.com` everywhere (search and replace across the folder). The contact form's recipient is set in `SITE.email` at the top of `assets/js/main.js`.
2. **Time zone.** Set `SITE.timeZone` in `main.js` (for example `'Europe/Berlin'`) so the "Local time" clock shows your studio time.
3. **Projects are sample content.** The eight projects (Aurora, Kiln & Co., Pulse, …) are fictional placeholders, and so are their results figures. Replace them with your real work:
   - the case-study text and results live in `assets/js/projects.js`
   - the project cards live in `index.html` (work list and hover preview) and `work.html` (grid)
4. **Numbers, testimonials, clients and experience.** On the home page the stats, testimonials and client logos are placeholders. The timeline on `about.html` is too. Only publish real figures and real quotes, used with permission.
5. **Social links** point to the platform home pages. Replace them with your profile URLs.
6. **CV link** on `about.html` (`href="#"`).

## Contact form

The form validates input and then opens the visitor's email app with the enquiry pre-filled (`mailto:`). If you want submissions delivered without an email app, point the form at a form service such as Formspree, Basin or Netlify Forms. Set the form's `action` to the service's URL, then remove the `submit` handler in `initForm()` in `main.js`, or change it to `fetch()` the service.

## Deploy

It works as-is on GitHub Pages (Settings → Pages → deploy from branch), Netlify, Vercel or any static host.

## Customising the look

The design tokens (colours, fonts, type scale, easing, spacing) are CSS variables at the top of `assets/css/style.css`:

- `--accent`: the Designwave blue (`#3b4bff`)
- `--bg` / `--fg`: the paper and ink colours
- `--font-sans` / `--font-serif`: Inter Tight and Instrument Serif (from Google Fonts)
