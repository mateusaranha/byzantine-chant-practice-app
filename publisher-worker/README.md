# Psaltikon publisher service

This Worker authenticates approved GitHub users and writes hymn-set JSON files to
`hinos/<github-login>/` in `mateusaranha/byzantine-chant-practice-app`. Hymn data
is not stored by the Worker.

## GitHub App

Create a GitHub App owned by `mateusaranha` with:

- Homepage URL: `https://mateusaranha.github.io/byzantine-chant-practice-app/`
- Callback URL: `https://<worker-url>/auth/callback`
- Webhooks: disabled
- Repository permissions: **Contents — Read and write**, **Issues — Read and write**
- Installation: only `mateusaranha/byzantine-chant-practice-app`

Record the App ID, Client ID and installation ID, generate a client secret, and
download a private key. Never commit the secret or private key.

## Worker configuration

Add these as GitHub Actions repository secrets. The `PSALTIKON_` prefix avoids
GitHub's reserved secret-name prefix. The deployment workflow maps them into
encrypted Cloudflare Worker secrets:

- `PSALTIKON_APP_ID`
- `PSALTIKON_CLIENT_ID`
- `PSALTIKON_INSTALLATION_ID`
- `PSALTIKON_CLIENT_SECRET`
- `PSALTIKON_PRIVATE_KEY`

Also add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The Cloudflare API
token only needs permission to edit Workers Scripts in the selected account.

The non-secret repository and frontend values live in `wrangler.jsonc`.

## Inactive translation experiment

The Worker contains a dormant `POST /api/experiments/translate` prototype for
ephemeral Greek-to-Brazilian-Portuguese translation. It is not used by the
frontend, does not store source text or translations, and returns `404` unless
`TRANSLATION_EXPERIMENT_ENABLED` is exactly `true`. Approved-publisher
authentication is still required when it is enabled.

`wrangler.jsonc` declares a Cloudflare Workers AI binding named `AI`, but merely
deploying that binding does not invoke a model. Before a real-account test,
confirm the account quota and choose one of the allowlisted models through
`TRANSLATION_MODEL`. Do not enable the endpoint in production until request
limits and the user-facing AI notice have been reviewed.

The Pages workflow currently passes the deployed Worker URL directly to Vite as
`VITE_PUBLISHER_API_URL`. The online library is omitted from builds where that
environment variable is empty. If the Worker URL changes, update the Pages
workflow and the GitHub App callback. If the frontend URL changes, update the
GitHub App homepage and `FRONTEND_URL`, which also controls CORS and the OAuth
return destination.
