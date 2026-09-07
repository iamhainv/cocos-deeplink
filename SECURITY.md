# Security Policy

## Supported Versions

Cocos Deeplink follows [semantic versioning](https://semver.org/). Only the
most recent published `1.x` release receives security fixes; older tags are
not patched.

| Version    | Supported          |
| ---------- | ------------------- |
| latest 1.x | :white_check_mark:  |
| < 1.0      | :x:                 |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for a security vulnerability.

Instead, use GitHub's private vulnerability reporting for this repository:
**Security** tab → **Advisories** → **Report a vulnerability**, or go
directly to
`https://github.com/iamhainv/cocos-deeplink/security/advisories/new`.

This is a community-maintained open-source project with no dedicated
security team. As a goal, not a guarantee, we aim to acknowledge new reports
within 5 business days and to share an initial assessment within 14 days.

## Scope

In scope — this repository's own code:

- The editor/build-panel TypeScript under `extensions/*/source`
- The runtime API under `extensions/*/assets`
- The native build templates under `extensions/*/template` and `native/`

Out of scope — please report these directly to the vendor, not here:

- The underlying Google Play services / Google Mobile Ads / Firebase /
  Google Play Billing SDKs → [Google's vulnerability reward program](https://g.co/vulnz)
- The underlying Apple frameworks (StoreKit, UserNotifications, etc.)
  → [Apple Product Security](https://support.apple.com/en-us/HT201220)
- Cocos Creator itself → the
  [Cocos Creator engine repository](https://github.com/cocos/cocos-engine)

This project wraps those SDKs; it does not audit, patch, or vendor fixes for
vulnerabilities that originate inside them.
