# Contributing

Thanks for your interest in contributing!

## Development setup

1. Clone this repository.
2. Open the project folder with Cocos Creator 3.8.8 (or newer 3.8.x).
3. `cd extensions/<Extension>` and run `npm install`.
4. `npm run build` compiles the extension's `source/` TypeScript into `dist/`.
   Cocos Creator loads the extension from `dist/`, so re-run this after every
   change (or use `npm run watch`).

## Making changes

- Keep pull requests focused on a single change.
- Run `npm run build` and make sure it succeeds with no TypeScript errors.
- Run `scripts/check-secrets.sh .` before submitting if you touched build
  scripts or native templates — it catches accidentally committed secrets,
  config files, and build-machine paths. CI runs the same check.
- Update `CHANGELOG.md` for user-visible changes.
- Update the docs under `extensions/<Extension>/doc/en` and `doc/zh` when
  behavior or configuration options change.

## Reporting issues

Please include:
- Cocos Creator version
- Target platform (Android / iOS / Web, etc.)
- Steps to reproduce
- Relevant logs (build panel output, device logcat/console)

## Code of Conduct

This project follows the [Code of Conduct](./CODE_OF_CONDUCT.md).
