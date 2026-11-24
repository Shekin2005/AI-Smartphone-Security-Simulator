"""Curated reference list for the full report — 15 sources.

The earlier draft carried 71. That was more than a submission of this length
needs, and a long list makes the argument harder to follow rather than
stronger. This list keeps only the sources that carry weight in the text:

  * seven standards and foundational works — the process model (NIST 800-115),
    the access-control principle (OWASP Top 10), the weakness class (CWE-639),
    the authentication standard (NIST 800-63B), the lockout trade-off (Pinkas
    and Sander), the injection taxonomy (Halfond et al.), and the scoring
    system (CVSS v3.1);
  * eight production and evaluation sources — the company deployments that
    actually found things (Project Zero's Big Sleep, Microsoft's MDASH,
    Anthropic's 0-day programme, XBOW), DARPA's AI Cyber Challenge, the two
    independent measurements (ARTEMIS at ICLR 2026, Semgrep's evaluation), and
    the Omdia survey for adoption and buyer expectations.

Everything removed is folded into the nearest retained source at the point of
citation, via the ALIAS table in the build script, so no citation dangles and
no claim is attributed to a source that does not make it.
"""

from docx_framework import REFS as BASE
from references_full import EXTRA

_BASE = dict(BASE)
_EXTRA = dict(EXTRA)

# Core: standards and foundational work.
_CORE = [
    ("nist115", _BASE["nist115"]),
    ("owasp2021", _BASE["owasp2021"]),
    ("cwe639", _BASE["cwe639"]),
    ("nist63b", _BASE["nist63b"]),
    ("pinkas", _BASE["pinkas"]),
    ("halfond", _BASE["halfond"]),
    ("cvss", _BASE["cvss"]),
]

# Industry: production deployments and independent evaluations.
_INDUSTRY = [
    ("pz_bigsleep", _EXTRA["pz_bigsleep"]),
    ("ms_mdash", _EXTRA["ms_mdash"]),
    ("anthropic_0day", _EXTRA["anthropic_0day"]),
    ("xbow_top1", _EXTRA["xbow_top1"]),
    ("darpa_results", _EXTRA["darpa_results"]),
    ("artemis", _EXTRA["artemis"]),
    ("semgrep", _EXTRA["semgrep"]),
    ("omdia", _EXTRA["omdia"]),
    # Appended rather than inserted so the existing numbering stays stable; this
    # is the companion post to reference 10 and carries the browser and OS
    # findings that the 0-day programme post does not report.
    ("anthropic_disc", _EXTRA["anthropic_disc"]),
]

REFS15 = _CORE + _INDUSTRY
