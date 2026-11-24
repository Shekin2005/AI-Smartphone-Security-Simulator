# Injection Analysis Report

## 1. Executive Summary

One exploitable SQL injection vulnerability identified in /api/lab/exploit/sqli; all other injection source-to-sink paths are defended via parameterized queries or strong command injection protections.

## 2. Dominant Vulnerability Patterns

### Pattern 1: SQLi via String Concatenation after Parameterized CTE
- **Description:** The /api/lab/exploit/sqli endpoint constructs a vulnerable query by concatenating user input (${input}) directly into the SQL string after a parameterized CTE (WITH scoped AS MATERIALIZED ... WHERE target = $1). The safe query uses parameterized $2 for the label comparison, but the unsafe query uses string concatenation ('${input}'), allowing input to become SQL syntax. This pattern nullifies the parameterized CTE's protection for the label comparison slot.
- **Implication:** An attacker can inject SQL logic through the label comparison, potentially extracting data from the lab_sqli_demo table beyond the intended scope. The attack requires LAB_VULNERABLE_MODE=true and MFA-authenticated session with consent opt-in.
- **Representative Findings:** `INJ-VULN-01`

## 3. Strategic Intelligence for Exploitation

### Defensive Evasion (WAF Analysis)
Not applicable — no WAF observed. The application relies on Caddy reverse-proxy with default security headers. The /api/lab/exploit/sqli endpoint's SQL injection succeeds based on string concatenation patterns, not WAF bypass. The /api/lab/terminal/exec endpoint rejects shell metacharacters but this is an application-level check, not a WAF.

### Error-Based Injection Potential
Low — the /api/lab/exploit/sqli endpoint employs application-level error handling that prevents verbose PostgreSQL errors from reaching the client, limiting error-based exploitation. However, the vulnerable query construction could still enable boolean-based or union-based injection techniques to extract data, as demonstrated by the endpoint's design comparing safe (parameterized) vs unsafe (concatenated) queries.

### Confirmed Database Technology
PostgreSQL

## 4. Vectors Analyzed and Confirmed Secure

| Source | Endpoint/File Location | Defense Mechanism | Verdict |
| --- | --- | --- | --- |
| Acadia profile/courses/payments endpoints | /api/acadia/profile, /api/acadia/courses, /api/acadia/payments | Prepared Statement (Parameter Binding) via pg.Pool $1/$2 placeholders | SAFE |
| Bank transfer endpoint (amount, from, to) | /api/bank/transfer | Prepared Statement (Parameter Binding) via pg.Pool $1/$2 placeholders | SAFE |
| School enrollment/grades/catalog endpoints | /api/school/enrollments, /api/school/admin/grades, /api/school/admin/course-manager/catalog | Prepared Statement (Parameter Binding) via pg.Pool $1/$2 placeholders | SAFE |
| Terminal command execution (cmd query param) | /api/lab/terminal/exec | Binary whitelist + Host whitelist + shell=false in spawn() + metachar regex rejection | SAFE |
| TOTP decrypt function | server.js decrypt() function | AES-256-GCM decryption key derived from TOTP_ENCRYPTION_KEY environment variable; user input (totp_secret) is database-stored ciphertext, not directly controllable without prior SQLi | SAFE |

## 5. Analysis Constraints and Blind Spots

### LAB_VULNERABLE_MODE Configuration
The /api/lab/exploit/sqli endpoint is gated by the LAB_VULNERABLE_MODE environment variable set to "true". The analysis assumes this is enabled in the test deployment, but the actual configuration may vary, affecting exploit availability.

### MFA and Consent Opt-in Requirements
The SQLi endpoint requires a signed-in, MFA-verified session and a recorded consent row in lab_optin_accounts. Without MFA enrollment and consent opt-in, the endpoint returns 403/401, which limits but does not eliminate the finding — the underlying code flaw (string concatenation) persists.

### Advanced SQLi Bypass Techniques
The analysis focused on the straightforward string concatenation path. More advanced techniques such as stacked queries, time-based blind injection, or second-order SQLi were not explicitly traced through all code branches, representing a coverage gap.
