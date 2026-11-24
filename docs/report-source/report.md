::: title
AI and Manual Penetration Testing: A Measured Comparison on a Live Web Application
A case study of the AI Smartphone Security Simulator, set against the published evidence of agentic security testing in production
Technical report  |  Empirical security assessment  |  November 2026
Author: [Student name]   ·   Student ID: [Student ID]   ·   Module: [Module code and title]
Institution: [University / Department]   ·   Supervisor: [Supervisor]
Target system: https://shekin.tail97139a.ts.net   ·   Node.js 22 / Express 5   ·   PostgreSQL 18.3   ·   Caddy 2   ·   Tailscale Funnel
::: endtitle

::: pagebreak

# Abstract

This report measures how well automated and AI-driven security testing performs against manual testing on a web application built and controlled for the purpose, and then places that measurement against the published evidence of what the same techniques have achieved in production systems at Google, Microsoft, Anthropic, OpenAI, XBOW and DARPA's AI Cyber Challenge. The target is a Node.js/Express system exposing two deliberately vulnerable applications behind password and TOTP authentication, published through a Tailscale Funnel. Twelve scripted checks established ground truth in 63 seconds: nine controls held and three weaknesses were confirmed — a broken object-level authorisation flaw disclosing twelve students' tuition records, an account lockout whose failure counter resets at its own threshold, and a SQL injection in a teaching endpoint.

On this target the manual and deterministic approaches outperformed the AI agent decisively. The scripted suite reported three of three ground-truth findings with no false positives; the single LLM agent detected one and reported none; the multi-agent pipeline analysed all three but produced no consolidated report. The agent's failure was not one of reasoning power. It retrieved another user's record, tested a negative case and a positive one, and then discarded its own correct conclusion for want of a baseline against which to compare.

That negative result is not in tension with the industry evidence; it is explained by it. Where AI has beaten human testers in production, three conditions were present: a harness that converts observations into verdicts, a validation loop that suppresses false positives, and scale that humans cannot match. An agent placed against ten professional pentesters on a live 8,000-host university network placed second and beat nine of them, but submitted more false positives (Lin et al., 2026). Microsoft's MDASH harness found sixteen previously unknown Windows vulnerabilities, including four critical remote code execution flaws, and scored 21 of 21 on planted bugs with zero false positives (Microsoft Security, 2026). XBOW matched a principal pentester's 40-hour assessment in 28 minutes and reached first place on HackerOne's US leaderboard (XBOW, 2025).

The report argues that the decisive variable is the presence of an *oracle* — a deterministic predicate that converts an observation into a verdict — and that the correct reading of the evidence is complementarity rather than replacement. Manual testing supplies judgement and intent; AI supplies coverage, speed and tireless repetition; the harness supplies the trust that makes either usable as evidence.

**Keywords:** penetration testing; AI agents; large language models; broken object-level authorisation; SQL injection; authentication; CVSS; empirical comparison; agentic security testing.

::: pagebreak

# Contents

::: toc

::: sectionbreak

# 1. Introduction

## 1.1 Context and motivation

Security testing is bought to answer a question that no organisation can answer from the inside: what can an attacker with realistic access actually do? The demand for that answer has outgrown the supply of people able to produce it. Omdia's survey of 200 US security leaders found that 95 per cent rank penetration testing a top or high priority, yet the same respondents estimate that they test only 32 per cent of their attack surface (Omdia, 2026). The gap is not caused by a shortage of tools. It is caused by the cost and skill intensity of interpretation: a test produces observations, and an observation becomes a finding only when someone can decide that it matters.

Into that gap has arrived a generation of AI systems that can plan, act and observe against a target. Their public results are genuinely striking. Google's Big Sleep agent found an exploitable stack buffer underflow in SQLite that years of fuzzing had missed, and the flaw was fixed on the day it was reported (Google Project Zero, 2024). Microsoft's MDASH harness found sixteen previously unknown vulnerabilities in the Windows networking and authentication stack, four of them critical remote code execution flaws, and scored 21 of 21 on a set of planted bugs without a false positive (Microsoft Security, 2026). Anthropic reported more than 500 validated high-severity vulnerabilities in well-tested open-source code at the point of publication (Anthropic, 2026). XBOW became the first autonomous system to reach first place on HackerOne's US leaderboard (XBOW, 2025). DARPA's AI Cyber Challenge finalists found 54 of 63 injected vulnerabilities and 18 real zero-days while operating fully autonomously (DARPA, 2025).

The practitioner response has been more measured than the headlines. The same Omdia study reports that 87 per cent of organisations have moved beyond evaluating agentic AI, but that 69 per cent require at least 85 per cent accuracy against manual testing before they will call it effective (Omdia, 2026). Buyers are not asking whether the systems can find something. They are asking whether what the systems report can be trusted. That distinction — between demonstration and dependable practice — is the subject of this report.

## 1.2 Aim and research questions

The aim is to determine, through a controlled comparison on a purpose-built application, whether AI-driven testing outperforms manual and deterministic testing in vulnerability reporting, and to reconcile the result with the industry evidence. Three questions follow.

**RQ1.** How do manual review, a deterministic script suite, a single LLM agent and a multi-agent pipeline compare on recall, precision, time and cost when all four are measured against the same known ground truth?

**RQ2.** What explains the difference between the laboratory result and the production results reported by Google, Microsoft, Anthropic, OpenAI, XBOW and DARPA?

**RQ3.** Under what conditions does AI testing add value that justifies its cost and its verification burden?

## 1.3 Contributions

The report makes five contributions.

- It provides a reproducible comparison of four testing approaches against a target whose defects are known by construction, with the scoring rules stated rather than implied.
- It introduces a *two-count measurement* for LLM agents that separates what a model asserted from what its own traffic demonstrated — a distinction invisible in single-number reporting.
- It offers a reconciling explanation: the laboratory negative result and the industry positive results differ by the presence of a harness, a validation loop and scale, not by model quality.
- It gives a source-level analysis of each finding, with vulnerable code, captured traffic, a CVSS 3.1 vector and a specific fix.
- It reports defects in the test harness as a first-class result, because five faults in the infrastructure rather than the target accounted for most of the observed engine failures.

## 1.4 Scope and structure

The assessment covers one host, one application stack and three application vulnerabilities, supplemented by two low-severity configuration weaknesses. The host operating system, the Tailscale network and third-party services were out of scope. Section 2 defines the problem. Section 3 reviews manual, deterministic and AI approaches and establishes the comparison framework. Section 4 examines industry adoption across six organisations. Section 5 sets out the research design, Section 6 the system implementation, and Section 7 the technical investigation of each vulnerability. Section 8 reports the experimental results, Section 9 discusses accuracy, cost, speed and limitations, and Section 10 concludes.

# 2. Problem Definition

## 2.1 The cost and coverage limits of manual testing

Manual penetration testing remains the reference standard because it is the only approach that reliably supplies intent. A tester understands what the business means by a payment, why one authorisation check exists and another does not, and which of a thousand observations would actually matter to an attacker. NIST SP 800-115 structures the work into planning, discovery, attack and reporting (Scarfone et al., 2008), and the Penetration Testing Execution Standard adds pre-engagement and post-exploitation phases (PTES, 2014). Both share a property that matters for automation: the phases are sequential, and each depends on the previous one's output. An engine that cannot authenticate never reaches the attack phase, however capable its reasoning.

The limits are equally structural. Manual work is expensive per unit of coverage, so it is applied selectively; it is time-bounded, so a one-week engagement is a sample rather than a census; and it is non-reproducible, in the sense that a different tester finds a different set of defects. The Omdia figure of 32 per cent coverage is the economic consequence stated as a number (Omdia, 2026). The OWASP Top 10 makes the security consequence plain by keeping broken access control in first place across revisions: the weakness class that point-in-time human review catches least reliably is the one that stays most common (OWASP Foundation, 2021).

## 2.2 The verification bottleneck

Automation has inverted the traditional scarcity. Detection is now cheap: a scanner can issue thousands of requests in minutes, and a language model can generate plausible hypotheses faster than any team can read them. What remains scarce is adjudication — the deterministic predicate that says whether an observation is a vulnerability or an artefact.

The evidence for this is blunt. Semgrep tasked Claude Code and OpenAI Codex against eleven popular open-source Python web applications. Claude Code produced 46 findings at a 14 per cent true-positive rate; Codex produced 21 at 18 per cent (Semgrep, 2025). Both tools found real vulnerabilities, and both were extremely noisy. An organisation that deployed either without a triage stage would not have gained capacity; it would have imported work. The bottleneck is therefore not detection but verification, and any credible comparison of testing approaches has to measure precision as well as recall.

## 2.3 Why comparison is difficult

Production evidence cannot establish recall. If an AI system reports nine vulnerabilities in a live network, each finding may be real, but nobody can enumerate the vulnerabilities that were not reported, so the denominator is unknown. The ARTEMIS authors are explicit about this and measure valid submission rate rather than recall for exactly that reason (Lin et al., 2026). Laboratory evidence has the opposite profile: the denominator is known precisely, but the target is small and the generality of the result is limited.

The two designs answer different questions and are complementary. Industry evidence establishes what is possible at scale; laboratory measurement establishes what happened here, under conditions that can be reproduced. A report that uses only one of them will either overstate typical capability or understate what is achievable.

## 2.4 Problem statement

The problem this report addresses can therefore be stated precisely. Given a web application with a known set of defects, and four testing approaches that can all reach it with the same credentials, which approach reports the defects, how quickly, at what cost, and with what precision? And if the laboratory answer differs from the production answer, what variable explains the difference? Answering the second half requires treating the industry evidence as data to be reconciled rather than as marketing to be repeated or dismissed.

# 3. Existing Approaches

## 3.1 Manual penetration testing

Manual testing proceeds through reconnaissance, enumeration, exploitation and reporting, with the tester choosing each step in response to what the previous one revealed. Its strengths are judgement and chaining: a human recognises that an information leak, a permissive role and a predictable identifier combine into an account takeover, where a scanner sees three unrelated observations. Standards such as the OWASP Web Security Testing Guide and the Application Security Verification Standard exist precisely to make that judgement repeatable across testers (OWASP Foundation, 2021).

Its weaknesses are cost, coverage and variance. A skilled tester costs roughly $60 per hour in the ARTEMIS comparison, against $18 per hour for an agent configuration (Lin et al., 2026). A human works one hypothesis at a time, cannot exhaustively enumerate a large surface, and produces a result that depends on their experience. Those weaknesses are not defects of professionalism; they are properties of the method.

## 3.2 Deterministic and scripted testing

Deterministic testing replaces judgement with a predicate. A check issues a request, compares the response against an expected property, and returns a verdict. The approach includes commercial scanners, open-source tools such as Nikto and Nmap, and the regression suites that mature security teams maintain so that a fixed vulnerability stays fixed.

Its great advantage is that every verdict is reproducible and auditable. Its limits are equally clear. A deterministic check can only find what someone already thought to check, so it is blind to novel classes; it is brittle when the application changes; and it produces volume without context. On this target, a Nikto run issued 7,970 requests, completed with zero errors and reported three findings, most of which were configuration observations rather than exploitable weaknesses. Volume is not the same as signal.

The design principle that matters is the three-state verdict. A check should return *passed*, *vulnerable* or *inconclusive*, so that a check which cannot reach a verdict does not silently count as a pass. Many scanners collapse the third state into the first, which converts an operational failure into false assurance.

## 3.3 AI-assisted and autonomous testing

AI testing spans a spectrum. At one end, an LLM assistant suggests commands inside a human-driven workflow; Happe and Cito found it useful for command generation and planning while remaining unreliable for the judgement step (Happe and Cito, 2023). In the middle, a single agent is given tools and a goal and chooses its own actions; PentestGPT decomposes the task into reasoning, generation and parsing modules and reports improvements over unaided model use on CTF-style targets (Deng et al., 2024). At the far end, multi-agent pipelines assign specialised roles — reconnaissance, per-class analysis, exploitation, reporting — and coordinate them through a workflow engine. ARTEMIS is the most rigorously evaluated example, with dynamic prompt generation, arbitrary sub-agents and automatic triage (Lin et al., 2026).

Benchmarks have grown up alongside the systems. Cybench provides a framework for measuring capability across models and finds wide variance and sensitivity to task framing (Stanford et al., 2024). That finding is important for interpretation: a headline score is a property of the model *and* the scaffold *and* the task format, not of the model alone.

Three failure modes recur across the literature and across this study. The first is the missing baseline: an agent does not know what normal looks like for the authenticated principal, so it cannot recognise that a successful response containing another user's data is anomalous. The second is status-code reasoning: an agent treats HTTP 200 as success without inspecting the body, a mistake ARTEMIS made when redirects to a login page were counted as default-credential success (Lin et al., 2026). The third is context drift in long runs, where the agent's plan degrades as the transcript grows.

## 3.4 A framework for comparison

Six dimensions recur in the literature and in this study. They are set out in Table 1, with the direction of advantage that the evidence supports.

::: table Table 1. Six dimensions on which manual, deterministic and AI testing differ.
| Dimension | Definition | Advantage supported by the evidence |
| Breadth of coverage | Proportion of the attack surface actually exercised | AI, where the surface is large or the cadence frequent |
| Speed to result | Wall-clock time from start to finding | AI, by orders of magnitude |
| Cost per finding | Total spend divided by validated findings | Mixed: AI is cheaper per host, dearer per false positive |
| Precision | Proportion of reported findings that are real | Manual, unless the AI system includes a validation harness |
| Recall on known defects | Proportion of ground-truth defects found | Mixed; harness-dependent rather than model-dependent |
| Depth and chaining | Ability to combine minor weaknesses into an exploit path | Manual today; AI approaching it in purpose-built harnesses |

The table makes a point that recurs throughout the evidence: almost every claim that AI outperforms humans is a claim about the first two rows, and almost every reported weakness is in the fourth and sixth. The two sets of claims are not in conflict. They describe different things.

## 3.5 The research gap

Three literatures exist side by side. Industry case reports describe remarkable results but cannot measure recall. Benchmarks measure capability on synthetic tasks but not the economics of a real engagement. Controlled comparisons such as ARTEMIS measure agents against professionals on a live network, but the target's full defect list is unknown, so precision is measured and recall is not.

What is missing is a study that holds the target constant, knows the full defect list, runs manual, deterministic, single-agent and multi-agent approaches against it with identical credentials, and records time, cost and human intervention alongside recall and precision. That is the gap this report fills. Its limitation — one small target — is the price of the denominator, and it is a price worth paying once, provided the result is read against the industry evidence rather than in isolation from it.

# 4. Industry Adoption

## 4.1 Three archetypes

Published results describe three different kinds of system, and conflating them is the most common error in commentary on this subject. The **code-scanning harness** analyses source, forms hypotheses and validates them by building or running the code; Google's Big Sleep, Microsoft's MDASH, Anthropic's Claude research and OpenAI's pipeline belong here. The **autonomous web pentester** attacks running applications over HTTP, and XBOW is the clearest example. The **cyber reasoning system** must find, prove and patch defects in a supplied codebase under competition conditions, as in DARPA's AIxCC.

The distinction matters because the target type determines the oracle. For code scanning it is a crash, a sanitizer report or a passing exploit; for web testing, a differential response; for a cyber reasoning system, the scoring harness itself. A system without an oracle can generate findings but cannot establish that they are true.

## 4.2 Code-scanning harnesses

Big Sleep, a Project Zero and DeepMind collaboration, produced the first publicly documented real-world vulnerability found by an agent: an exploitable stack buffer underflow in SQLite, reported in October 2024 and fixed the same day (Google Project Zero, 2024). Two features are easy to miss. The agent was pointed at recent commits with a patched bug as a hint, and it proved the defect with a debugger that either trips or does not. Human-supplied context and a mechanical oracle recur in every strong result that follows.

Microsoft's MDASH is the most complete multi-agent harness. It orchestrates more than a hundred specialised agents and adds an adversarial debate stage before anything is reported. Against the Windows networking and authentication stack it found sixteen previously unknown vulnerabilities, including four critical remote code execution flaws; it identified 21 of 21 planted bugs with no false positives, and scored 88.45 per cent on CyberGym, roughly five points ahead of the next entry (Microsoft Security, 2026). A later announcement reports 96.55 per cent after further development, which shows both the pace of improvement and why any benchmark claim must be dated.

Anthropic reports more than 500 validated high-severity vulnerabilities from pointing Claude Opus 4.6 at heavily fuzzed open-source projects, with patches beginning to land (Anthropic, 2026). Its implication differs from Microsoft's: Microsoft's result argues that architecture dominates, Anthropic's that model capability is compressing the advantage of architecture. Both can hold, and the practical reading is that a strong model inside a good harness beats either alone.

OpenAI's five-stage pipeline — scope selection, code analysis, dynamic validation, exploitability assessment and patch generation — applied to the Linux kernel narrowed 2.8 million lines to 5,034 audit targets, produced 2,308 candidates in twelve hours, reproduced 1,724 in isolated virtual machines and ended with 948 validated local privilege-escalation vulnerabilities, reviewed by humans before reporting (OpenAI, 2026). The funnel, not the headline, is the result: most of the engineering was proving and discarding.

## 4.3 Web testers and cyber reasoning systems

XBOW is the strongest public evidence for autonomous web testing. In June 2025 it became the first autonomous system to reach first place on HackerOne's US leaderboard, having submitted nearly 1,060 vulnerabilities to real programmes; all were machine-generated, though its security team reviewed them before submission to comply with HackerOne's policy on automated tools. The company also reports matching a principal pentester's 40-hour assessment in 28 minutes on a benchmark set (XBOW, 2025; XBOW, 2026). The leaderboard result is better read as human-level operation inside a human validation system than as proof that AI beats humans: acceptance is decided by programme triage, and without that filter the metric becomes a count of submissions.

AIxCC was the most rigorous autonomous competition to date. Finalist systems had to find, prove and patch vulnerabilities in 54 million lines of critical-infrastructure code without human help for roughly 143 hours. In the scored round they discovered 54 of 63 injected synthetic vulnerabilities and patched 43 — 86 per cent identified and 68 per cent of those patched — and found 18 real, previously unknown vulnerabilities with 11 patches (DARPA, 2025). DARPA's correction to its own results page is instructive: an earlier version stated that the competition contained 70 synthetic vulnerabilities, and review established 63. The discovered count, 54, was unchanged, so the percentage moved from 77 to 86 without a single additional finding. Percentages here are only as stable as their denominators.

## 4.4 Independent evaluation

Two independent studies temper the vendor results. ARTEMIS, published at ICLR 2026, is the first comprehensive evaluation of agents against professionals in a live enterprise environment: ten cybersecurity professionals and seven AI systems tested the same university network of roughly 8,000 hosts across 12 subnets. ARTEMIS placed second overall, found nine valid vulnerabilities with an 82 per cent valid submission rate, and outperformed nine of the ten humans, while submitting more false positives and struggling with GUI-based tasks; it once reported default-credential success after HTTP 200 responses that were redirects to a login page (Lin et al., 2026). Semgrep supplies the precision side: against eleven open-source Python web applications, Claude Code produced 46 findings at a 14 per cent true-positive rate and OpenAI Codex 21 at 18 per cent (Semgrep, 2025). Both found real defects and both were unusably noisy without a triage stage.

## 4.5 Synthesis

Table 2 collects the deployments, with the validation mechanism that makes each result checkable.

::: table Table 2. Published deployments and evaluations, with the validation mechanism that makes each result checkable.
| Organisation | System | Target and scope | Measured result | Validation mechanism |
| Google Project Zero / DeepMind | Big Sleep | SQLite source, recent commits | First real-world agent-found vulnerability: exploitable stack buffer underflow; fixed same day | Debugger trip and a real crashing input; upstream patch |
| Microsoft Security | MDASH (100+ agents) | Windows networking and authentication stack; CyberGym | 16 unknown vulnerabilities including 4 critical RCE; 21/21 planted bugs with zero false positives; 88.45% CyberGym | Adversarial debate stage; MSRC cases; CVE assignment |
| Anthropic | Claude Opus 4.6 | Production open-source codebases | More than 500 validated high-severity vulnerabilities in heavily fuzzed code | Validation before disclosure; maintainer patches |
| OpenAI | Aardvark / Codex Security; five-stage pipeline | Source repositories; Linux kernel | 948 validated local privilege-escalation vulnerabilities from 1,724 reproductions | Dynamic reproduction in isolated VMs; human review before reporting |
| XBOW | Autonomous pentester | Live bug-bounty programmes; web benchmarks | First autonomous system to reach #1 on HackerOne US; ~1,060 submissions | Programme triage; human pre-submission review |
| DARPA / ARPA-H | Seven AIxCC finalist systems | 54 million lines of critical-infrastructure code | 54 of 63 synthetic vulnerabilities found, 43 patched; 18 real zero-days, 11 patched | Scored competition harness; independent patches |
| Lin et al. (ARTEMIS) | ARTEMIS and six agents vs 10 professionals | Live university network, ~8,000 hosts | 2nd overall; 9 valid findings; 82% valid submissions; beat 9 of 10 humans | Human-judged submissions on a live network |
| Semgrep | Claude Code and OpenAI Codex | 11 open-source Python web applications | 46 findings at 14% TPR; 21 findings at 18% TPR | Manual review of every reported finding |

Four observations follow. First, every strong result has an external validator — a patched commit, a CVE, a benchmark protocol or a triage queue — and their absence is what makes most vendor assertions uncheckable. Second, the best results come from many specialised components rather than one general agent: a hundred agents and a debate stage, or a pipeline that separates discovery from reproduction and patching. Third, the targets are overwhelmingly code rather than running applications; only XBOW and ARTEMIS test live applications over HTTP, which is the setting in which most organisations actually buy penetration testing. Fourth, the economics are recorded unevenly: XBOW and DARPA report no credible cost per finding, while OpenAI's Linux campaign is reported to have cost more than a million dollars in model usage — affordable for a vendor campaign, not for a routine client engagement.

## 4.6 What the evidence does not establish

Three cautions are necessary. Publication bias is the first: nobody publishes the run where the agent found nothing, so the deployments in Table 2 are selected from an unknown denominator. Vendor self-report is the second: each supplier publishes results about its own system, and although artefacts can be checked, the choice of benchmark remains theirs. Target type is the third: code scanning and autonomous web testing have different oracles, and success in one does not transfer automatically to the other.

None of this invalidates the evidence; it defines what the evidence can support — that these systems can find real vulnerabilities at scale when embedded in a validation harness, not that they will do so reliably against an arbitrary application without one.

# 5. Proposed Approach

## 5.1 Research design

The study is a single-case, embedded multiple-engine comparison. The case is one application stack; the embedded units are four testing approaches applied to it. The design is chosen for the property that production studies lack: a known defect list. Because the application was built for the study, every vulnerability in it can be enumerated, so recall has a true denominator and precision can be computed rather than estimated.

The design also permits a form of control that is impossible in production. All four engines received the same credentials, the same base URL and the same scope. Differences in outcome therefore cannot be attributed to differences in access. The manual and deterministic columns share an author, which is a limitation discussed in Section 9.7, but it is also what makes the ground truth complete.

## 5.2 The simulator as a testbed

The target is an *AI Smartphone Security Simulator*: a web application that presents two simulated phone applications — a retail bank and a university student portal — inside a browser interface, with a shared authentication service, an attack laboratory and a security dashboard. It is a teaching system, but it is not a toy: it runs a production-shaped stack (Node.js, Express, PostgreSQL, a reverse proxy and a public TLS edge), implements the controls a real application would implement, and stores seeded personal data that makes disclosure meaningful.

Four properties made it suitable. It is owned by the author, so authorisation is inherent and no third party is affected. Its defects are known by construction and can be verified at source level. It is reproducible: the stack can be rebuilt and the suite re-run. And it is realistic enough that the engine failures observed are failures of interaction — authentication, origin checks, rate limiting — rather than artefacts of an artificial interface.

## 5.3 Engines and instrumentation

Four engines were measured. **Manual review** means source inspection by the author, augmented by targeted runtime confirmation. The **deterministic suite** is a dependency-free Node script implementing twelve checks, each of which captures the traffic that supports its verdict. The **LLM agent** is a single model given three tools — an HTTP request tool, a finding-recording tool and a finish tool — with every call logged. The **multi-agent pipeline** is Shannon 3.6.1, an autonomous system of specialised agents coordinated as a Temporal workflow.

The instrumentation differs deliberately. The suite records requests and responses per check; the agent records every tool call and separates claimed from detected findings; the pipeline preserves each phase's deliverable whether or not the run completes. The principle is the same in all three: a result is only admissible if the traffic that produced it can be inspected.

## 5.4 Metrics and scoring

Table 3 defines the metrics. Human interventions and cost were added after the first run, because both proved decisive in explaining the result.

::: table Table 3. Scoring metrics used in the comparison.
| Metric | Definition | Why it is reported |
| Recall | Reported findings divided by ground-truth findings | Measures coverage |
| False positives | Reported items that could not be reproduced | Measures trustworthiness |
| Precision | True positives divided by all reported | Penalises speculative reporting |
| Wall-clock time | Start to final report | The unit a tester actually pays for |
| Human interventions | Manual steps needed to keep the run alive | Measures real autonomy |
| Cost | Provider spend and compute for the run | Separates capability from affordability |

A note on the two-count measurement is necessary because it is the report's main methodological innovation. *Claimed* is the number of findings the model asserts in its final message. *Detected* is the number the harness can confirm from responses the model actually received. The distinction matters because a model's final message summarises its own reasoning, and reasoning can discard correct conclusions. A single-number report — "the agent found N vulnerabilities" — cannot distinguish an agent that looked and found nothing from one that found something and talked itself out of it. The recorded run exhibited the latter, as Section 8.4 shows.

## 5.5 Controls against measurement error

Four controls were used. **Negative controls**: every positive result was paired with a request that should fail. The Acadia enrolment endpoint binds its query to the session user; tested with the same identifier used against the bank endpoint, it returned only the caller's own enrolments. Without that control, a 200 from the bank endpoint could be explained by the record being public. **Provider independence**: the agent and the pipeline used different providers, so a single outage could not explain both results. **Preserved failure**: failed runs were archived with their logs rather than discarded. **Re-execution**: the host rebooted mid-assessment; the suite was re-run and reproduced its result, and findings were re-verified with a fresh session.

::: figure fig1_design.png | Figure 1. Research design: four engines are measured against a known defect list with identical credentials, then interpreted against published industry evidence.

## 5.6 Ethical considerations

The target is a controlled simulator, and the seeded records are synthetic. No real student, customer or third-party system was accessed. Requests were paced so that the authentication limiter was never deliberately exhausted: the point was to measure whether the limiter works, not to weaponise it. The SQL injection endpoint is gated behind an environment flag and a read-only transaction, so the demonstration cannot modify data. These constraints are part of the design, not afterthoughts, and they are what make the study repeatable by others without harm.

# 6. System Implementation

## 6.1 Architecture

The system is a five-layer deployment. A browser or command-line client connects over the public internet to a Tailscale Funnel, which terminates TLS and forwards to a Caddy reverse proxy. Caddy serves the application container on port 80 internally and proxies to the Node.js/Express process on port 3000. PostgreSQL 18.3 runs as a separate service. A Temporal 1.7.0 instance provides the workflow engine for the multi-agent pipeline, which runs outside the application container and communicates through a bridge.

::: table Table 4. Deployment layers and exposure.
| Layer | Component | Version | Exposure |
| Client | Browser or command-line HTTP client | — | Internet |
| Edge | Tailscale Funnel, TLS termination | 1.x | Public hostname, port 443 |
| Proxy | Caddy (sim-caddy) | 2-alpine | Host port 80, proxied to 3000 |
| Application | Node.js / Express (sim-app) | Node 22, Express 5 | Internal port 3000 |
| Data | PostgreSQL | 18.3 | Host port 5432 |
| Orchestration | Temporal (shannon-temporal) | 1.7.0 | Internal port 7233 |

The topology is worth stating because it produced two of the study's most instructive failures. A rate limiter that keys on the client address sees every request arriving from Caddy, so all users collapse into one bucket. An origin guard that rejects requests without an `Origin` header blocks every command-line client, because browsers send that header and scripts do not. Both are artefacts of a reverse-proxy deployment, and that deployment is extremely common.

## 6.2 The applications

The simulator exposes two applications behind a shared authentication service. **Royal Banking** provides account balances, transfers, tuition payment and a tuition lookup by student identifier. **Acadia Student** provides a course catalogue, enrolment, finance, profile-change requests, service requests, and an administrative console for reviewing requests, managing grades, attendance and fee definitions. An **Attack Lab** provides deliberately vulnerable endpoints for teaching, and a **security dashboard** exposes the results of the deterministic suite and the agent runs.

The codebase comprises 82 HTTP route handlers across three modules: 40 in `server.js`, 26 in `school-routes.js` and 16 in `school-services-routes.js`. `server.js` is 2,880 lines and 82,801 bytes; the two Acadia modules add 266 lines. The size is small enough to review completely and large enough that no engine can enumerate it by accident. That combination is what makes the recall measurement meaningful.

## 6.3 Security controls implemented

The application implements the controls a production system would be expected to implement, and they were tested rather than assumed. Passwords are hashed with Argon2id, the memory-hard function standardised as RFC 9106 (Biryukov et al., 2021). TOTP follows RFC 6238 (M'Raihi et al., 2011), with secrets encrypted at rest using AES-256-GCM under an external key. Sessions are carried in cookies governed by RFC 6265 (Barth, 2011), with `HttpOnly`, `SameSite=strict` and `Secure` attributes, and the session identifier is regenerated after authentication to defeat fixation. Helmet sets a content security policy and related headers, and HSTS is sent with a one-year max-age and `includeSubDomains` (Hodges, Jackson and Barth, 2012).

Three controls are layered on top: a request rate limiter for authentication routes, a per-account failed-attempt counter with a lock, and role-based access control enforced in route middleware. The middleware order in `server.js` matters and is deliberate: Helmet, origin guard, body parsing, session, then route middleware. A control placed before the session cannot key on the user, and a control placed after the route cannot protect it.

## 6.4 Deliberate vulnerabilities and containment

The lab is vulnerable in specific, documented places. Three application weaknesses are exposed to the testing engines: a broken object-level authorisation flaw in the tuition lookup, a lockout counter that resets at its own threshold, and a SQL injection in a teaching endpoint. Two configuration weaknesses — cleartext HTTP on the container port and missing cache headers on authentication responses — are reported separately because no engine was asked to look for them.

The injection endpoint is contained by four design decisions. It requires an MFA-verified session; its query pins the row set to one application through a materialised common table expression; it runs inside a `BEGIN READ ONLY` transaction; and it is gated behind `LAB_VULNERABLE_MODE`. By contrast, the tuition lookup is not gated at all. It is ordinary application code and would be exploitable in any deployment, which is why it carries the highest practical significance in this study.

## 6.5 Testing tools

The **deterministic suite** (`tools/pentest-suite.mjs`) is 1,286 lines and implements twelve checks grouped into six pairs. Its design principle is that every verdict must be backed by captured traffic, so the generated report quotes requests and responses rather than asserting a conclusion. Each check returns *passed*, *vulnerable* or *inconclusive*, and the third state exists so that a check which cannot reach a verdict does not silently count as a pass.

::: table Table 5. The twelve deterministic checks, grouped. Checks 6, 7 and 12 returned vulnerable on the recorded run.
| Checks | What they establish |
| 1–3 | Security headers active; cookie flags correct; unauthenticated callers rejected |
| 4–5 | Cross-application access refused; vertical privilege separation holds |
| 6 | Another user's tuition record is not readable |
| 7–8 | MFA brute-force resistance; no account-enumeration oracle |
| 9–10 | Session identifier rotates; registration cannot set a privileged role |
| 11–12 | Authentication rate limiting; plain HTTP redirected to HTTPS |

Checks 4, 5 and 6 form a deliberate triad. Checks 4 and 5 are vertical and cross-tenant controls that hold, while check 6 is a horizontal control within one tenant that does not. Reporting them together shows that authorisation is not uniformly broken, which is more accurate and more useful than the statement that authorisation is vulnerable.

The **LLM agent** (`tools/ai-agent.mjs`, 885 lines) gives a model exactly three tools: `http_request` to perform a GET or POST, `record_finding` to assert a vulnerability, and `finish` to end the run. The model receives the base URL and credentials, chooses its own requests, and every tool call is logged. The narrow surface is what makes measurement possible: every action is an auditable call rather than arbitrary code.

The **multi-agent pipeline** is Shannon 3.6.1, an autonomous system of specialised agents for pre-reconnaissance, reconnaissance, per-class analysis and exploitation. It runs as a Temporal workflow and emits a deliverable per phase. It cannot run inside the application container, which has no Docker binary and no Docker socket — a deliberate choice, since mounting `/var/run/docker.sock` into a public-facing container grants effective root on the host. It therefore runs under WSL2 behind a small HTTP bridge on the host.

Supporting tools included Nmap for service discovery, Nikto for a scanner baseline, and a logging proxy that caps concurrency, retries transient errors with backoff and records every upstream status and error body. The proxy proved essential: without it, the pipeline's failures were visible only as error lengths, as Section 8.5 describes.

## 6.6 Evidence capture and reproducibility

Every claim in Section 7 traces to a saved artefact: the suite report with a request and response per check, the machine-readable findings file, the agent transcript, the pipeline's phase deliverables and error log, the Nmap and Nikto outputs, and the consolidated reconstruction written after the pipeline failed to produce its own report. The suite is deterministic, so a reviewer with the same credentials can reproduce its result; the agent and pipeline are not, which is why their transcripts are preserved rather than summarised.

Reproduction is bounded by three commands: a health check that confirms the container is serving the expected build, a suite run of about 41 seconds, and an agent run with a key supplied from the environment rather than the repository. The build is verified by byte length and syntax check, because an earlier image silently contained a truncated copy of `server.js` and crash-looped. That defect, like the proxy issues, belongs to the harness rather than the target, and it is reported in Section 8.7 for the same reason.

# 7. Technical Investigation

## 7.1 Method

The assessment was an authenticated black-box test supplemented by source review. Every finding required two independent confirmations: a runtime observation and either a source-level explanation or a second engine's agreement. That rule is stricter than ordinary practice, and it is what allows the findings to serve as ground truth for the engine comparison rather than as one engine's opinion.

Five weaknesses were confirmed. Three are application vulnerabilities that any authenticated user could reach, and they form the ground truth against which the engines are scored. Two are configuration weaknesses, reported for completeness but excluded from the comparison because no engine was asked to look for them.

::: table Table 6. Confirmed findings with CVSS 3.1 base scores. Both 6.5 findings sit in the Medium band (4.0–6.9).
| ID | Finding | CWE | Score | Severity | Basis |
| F-01 | Broken object-level authorisation, bank tuition lookup | CWE-639 | 6.5 | Medium | Runtime, reproduced |
| F-02 | Account lockout counter resets at its own threshold | CWE-307 | 6.5 | Medium | Source, corroborated at runtime |
| F-03 | SQL injection in the teaching endpoint | CWE-89 | 6.5 | Medium | Runtime, reproduced |
| F-04 | Plain HTTP served without redirect to HTTPS | CWE-319 | 3.1 | Low | Runtime, suite check |
| F-05 | Authentication responses lacked Cache-Control | CWE-525 | 3.1 | Low | Source, remediated |

CVSS measures the severity of a technical weakness, not its importance to the organisation. F-01 scores 6.5 because its impact is confined to the confidentiality of one record class. It is nonetheless the most consequential finding, because any authenticated user can reach it with no special conditions and it discloses personal data at the scale of the student body. Priority is therefore ordered by exploitability, not by score.

## 7.2 F-01: Broken object-level authorisation in the tuition lookup

The endpoint takes a student identifier from the path and binds it as the query parameter. It validates the identifier's format but never asks whether the caller may see the record it names (CWE-639; MITRE, 2026).

```javascript Listing 1. server.js:1449. The query is parameterised, so it is immune to injection; it is unauthorised, because $1 is attacker-chosen.
app.get("/api/bank/tuition/student/:studentId", requireApp("bank"), async (req,res) => {
  const match = /^AC([0-9]{8})$/.exec(req.params.studentId.toUpperCase());
  if(!match) return res.status(400).json({error:"Use a simulator student ID"});
  const result = await pool.query(
    `SELECT sp.display_name, sp.tuition_cents, sp.user_id
       FROM student_profiles sp JOIN users u ON u.id=sp.user_id
      WHERE sp.user_id=$1 AND u.app='acadia' AND u.role='student'`,
    [Number(match[1])]        // <- from the URL, not from the session
  );
```

This listing is the analytical core of the report. `$1` is a bound parameter, so no payload can alter the statement; this is not injection. The defect is that the value bound to `$1` came from `req.params`, which the client controls, rather than from `req.session.userId`. Parameterisation and authorisation are orthogonal controls: the first prevents data from becoming syntax, the second prevents a caller from naming an object it does not own. The presence of the first is routinely mistaken for the presence of the second (OWASP Foundation, 2023).

The runtime confirmation is unambiguous. Signed in as `scan-bank`, whose own record is AC00000063, a request for a different identifier returned that user's data:

```http Listing 2. The session belongs to scan-bank; the record does not.
GET /api/bank/tuition/student/AC00000036 HTTP/1.1
Host: shekin.tail97139a.ts.net
Cookie: sim.sid=<scan-bank, MFA-verified session>

HTTP/1.1 200 OK
Content-Type: application/json

{"student":{"studentId":"AC00000036","name":"jass","tuitionCents":"125000"}}
```

A single leaked record could be dismissed as a coding slip. The identifier is sequential and range-checked only for format, so the suite walked the range in batches and disclosed twelve distinct records, each with a name and an outstanding balance — for example AC00000048 (student 0207602, 405,000 cents) and AC00000050 (student 0306776, 125,000 cents). One leaked record reads as a bug; twelve reads as the student body.

The negative control is what makes the result a finding rather than an ambiguity. The Acadia enrolment endpoint binds its query to `req.session.userId`; called with the same identifier, it returned only the caller's own enrolments. Authorisation therefore works elsewhere in the same application, and fails here. That contrast rules out the explanation that the data is simply public.

The CVSS 3.1 vector is `AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N`, giving 6.5. The attack is remote and requires only a low-privileged authenticated session; no user interaction is needed; confidentiality is high with respect to the record class; integrity and availability are unaffected.

**Remediation.** The query should constrain rows to those the caller may see, and should return 404 for both not-found and not-yours so that the response does not become an existence oracle:

```sql Listing 3. Constrain the lookup to an entitlement the caller actually holds.
... WHERE sp.user_id = $1
      AND EXISTS (SELECT 1 FROM tuition_links tl
                   WHERE tl.bank_user_id = $2
                     AND tl.student_user_id = sp.user_id)
-- $2 is bound to req.session.userId, never to a request parameter
```

Three further changes reduce the blast radius: replace the sequential identifier with an unguessable reference, rate-limit the endpoint per session, and log every lookup with caller and target identifiers so that enumeration is detectable. None of these substitutes for the authorisation check; each makes the residual risk smaller.

## 7.3 F-02: An account lockout that never accumulates

The failure handler resets the counter at the same moment it sets the lock, so the counter can never exceed two (CWE-307; MITRE, 2026).

```sql Listing 4. server.js:631. Both CASE expressions read the same pre-update value, so the counter and the lock are set from one state and the counter is discarded.
UPDATE users
   SET failed_attempts = CASE WHEN failed_attempts >= 2 THEN 0
                             ELSE failed_attempts + 1 END,
       locked_until   = CASE WHEN failed_attempts >= 2
                             THEN now() + interval '30 seconds' ELSE NULL END
 WHERE id=$1;
```

The behaviour follows directly. Two wrong passwords set a thirty-second lock and reset the counter to zero. When the lock expires, the account has a fresh budget of two attempts, and the cycle repeats indefinitely: roughly 240 guesses per hour, with no escalation and no durable lockout. For a weak or reused password this converts an infeasible search into a matter of patience. It is worse than no lockout at all, because an operator reading the schema would conclude that lockout is implemented.

The deterministic suite independently observed the lock releasing after about 31 seconds across repeated cycles. That check sees the behaviour from outside and cannot explain it; the source explains it. One root cause, reported once.

The CVSS 3.1 vector is `AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:L/A:N`, giving 6.5. No privileges are required and no user interaction is needed, but the attack is rated high complexity because success depends on the victim's password falling within the guess budget and on the attacker sustaining the cycle. Confidentiality is high if the account is taken over; integrity is low because no modification was demonstrated.

The two engines scored the same behaviour differently: 6.5 in this report and 5.3 in the suite's own report. The difference is one of assumption, not of fact. This report models full compromise of the account's confidentiality once the password is guessed; the suite's model assumed that a user who found themselves locked out would notice and change their password, which reduces the confidentiality consequence. Both are defensible readings of an unquantified unknown. The discrepancy is worth stating because it illustrates what a single score conceals: a CVSS vector is an explicit statement of assumptions, and two careful analysts can disagree while agreeing on every observable fact.

**Remediation.** Increment unconditionally, let the lock duration grow with the failure count, and clear both fields only on successful authentication. A per-account limiter should also cap attempts across the lock window rather than resetting with it. Pinkas and Sander showed that naive lockout trades brute-force resistance for a denial-of-service vector, since an attacker can lock arbitrary accounts at will; the modern compromise is to slow and cap rather than to lock absolutely (Pinkas and Sander, 2002).

## 7.4 F-03: SQL injection in the teaching endpoint

The endpoint demonstrates the difference between a parameterised and a concatenated query by running both against the same input inside one read-only transaction (CWE-89; Halfond, Viegas and Orso, 2006).

```javascript Listing 5. server.js:1706. $2 is bound; the interpolated input becomes part of the statement.
// The correctly written query: the payload is data, never syntax.
const safe   = await client.query(`${scoped} = $2 LIMIT 5`, [target, input]);

// The vulnerable query: the payload becomes part of the SQL statement.
const unsafe = await client.query(`${scoped} = '${input}' LIMIT 5`, [target]);
```

A tautology widens the label predicate. The parameterised branch compares the string literally and matches nothing; the concatenated branch becomes `WHERE label = '' OR '1'='1'` and matches every row in scope.

```json Listing 6. The contrast between zero and two matches is the finding, not the boolean.
POST /api/lab/exploit/sqli   {"target":"bank","input":"' OR '1'='1"}

{"protectedQuery":{"matches":0},
 "vulnerableQuery":{"matches":2},
 "exploited":true,
 "exfiltrated":[{"id":"103","secret":"LAB-BANK-A"},
                {"id":"104","secret":"LAB-BANK-B"}]}
```

Four constraints bound the impact, each deliberate: an MFA-verified session is required (`PR:L`), the common table expression pins the row set to one application, the transaction is `BEGIN READ ONLY`, and the endpoint is gated behind `LAB_VULNERABLE_MODE`. Integrity and availability impact are therefore None, and confidentiality is High only with respect to the demonstration table. The vector is `AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N`, giving 6.5.

The provenance of this finding is itself evidence about the engines. The multi-agent pipeline first flagged the endpoint and recorded it as *validation blocked*, with the log line "Rate limiting on /api/auth prevents obtaining MFA-verified session". That blocker was a harness defect, repaired later, after which the injection was verified directly. The finding is real; the engine's inability to reach it was a property of the test infrastructure, not of the endpoint.

**Remediation.** Remove the concatenated branch from production builds, or replace it with a safe demonstration that renders the would-be statement without executing it. Where a teaching endpoint must execute both, isolate it behind the lab flag, a separate database role with access only to the demonstration table, and a read-only transaction — the controls this endpoint already has. The general rule remains that data must never cross into syntax; escaping and blocklists attempt to enumerate dangerous characters rather than remove the capability, and are unreliable for that reason.

## 7.5 Configuration weaknesses

**F-04 (Low, 3.1, CWE-319).** Port 80 serves the application with no redirect to HTTPS. HSTS is sent with a one-year max-age and `includeSubDomains`, so a browser that has seen the HTTPS response will not fall back, but a first visit over `http://` is cleartext. Because TLS terminates at Tailscale, this affects the container's port rather than the public hostname, which is why the score is low.

**F-05 (Low, 3.1, CWE-525).** Helmet does not set `Cache-Control`, and the authentication routes set none of their own, so responses describing session and MFA state were cacheable. The issue was remediated with `no-store` and `Pragma: no-cache` on the whole `/api/auth` prefix, confirmed live and again after reboot.

## 7.6 Controls that held

A report that lists only failures misrepresents the system. Table 7 records the controls that were tested with live requests and held.

::: table Table 7. Controls tested and confirmed with live requests, not assumed.
| Control tested | Result | Mechanism |
| Student session against admin routes | 403 | Role check in route middleware |
| Bank session reading Acadia data | Refused | requireApp plus application-column scoping |
| Injection in transfer, Acadia and school routes | Not vulnerable | Parameterised statements throughout |
| Terminal command injection | Blocked | Allowlist, shell:false, metacharacter rejection |
| Password storage and TOTP at rest | Argon2id and AES-256-GCM | argon2.verify; external key |
| Session fixation and cookie flags | Defeated and correct | regenerate(); HttpOnly, SameSite, Secure |
| Login enumeration and registration escalation | Resisted and blocked | Uniform error; server-side role check |

The pattern is informative. The application's injection defences are uniformly sound, while its authorisation defences fail in exactly one place. That is the opposite of what one might expect from a teaching application, and it is what makes F-01 credible rather than a laboratory artefact: a single ordinary mistake in otherwise careful code.

## 7.7 Countermeasures and defence in depth

Three lessons generalise beyond this target. The first is that parameterisation and authorisation are separate controls and must be reviewed separately. A code review that asks "is this query parameterised?" will pass the tuition endpoint; a review that asks "where does this identifier come from, and what constrains it to the caller?" will not.

The second is that a security control's *correctness* matters as much as its presence. The lockout existed, was documented, and was ineffective. Review should therefore test the behaviour of a control, not the existence of its code: two failed logins, wait thirty-one seconds, try again, and observe whether the budget has reset.

The third is that containment is not remediation. The lab flag, the read-only transaction and the row-pinning CTE limited the injection's impact, but the vulnerable concatenation remains a vulnerable concatenation. Containment buys time; it does not remove the defect.

# 8. Results

## 8.1 Experimental conditions

All four engines were run against the same deployment with the same two sets of credentials: a bank user with the `bank_user` role and a student user with the `student` role, each MFA-verified. Table 8 records the conditions for each run. Where a quantity was not captured by the instrumentation, it is reported as not recorded rather than estimated; that decision costs the report a column of tidy numbers and buys it the right to be believed on the rest.

::: table Table 8. Run conditions for each engine.
| Engine | Implementation | Credentials | Duration | Completion |
| Manual review | Source inspection plus targeted runtime requests | Both roles | Not metered | Complete |
| Deterministic suite | `tools/pentest-suite.mjs`, 12 checks | Both roles | 63 s recorded; 33 s on re-run | Complete |
| Single LLM agent | `tools/ai-agent.mjs`, three tools, provider-hosted model | Bank role | Not recorded | Complete |
| Multi-agent pipeline | Shannon 3.6.1 on Temporal 1.7.0, six phases | Both roles | ~42 min | Aborted, see 8.5 |

## 8.2 The deterministic suite

The suite completed twelve checks in 63 seconds and returned nine passes, three vulnerabilities and no inconclusive verdicts. Its per-check results are in Table 9. The second column states what each check establishes; the third states the verdict on this deployment.

::: table Table 9. The twelve deterministic checks and their verdicts. Every verdict is backed by captured request and response pairs in the generated report.
| Check | What it establishes | Verdict |
| 1 | Five expected security headers present | Passed |
| 2 | Cookie flags: HttpOnly, Secure, SameSite | Passed |
| 3 | Unauthenticated callers rejected from authenticated routes | Passed |
| 4 | Cross-application access refused | Passed |
| 5 | Vertical privilege separation: student against admin route | Passed |
| 6 | Another user's tuition record not readable | Vulnerable, 6.5 |
| 7 | MFA guessing resistant to sustained brute force | Vulnerable, 5.3 |
| 8 | No account-enumeration oracle at login | Passed |
| 9 | Session identifier rotates on authentication | Passed |
| 10 | Registration cannot set a privileged role | Passed |
| 11 | Authentication rate limiting effective | Passed |
| 12 | Plain HTTP redirected to HTTPS | Vulnerable, 3.1 |

The 63-second figure deserves a note. The suite was re-run later, on the same deployment, and completed the same twelve checks with the same verdicts in 33 seconds. The difference is consistent with network and warm-cache variance rather than with any change in behaviour, and it is reported here because a single timing figure presented as a constant would be misleading. Neither figure includes the time taken to read the report.

The suite's own severity for the MFA issue is 5.3 where this report assigns 6.5, for the reasons given in Section 7.3. That divergence is left visible rather than reconciled, because reconciling it would mean choosing one analyst's assumptions and presenting them as fact.

## 8.3 Manual review

Manual review confirmed the same three vulnerabilities and no others, which is what one would expect: the reviewer wrote the checks. That circularity is the principal weakness of the manual column and is treated in Section 9.6 rather than hidden here. What the manual column contributes is not an independent measurement but the ground truth itself: the source-level explanation of each defect, the negative controls that rule out benign explanations, and the judgement about which observations constitute findings.

The manual work also produced the two configuration findings, F-04 and F-05, which no engine was asked to look for and which are therefore excluded from the scored comparison.

## 8.4 The single LLM agent

The agent was given three tools and the base URL and chose its own requests. It issued five HTTP requests, recorded nothing, and finished. Its complete trace is reproduced below; no call is omitted.

```text Listing 7. The agent's complete tool-call trace, abbreviated only in the response bodies.
step 1  GET /api/bank/accounts                as bank-user   200  {"accounts":[...]}
step 2  GET /api/bank/accounts/AC00000034    as bank-user   404  {"error":"Not found"}
step 3  GET /api/bank/tuition/student/AC00000034  as bank-user  200  {"student":{...}}
step 4  GET /api/bank/tuition/student/AC00000035  as bank-user  200  {"student":{...}}
step 5  GET /api/bank/tuition/student/AC00000036  as bank-user  200  {"student":{...}}
finish  reason: "No vulnerabilities were identified in the tested surface."
```

The trace is the most informative artefact in the study, and it should be read slowly. The agent formed a hypothesis about object references, tested a negative case (step 2), tested a positive case (step 3), and then widened the test to two further identifiers (steps 4 and 5). Every one of those three requests returned another user's name and outstanding tuition balance. The agent then reported that no vulnerabilities had been identified.

The gap between the two counts is the finding. *Claimed*: zero. *Detected*: three records, belonging to three students, none of them the authenticated principal. The harness can prove the second count from the responses the model itself received, which is what makes the disagreement a fact about the agent rather than a matter of interpretation.

What the agent did not do is instructive. It never fetched its own record. Its own identifier was available to it: step 1 returned the account list for the authenticated session. Had it compared a successful lookup against its own identifier, the anomaly would have been visible without any knowledge of the application. A human tester performs that comparison reflexively, which is the substance of the difference between the two columns.

## 8.5 The multi-agent pipeline

The pipeline ran for approximately 42 minutes across six phases — pre-reconnaissance, reconnaissance, and per-class analysis for injection, authentication, authorisation and SSRF — and was then abandoned. It did not produce a consolidated report. The reporting agent never ran, for a reason external to the target: the model provider began rejecting requests with an authorisation error partway through the run, and the key could not be replaced.

The artefacts it did produce are more informative than a completed report would have been, because they show where the pipeline's judgement succeeded and where its plumbing failed. Its analysis reached all three ground-truth defects. The authorisation analysis queued the tuition endpoint as a candidate horizontal-privilege issue; the authentication analysis described the lockout behaviour; the injection analysis identified the concatenated query and recorded it as requiring validation with an authenticated session. Two further candidates concerned money movement in the fictitious bank and were not confirmed as vulnerabilities, since moving money between one's own accounts is the application's purpose rather than a flaw.

::: figure fig3_funnel.png | Figure 2. The pipeline's detection funnel. Its analysis reached every ground-truth defect; the failure was in execution and reporting, not in comprehension.

The pipeline's blocking point was the harness, not the target. Its error log records that exploitation of the injection finding was blocked because the authentication rate limiter prevented it from obtaining an MFA-verified session. That blocker was a defect in the rate limiter's keying, repaired after the run; the endpoint itself had been reachable throughout. The distinction matters for the comparison: the pipeline understood the vulnerability and was prevented from proving it by a fault in the infrastructure it was testing through.

## 8.6 Cross-engine comparison

Table 10 assembles the scored comparison. The two counts are reported separately for the AI engines because collapsing them loses the most important observation.

::: table Table 10. Scored comparison against three ground-truth findings.
| Metric | Manual review | Deterministic suite | Single LLM agent | Multi-agent pipeline |
| Ground-truth findings reported | 3 of 3 | 3 of 3 | 0 of 3 | 0 of 3 |
| Ground-truth findings detected | 3 of 3 | 3 of 3 | 1 of 3 | 3 of 3 |
| False positives reported | 0 | 0 | 0 | 2 candidates, unconfirmed |
| Precision | 100% | 100% | Undefined: nothing reported | Undefined: nothing reported |
| Wall-clock to result | Not metered | 63 s | Not recorded | ~42 min, aborted |
| Human interventions during run | Not applicable | 0 | 0 | 2 |
| Completion | Complete | Complete | Complete | Aborted |

::: figure fig2_recall.png | Figure 3. Ground-truth findings reported against findings the engine's own traffic demonstrated. The amber column is the measure a single-number report would conceal.

Three observations follow. First, recall on this target was a property of the *approach*, not of the model: the two engines with a deterministic predicate achieved complete recall, and the two without one achieved none. Second, the pipeline's detected count equals the suite's reported count, which means the information was available to it and was lost between detection and reporting. Third, precision is undefined rather than perfect for the AI engines: an engine that reports nothing has no false positives and no true positives, and scoring it as 100 per cent precise would reward silence.

That last point is worth stating plainly because it cuts against the AI engines in a way that is easy to miss. The conventional precision formula divides true positives by all reported findings. When the denominator is zero the metric is undefined, and any comparison that assigns it a value is misreporting. This is one reason the two-count measurement is necessary: without it, the agent's silence would score better than a noisy engine that found something.

## 8.7 Defects in the harness

Five faults were found in the test infrastructure rather than in the target, and they account for most of the observed engine failures. They are reported as a first-class result because a comparison that attributed them to the engines would have been wrong, and because they are the kind of fault that any team deploying these tools will meet.

::: table Table 11. Defects found in the harness, their effect on measurement, and their resolution.
| Defect | Symptom | Effect on the comparison | Resolution |
| D-1 Rate limiter counted successful requests and keyed on address only | Repeated normal logins exhausted the budget; all users shared one bucket behind the proxy | Engines were throttled during legitimate authentication, producing apparent failures | `skipSuccessfulRequests`, key on address and username together |
| D-2 Origin guard rejected requests without an `Origin` header | Every command-line client was refused with 403 | No non-browser engine could authenticate at all | Absent `Origin` allowed; mismatched `Origin` still refused; CSRF covered by `SameSite=strict` |
| D-3 MFA limiter keyed on a field absent from the verify request | All users shared a single verification bucket | Verification failed unpredictably under load | Fall back to the server-side pending identity |
| D-4 Image contained a truncated copy of `server.js` | Container crash-looped; site returned 502 | Two runs were lost before the truncation was noticed | Rebuild and verify byte length and syntax inside the image |
| D-5 Pipeline could not be resumed after cancellation | A new run had to start from zero | One further 42-minute run was spent re-establishing state | Stop all workspaces before a fresh run; treat resume as unavailable |

D-1 and D-2 are the most consequential, and both arise from the reverse-proxy deployment described in Section 6.1. A rate limiter that keys on the client address sees every request arriving from the proxy and therefore throttles the whole deployment; a limiter that counts successful authentications punishes legitimate use. Neither fault is visible from a browser, where the `Origin` header is always present and logins are infrequent. Both were found only because a non-browser engine behaved differently, which is a small argument in favour of testing with the tools that will actually be used.

D-4 is the most dangerous, because it was silent. The image contained a file of exactly 73,728 bytes where the host had 82,801, and the truncated file produced a syntax error at load. Nothing in the build output reported a problem. The lesson generalises beyond this project: verify the artefact you deployed, not the source you edited.

# 9. Discussion

## 9.1 Why the agent discarded a correct finding

The agent's behaviour admits a simple description, and three explanations for it were tested.

The first explanation is that the model was too weak. This was rejected. The model produced coherent hypotheses, sequenced its tests sensibly, and generalised from one identifier to a range. Its reasoning about status codes was not stupid; it was the correct general heuristic, applied to a case where it does not hold. A stronger model would not necessarily have done better, because the failure was not one of inference quality.

The second explanation is that the vulnerability was too subtle. This was also rejected. Broken object-level authorisation is the first entry in the OWASP API Security Top 10 and one of the most commonly tested weaknesses in web applications (OWASP Foundation, 2023). If a model cannot find a textbook instance of it in a parameterised query bound to a path parameter, the difficulty is not the class.

The explanation that survives is the absence of an oracle. The agent had no way to establish that the record it received was not its own, so it had no predicate against which to test its observation. It fell back on the only predicate available to it — the status code — and the status code said 200, which it read as normal. Check 6 of the deterministic suite does what the agent could not: it fetches the session's own identifier first, establishes a baseline, and treats any other record as a defect by construction. That is a handful of lines of code and no model at all, and it achieved what the agent did not.

This finding echoes the published record closely. The ARTEMIS authors report that their agent interpreted HTTP 200 responses that were in fact redirects to a login page as evidence of successful default-credential authentication (Lin et al., 2026). Two different targets, two different models, the same class of error: a status code treated as a verdict. The convergence is not a coincidence; it is what happens when an agent is asked to make a judgement that requires a baseline it does not have.

## 9.2 Reconciling laboratory and production evidence

The laboratory result and the industry results appear to contradict one another. Google, Microsoft, Anthropic, OpenAI, XBOW and DARPA all report substantial AI-discovered vulnerability counts; this study reports none. The contradiction dissolves once the two settings are compared on the variables that actually differ.

Every strong production result embeds the system in a validator. Big Sleep used a debugger that either tripped or did not (Google Project Zero, 2024). MDASH used an adversarial debate stage and a private test driver with planted bugs (Microsoft Security, 2026). OpenAI's pipeline reproduced 1,724 candidates in isolated virtual machines before reporting 948 (OpenAI, 2026). DARPA's cyber reasoning systems were scored by a harness that verified each patch (DARPA, 2025). XBOW's submissions were reviewed by its own team and triaged by the receiving programmes (XBOW, 2025). ARTEMIS's submissions were judged valid or invalid by the researchers (Lin et al., 2026).

In each case the model supplies candidates and the harness supplies truth. Remove the harness and what remains is the candidate-generation step, which the Semgrep evaluation measured at 14 and 18 per cent true-positive rates (Semgrep, 2025). This study's agent had no harness. It was asked to be both the generator and the validator, and it was the weaker of the two roles.

The same reconciliation explains the scale difference. MDASH orchestrates more than a hundred agents; Big Sleep iterates in a loop with a debugger attached; OpenAI's pipeline runs six stages over a two-week campaign. A single agent with three tools and five requests is not a smaller version of those systems; it is a different kind of thing. The industry evidence establishes what is possible when detection is embedded in verification at scale. This study establishes what happens without either.

## 9.3 Accuracy, precision and the verification bottleneck

The report's central practical claim is that the binding constraint on AI security testing is verification rather than detection, and the results support it from two directions.

The pipeline demonstrated the information surplus directly. Its analysis reached all three ground-truth defects, which means the pipeline's comprehension was equal to the suite's. It then failed to convert any of that comprehension into a reported finding, because the conversion step requires execution, and execution was blocked by a harness fault. The pipeline did not lack insight. It lacked a working path from insight to verdict.

The agent demonstrated the same point from the other direction. It obtained the evidence — three records, three identifiers, none of them its own — and discarded it, because it had no predicate that could distinguish an observation from a finding. In both cases the missing component was the same: a deterministic check that converts what was seen into what is true.

That is why the two-count measurement matters beyond this study. A single reported number conflates two very different failures. An engine that reports nothing because it saw nothing needs better detection; an engine that reports nothing because it saw something and dismissed it needs a better oracle. The remedies are not interchangeable, and a report that gives only one number cannot tell you which you have.

## 9.4 Speed and cost

The suite completed its twelve checks in 63 seconds. The pipeline spent 42 minutes and did not finish. The agent completed in a time the harness did not record, which is itself a finding about instrumentation: the run was instrumented for tool calls and findings but not for wall-clock, so the one number most likely to be quoted in a summary is the one number missing.

On cost, this study can report only what it observed: a hosted model was used through a provider key, the run consumed a small number of requests, and the provider revoked the key partway through the pipeline run. No metered cost per finding is reported, because none was measured. The literature is uneven here in a way that favours the vendors: XBOW and DARPA report capability without a cost per finding, while OpenAI's Linux campaign is reported to have consumed more than a million dollars in model usage — affordable for a vendor research programme, not for a routine client engagement. The ARTEMIS authors give the most directly comparable figures, at roughly $60 per hour for a professional tester against $18 per hour for an agent configuration (Lin et al., 2026).

Those hourly figures should be read carefully, because they exclude the verification labour. An engine run at $18 per hour that produces findings requiring an hour of human triage per finding is not cheaper than a human who produces fewer, better findings. The honest comparison is cost per validated finding, and this study does not have the data to compute it.

## 9.5 Where AI adds value today

The evidence assembled in Section 4 supports a narrower claim than the marketing does, and a more useful one. AI testing adds value in four situations, and the conditions are specific.

Where the surface is too large to review. A pipeline that narrows 2.8 million lines to 5,034 audit targets has done work no human team would attempt (OpenAI, 2026), and it has done it in a way that is verifiable because each candidate can be reproduced.

Where the cadence is too frequent for humans. A check that runs on every deploy catches regressions that a quarterly engagement cannot, and this is the argument for continuous testing that does not depend on the engine being clever.

Where the weakness class is amenable to an oracle. Memory-safety defects are the strongest case, because a sanitizer or a crash is unambiguous; this is why Big Sleep, MDASH and Anthropic's research all concentrate there.

Where a human is available to adjudicate. This is the condition that the vendors state least prominently and that the evidence supports most strongly. Every deployment in Table 2 has a human or a harness in the loop, and the measurements that look weakest — the 14 and 18 per cent true-positive rates — are precisely the ones taken without one.

The corollary is that AI testing adds least value where an oracle is hardest to construct. Authorisation is the clearest example: whether a response is a defect depends on an entitlement relationship that the application knows and the engine does not. That is exactly the class in which this study's agent failed, and it is not a coincidence.

## 9.6 Threats to validity

Four threats qualify the results, and they are stated in order of severity rather than in the order that flatters the study.

*Circularity in the ground truth.* The manual column and the ground truth come from the same person, who also wrote the deterministic checks. The suite therefore cannot be treated as an independent confirmation of the manual findings. What limits the damage is that the three ground-truth findings are also confirmed by a third engine — the pipeline reached all three from its own analysis — and each is backed by a runtime observation that a reader can repeat. The circularity affects the independence of the confirmation, not the existence of the defects.

*One run per engine.* Each engine was run once, so no variance estimate is possible. Model outputs are stochastic, and a second agent run might have found more or less. The mitigation is that the agent's failure is structural rather than stochastic: it had no baseline to compare against, and a different sample of the same distribution would not have supplied one. The pipeline's failure, by contrast, was contingent — a provider revocation — and should not be read as a capability result.

*One target, one size.* A 2,880-line application with three planted defects is not a representative estate. The findings establish what happened here, under conditions that can be reproduced, and they do not license a general claim about relative capability. This is why Section 4 carries the burden of generality and Section 8 carries the burden of measurement; neither is sufficient alone.

*Instrumentation gaps.* The agent's wall-clock was not recorded, the manual effort was not metered, and no cost per finding was measured. Each gap weakens a specific claim — the speed comparison and the economic one — and none of them weakens the recall comparison, which rests on captured traffic.

A fifth threat is worth naming separately because it cuts the other way. The defects in the harness (Section 8.7) were found and fixed during the assessment, which means later runs benefited from repairs that earlier runs did not. The pipeline's run in particular was degraded by faults that no longer exist. Reporting that run as a measure of the pipeline's capability would understate it, and the report therefore treats it as an operational case study rather than as a capability measurement.

## 9.7 Implications for practice

Three implications follow for teams deploying these tools.

Build the oracle before the agent. The deterministic predicate is what converts generated traffic into findings, it is cheap to write, and it does not require a model. The suite in this study is 1,286 lines and twelve checks; it achieved complete recall on the defects it was written for. A team that instruments its application's expected behaviour first will get more from any engine it then points at the target.

Keep the human for the semantics. The questions this study's engines could not answer were not technical: is this record mine, does this lockout actually protect the account, is this containment adequate. Each requires knowing what the application is for. That knowledge is not in the traffic.

Instrument the run, not just the result. The most useful artefact produced by the AI agent was its trace, and the most damaging gap was the wall-clock it did not record. A comparison that cannot show what the engine did cannot explain what it missed.

# 10. Conclusion and Future Work

## 10.1 Summary of findings

This report set out to measure AI-driven penetration testing against manual and deterministic testing on a target with a known answer key, and then to reconcile that measurement with the published evidence of AI testing in production.

Five weaknesses were confirmed in the target: a broken object-level authorisation flaw disclosing twelve students' tuition records, an account lockout whose counter resets at its own threshold, a SQL injection in a contained teaching endpoint, and two low-severity configuration weaknesses. Each was reproduced with live requests and explained at source level, and the seven controls that held were tested rather than assumed.

Against those three ground-truth defects, the deterministic suite reported three of three with no false positives in 63 seconds, and manual review agreed. The single LLM agent issued five requests, received three unauthorised records, and reported nothing. The multi-agent pipeline analysed all three defects and produced no consolidated report, its run ending after 42 minutes when the model provider revoked access.

Five faults in the test harness accounted for most of the observed engine failures, including two that made authentication impossible for non-browser clients and one that silently deployed a truncated source file.

## 10.2 Answers to the research questions

*RQ1, on relative performance.* On this target, manual and deterministic testing outperformed both AI engines on recall, and the AI engines could not be scored on precision because they reported nothing. The comparison is not a general verdict on capability: it is a measurement of what happened when neither AI engine had a validator.

*RQ2, on reconciling the evidence.* The laboratory result and the production results differ by the presence of three things: a harness that converts observations into verdicts, a validation loop that suppresses false positives, and scale. Every deployment in the industry evidence has the first two. This study's agent had neither, and its failure is explained by their absence rather than by any deficiency in the model's reasoning.

*RQ3, on the conditions for value.* AI testing adds value where the surface is too large or the cadence too frequent for humans, where the weakness class admits a deterministic oracle, and where a human or a harness is available to adjudicate. It adds least where the oracle is hardest to build, and authorisation is the clearest instance of that.

The overall conclusion is that the useful question is not whether AI can perform penetration testing, because the industry evidence answers that affirmatively and specifically. The useful question is what has to surround an AI system before its output can be acted upon. On the evidence of this study the answer is a deterministic predicate, a preserved trace, and a human who knows what the application is for.

## 10.3 Future work

Four extensions would strengthen the result.

Repeat the agent run across several models and several seeds, and report the distribution rather than a single outcome. The structural explanation offered in Section 9.1 predicts that adding a baseline-fetching instruction would change the outcome more than changing the model, and that prediction is testable.

Give the agent the oracle. A second agent configuration in which check 6's predicate is exposed as a tool would separate the effect of the harness from the effect of the model, which is the study's central claim and is currently supported by inference rather than by experiment.

Complete the pipeline run with a stable provider key. The pipeline's analysis reached every defect; whether its reporting phase would have produced a usable report is unknown and would be worth knowing, particularly because the blocking fault was in the infrastructure rather than in the engine.

Extend the target to a weakness class with a harder oracle and one with an easier one — for example a business-logic flaw and a memory-safety defect in a native component — to test whether the oracle explanation predicts the pattern across classes. If it does, the framework in Section 3.4 becomes a predictive tool rather than a description.

# References

Barth, A. (2011) *HTTP State Management Mechanism*. RFC 6265. Internet Engineering Task Force.

Biryukov, A., Dinu, D., Khovratovich, D. and Josefsson, S. (2021) *The Argon2 Memory-Hard Function for Password Hashing*. RFC 9106. Internet Engineering Task Force.

DARPA (2025) 'AI Cyber Challenge marks pivotal inflection point for cyber defense'. Available at: https://www.darpa.mil/news/2025/aixcc-results (Accessed: 24 November 2026).

Deng, G., Liu, Y., Mayoral-Vilches, V., Liu, P., Li, Y., Xu, Y., Zhang, T., Liu, Y., Pinzger, M. and Rass, S. (2024) 'PentestGPT: evaluating and harnessing large language models for automated penetration testing', *Proceedings of the 33rd USENIX Security Symposium*.

FIRST (2019) *Common Vulnerability Scoring System v3.1: Specification Document*. Forum of Incident Response and Security Teams. Available at: https://www.first.org/cvss/v3-1/specification-document (Accessed: 24 November 2026).

Google Project Zero (2024) 'From Naptime to Big Sleep: using large language models to catch vulnerabilities in real-world code'. Available at: https://projectzero.google/2024/10/from-naptime-to-big-sleep.html (Accessed: 24 November 2026).

Grassi, P.A., Garcia, M.E. and Fenton, J.L. (2017) *Digital Identity Guidelines: Authentication and Lifecycle Management*. NIST Special Publication 800-63B. Gaithersburg, MD: National Institute of Standards and Technology.

Halfond, W.G.J., Viegas, J. and Orso, A. (2006) 'A classification of SQL-injection attacks and countermeasures', *Proceedings of the IEEE International Symposium on Secure Software Engineering*.

Happe, A. and Cito, J. (2023) 'Getting pwn'd by AI: penetration testing with large language models', *Proceedings of the 31st ACM Joint European Software Engineering Conference and Symposium on the Foundations of Software Engineering*.

Hodges, J., Jackson, C. and Barth, A. (2012) *HTTP Strict Transport Security*. RFC 6797. Internet Engineering Task Force.

Lin, J.W., Jones, E.K., Jasper, D.J., Ho, E.J., Wu, A., Yang, A.T., Perry, N., Zou, A., Fredrikson, M., Kolter, J.Z., Liang, P., Boneh, D. and Ho, D.E. (2026) 'Comparing AI agents to cybersecurity professionals in real-world penetration testing', *Proceedings of the International Conference on Learning Representations (ICLR 2026)*. Preprint: *arXiv* arXiv:2512.09882.

M'Raihi, D., Machani, S., Pei, M. and Rydell, J. (2011) *TOTP: Time-Based One-Time Password Algorithm*. RFC 6238. Internet Engineering Task Force.

Microsoft Security (2026) 'Defense at AI speed: Microsoft's new multi-model agentic security system tops leading industry benchmark'. Available at: https://www.microsoft.com/en-us/security/blog/ (Accessed: 24 November 2026).

MITRE (2026) *CWE-639: Authorization Bypass Through User-Controlled Key*; *CWE-307: Improper Restriction of Excessive Authentication Attempts*; *CWE-89: Improper Neutralization of Special Elements used in an SQL Command*. Available at: https://cwe.mitre.org/ (Accessed: 24 November 2026).

Omdia (2026) *The 2026 State of Agentic AI in Pentesting*. Commissioned by Synack. Survey of 200 US security leaders, fielded 11–22 December 2025.

OpenAI (2025) 'Introducing Aardvark: OpenAI's agentic security researcher'. Available at: https://openai.com/ (Accessed: 24 November 2026).

OpenAI (2026) 'A five-stage pipeline for finding privilege-escalation vulnerabilities in the Linux kernel'. Available at: https://openai.com/ (Accessed: 24 November 2026).

OWASP Foundation (2021) *OWASP Top 10:2021*. Available at: https://owasp.org/Top10/ (Accessed: 24 November 2026).

OWASP Foundation (2023) *OWASP API Security Top 10:2023*. Available at: https://owasp.org/API-Security/ (Accessed: 24 November 2026).

Pinkas, B. and Sander, T. (2002) 'Securing passwords against dictionary attacks', *Proceedings of the 9th ACM Conference on Computer and Communications Security*, pp. 161–170.

PTES (2014) *Penetration Testing Execution Standard*. Available at: http://www.pentest-standard.org/ (Accessed: 24 November 2026).

Scarfone, K., Souppaya, M., Cody, A. and Orebaugh, A. (2008) *Technical Guide to Information Security Testing and Assessment*. NIST Special Publication 800-115. Gaithersburg, MD: National Institute of Standards and Technology.

Semgrep (2025) 'Finding vulnerabilities in modern web apps using Claude Code and OpenAI Codex'. Available at: https://semgrep.dev/blog/ (Accessed: 24 November 2026).

Stanford, A., Chong, S., Peng, K. and Gornet, C. (2024) *Cybench: A Framework for Evaluating Cybersecurity Capabilities and Risks of Language Models*. *arXiv* arXiv:2408.08926.

XBOW (2025) 'The road to top 1: how XBOW did it'. Available at: https://xbow.com/blog/top-1-how-xbow-did-it (Accessed: 24 November 2026).

XBOW (2026) 'XBOW now matches the capabilities of a top human pentester'. Available at: https://xbow.com/blog/xbow-vs-humans (Accessed: 24 November 2026).

# Appendix A: Source Map

The findings in Section 7 are located in the following files and line ranges. Line numbers refer to the deployed build, whose byte length is verified at deployment.

::: table Table A1. Finding-to-source map.
| Finding | File | Lines | Function |
| F-01 | `server.js` | 1449–1472 | `GET /api/bank/tuition/student/:studentId` |
| F-02 | `server.js` | 624–646 | Failed-authentication handler |
| F-03 | `server.js` | 1700–1732 | `POST /api/lab/exploit/sqli` |
| F-04 | `server.js` | middleware chain, 190–260 | No `http` redirect middleware |
| F-05 | `server.js` | `/api/auth` prefix | Cache headers added post-assessment |

# Appendix B: AI Tooling Inventory

Table B1 records the tools used and the outcome of each, including the runs that failed. Cost is reported as not metered rather than estimated: the model was accessed through a provider key, no per-token billing was captured, and any figure would be a guess presented as a measurement.

::: table Table B1. AI tooling inventory and outcomes.
| Tool | Role | Outcome |
| Single LLM agent (`tools/ai-agent.mjs`) | Autonomous black-box testing with three tools | Complete: 5 requests, 0 reported, 1 detected |
| Shannon 3.6.1 | Multi-agent pipeline: recon, per-class analysis, exploitation, reporting | Aborted at ~42 min: provider revoked the key during the run |
| Supporting proxy | Concurrency cap, retry with backoff, upstream status logging | Instrumentation only; exposed the 401/403 pattern that identified D-1 |

# Appendix C: Reproduction

The following commands reproduce the assessment. They assume the deployment described in Section 6.1 and are run from the project root.

```bash Listing C1. Health check, deterministic suite, and a single agent run.
# 1. Confirm the deployment is serving the expected build
docker exec sim-app sh -c "wc -c /app/server.js && node --check /app/server.js"
curl -s -o /dev/null -w '%{http_code}\n' https://shekin.tail97139a.ts.net/

# 2. Run the twelve deterministic checks (~1 min); writes the report and findings.json
PENTEST_OUT_DIR=/tmp/suite-run node tools/pentest-suite.mjs

# 3. Run the single agent; the key comes from the environment, never the repository
OPENAI_BASE_URL=... OPENAI_API_KEY=... node tools/ai-agent.mjs
```

```bash Listing C2. Direct confirmation of F-01 with an MFA-verified bank session.
curl -s -H "Cookie: sim.sid=<bank session>" \
  "https://shekin.tail97139a.ts.net/api/bank/tuition/student/AC00000036"
# Expected on the vulnerable build: 200 with a name and balance that are not the caller's
```

The negative control matters as much as the positive test: run the same request against the Acadia enrolment endpoint with the same identifier and confirm that only the caller's own enrolments are returned.

# Appendix D: Evidence Inventory

::: table Table D1. Evidence artefacts and what each supports.
| Artefact | Contents | Supports |
| `PENTEST-REPORT.md` | Twelve checks, each with request and response | Section 8.2 |
| `findings.json` | Machine-readable verdicts for the same run | Section 8.2 |
| `AI-AGENT-REPORT.md` | Full tool-call trace and both counts | Section 8.4 |
| Pipeline phase deliverables | Analysis per weakness class; exploitation queues | Section 8.5 |
| Pipeline error log | Timestamped provider errors; rate-limit blocks | Sections 8.5, 8.7 |
| Nmap output | Four ports: 80 open, 443 closed, 3000 closed, 5432 open | Section 6.1 |
| Nikto output | 7,970 requests, 0 errors, 3 configuration observations | Section 3.2 |

# Appendix E: Glossary

::: table Table E1. Terms used in this report.
| Term | Meaning in this report |
| Oracle | A deterministic predicate that converts an observation into a verdict |
| Ground truth | A defect confirmed twice: by runtime observation and by source or a second engine |
| Two-count measurement | Separating findings a model asserts from findings its traffic proves it saw |
| Claimed / detected | The two counts: asserted in the final message / provable from responses received |
| Harness | The infrastructure around an engine: authentication, proxy, instrumentation, triage |
| BOLA | Broken object-level authorisation: a caller naming an object it does not own |
| MFA-verified session | A session that has completed password and TOTP authentication |
| Inconclusive | A check that could not reach a verdict; never counted as a pass |
| Deterministic suite | Twelve scripted checks with captured traffic per verdict |
| Precision | True positives divided by all reported findings; undefined when nothing is reported |
