# Chat UI improvements

Branch: `feat/chat-ui-polish`. Each feature and subsequent correction has its own commit. Preserve these commits when merging if individual rollback is desired.

## Changes

- Composer: attachment filename/preview, upload progress, readable validation errors, keyboard support and a clear ready-to-send state.
- Feedback: document/search/image processing status, actual response provider, persistent chat errors and offline/reconnection notices.
- Conversations: rename with validation; confirmed removal from history. Removal is a soft delete, not permanent data erasure. Ownership checks protect both operations, and concurrent response updates cannot restore removed sessions.
- Mobile: overlay navigation, keyboard focus handling, safe-area spacing and a composer that does not cover the final answer.
- Empty conversations: starter prompts populate an editable draft without automatically sending a request.
- Messages: readable code and tables, visible links, image enlargement, touch-visible actions and clipboard-failure feedback.
- Stop: wait for server acknowledgement, keep the next draft, and reconnect if cancellation times out.

## Verification

Run from `client`:

```sh
npm ci
npm run build
npx playwright install --with-deps chromium firefox webkit
npx playwright test
```

The UI regression workflow runs 18 scenarios in four configurations (Chromium, Firefox, WebKit and iPhone emulation): 72 checks. It saves desktop/mobile screenshots and failure traces as `browser-test-results` for seven days. Coverage includes sending, attachments, processing status, providers, errors/offline feedback, rename persistence and failure, confirmed removal, mobile focus/navigation, prompts, code/tables/links, image previews, stopping, editing/regenerating and clipboard denial.

Run from the repository root with server dependencies installed:

```sh
python -m unittest discover -s server/tests
```

The backend suite has 18 tests including ownership, removed-session access, rename validation, upload handling, cancellation and existing authentication checks.

Browser tests mock HTTP and WebSocket responses; backend tests mock database/provider boundaries. They do not consume Gemini quota or modify production conversations. They do not prove live provider availability, real-device keyboard behavior or production deployment configuration.

## Deployment and user check

Deploy both server and client after review. Rename/removal and status/provider feedback need the server changes. Existing documents default to `is_deleted=False`; no destructive migration is required.

After deployment, check a real conversation, a PDF question, an image upload, edit/regenerate, Stop, rename and reload, and removal of a disposable conversation. On a phone, open/close the sidebar and type with the keyboard open. Check a slow upload and an offline/reconnect cycle. These are live acceptance checks, not a claim that every environment has been tested.
