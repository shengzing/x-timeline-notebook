# Security Policy

## Supported Versions

| Version | Supported |
|---------|----------|
| 0.1.x   | yes      |

## Reporting a Vulnerability

If you discover a security issue, please do not share exploit details in a
public issue. Use GitHub Security Advisories or another private channel
supported by the repository.

## Scope

Security reports are accepted for issues in this extension’s code, such as:

- unintended data exposure
- unsafe handling of exported files
- permission escalation
- malicious script injection

Please report platform-side issues directly to X.

## Data Safety

- All data stays in `chrome.storage.local`.
- The extension has no remote upload functionality.
- Exports are user-initiated and use Chrome’s download permission.
