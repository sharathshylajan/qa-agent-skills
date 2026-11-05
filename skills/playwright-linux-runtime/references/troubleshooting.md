# Troubleshooting

| Category | Meaning | Correct action |
|---|---|---|
| `node-runtime-missing` | Node.js or npm is absent | Use a Slingshot Linux base image with Node.js 20+ and npm |
| `npm-network-failure` | npm registry is unreachable | Configure the approved proxy/registry or network allowlist |
| `browser-download-failure` | Playwright browser CDN is unreachable | Allow the CDN or configure an approved `PLAYWRIGHT_DOWNLOAD_HOST` |
| `missing-linux-dependency` | Chromium shared libraries are absent and package installation is unavailable | Update the base image or grant noninteractive dependency-install permissions |
| `authentication-or-authorization-failed` | Site returned 401 or 403 | Correct the secret or authorization; do not retry unchanged credentials |
| `dns-failure` | Target host cannot be resolved | Correct the host or workspace DNS/network policy |
| `tls-certificate-failure` | Certificate chain is not trusted | Install the organization CA; use insecure TLS only with explicit test approval |
| `workspace-permission-denied` | npm or workspace is not writable | Correct workspace ownership and cache permissions |
| `setup-exhausted` | Five total attempts were consumed | Inspect the sanitized log and fix the underlying image/network/permission issue |

The bootstrap log is stored under `.playwright-runtime/bootstrap.log` in the ephemeral workspace. It must not be uploaded if it contains application-sensitive diagnostic data.
