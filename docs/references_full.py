"""Reference list for the full report.

Extends the base list with the industry and evaluation literature: the
company deployments, the head-to-head studies, and the market surveys. Kept in
its own module so the two shorter editions keep their existing numbering and
cannot drift.

Every entry is a real, locatable source. Where a figure is quoted in the body,
it comes from its entry here.
"""

from docx_framework import REFS as BASE

# (key, formatted reference). Formatted Harvard-style, matching the base list.
EXTRA = [
    ("pz_bigsleep", "Google Project Zero (2024) 'From Naptime to Big Sleep: using large language "
                    "models to catch vulnerabilities in real-world code'. Available at: "
                    "https://projectzero.google/2024/10/from-naptime-to-big-sleep.html "
                    "(Accessed: 24 November 2026)."),
    ("google_ciso", "Google Cloud (2025) 'Cloud CISO Perspectives: our Big Sleep agent makes a big "
                    "leap'. Available at: https://cloud.google.com/blog/products/identity-security/"
                    "cloud-ciso-perspectives-our-big-sleep-agent-makes-big-leap "
                    "(Accessed: 24 November 2026)."),
    ("secweek_sqlite", "SecurityWeek (2024) 'Google says its AI found SQLite vulnerability that "
                       "fuzzing missed'. Available at: https://www.securityweek.com/"
                       "google-says-its-ai-found-sqlite-vulnerability-that-fuzzing-missed "
                       "(Accessed: 24 November 2026)."),
    ("xbow_top1", "XBOW (2025) 'The road to top 1: how XBOW did it'. Available at: "
                  "https://xbow.com/blog/top-1-how-xbow-did-it (Accessed: 24 November 2026)."),
    ("xbow_1060", "XBOW (2026) 'We ran 1,060 autonomous attacks: what we learned'. Available at: "
                  "https://xbow.com/blog/we-ran-1060-autonomous-attacks "
                  "(Accessed: 24 November 2026)."),
    ("darpa_results", "DARPA (2025) 'AI Cyber Challenge marks pivotal inflection point for cyber "
                      "defense'. Available at: https://www.darpa.mil/news/2025/aixcc-results "
                      "(Accessed: 24 November 2026)."),
    ("aixcc_sok", "SoK: DARPA's AI Cyber Challenge (AIxCC): competition design, architectures, and "
                  "lessons learned (2026), *arXiv preprint* arXiv:2602.07666."),
    ("kaist", "KAIST (2025) 'Team Atlanta, with Professor Insu Yun's team, wins AIxCC final'. "
              "Available at: https://ee.kaist.ac.kr/en/research-achieve/"
              "team-atlanta-with-professor-insu-yuns-team-wins-aixcc-final/ "
              "(Accessed: 24 November 2026)."),
    ("ms_mdash", "Microsoft Security (2026) 'Defense at AI speed: Microsoft's new multi-model "
                 "agentic security system tops leading industry benchmark'. Available at: "
                 "https://www.microsoft.com/en-us/security/blog/2026/05/12/"
                 "defense-at-ai-speed-microsofts-new-multi-model-agentic-security-system-tops-"
                 "leading-industry-benchmark/ (Accessed: 24 November 2026)."),
    ("ms_learn", "Microsoft Learn (2026) 'Codename MDASH overview'. Available at: "
                 "https://learn.microsoft.com/en-us/security-exposure-management/"
                 "ai-code-security-overview (Accessed: 24 November 2026)."),
    ("secweek_ms", "SecurityWeek (2026) 'Microsoft, Palo Alto Networks find many vulnerabilities by "
                   "using AI on their own code'. Available at: https://www.securityweek.com/"
                   "microsoft-palo-alto-networks-find-many-vulnerabilities-by-using-ai-on-their-"
                   "own-code/ (Accessed: 24 November 2026)."),
    ("github_oss", "GitHub Blog (2026) 'Maintainers don't need more AI bug reports. They need "
                   "fixes.' Available at: https://github.blog/open-source/maintainers/"
                   "maintainers-dont-need-more-ai-bug-reports-they-need-fixes/ "
                   "(Accessed: 24 November 2026)."),
    ("cso_ms", "CSO Online (2026) 'Microsoft's new AI system finds 16 Windows flaws, including four "
               "critical RCEs'. Available at: https://www.csoonline.com/article/4170785/ "
               "(Accessed: 24 November 2026)."),
    ("openai_aardvark", "OpenAI (2025) 'Introducing Aardvark: OpenAI's agentic security "
                        "researcher'. Available at: https://openai.com/index/introducing-aardvark/ "
                        "(Accessed: 24 November 2026)."),
    ("anthropic_ccs", "Anthropic (2026) 'Making frontier cybersecurity capabilities available to "
                      "defenders' (Claude Code Security). Available at: "
                      "https://www.anthropic.com/news/claude-code-security "
                      "(Accessed: 24 November 2026)."),
    ("anthropic_disc", "Anthropic (2026) 'Discovering and exploiting vulnerabilities in critical, "
                       "real-world software'. Available at: https://www.anthropic.com/research/"
                       "discovering-vulnerabilities-with-claude (Accessed: 24 November 2026)."),
    ("anthropic_0day", "Anthropic (2026) 'Evaluating and mitigating the growing risk of "
                       "LLM-discovered 0-days'. Available at: https://www.anthropic.com/research/"
                       "zero-days (Accessed: 24 November 2026)."),
    ("anthropic_mythos", "Anthropic (2026) 'Claude Mythos Preview's cybersecurity capabilities'. "
                         "Available at: https://www.anthropic.com/research/mythos-preview "
                         "(Accessed: 24 November 2026)."),
    ("semgrep", "Semgrep (2025) 'Finding vulnerabilities in modern web apps using Claude Code and "
                "OpenAI Codex'. Available at: https://semgrep.dev/blog/2025/"
                "finding-vulnerabilities-in-modern-web-apps-using-claude-code-and-openai-codex/ "
                "(Accessed: 24 November 2026)."),
    ("cvebench", "Fang, R. et al. (2025) 'CVE-Bench: a benchmark for AI agents' ability to exploit "
                 "real-world web application vulnerabilities', *arXiv preprint* "
                 "arXiv:2503.17332."),
    ("artemis", "Singer, A. et al. (2026) 'Comparing AI agents to cybersecurity professionals in "
                "real-world penetration testing', *Proceedings of the International Conference on "
                "Learning Representations (ICLR 2026)*. Preprint: *arXiv* arXiv:2512.09882."),
    ("omdia", "Omdia (2026) *The 2026 State of Agentic AI in Pentesting*. Commissioned by Synack. "
              "Survey of 200 US security leaders, fielded 11–22 December 2025."),
    ("synack_buyers", "Synack (2026) 'What enterprise buyers want from AI pentesting, according to "
                      "the data'. Available at: https://www.synack.com/blog/"
                      "enterprise-ai-pentesting-buyer-research/ (Accessed: 24 November 2026)."),
    ("intruder", "Intruder (2026) 'State of AI pentesting: adoption, trust, and the future of the "
                 "pentest'. Available at: https://www.intruder.io/blog/state-of-ai-pentesting "
                 "(Accessed: 24 November 2026)."),
    ("cobalt", "Cobalt (2026) *Cobalt AI and Pentesting Pulse Report 2026*. Survey of 455 security "
               "leaders and practitioners."),
    ("cobalt_survey", "SecurityBrief UK (2026) 'Pentesters use AI more, but trust in autonomy "
                      "lags', 23 November. Reporting a Cobalt survey of the Cobalt Core "
                      "community of 500+ security experts."),
    ("sans", "SANS Institute (2026) *SANS 2026 AI in Cybersecurity*. Survey of 536 practitioners "
             "and 57 senior security leaders."),
    ("pentesttools", "Pentest-Tools.com (2026) 'AI pentesting in 2026: why testing cadence decides "
                     "who copes'. Survey of 158 security practitioners."),
    ("h3_trad", "Horizon3.ai (2026) *Traditional v. Autonomous: case study of a media company*. "
                "White paper."),
    ("h3_prior", "Horizon3.ai (2022) 'Vulnerable ≠ Exploitable: a lesson on prioritization'. "
                 "Available at: https://horizon3.ai/customer-story/a-lesson-on-prioritization/ "
                 "(Accessed: 24 November 2026)."),
    ("h3_jerome", "Horizon3.ai (2026) *How Jerome's Furniture moved from compliance to real "
                  "security*. Case study."),
    ("h3_devon", "Horizon3.ai (2026) *Mid Devon District Council: continuous autonomous "
                 "pentesting*. Case study."),
    ("ad_harness", "'Autonomous Active Directory exploitation via multi-model harness "
                   "orchestration' (2026), *arXiv preprint* arXiv:2610.04243."),
]
