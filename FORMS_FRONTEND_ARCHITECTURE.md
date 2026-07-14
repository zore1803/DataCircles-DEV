# Forms Frontend Architecture

Companion to `FORMS_ARCHITECTURE.md` / `FORMS_SCHEMA.md` / `FORMS_DOMAIN_MODEL.md` / `FORMS_IMPLEMENTATION.md` (backend) and `FORMS_SCHEMA_IMPLEMENTATION_NOTES.md`. This document covers the **frontend only** — the Forms List, Form Detail (Builder/Submissions/Duplicate Reviews/Settings tabs), and the per-module entry points on Companies/Contacts/Vendors.

**Grounding discipline**: every pattern named below (routing, table, drawer, badge, permission check, empty/loading state, API-call style) is a direct copy of an existing, named file in this codebase — not a new abstraction. Where the audit found the codebase itself to be inconsistent (Vendors vs. Companies/Contacts table implementations, no shared Drawer/Badge/EmptyState component), this document states which existing file is being copied and why, so the choice is traceable rather than invented. Nothing in this document introduces a new shared component, a new state-management library, or a new API-client pattern. Five decisions were made explicitly before this document was written; they are stated verbatim in §0 and referenced throughout rather than re-justified per section.

---

## 0. Decisions already made (input to this document, not derived here)

1. **No new shared components.** Drawer and Badge are each a straightforward copy of an existing pattern — not a generalized extraction.
2. **Forms List is a table** (TanStack, matching `Companies.jsx`), not a card grid.
3. **Navigation is form-as-container**: Forms List → click a form → one full page with four tabs (Builder / Submissions / Duplicate Reviews / Settings) — not five sibling top-level pages. *(An Overview tab was added afterward, as a fifth tab and the default landing view — see §3.2. It doesn't contradict this decision: it's still one page, still form-as-container, just with a dashboard-style landing tab in front of Builder rather than dropping straight into it.)*
4. **Per-module "Forms" button** on Companies/Contacts/Vendors is v1-simple: navigates to Forms List with the module filter pre-set. No dropdown of actual form names, no extra data-fetch on those pages.
5. **Everything else matches the audit exactly**: routing via the `settingsItems` array, inline API calls via the shared `API` instance, local `useState` for record data, manual per-page permission checks, Companies-style empty/loading states.

---

## 1. Routing

### 1.1 Forms List — inside Settings, via `settingsItems` (per decision 5 / audit §1, §12)

Exactly the existing convention: one new entry in `Settings.jsx`'s `settingsItems` array —

```js
{
  id: "forms",
  icon: <FileText className="w-5 h-5" />,   // lucide-react, matching the existing icon convention
  label: "Forms",
  description: "Build lead-capture forms and review submissions",
  color: "text-emerald-600",
  bgColor: "bg-emerald-50",
  borderColor: "border-emerald-200",
  hoverBg: "hover:bg-emerald-50",
  component: <FormsList />,
  category: "Customization",   // alongside Company/Contact/Deal/Vendor Fields, Kanban Settings
},
```

This renders at `/settings/forms`, inside `Settings.jsx`'s existing `activeSection` shell (header, back-to-Settings link, breadcrumb) — identical to how `/settings/company-fields` renders `<CompanyFieldSettings />` today. **No new route is added for the list.** `FormsList.jsx` lives at `frontend/src/components/settings/FormsList.jsx`, next to `CompanyFieldSettings.jsx` / `VendorFieldSettings.jsx` (audit §12: flat, no per-module subfolder inside `settings/`).

### 1.2 Form Detail — a new top-level route, mirroring `/companies/:id` exactly

**This is the one place this document deviates from "routing via `settingsItems`, no changes"**, and it is a deviation forced by a structural fact discovered during the audit, not a new invention: `/settings/:section?` is a single flat parameter — it has no second level for an individually-addressable record. Clicking a company, by contrast, already navigates to a **separate, top-level route**:

```js
// frontend/src/App.jsx (existing, verbatim)
<Route path="/companies/:id" element={<PrivateRoute><CompanyProfilePage /></PrivateRoute>} />
```

`CompanyProfilePage.jsx` reads `const { id } = useParams()`, keeps `const [activeTab, setActiveTab] = useState("Notes")`, and a `tabsRight = ["Notes","Tasks","Meetings","Folder","Calendar"]` array driving conditional render blocks (`{activeTab === "Notes" && <NoteSection/>}` etc.). This is **exactly** the "form-as-container, one page, four tabs" shape decision 3 describes. Forms Detail copies this file's structure verbatim:

```js
// New route in App.jsx, placed next to the /companies/:id and /deals/:dealId entries
<Route path="/forms/:id" element={<PrivateRoute><FormDetailPage /></PrivateRoute>} />
```

`FormDetailPage.jsx` lives at `frontend/src/pages/FormDetailPage.jsx` (top-level `pages/`, matching `CompanyProfilePage.jsx`'s location — not inside `components/settings/`, since it is no longer a Settings sub-page once you're viewing one specific form). It is reached by `navigate(`/forms/${form._id}`)` from a `FormsList.jsx` row click — same as `Companies.jsx` navigating to `/companies/${company._id}`.

`tabs = ["Overview", "Builder", "Submissions", "Duplicate Reviews", "Settings"]`, `const [activeTab, setActiveTab] = useState("Overview")`, conditional blocks per tab, same as `CompanyProfilePage`.

### 1.3 Full route/render map

```
/settings/forms                    Settings.jsx shell → FormsList.jsx (table)
/forms/:id                         FormDetailPage.jsx (own page, own header — NOT the Settings shell)
  activeTab === "Overview"         → OverviewTab (default landing tab — see §3.2)
  activeTab === "Builder"          → BuilderTab (placeholder shell first, real builder last — see §11)
  activeTab === "Submissions"      → SubmissionsTab
  activeTab === "Duplicate Reviews"→ DuplicateReviewsTab
  activeTab === "Settings"         → FormSettingsTab (title/module/duplicate-strategy/theme config — form-level, not app Settings)
```

Note the name collision risk: the fourth tab is called "Settings" (a Forms concept — publish state, duplicate strategy, notification config) and is unrelated to the app's `Settings.jsx`/`settingsItems` (a completely different concept, just an unfortunate shared word). Keep the component named `FormSettingsTab`, not `SettingsTab`, to avoid confusion in the codebase.

---

## 2. Forms List (`frontend/src/components/settings/FormsList.jsx`)

### 2.1 Table — copies `Companies.jsx`'s `useReactTable` usage exactly (decision 2)

Per audit §3: Companies and Contacts use `@tanstack/react-table` directly in-page; Vendors does not (plain `<table>`). Decision 2 explicitly picks the Companies/Contacts pattern. `FormsList.jsx` therefore imports `useReactTable`, `getCoreRowModel`, etc. the same way `Companies.jsx` does, defines its own `columns` array in-file (no shared column-def module exists to import from — there isn't one), and renders its own `<table>` — same as every other module. No new abstraction, no attempt to unify Vendors' pattern with this one; that inconsistency is pre-existing and out of scope here.

### 2.2 Columns (decision 2, verbatim)

| Column | Source | Notes |
|---|---|---|
| Title | `form.title` | Clicking the row (or an explicit link within it) navigates to `/forms/${form._id}` |
| Module | `form.module` | Contact / Company / Vendor — plain text or a small pill, **not** the Badge pattern. Reasoning, stated explicitly rather than left implicit: Module is a fixed classification set once at creation and never transitions (§2.7 — it's immutable after creation); Status is a real state machine (`draft→published→paused→archived`) with actual transitions. The Badge pattern (§6) exists to communicate state that *changes*; using it for a value that never changes would misrepresent Module as more dynamic than it is. |
| Status | `form.status` | `draft` / `published` / `paused` / `archived` — **this is a genuine status enum, use the copied Badge pattern** (§6) |
| Submissions | computed count | `GET /api/forms` does not return this today (Phase 1b's `listForms` returns only `FormDefinition` fields — confirmed by reading `formController.js`). Two options: (a) add `submissionCount` to the existing `listForms` response — a small backend addition, or (b) fetch it client-side per row (N+1, avoid). **Recommend (a)** — flag as a small, additive backend follow-up before building this column, not a redesign. |
| Updated | `form.updatedAt` | Same relative-time formatting convention already used elsewhere (check `Companies.jsx` / `Contacts.jsx`'s existing date-format helper, reuse it, don't invent a new one) |
| Actions | — | Minimal v1: "Open" (navigates to `/forms/${form._id}`). Do not build Duplicate/Archive/Delete row actions yet — `formController` doesn't expose duplicate, and archive/delete are already-identified v1-deferred items per the earlier Phase 1b scoping (`FORMS_ARCHITECTURE.md` §2.9 audit) |

### 2.3 Pagination, filtering, sorting

Matches `Companies.jsx`'s own hand-rolled `page`/`limit` `useState`, not a shared pagination component (none exists — audit §3). `GET /api/forms` already supports `page`, `limit`, `status`, `module`, `search` query params (confirmed in `formController.listForms`) — the frontend passes these directly, no new backend work needed here. The **module pre-filter from the per-module "Forms" button** (§4) is implemented as: `navigate('/settings/forms?module=Contact')`, and `FormsList.jsx` reads `useSearchParams()` / the query string once on mount to seed its `module` filter state — same idea as `Companies.jsx` reading `useLocation()` for pre-set filters coming from elsewhere in the app (confirmed present in `Companies.jsx`'s imports: `useLocation` is already imported there for a similar reason).

### 2.4 Empty / loading state — copies `Companies.jsx`'s ternary exactly (decision 5)

```jsx
{loading && forms.length === 0 ? (
  <tr><td colSpan={...}><p>Loading forms...</p></td></tr>
) : forms.length === 0 ? (
  <tr><td colSpan={...}><p className="font-medium">No forms found</p></td></tr>
) : (
  table.getRowModel().rows.map(...)
)}
```
No shared `<EmptyState>` — none exists (audit §8). Loading/empty copy text is written per-page, same as every other module.

### 2.5 API calls

Direct `API.get('/forms', { params: {...} })` inline in `FormsList.jsx`, via the shared `frontend/src/services/api.js` instance — same as `Contacts.jsx` calling `API.get("/auth/me")` inline. No `formsApi.js` service-layer file is introduced (the audit found Companies/Contacts/Vendors don't have one either — only Billing has `subscriptionApi.js`/`couponApi.js`; that pattern is Billing-specific, not the general convention).

### 2.6 Permission gating

Copies `Contacts.jsx`'s exact per-page pattern (audit §11), with resource name `"forms"` (already registered — see `FORMS_IMPLEMENTATION.md`'s Billing-integration entry, and `frontend/src/pages/UserManagement.jsx`'s `resources` array already includes `"Forms"`):

```jsx
const [permission, setPermission] = useState("");
useEffect(() => {
  const fetchPermission = async () => {
    const res = await API.get("/auth/me");
    const p = res.data.user?.permissions?.find(p => p.name.toLowerCase() === "forms");
    setPermission(p?.permission || "no");
  };
  fetchPermission();
}, []);
// later: {permission !== "readonly" ? <CreateFormButton/> : null}
```
Copy-pasted verbatim per the audit's own finding that this is already copy-pasted per page — not centralized into a hook here, per decision 1 (no new shared abstractions this pass).

### 2.7 "Create Form" entry point

A button on `FormsList.jsx` (gated `permission !== "readonly"`, same as above) opens... what? `formController.createForm` requires only `{title, module}`. This needs a minimal name/module picker — **not a full wizard**. Recommend a small inline form or the existing modal CSS pattern (§8, `ExportModal.jsx`'s centered-overlay shape) with two fields (title text input, module select) and a Create button that calls `POST /api/forms`, then navigates straight to `/forms/${newForm._id}` (landing on the new Overview tab, §3.2). This is the **smallest possible on-ramp into the form** — no separate "wizard" page needed.

**Module is a one-time, permanent choice.** §3.3 confirms `module` is immutable after creation (routing/`targetModule` derivation and `schemaHash` all key off it — see `FORMS_SCHEMA.md`). The modal's module selector must say so plainly next to the field — e.g. "Module can't be changed after creating this form" — so a user doesn't build out a Contact form expecting to switch it to Company later and hit a wall. Cheap to add now, avoids a support question later.

---

## 3. Form Detail Page (`frontend/src/pages/FormDetailPage.jsx`)

### 3.1 Structure — copies `CompanyProfilePage.jsx`

```jsx
const { id } = useParams();
const [form, setForm] = useState(null);
const [activeVersion, setActiveVersion] = useState(null);
const [loading, setLoading] = useState(true);
const [activeTab, setActiveTab] = useState("Overview"); // Overview is the landing tab, §3.2

useEffect(() => {
  API.get(`/forms/${id}`).then(res => {
    setForm(res.data.form);
    setActiveVersion(res.data.activeVersion);
  });
}, [id]);
```

`GET /api/forms/:id` already returns exactly `{form, activeVersion}` (confirmed in `formController.getForm`) — this maps directly, no reshaping needed.

Header: form title, status badge (§6), a "Back to Forms" link (→ `/settings/forms`, same idea as `CompanyProfilePage`'s own back-navigation), and the tab bar. Loading state: copy `CompanyProfilePage`'s own loading-message-array pattern (a fun rotating message + spinner) — it already exists in that exact file, verbatim reusable style (not verbatim reusable *code*, since no shared loading component exists — each page keeps its own `loadingMessages` array, per audit §8).

### 3.2 Tab: Overview (`OverviewTab`) — default landing tab

Added after the initial draft of this document, for a concrete reason: without it, clicking into a form drops the user straight into either a placeholder Builder or a half-built tab, with no orientation on what's actually going on with this form. Overview answers "what's the state of this form" before asking the user to do anything — and it's cheap, because it's almost entirely data the other tabs already fetch, just given a home.

**Contents**: status + version (from `activeVersion.versionNumber`, already returned by `GET /api/forms/:id` per §3.1 — no new fetch), public URL with copy button (from `form.publishState.publicSlug`, same data source), submission count and pending-review count (same two numbers flagged as backend additions in §9 — `submissionCount` on the list endpoint and the org-wide `/api/duplicate-reviews` count filtered to this form — this tab is the second consumer of both, not a new requirement), and four quick-action buttons: **Continue Editing** (→ Builder tab), **View Submissions** (→ Submissions tab), **Review Duplicates** (→ Duplicate Reviews tab, only shown/enabled if the pending count is non-zero), **Open Public Form** (opens `publicSlug`'s public URL in a new tab, only shown once published).

No new backend endpoint beyond what §9 already flags — this tab reuses `GET /api/forms/:id`'s existing response plus the same two additive counts the List table (§2.2) and Duplicate Reviews tab (§3.6) already need. Quick actions are just `setActiveTab(...)` calls within the same `FormDetailPage` — no navigation, no new route.

`activeTab` defaults to `"Overview"`, not `"Builder"` (§3.1) — this is the landing tab for every visit to `/forms/:id`, including immediately after creation (§2.7).

### 3.3 Tab: Settings (`FormSettingsTab`)

The one tab not explicitly scoped by the five decisions — smallest reasonable v1 given what `formController` actually exposes: edit `title` (calls `PATCH /api/forms/:id` with `{title}`), view `module` (read-only — module is not editable after creation, since layout/targetModule derivation and `schemaHash` all key off it per `FORMS_SCHEMA.md`), show `status` + `publishState.publicSlug` (with a copy-link button once published — also surfaced on Overview, §3.2, so this is a secondary/detail view of the same fact, not a competing source), and a **Publish** button calling `POST /api/forms/:id/publish`. `duplicateStrategy` editing is **not exposed by any Phase 1b endpoint today** — but note it does **not** block the Duplicate Reviews tab: `FormDefinition.publishState.duplicateStrategy` already defaults to `"review_queue"` in the schema itself (`FormDefinition.js`), and `formController.createForm` doesn't override `publishState` at all, so every form created via this UI is review-enabled from creation, with no code change needed. What's still missing is only the ability to later *switch* a form to `"allow_duplicates"` (`formController.updateForm` only passes `{layout, theme, title}` through to `saveDraft`, which itself only touches those three fields). **Flag, don't invent**: defer duplicate-strategy *editing* to a later backend addition — the default already makes the Duplicate Reviews tab reachable without it.

### 3.4 Tab: Builder (placeholder first, real build last — per your build order)

Initial placeholder: render `form.layout` read-only (or an explicit "Builder coming soon" message) so the tab exists and is navigable, without pretending it does more than it does. The real drag-and-drop builder is explicitly the last, largest piece of the build order you specified — this document does not design its internals yet (no FieldsPanel/Canvas/PropertiesPanel component shapes here), since that's future work, not something to invent ahead of need.

### 3.5 Tab: Submissions (`SubmissionsTab`)

Table, same TanStack convention as `FormsList.jsx` / `Companies.jsx`. Calls `GET /api/forms/:id/submissions` (confirmed shape: `{submissions, pagination}`, `rawData`/`processedData` already excluded from the list view by the backend itself — no frontend filtering needed to hide them). Columns: Submitted (relative time from `submittedAt`), Review Status, Import Status, Actions (Open → opens the **Submission Details Drawer**, §5). Filters: `reviewStatus`/`importStatus`/`processingStatus` query params, already supported server-side — render as simple `<select>` filters, not a generalized filter-bar component (none exists, audit §3).

Empty/loading states: copy §2.4's exact pattern again.

### 3.6 Tab: Duplicate Reviews (`DuplicateReviewsTab`)

Table again. Calls `GET /api/duplicate-reviews?module=&decision=` — **note this is an org-wide endpoint, not form-scoped** (confirmed: `formController.listDuplicateReviews` queries by `organization`, not by `formDefinition`/`formSubmission`). Two ways to show only *this* form's reviews inside this tab:
- (a) client-side filter after fetching (fetch all pending org-wide reviews, filter in the browser by whether `review.formSubmission` belongs to this form) — wasteful and wrong once other forms have their own pending reviews, or
- (b) add a `formId` query param to `GET /api/duplicate-reviews` server-side (small, additive backend change — the review already denormalizes `organization`; adding a `formSubmission`-based join filter is a one-line addition to `formController.listDuplicateReviews`'s query object, no schema change).

**Recommend (b)**, flagged as a small necessary backend addition before this tab is built — not a redesign, and directly parallel to the `submissionCount` flag in §2.2. Columns: Contact/Company name (from `existingRecord`/`incomingData` — needs a bit of shaping, since the raw API returns `matchDetails`/`score` rather than display-ready names; keep this shaping in the component, don't invent a new backend endpoint just to reformat it), Match confidence (derived label — **never render the raw `score` number**, per the general Review Center principle already established during the Phase 1b API design discussion), Actions (Keep Separate / Keep Existing buttons calling `POST /api/duplicate-reviews/:id/keep-separate` and `/link` directly).

No dedicated review-detail drawer is specified by the five decisions — inline row actions are enough for v1 (a full "Submission Review" comparison-card screen, as sketched in the earlier UX discussion, is bigger than what's been scoped now; flag it as a richer v2 if the inline buttons prove too cramped once built).

---

## 4. Per-module "Forms" button (Companies / Contacts / Vendors)

Decision 4, v1-simple: a button (near the existing page-level action buttons — e.g. next to "Import"/"Export" in `Companies.jsx`) that does:

```jsx
<button onClick={() => navigate('/settings/forms?module=Company')}>Forms</button>
```

No dropdown, no per-page data-fetch of the org's actual Company-module forms — `FormsList.jsx` opens already-filtered via the query param (§2.3). This is a **one-line addition** to each of `Companies.jsx` / `Contacts.jsx` / `Vendors.jsx` — no new component. **Flag for later, not now** (per your instruction): once `FormsList.jsx` exists, showing an actual dropdown of the 1-3 forms for that module (skipping the list page entirely when there's exactly one) is trivial to add as a v1.1 — but building the dropdown now would mean querying `GET /api/forms?module=X` from three unrelated pages before the list page itself is proven out, which is the wrong build order.

---

## 5. Submission Details Drawer — copies `CompanyQuickView.jsx` exactly (decision 1)

`frontend/src/components/forms/SubmissionDetailsDrawer.jsx` (new subfolder `components/forms/`, matching the `components/company/`, `components/contact/`, `components/vendor/`, `components/deal/` per-module convention already established).

Copied verbatim from `CompanyQuickView.jsx`:
- **CSS**: `fixed top-0 right-0 h-full w-full lg:w-[45vw] xl:w-[40vw] 2xl:w-[35vw]`, `translate-x-0`/`translate-x-full` toggle, plus the `fixed inset-0 bg-black/30 lg:hidden` mobile backdrop.
- **Prop shape**: `{ submissionId, onClose }` — controlled by `submissionId` being non-null (not a boolean `isOpen`), exactly like `companyId` in `CompanyQuickView`.
- **Tabs inside the drawer**: per the earlier UX discussion (Submission Details: Submission / Timeline / Raw Payload / Logs) — same `tabs` array + `activeTab` `useState` pattern as `CompanyQuickView`'s own internal `tabs = ["Notes","Tasks","Meetings","Folder","Calendar"]`.
- Data: `GET /api/forms/:id/submissions/:submissionId` is **not yet built** — `formController.js` only has `listSubmissions`, no single-submission detail handler. **Flag**: this is a small, additive Phase 1b follow-up (one new controller function + one new route, wrapping a plain `FormSubmission.findById` + its `SubmissionEvent`s — exactly the shape already designed in the earlier Phase 1b contract discussion), needed before this drawer can be built, not before the rest of this document.

No `VendorQuickView` equivalent exists to also model against — irrelevant here since Forms' drawer is submission-scoped, not module-scoped.

---

## 6. Badge — copies `DealQuickView.jsx` / `DealDetail.jsx`'s `StatusBadge` exactly (decision 1)

A local, in-file `StatusBadge` (or `FormStatusBadge`/`ReviewStatusBadge`, named per context to avoid confusion with the *other* two already-duplicated `StatusBadge`s) — copy the exact shape:

```jsx
const statusConfig = {
  draft:     { bg: "bg-gray-50",  text: "text-gray-700",  border: "border-gray-200",  icon: <...  /> },
  published: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", icon: <...  /> },
  paused:    { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: <...  /> },
  archived:  { bg: "bg-gray-50",  text: "text-gray-500",  border: "border-gray-200",  icon: <...  /> },
};
```
for `FormDefinition.status`, and a separate small one for `reviewStatus`/`importStatus` in the Submissions tab if a visual pill is wanted there (optional — plain text is also consistent with how `Module` is rendered in §2.2). **Not extracted into a shared component** — per decision 1, this becomes the **third** independent copy of this exact pattern (after `DealQuickView.jsx` and `DealDetail.jsx`), logged in §9 below as intentional, deferred debt.

---

## 7. State management

No new Zustand store. Per audit §9, Zustand (`useCompanyStore`/`useContactStore`) holds only cross-component *navigation* state (the `currentCompanyIds` array used for the drawer's prev/next). Forms' drawer (Submission Details) has no prev/next requirement in this scope — plain `useState` for `submissionId` in `SubmissionsTab`, passed down to the drawer, is sufficient. If prev/next inside the drawer becomes a real requirement later, that's the moment to consider a `useFormsStore`, mirroring the existing two stores — not now.

All list/table state (`forms`, `submissions`, `reviews`, `page`, `filters`) is local `useState` per component, matching the dominant pattern everywhere else in this codebase.

---

## 8. Modal usage

The only modal-shaped UI in this scope is the "Create Form" name/module picker (§2.7). Copies `ExportModal.jsx`'s CSS exactly: `fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center`. No shared `<Modal>` component (none exists, audit §6).

---

## 9. Explicitly deferred / not building now

Restating and consolidating the flags raised throughout this document, plus the decisions' own explicit deferrals:

- **No shared Drawer/Badge/Table/Modal/EmptyState component** — three, now four (Drawer) and three (Badge) independent copies of the same pattern exist across the codebase; Forms adds one more of each. Logged as future cleanup in `FORMS_IMPLEMENTATION.md` (§10 below), matching how Phase 0 originally flagged (then later fixed, in its own separate follow-up commit) the Vendor bulk-import coercion duplication rather than fixing it mid-phase.
- **`submissionCount` on the Forms List response** — small backend addition needed before building that column (§2.2).
- **`formId` filter on `GET /api/duplicate-reviews`** — small backend addition needed before the Duplicate Reviews tab can scope to one form (§3.6).
- **`GET /api/forms/:id/submissions/:submissionId`** — not yet built; needed before the Submission Details Drawer (§5).
- **Duplicate-strategy editing** in the Settings tab — no backend update path exists yet; deferred (§3.3). Note this only blocks *switching* a form to `allow_duplicates` later, not the Duplicate Reviews tab itself — the schema already defaults new forms to `review_queue` (confirmed, see §3.3).
- **Richer per-module Forms button** (dropdown of actual forms, skip-list-if-one) — explicitly v1.1, not now (§4).
- **Real Builder internals** (FieldsPanel/Canvas/PropertiesPanel) — explicitly last in the build order, not designed in this document (§3.4).
- **Row actions beyond "Open"** on Forms List (Duplicate/Archive/Delete) and a full Submission Review comparison-card screen for Duplicate Reviews — both previously identified as v1-deferred; restated here, not reopened.

---

## 10. Note for `FORMS_IMPLEMENTATION.md`

Once implementation begins, log there (not here, to keep this document a stable reference rather than a running log):

> **Frontend Drawer/Badge duplication (flagged, not fixed).** `SubmissionDetailsDrawer.jsx` and Forms' local `StatusBadge` copy are the 4th and 3rd independent implementations, respectively, of an already-repeated pattern (`CompanyQuickView`/`ContactQuickView`/`DealQuickView`/`ColumnSettingsPanel` for the drawer CSS; `DealQuickView`/`DealDetail` for the badge). Deliberately not extracted into a shared component now, per explicit product decision — mirrors how Phase 0 initially flagged the Vendor bulk-import coercion duplication and fixed it later, in its own separate commit, rather than mid-phase. Future cleanup candidate once three-plus real usages exist and the shared shape is proven stable.

---

## 11. Folder/file plan (summary)

```
frontend/src/
  components/
    settings/
      FormsList.jsx                 (NEW — settingsItems entry, table, matches CompanyFieldSettings.jsx's file location convention)
    forms/                          (NEW subfolder, matches company/ contact/ vendor/ deal/ convention)
      SubmissionDetailsDrawer.jsx   (NEW — copies CompanyQuickView.jsx)
      SubmissionsTab.jsx            (NEW)
      DuplicateReviewsTab.jsx       (NEW)
      FormSettingsTab.jsx           (NEW)
      BuilderTab.jsx                (NEW — placeholder first)
  pages/
    FormDetailPage.jsx              (NEW — copies CompanyProfilePage.jsx's tab-container structure)
  App.jsx                           (MODIFIED — one new route: /forms/:id)
  pages/Settings.jsx                (MODIFIED — one new settingsItems entry)
  pages/Companies.jsx               (MODIFIED — one new "Forms" button)
  pages/Contacts.jsx                (MODIFIED — one new "Forms" button)
  pages/Vendors.jsx                 (MODIFIED — one new "Forms" button)
```

---

## 12. Build order (restating your instruction, for a single point of reference)

1. **Forms List** (`FormsList.jsx` + `settingsItems` entry) — table, empty/loading states, permission gate, Create Form modal.
2. **Form Detail shell** (`FormDetailPage.jsx` + `/forms/:id` route) — header, tabs, all five tabs present (Overview/Builder/Submissions/Duplicate Reviews/Settings) but Builder/Settings may be minimal placeholders initially. Overview should be real from the start — it's cheap (§3.2) and is the landing experience.
3. **Submissions tab** — real table against `GET /api/forms/:id/submissions`.
4. **Duplicate Reviews tab** — real table against `GET /api/duplicate-reviews` (flag: needs the `formId` filter addition first, §3.6/§9). Confirmed reachable: new forms default to `duplicateStrategy: "review_queue"` (§3.3), so this tab has real data to show once duplicates occur — not an empty tab by construction.
5. **Builder** — last, largest; not designed in this document.

Each step should be independently visible/demoable before moving to the next, per your instruction.
