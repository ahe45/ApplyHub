# Architecture Notes

## Refactor direction

- Keep entry files thin and use them as composition or wiring layers.
- Move reusable behavior into feature folders under `client/features/*` and domain services under `server/modules/*`.
- Keep shared constants in `shared/*` so client and server stay aligned.

## Current structure

### Client

- `client/app/*`: runtime state, API access, DOM lookup, navigation, bootstrap loading.
- `client/features/*`: feature-specific controllers and rendering helpers.
- `client/features/applications/admin-downloads.js`: applicant administration template/export/photo download actions.
- `client/features/applications/admin-management-workflow.js`: applicant form field, recruitment unit, schedule and settings edit/save/delete workflow.
- `client/features/applications/admin-*-workflow.js`: smaller applicant administration workflows composed by the management, submission, upload, and download controllers.
- `client/features/applications/admin-submissions-workflow.js`: applicant submission detail, direct photo replacement, and submission deletion workflow.
- `client/features/applications/admin-upload-workflow.js` and `admin-upload-target-workflow.js`: applicant recruitment upload preview, policy selection, and import execution workflow.
- `client/features/applications/admin-events.js`: event delegation for applicant administration views, separated from the top-level document event router.
- `client/features/applicant-public/*`: public applicant page modules used by `client/applicant-page.js`.
  `constants.js` owns route/runtime constants, `rendering-helpers.js` owns shared safe markup helpers,
  `upload-helpers.js` owns file/PDF upload helpers and `ticket-pdf-viewer.js` renders ticket PDFs.
- `client/features/upload-workflows/*`: shared upload workflow utilities plus reusable drag/drop and file input event binding.
- `client/features/app/*-events.js`: app-level navigation, auth, grid, editor toolbar, and document event adapters used by the top-level event composition file.
- `client/template-editor-kit/*`: portable template editor entry point, asset manifest, and small shell CSS for reuse in other projects.
- Thin composition files such as `client/features/admit-cards/workflow.js`, `client/features/grids/filtering.js`, and `client/features/template-editor/lifecycle.js` now assemble smaller modules from sibling folders.
- `client/events.js`: top-level event registration and startup wiring.
- `index.html`: keeps the static app shell; modal markup and ordered script tags are rendered from server-side partial/manifest files.

### Server

- `server/http/*`: request body parsing, response helpers, routing, and page handling.
- `server/app/services.js`: creates domain services, shared server helpers, and startup data/bootstrap operations.
- `server/app/api-route-dependencies.js`: maps composed domain services to the dependency object consumed by HTTP route modules.
- `server/app/index-modals.html`: static modal markup injected into `index.html` at render time.
- `server/app/index-page-partials.js`: applies server-side placeholders for the index page shell.
- `server/app/index-script-assets.js`: ordered script manifest rendered into `index.html` by the page handler.
- `server/modules/applications/attachment-storage.js`: applicant submission photo/file storage, legacy photo reading, read/delete helpers, and stored upload value normalization.
- `server/modules/applications/config.js`: applicant domain constants, workbook column definitions, default form seeds, and shared applicant-form config bindings.
- `server/modules/applications/import-utils.js`: applicant upload import policy, row classification, and import row labeling helpers.
- `server/modules/applications/public-access-store.js`: in-memory public access token lifecycle for applicant verification and lookup flows.
- `server/modules/applications/verification-mailer.js`: applicant email verification SMTP setup, reserved-domain suppression, and delivery result normalization.
- `server/modules/applications/workbook-service.js`: applicant Excel template, export, and import workbook generation/parsing service.
- `server/modules/applications/workbook-utils.js`: shared Excel cell text extraction, worksheet text-column formatting, and workbook header styling helpers used by applicant import/export flows.
- `server/modules/auth/*`: password helpers, session/auth flows, account administration.
- `server/modules/system/*`: settings, login notice, data cleanup, account bootstrap, summary payloads.
- `server/modules/system/default-notices.js`: default login and applicant notice HTML shared by system and applicant services.
- `server/modules/templates/*`: template bootstrap, rendering, generated objects, tag replacement.
- `server/modules/bootstrap/*`: schema bootstrap per table/domain.
- `server.js`: composition root that wires HTTP helpers and domain services together.

### Styles

- `styles.css`: shared components and common form/layout rules.
- `styles/features/uploads.css`: shared upload modal, preview, progress, policy, and dropzone styles.
- `styles/features/*.css`: feature-level styling for grids, forms, system pages, templates, and modals.
- `styles/features/applicant-public.css`: import hub for the public applicant page.
  The page styling is split into `applicant-public-layout.css`, `applicant-public-form.css`,
  `applicant-public-lookup.css`.
- `styles/responsive.css`: responsive overrides.

## Current hotspots

- `server.js` is now the HTTP server entry point; remaining backend hotspots are mostly large domain services rather than startup wiring.
- `index.html` is much thinner now; the remaining shell markup can be split only if the app shell itself becomes difficult to maintain.
- Submission ticket, application archive, membership and public UI regression tests are available through the package scripts.

## Ticket data source

- `server/modules/admit-cards/submission-records.js` reads `app_subm` answers and `app_meta` exam numbers directly. Individual PDFs, batch PDFs/ZIPs, the dashboard and print history share these records.
- There is no roster import/edit screen or assignment workflow. Current schema and backups do not create/include `examinee` or `app_assign`.
- Existing installations retain inactive legacy tables and old print logs. Startup detaches the old print-log foreign key without deleting log rows; legacy `candidate_id` records are converted to exam numbers first. Historical per-application field overrides and photos remain readable.
- The `promoted_examinee_no` column name is retained for compatibility; it is the exam number issued when an application is submitted. A promotion state is not required to print. Applicant ownership and lookup schedule checks still apply.
- Run `npm run test:submission-tickets` for fresh-schema and legacy-migration checks plus real PDFs and administrator page checks.

## Template and cleanup rules

- The editor offers application fields, photo and current date. Retired date/time/room/building/group tags are not offered; saved templates remain intact and these tags render as empty values.
- New editor documents and fresh database seeds share `shared/domain/default-template.js`. Old layout-specific string migrations and duplicate template seed markup have been removed.
- Ticket generation has one source (applications); the former `admitCardDataSource` setting is ignored and no longer read or written.
- Legacy schema/photo migrations remain only to preserve installed data. User uploads, inactive legacy tables and existing templates are never deleted by code cleanup.
- `npm test` runs current application, document, archive and ticket workflows in disposable databases. The ticket suite also covers template preview, tag options, cell splitting and borders.
