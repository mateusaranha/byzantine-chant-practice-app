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

Add these as GitHub Actions repository secrets. The deployment workflow copies
them into encrypted Cloudflare Worker secrets:

- `GITHUB_APP_ID`
- `GITHUB_CLIENT_ID`
- `GITHUB_INSTALLATION_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_PRIVATE_KEY`
- `SESSION_SECRET`

Also add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The Cloudflare API
token only needs permission to edit Workers Scripts in the selected account.

The non-secret repository and frontend values live in `wrangler.jsonc`.

After deployment, set the GitHub repository variable `PUBLISHER_API_URL` to the
Worker URL. The Pages workflow passes it to Vite and reveals the online library
only after the service is available.
