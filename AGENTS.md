# Agent Safety Rules

## Secrets Access Is Forbidden By Default

- Never read, print, search, cat, open, parse, or otherwise access secrets-bearing files.
- Blocked patterns include: `.env`, `.env.*`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `id_rsa*`, `id_ed25519*`, `secrets.*`, `credentials.*`, and any file that appears to contain API keys, tokens, private keys, or passwords.
- This rule applies even when debugging.

## Explicit User Authorization Requirement

- Access to any blocked file is allowed only if the user's exact message includes the phrase: `read secrets file`.
- If that exact phrase is not present, refuse and continue with a non-secret alternative.

## Scope

- These rules apply to all agents and all tools in this repository.
