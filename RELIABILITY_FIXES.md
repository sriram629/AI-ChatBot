# Reliability fixes: deployment and verification

The fixes are on branch `fix/chat-auth-reliability`.

## Deployment
- Deploy the backend and frontend from this branch together.
- Render must have a private, nonempty SECRET_KEY. The known fallback is rejected.
  Keep your existing private key to preserve sessions. Old outstanding OTPs must be reissued.
- No new Python dependency is required. The existing Pillow and provider packages are used.
- Images now use validated inline content stored with the conversation, so Gemini can see
  them and later questions can refer to them. New uploads no longer require Cloudinary.
  Uploads are limited to 2 MB and extracted documents to 200,000 characters.
  Images uploaded before this change contain no stored image bytes and must be reattached.
- Session titles use the first message, avoiding an extra API call.
- Web search is requested with /search followed by a question.

## Database activity
/health now pings MongoDB and returns HTTP 503 if it cannot connect.
The daily GitHub workflow calls this endpoint and verifies the database field.
Scheduled workflows activate on the repository's default branch; merging and deploying
are both necessary. Actions must be enabled. The workflow does not run on an unmerged branch.
It uses no database credentials and does not call an AI provider.
This reduces inactivity pauses; it does not guarantee uptime or resume an already paused cluster.
GitHub can delay scheduled runs and disables scheduled workflows in inactive public repositories
after 60 days. Monitor failed workflow notifications and the Actions tab.
Atlas documents a 30-day inactivity threshold with zero connections:
https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/

## Validation
Run:
- server/venv/bin/python -m unittest discover -s server/tests -v
- cd client && npm ci && npm run build

Tests use isolated database/provider doubles and do not consume API quotas.
After deployment, verify login, OTP expiry, text/PDF/image uploads, image questions,
document follow-ups, edit, regenerate, stop, reconnect, /search, and image generation
with a test account. Provider credentials, quotas and the Atlas vector index need live checks.

