# Security Policy

## Supported Versions

We actively support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by:

1. **Email**: Send details to [security contact - add your email here]
2. **GitHub Security Advisories**: Use the [private vulnerability reporting](https://github.com/Lukeus/my-context-kit/security/advisories/new) feature

### What to Include

Please include the following information in your report:

- Type of vulnerability (e.g., RCE, XSS, path traversal)
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Critical vulnerabilities will be patched within 30 days

### Disclosure Policy

- We ask that you allow us reasonable time to address the issue before public disclosure
- We will credit you in the security advisory (unless you prefer to remain anonymous)
- We will publish a security advisory once a fix is available

## Security Measures

This project implements several security measures:

- **Code Scanning**: Automated security scanning with CodeQL
- **Dependency Scanning**: Regular dependency vulnerability checks
- **Secret Scanning**: Automated detection of exposed secrets
- **Branch Protection**: Required code reviews and status checks
- **Least Privilege**: Minimal permissions for GitHub Actions workflows

## Known Security Considerations

- This is an Electron desktop application that handles sensitive data (API keys, repository access)
- API keys are stored encrypted using Electron's safeStorage API (Windows Credential Manager / macOS Keychain / Linux Secret Service)
- The application requires filesystem access to manage context repositories

## Questions?

If you have questions about this security policy, please open a general issue (not for vulnerabilities).
