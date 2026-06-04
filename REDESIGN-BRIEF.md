# TrueDrafts — Redesign Brief & Page/Flow Outline

> A structural map of the product for planning a redesign. Covers: what TrueDrafts is, the
> sitemap, user roles, key flows, a page-by-page content breakdown, global chrome, and the
> current design system. Last mapped from source on 2026-06-03.

---

## 1. What TrueDrafts is

A two-sided marketplace where **students admitted to colleges ("Writers")** sell their real
college **application materials** — full applications (Common App essay + supplemental essays +
proof of admission) and standalone essays — to **buyers ("Readers")** who want authentic
reference material. Writers keep **50%** of each sale; the platform keeps 50%.

- **Payments:** Razorpay (INR). Buyers pay via Razorpay checkout; access is granted on capture.
- **Payouts:** manual. Writers save a payout method (UPI / bank account / Zelle); admins process
  withdrawals by hand. Minimum payout ₹1,000.
- **Refunds:** generally none for customers; admins can issue rare refunds.
- **Curation:** every submission is human-reviewed by admins before going live.
- **Bundles:** curated multi-application packages sold at a discount.
- **AI:** AI-generated "insight" summaries/previews on locked applications; AI-assisted ("vibe")
  search.

### Two overlapping content concepts (important for redesign)
- **Applications** (`/applications`) — the newer, primary unit: a full application with a Common
  App essay + N supplementals + admission proof. This is what the home page, listings, and writer
  upload wizard center on.
- **Essays** (`/essays/[slug]`, `/university/[slug]`) — an older, standalone-essay unit. Admin
  even labels its queue "Old Essays." Both still exist in the UI and share card styling. **A
  redesign should decide whether to unify these or clearly separate them.**

---

## 2. User roles

| Role | Default? | Where they live | Becomes one by |
|------|----------|-----------------|----------------|
| **reader** | yes (new signups & Google OAuth) | `/dashboard` (My Library) | default |
| **writer** | no | `/writer` dashboard | choosing "writer" at signup, or the writer-onboarding flow auto-upgrades |
| **admin** | no | `/admin` dashboard | assigned by another admin |

Navbar dashboard link + settings link are role-aware (reader → "My Library", writer →
"Dashboard", admin → "Admin").

---

## 3. Sitemap (all routes)

### Public / Marketing — layout: Navbar + Footer
- `/` — Home / landing
- `/applications` — Applications listing (search + filters + pagination)
- `/applications/[slug]` — Single application (paywalled)
- `/bundles` — Bundles listing
- `/bundles/[slug]` — Single bundle (paywalled)
- `/essays/[slug]` — Single essay (paywalled, legacy unit)
- `/university/[slug]` — University page (its essays)
- `/writers/[username]` — Writer public profile
- `/how-it-works` — Explainer
- `/privacy`, `/terms` — Legal

### Auth — layout: centered card on light-blue, doodle background
- `/login`
- `/signup` — 2-step: role select → account details
- `/signup/writer` — 3-step writer onboarding wizard
- `/reset-password`

### Reader dashboard — layout: Navbar + centered container
- `/dashboard` — My Library (purchased items)
- `/dashboard/bookmarks` — Saved items
- `/dashboard/settings` — Profile + logout

### Writer dashboard — layout: left sidebar nav
- `/writer` — Overview (stats + recent apps)
- `/writer/essays` — My Applications (+ in-progress drafts)
- `/writer/essays/new` — Upload Application wizard (4 steps)
- `/writer/essays/[id]/edit` — Edit a single essay
- `/writer/essays/submitted` — Post-submit success
- `/writer/library` — Apps this writer bought from others
- `/writer/buyers` — Who bought my apps
- `/writer/payout` — Earnings + payout methods + history
- `/writer/settings` — Profile, activities, referral, logout

### Admin dashboard — layout: left sidebar nav
- `/admin` — Overview metrics
- `/admin/applications` — Application moderation queue
- `/admin/essays` — "Old Essays" moderation queue
- `/admin/users` — User & role management
- `/admin/revenue` — GMV, top earners, recent purchases
- `/admin/payouts` — Process payout requests
- `/admin/disputes` — Issue refunds
- `/admin/bundles` — Bundle list
- `/admin/bundles/new` — Create bundle
- `/admin/bundles/[id]` — Edit bundle

### Disabled (hidden, code preserved behind a flag)
- `/studio`, `/studio/[appId]`, `/studio/[appId]/[essayId]` — "Writing Studio" (404s while off)

---

## 4. Key user flows

**Buyer purchase**
Home / listing → Application or Essay detail → preview (locked) → Unlock (Razorpay checkout) →
`?purchased=true` success banner → full content + watermark → appears in `/dashboard` library.

**Reader signup**
`/signup` → pick "Read & discover" → name/email/password (or Google) → `/dashboard`.

**Writer signup + first upload**
`/signup` → pick "Share my essays & earn" → account → `/signup/writer` onboarding (profile →
universities admitted + years → done) → "Upload My First Essay" → `/writer/essays/new` 4-step
wizard (setup → Common App essay → supplementals → review & submit) → `/writer/essays/submitted`
→ admin reviews (24–48h) → approved → live for sale.

**Writer payout**
Earnings accrue automatically on each sale → `/writer/payout` → "Request Payout" (needs a default
payout method; modal prompts if none) → payout row `pending` → admin marks
`processing/paid/failed` in `/admin/payouts` → balance moves accordingly.

**Admin moderation**
`/admin/applications` (or essays) → expand submission → review essays/proof → Approve (set price)
or Reject (reason) → goes live or returns to writer.

---

## 5. Page-by-page content breakdown

### PUBLIC / MARKETING

**Home `/`**
1. Hero — animated mesh-gradient blobs + low-opacity doodles; badge "500+ essays from verified
   admits"; serif H1 "Real essays. Real admits. Real insight."; sub "Browse successful college
   essays… or share yours to earn."; CTAs **Explore Applications →** (`/applications`), **Share
   Your Essays** (`/signup/writer`); stat line "2,500+ Essays · 30+ Universities · 50% Writers
   Keep".
2. University logo gallery — two infinite marquee rows (27 logos), grayscale→color on hover, click
   filters applications by school.
3. Bento "How It Works" — sketch-style 4-card grid (Browse / Unlock & Read / By the Numbers /
   Connect with Writers) with scroll-reveal.
4. Essay teaser — split layout; locked sample essay card with blur + shimmer "Unlock Full Essay —
   $8"; 3 trust checkmarks.
5. Writer CTA band (blue) — "Got into your dream school? Earn from it." → **Start Earning →**.
6. Contact — Email / Instagram / LinkedIn cards.
7. Floating social-proof toast (bottom-left, rotating "Someone just unlocked…").

**Applications listing `/applications`**
- Header w/ optional university breadcrumb + clear-filter; search bar (`EssaySearch`, vibe-aware);
  bundle hero strip; **left filter sidebar** (sort: popular/trending/newest/top-rated/price/relevance;
  university multi-select; admitted year) + **3-col card grid** (`ApplicationCard`, 18/page) +
  pagination. Empty: "No applications found."

**Application detail `/applications/[slug]`**
- Back link; green purchase-success banner (`?purchased=true`); 2-col:
  - **Left sticky:** header card (logo, name, "Class of [year]", views/purchases, essay count,
    tags, bundle membership); writer card (anonymous until purchased, then name/bio/email + verified
    badge); price + `ApplicationPaywall` unlock.
  - **Right:** AI insight preview (locked state); essay blocks — Common App essay (prompt + body),
    then supplementals. Locked = ~20% visible w/ fade; purchased = full text + diagonal email
    watermark.

**Bundles listing `/bundles`** — header (Package icon, "Bundle deals"); 3-col `BundleCard` grid
(member count, struck original price vs bundle price, savings %, expiry). Empty: "No active bundles."

**Bundle detail `/bundles/[slug]`** — back link; success banner; 2-col: left sticky bundle card
(gradient, pricing breakdown, `BundleCheckoutButton`, overlap/owned states); right member list
(each app w/ logo, struck price, AI summary, links to detail) + "Buying a bundle" terms box.

**Essay detail `/essays/[slug]`** (legacy unit) — back link; header (logo, type badge, title,
views/purchases/rating/word-count, bookmark); writer card; content (locked → `PaywallOverlay`;
purchased → full + watermark); rating widget when purchased.

**University `/university/[slug]`** — hero (logo, name, essay count); filters; 3-col `EssayCard`
grid (30); empty CTA to `/applications`.

**Writer profile `/writers/[username]`** — header (avatar, name + verified badge, bio,
essay/purchase counts, admitted-school pills); "Essays by [name]" grid.

**How It Works `/how-it-works`** — hero; "For Students Applying" (3 steps) → Browse Applications;
"For Admitted Students" (3 steps) → Start Earning; "Why TrueDrafts?" (4 trust cards). ⚠️ Stale copy:
mentions **"Powered by Polar"** and **"$10"** threshold (now Razorpay/INR).

**Privacy `/privacy`, Terms `/terms`** — gradient header + numbered legal sections (India
governing law, Razorpay, AI processing, academic-integrity clause, 50% writer share, etc.).

### AUTH (centered card, doodle background, logo top-left, legal footer)

**Login `/login`** — top accent bar; "Welcome back"; **Continue with Google**; divider; email +
password (show/hide toggle); "Forgot password?" (⚠️ links to `#`, incomplete); **Sign in**; link to
signup. Redirects to `?redirect` (default `/dashboard`).

**Signup `/signup`** — Step 1: role select (Reader card / Writer card). Step 2: role badge +
Google + name/email/password (with 4-bar strength meter) + terms/privacy note + **Create account**.
Writer → `/signup/writer`, reader → `/dashboard`.

**Writer onboarding `/signup/writer`** (OnboardingWizard, 3 steps + progress bar) — (1) profile:
username (`truedrafts.com/writers/…`) + bio (300 chars); (2) "Where did you get in?" multi-select
universities + per-school admission year; (3) success → **Upload My First Essay** / **Go to
Dashboard**.

**Reset password `/reset-password`** — new + confirm password; success auto-redirects to login.

### READER DASHBOARD

**My Library `/dashboard`** — "My Library" + "Welcome back, [name] · N unlocked"; list of purchased
applications (logo, title, essay-count badge, university + class year, writer name/email, "Unlocked"
green badge + timeAgo; whole card → detail). Empty: BookOpen + "No purchases yet" → Browse.

**Bookmarks `/dashboard/bookmarks`** — "N saved"; 3-col `EssayCard` grid. Empty → Browse.

**Settings `/dashboard/settings`** — Profile card (editable display name; email disabled) + Account
card (Log out).

### WRITER DASHBOARD (sidebar: Overview, My Applications, My Library, Buyers, Payout, Settings; CTA "Upload Application")

**Overview `/writer`** — "Welcome back, [name]"; 4 stat cards (Total Earned, Available [+Request
Payout link], Applications, Total Sales); quick actions (Upload Application / View Buyers); Recent
Applications (5, with status badges Pending/Live/Rejected/Archived).

**My Applications `/writer/essays`** — "In Progress" drafts (progress bar + step label + Continue /
delete); submitted list (status badge, meta, rejection reason if rejected, views/sales if live).

**Upload Application `/writer/essays/new`** (4-step wizard, autosaves drafts) — (1) Setup: university,
year, Common App yes/no, # supplementals (slider 1–10), admission proof upload; (2) Common App essay:
prompt dropdown (7 prompts) + textarea (700-word counter) + screenshot; (3) Supplementals: per-essay
prompt + body w/ counters; (4) Review summary + 6-point integrity disclaimer checkbox → **Submit for
Review**.

**Edit Essay `/writer/essays/[id]/edit`** — single-page form: title, university, type, price (USD ⚠️,
shows "You keep 50%"), admitted year, content (25% preview note).

**Submitted `/writer/essays/submitted`** — success icon + "Application received!" + "what happens
next" (review 24–48h) + View My Applications / Submit Another.

**My Library `/writer/library`** — apps this writer bought from others (same card style as reader
library).

**Buyers `/writer/buyers`** — list of buyers (name, email, essay/university, +payout amount, date,
Contact mailto). Empty: "No buyers yet."

**Payout `/writer/payout`** — 3 stat chips (Total Earned / Balance / Pending); **Request Payout**
button (min ₹1,000; opens method modal if no default); **Payout methods** section (`#payout-methods`:
add/edit/delete UPI/bank/Zelle, set default, masked details); Recent Sales; Payout History (status
badges pending/processing/paid/failed).

**Settings `/writer/settings`** — Writer Profile (name, bio 300, country, email disabled);
Universities Admitted To (list w/ status); Activities (up to 10, 100-word each); Referral Link (copy,
"5% bonus"); Account (Log out).

### ADMIN DASHBOARD (sidebar: Overview, Applications, Bundles, Old Essays, Users, Revenue, Payouts, Disputes)

**Overview `/admin`** — 4 stat cards (GMV, Total Purchases, Total Users, Live Essays); Pending Review
list + Recent Purchases list.

**Applications `/admin/applications`** — status tabs (pending/approved/rejected/all); collapsible
cards; expand → edit title/year/tags + essays + proof; Approve (set price modal) / Reject (reason);
for approved: edit price / delete.

**Old Essays `/admin/essays`** — status tabs; essay cards w/ preview; Approve / Reject (reason).

**Users `/admin/users`** — role tabs; table (avatar, name+verified, email, role badge, joined,
role-change buttons).

**Revenue `/admin/revenue`** — 3 stats (Total GMV, Platform Revenue 50%, Total Purchases); Top
Earning Writers (top 10); Recent Purchases (30).

**Payouts `/admin/payouts`** — 3 stats (Awaiting Action, In-Flight, Total Paid Out); Payout Requests
list w/ status-transition buttons (Mark Processing/Paid/Failed); Writer Earnings summary list.

**Disputes `/admin/disputes`** — table of completed purchases (essay, buyer, amount, status) +
Refund button (confirm → refunds, debits writer earnings).

**Bundles `/admin/bundles`** + **new/[id]** — list (status + kind + pricing); create/edit form
(`BundleAdminForm`): identity, static app-picker OR rule builder, % discount or flat price, optional
schedule, **live preview** panel (resolved members, pricing, savings), Save & Publish / Save draft /
Archive.

---

## 6. Global chrome

**Root layout** — fonts: **Inter** (`--font-sans`, body), **Playfair Display** (`--font-serif`,
headings), **Architects Daughter** (`--font-hand`, decorative/sidebar labels). Title template
"%s | TrueDrafts".

**Navbar** (sticky, white/blur, `border-b`) — logo `td_text_logo.png`; logged-out links: Browse
Applications, How It Works, Contact Us + **Log in** / **Start Earning**; logged-in: role-based
dashboard button + avatar dropdown (name/email, Settings, Sign out w/ confirm modal). (Writing
Studio link is currently removed/disabled.)

**Footer** — Brand (logo + "Real essays. Real admits. Real insight."); Platform (Browse
Applications, How It Works, Sell Your Essays); Legal (Privacy, Terms); © line.

---

## 7. Current design system (what a redesign would replace or evolve)

**Color**
- Primary brand blue **`#0851A0`** (buttons, links, active, icons), hover **`#063d85`**.
- Tints: **`#e8f1fa`** (badges/avatars), **`#f8faff`** / **`#f0f5ff`** (section/page backgrounds).
- Neutrals: gray-900 headings/body, gray-400/500 muted, gray-200 borders.
- Semantic: green (success/earnings), yellow (pending), red (reject/refund/error), orange (warnings/expiry).

**Type** — serif (Playfair) for hero/section headings, often with an italic blue emphasis phrase;
sans (Inter) for body/UI; hand font (Architects Daughter) for sidebar section headers & playful
labels; reader essay content set in serif w/ generous line-height.

**Shape & depth** — `rounded-full` (buttons, badges, search, avatars), `rounded-2xl` (cards/modals),
`rounded-xl` (small cards/icon tiles); `shadow-sm` base → `shadow-md` on hover; cards lift
(`hover:-translate-y-0.5`); focus ring `ring-2 ring-[#0851A0]`.

**Motion** — floating gradient blobs (`blob-float-1/2/3`), marquee logo rows, shimmer on unlock
buttons, scroll-reveal on bento cards, pulse dots.

**Signature visual quirks** — low-opacity hand-drawn doodles (grad cap, book, pencil, quill,
diploma, star) scattered on hero & auth pages; sketch-filter icons in the bento section;
frosted-glass `FilterSidebar` and `EssaySearch` (backdrop-blur, translucent white).

**UI primitives** (`components/ui/*`) — Button (default/destructive/outline/secondary/ghost/link),
Card (+sub-parts), Input, Textarea, Select, Tabs, Badge, Label, Progress, Separator.

**Recurring cards** — `EssayCard`, `ApplicationCard` (w/ AI-summary box), `BundleCard` (gradient),
`PaywallOverlay` / `ApplicationPaywall` (blur + sticky unlock bar).

**Overall feel** — clean, trustworthy navy academic base + playful hand-drawn/sketch accents;
restrained palette, premium micro-interactions.

---

## 8. Things to flag for the redesign

- **Currency inconsistency:** Razorpay/INR is the real system, but lots of copy still says USD —
  How It Works says **"Powered by Polar"** + **"$10"**, the essay edit form says **"price (USD)"**,
  home/teaser shows "$8 / $5–15". Unify to INR (or locale-aware) everywhere.
- **Essays vs Applications duality:** decide whether to merge the legacy "essay" unit into
  "applications" or present them as distinct products. Admin literally calls one queue "Old Essays."
- **Disabled Writing Studio:** hidden behind a flag; redesign can ignore or plan its return.
- **Incomplete bits:** login "Forgot password?" links to `#`; `EarningsCard` component is now unused
  (Payout page is the live surface).
- **Two dashboard shells** (reader = top nav + centered; writer/admin = left sidebar) — opportunity
  to unify the authenticated experience.
- **Mobile:** desktop nav collapses (`md:`) but there's no described mobile menu — worth designing.
