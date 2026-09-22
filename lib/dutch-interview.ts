import type { DutchCategory, DutchQuestion } from "@/types/interview";

/* ─────────────────────────────────────────────────────────
   Dutch Public-Sector Interview — Question Bank & Briefing
   ───────────────────────────────────────────────────────── */

export const DUTCH_CATEGORY_LABELS: Record<DutchCategory, string> = {
  technical:       "Technical (Db2 LUW)",
  behavioural:     "Behavioural (STAR)",
  personal:        "Personal & challenging",
  "public-sector": "Public sector",
  culture:         "Dutch work culture",
};

export const DUTCH_QUESTIONS: DutchQuestion[] = [
  /* ═══════════════ TECHNICAL ═══════════════ */
  {
    id: "nl-t-slow-query",
    category: "technical",
    question: "A user reports that a query that used to take 2 seconds now takes 2 minutes. Walk us through your approach, step by step.",
    whyAsked: "They want to see a structured method, not a list of tools. Dutch panels value how you think more than name-dropping.",
    approach: [
      "Scope: one query or everything? Since when? What changed (release, data volume, statistics, upgrade)?",
      "Locate it: MON_GET_PKG_CACHE_STMT / MON_GET_ACTIVITY and the time-spent breakdown (CPU vs lock wait vs I/O).",
      "If CPU/I/O: EXPLAIN (EXPLAIN_FROM_SECTION for the real plan), compare estimated vs actual cardinalities, check statistics.",
      "If lock wait: find the holder (MON_GET_APPL_LOCKWAIT, db2pd -wlocks).",
      "Fix at the right level: statistics → index → rewrite → optimization profile as a temporary measure.",
      "Verify with the same metrics and communicate back to the user.",
    ],
    modelAnswer:
      "First I establish the facts: is it this one query or is the whole system slower, and what changed around the time it started, such as a release, a data load or an upgrade. Then I look at where the time goes. MON_GET_PKG_CACHE_STMT tells me whether it is CPU, I/O or lock waiting. That decides the direction. If it's lock waiting, tuning the query won't help and I look for the blocking application. If it's CPU or I/O, I get the actual plan with EXPLAIN_FROM_SECTION and compare the estimates with the real row counts. In my experience a plan change is most often caused by statistics, for example correlated columns or a staging table that was reloaded. I fix the cause, verify with the same metrics, and report back to the user and in the ticket.",
    avoid: ["Starting with 'I would add an index'.", "Listing commands without a line of reasoning.", "Forgetting to communicate the result."],
    followUps: ["And if the plan is the same as last month?", "How do you get the actual plan of a statement that is running right now?"],
  },
  {
    id: "nl-t-dpf-key",
    category: "technical",
    question: "How do you choose a distribution key in a partitioned (DPF) database?",
    whyAsked: "DPF is in the job requirements, so this checks real design experience.",
    approach: [
      "Two goals: even distribution (avoid skew) and collocated joins for the most important/expensive joins.",
      "High cardinality, no dominant values, not frequently updated.",
      "Validate with DBPARTITIONNUM counts before committing.",
      "Small dimensions: replicate (replicated MQT) rather than distribute.",
      "Mention the trade-off and that you look at the real workload.",
    ],
    modelAnswer:
      "I weigh two things: an even spread of the data, and making the most important joins collocated. So I pick a column with high cardinality and no dominant values, preferably the join key of the largest joins, for example a person or case ID. I don't guess. I analyse which joins dominate the workload and test the distribution with DBPARTITIONNUM counts on a sample. Small dimension tables I usually replicate across partitions, so joins to them are always local. A low-cardinality key like a municipality code always causes skew, and adding partitions doesn't solve that.",
    avoid: ["Only saying 'the primary key'.", "Ignoring joins."],
    followUps: ["How would you change the key of an existing 20 TB table?", "What is a BTQ, and when is it acceptable?"],
  },
  {
    id: "nl-t-wlm",
    category: "technical",
    question: "How would you prevent ad-hoc reporting from affecting a critical OLTP application on the same database?",
    whyAsked: "WLM in practice: isolation, control, and the way you introduce it.",
    approach: [
      "Identify and separate work: workloads → service classes.",
      "Controls: CPU shares/limits (WLM dispatcher), concurrency thresholds, predictive (ESTIMATEDSQLCOST) and reactive (SQLTEMPSPACE, ACTIVITYTOTALTIME) thresholds.",
      "Introduce in monitoring mode first, calibrate, agree with the business, then enforce.",
      "Report per workload.",
    ],
    modelAnswer:
      "With Db2 workload management. First I make the work identifiable: I map the reporting tool and the OLTP application to their own workloads and service classes. Then I use controls: CPU shares so OLTP has priority, a concurrency threshold so only a few heavy reports run at the same time, and thresholds on temp space or execution time for runaway queries. I always start in monitoring mode for a couple of weeks to calibrate the values, and I agree the limits with the owners of the reporting, because stopping someone's query is a business decision. After that I report per workload, so we can show the OLTP SLA is protected.",
    avoid: ["Only 'buy more hardware'.", "Enforcing STOP EXECUTION on day one."],
  },
  {
    id: "nl-t-openshift",
    category: "technical",
    question: "What is your experience with Db2 on OpenShift, and what are the biggest differences from running it on VMs?",
    whyAsked: "They want to know how deep your container experience goes. Be honest about its depth and show understanding.",
    approach: [
      "Be honest and specific about what you have done hands-on vs studied.",
      "Differences: declarative config via the operator/CR, storage classes and access modes, probes, pod rescheduling, stable networking via Services, kernel parameters via KubeletConfig, resource limits/OOM.",
      "Operational: node maintenance and drains vs HADR, GitOps/change control.",
      "Show that the DBA fundamentals remain the same.",
    ],
    modelAnswer:
      "The Db2 engine is the same. What changes is how you operate it. With the operator, configuration is declarative in the custom resource, so I don't change things by hand inside a pod, because the operator reconciles them back and it isn't auditable. Storage is a conscious choice: RWX for shared metadata in MPP, low-latency block storage for data and logs. Pods can be rescheduled, so HADR must use stable Service names, and probes must allow for crash recovery time. Node maintenance needs to be coordinated with HADR. You switch roles gracefully before a drain. My hands-on container experience is [be precise here]. The DBA fundamentals, like performance, recovery and HADR, carry over fully.",
    avoid: ["Overstating hands-on experience; they will probe.", "Saying 'Kubernetes is just like VMs'."],
    followUps: ["What happens when a Db2 pod is evicted during crash recovery?", "How do you set kernel IPC parameters on OpenShift?"],
  },
  {
    id: "nl-t-hadr",
    category: "technical",
    question: "Explain the HADR synchronisation modes and which one you would advise for two data centres about 70 km apart.",
    whyAsked: "It checks precision (commit points) and whether you treat RPO as a business decision.",
    approach: [
      "SYNC: log on disk at the standby. NEARSYNC: in standby memory. ASYNC: handed to the network layer. SUPERASYNC: never waits.",
      "Latency = RTT (+ standby disk write for SYNC).",
      "Advice: usually NEARSYNC at 70 km. SYNC if RPO = 0 must hold for a simultaneous two-site failure.",
      "It's a business/CISO decision on RPO. Peer window is part of it.",
    ],
    modelAnswer:
      "In SYNC, the commit only returns once the log is written to disk on the standby as well. In NEARSYNC, once it's in the standby's memory. In ASYNC, once it's handed to the network. SUPERASYNC never waits. At 70 km the round-trip is around a millisecond, so SYNC adds RTT plus the standby's disk write to every commit. I would normally advise NEARSYNC: you only lose data if both sites fail at the same moment. But the RPO is not my decision. I present the trade-off to the business owner and the security officer, and document it, including the peer-window behaviour when the standby is unavailable.",
    avoid: ["Getting the commit points wrong.", "Deciding RPO yourself."],
  },
  {
    id: "nl-t-memory",
    category: "technical",
    question: "How does Db2 memory management work, and when would you not rely on STMM?",
    whyAsked: "Memory tuning is explicitly in the requirements.",
    approach: [
      "Hierarchy: INSTANCE_MEMORY → DATABASE_MEMORY → consumers (buffer pools, sort, locklist, package cache).",
      "STMM trades between AUTOMATIC consumers. It needs at least 2 and requires SHEAPTHRES = 0 for sort.",
      "Don't rely on it blindly: multiple instances per host (AUTOMATIC INSTANCE_MEMORY assumes exclusivity), very spiky workloads, DPF with heterogeneous partitions, containers (cgroup limits).",
      "Monitoring: db2pd -dbptnmem, MON_GET_MEMORY_POOL/SET.",
    ],
    modelAnswer:
      "Db2 has an instance limit, then database shared memory, and within that the consumers: buffer pools, sort memory, the lock list and the package cache. STMM moves memory between the consumers that are set to AUTOMATIC, based on benefit. I use it by default, but within fixed boundaries. For example, with multiple instances on one host, AUTOMATIC INSTANCE_MEMORY lets each instance assume the whole machine, and I've seen that lead to the OOM killer. In containers I set INSTANCE_MEMORY explicitly below the pod limit. In DPF, STMM propagates from one tuning partition, which doesn't work well if partitions differ. And for sort, it only tunes when SHEAPTHRES at instance level is zero.",
    avoid: ["'STMM does everything'.", "'I always disable STMM.'"],
  },
  {
    id: "nl-t-diag",
    category: "technical",
    question: "The instance hangs. What do you do in the first ten minutes?",
    whyAsked: "Incident behaviour under pressure: balancing restoring the service against finding the root cause.",
    approach: [
      "Inform the incident manager and agree on a time box.",
      "Collect: db2fodc -hang (or db2pd -stack all, -edus, -latches, -wlocks several times), db2diag.log, OS stats.",
      "Assess: HADR takeover as a service-restoration option.",
      "Restart per procedure, open an IBM case with db2support, and do the problem analysis afterwards.",
    ],
    modelAnswer:
      "I let the incident manager know right away and agree on a short time box, for example five minutes, for collecting diagnostics. Without data from the hang itself, we'll never find the cause and it will happen again. I run db2fodc -hang, or at least a few db2pd stack and latch snapshots, and save the db2diag log and OS stats. At the same time I check whether a HADR takeover is the quicker path to restore service. Then we restore service according to the procedure, and afterwards I open a case with IBM with the db2support output and drive the root-cause analysis in problem management.",
    avoid: ["'I restart immediately' with no data collection.", "Spending 45 minutes on analysis while citizens can't reach the service."],
  },
  {
    id: "nl-t-automation",
    category: "technical",
    question: "What have you automated in the Db2 lifecycle, and how do you make automation safe?",
    whyAsked: "Shell, Python and Ansible are requirements. They also want to hear 'safe' in a government sense.",
    approach: [
      "Concrete examples from your career: install/fix packs, backups and verification, RUNSTATS/REORG, health checks, user provisioning.",
      "Safety: idempotency, pre/post checks, correct CLP return codes, serial HADR order, dry runs, DTAP promotion.",
      "Security: no plaintext secrets (Vault), logging/audit, RBAC in AWX.",
      "Change management integration.",
    ],
    modelAnswer:
      "[Use your own examples, e.g.: I automated fix pack rollouts, backup verification and daily health checks with shell and Python, and later Ansible.] Safe automation is predictable automation for me. Every step has a pre-check and a post-check, tasks are idempotent, and I handle the Db2 CLP return codes correctly: 1 means 'no rows', not an error. For HADR pairs the playbook determines the roles at runtime and always patches the standby first. Secrets live in Ansible Vault or the enterprise vault, and every run is logged. And automation goes through DTAP and change management just like any manual change. Automated doesn't mean unapproved.",
    avoid: ["Vague claims without examples.", "Automation that bypasses change control."],
  },
  {
    id: "nl-t-versions",
    category: "technical",
    question: "You need to upgrade a 10.5 environment to 12.1. How do you plan it?",
    whyAsked: "Version range 10.5–12.1 is in the requirements. Planning and risk management.",
    approach: [
      "Path: 10.5 → 11.5 → 12.1 (12.1 does not upgrade directly from 10.5).",
      "Inventory: deprecated features, application/driver compatibility, OS support.",
      "Baselines of critical SQL plans and timings before each hop.",
      "db2ckupgrade, backups, fallback plan, rehearsal in ACC with production-like data.",
      "HADR: outage required for a version upgrade. The standby doesn't need to be re-initialised if you follow the procedure.",
      "After: RUNSTATS/rebind, plan comparison, monitoring.",
    ],
    modelAnswer:
      "It's a two-step path: first to 11.5, then to 12.1, because 12.1 doesn't support a direct upgrade from 10.5. For each hop I start with an inventory: deprecated functionality, client drivers, the operating system. Before each upgrade I capture baselines of the critical queries, meaning the plans and timings, so I can prove regressions afterwards instead of arguing about them. I rehearse fully in acceptance with production-like data, including the fallback. A major version upgrade with HADR needs an outage, but you don't have to rebuild the standby. After the upgrade: statistics, rebind, compare plans, and increased monitoring during the first batch cycles.",
    avoid: ["Proposing a direct 10.5 → 12.1 upgrade.", "No fallback plan."],
  },
  {
    id: "nl-t-explain",
    category: "technical",
    question: "What do you look at first when you read an EXPLAIN plan?",
    whyAsked: "They want an expert's reading order, not a textbook one.",
    approach: [
      "Estimated cardinalities vs reality (section actuals), because the biggest errors drive the bad choices.",
      "Join methods and their inputs: NLJOIN with an expensive inner, HSJOIN build side, table queues in DPF.",
      "Access paths: TBSCAN on large tables, residual predicates at FETCH, sargability.",
      "Sorts/spills, CTQ placement for BLU.",
      "Total cost is only relative.",
    ],
    modelAnswer:
      "At the cardinalities: where does the optimizer's estimate differ most from reality? With section actuals I can see that per operator. A wrong estimate at the bottom of the plan leads to wrong choices higher up, like a nested loop join with a table scan as the inner, or a hash join building on the wrong side. Then I look at the access paths: predicates that are only applied at FETCH instead of in the index, non-sargable expressions, and in DPF the table queues, especially broadcasts of large tables. I don't give much weight to the total cost in timerons. It's a relative unit.",
    avoid: ["'I look at the total cost first'."],
  },

  /* ═══════════════ BEHAVIOURAL (STAR) ═══════════════ */
  {
    id: "nl-b-major-incident",
    category: "behavioural",
    question: "Tell us about a major production incident you handled. What was your role, and what did you learn?",
    whyAsked: "Classic competency question: calm under pressure, ownership, learning.",
    approach: [
      "STAR: Situation (short), Task, Action (most detail, 'I', not 'we'), Result (measurable).",
      "Include communication with the incident manager/stakeholders.",
      "End with the structural improvement (problem management).",
      "Keep it to ~2 minutes; let them ask follow-ups.",
    ],
    modelAnswer:
      "[Prepare your own. Structure: 'At [organisation], a [system] with [scale] went down during [critical moment]. I was the on-call DBA. I first ..., then ..., I communicated every 15 minutes to ... We restored service in X minutes. Afterwards I led the root-cause analysis, found ..., and introduced ..., which prevented recurrence.']",
    avoid: ["'We did…' throughout: they are hiring you.", "Blaming colleagues or vendors.", "No lesson learned."],
    followUps: ["What would you do differently now?", "How did you keep management informed?"],
  },
  {
    id: "nl-b-disagree",
    category: "behavioural",
    question: "Describe a situation where you disagreed with an architect or manager on a technical decision.",
    whyAsked: "Dutch culture values directness with respect. They test whether you speak up, use facts, and can accept a decision.",
    approach: [
      "Show that you raised the concern early and factually (data, risk).",
      "Show that you listened to their reasons.",
      "Outcome: agreement, compromise, or you accepted the decision and documented the risk.",
      "No ego; the organisation's interest first.",
    ],
    modelAnswer:
      "[Example: An architect wanted to add partitions to solve slow queries. I thought the distribution key was the cause. I asked for time to make an analysis, showed the skew per partition and a test with a different key, and presented the costs of both options. We chose the redesign. If the decision had gone the other way, I would have supported it and documented the risk.]",
    avoid: ["Stories where you 'won' by being stubborn.", "Stories where you stayed silent."],
  },
  {
    id: "nl-b-stakeholders",
    category: "behavioural",
    question: "How do you explain a complex technical problem to a non-technical stakeholder?",
    whyAsked: "DBAs in the public sector talk with product owners, security officers and managers.",
    approach: ["Start with the impact (citizens, deadline, risk).", "Then options with pros and cons, and your advice.", "Avoid jargon; one clear metaphor at most.", "Confirm understanding and next steps."],
    modelAnswer:
      "I start with what it means for them: which service is affected, for whom, and how urgent it is. Then I give two or three options, each with its effect, risk and cost, and I say clearly which one I advise and why. The technical detail I keep available for when they ask. At the end I check whether it's clear and agree who decides what, and by when.",
    avoid: ["Starting with technical detail."],
  },
  {
    id: "nl-b-mistake",
    category: "behavioural",
    question: "Tell us about a mistake you made in production.",
    whyAsked: "Integrity and openness. In Dutch government culture, openly owning a mistake is valued. Covering it up is a red flag.",
    approach: ["Choose a real but contained mistake.", "Own it immediately; what you did to limit the impact.", "What you changed in your way of working (checklists, 4-eyes, automation)."],
    modelAnswer:
      "[Example structure: 'I once ran a change on the wrong environment / forgot X. I noticed it within minutes, reported it immediately to my lead and the incident manager, and restored it. After that I introduced a check in my scripts that shows the instance and database and asks for confirmation on production, and we introduced a four-eyes principle for production changes.']",
    avoid: ["'I don't make mistakes.'", "A catastrophic mistake without learning.", "Blaming others."],
  },
  {
    id: "nl-b-pressure",
    category: "behavioural",
    question: "How do you prioritise when several urgent requests come in at the same time?",
    whyAsked: "Workload management of yourself, and transparency.",
    approach: ["Impact and urgency (ITIL priority matrix).", "Make trade-offs transparent; let the lead/business decide on conflicts.", "Communicate expected times."],
    modelAnswer:
      "I look at impact and urgency: a production outage for citizens goes before an acceptance request. If two things really compete, I don't decide on my own. I make the choice visible to my team lead or the product owner. And I communicate to everyone waiting when they can expect something, so nobody has to chase me.",
    avoid: ["'I just work harder / longer.'"],
  },
  {
    id: "nl-b-knowledge",
    category: "behavioural",
    question: "How do you share knowledge with colleagues and make yourself replaceable?",
    whyAsked: "Government organisations fear single points of knowledge ('kennisborging').",
    approach: ["Runbooks, documentation in the team wiki, automation as documentation.", "Pairing, knowledge sessions.", "Show it's a value for you, not a threat."],
    modelAnswer:
      "I think a good DBA should be replaceable. I write runbooks for recurring incidents, keep scripts and playbooks in Git with an explanation, and I prefer to do complicated changes together with a colleague. When I solve something new, I give a short knowledge session. That makes the team stronger, and it means I can go on holiday.",
  },
  {
    id: "nl-b-learning",
    category: "behavioural",
    question: "How do you keep your knowledge up to date?",
    whyAsked: "Especially relevant with a 10.5 → 12.1 range and containers.",
    approach: ["Concrete: IBM docs/what's new per release, labs (your own test environment, OpenShift Local/CRC), IDUG, community.", "Mention your recent structured refresh on 12.1, OpenShift and Ansible."],
    modelAnswer:
      "Structurally. For every release I go through the 'what's new' and deprecated features, and I test in my own lab. Recently I did a focused refresh on Db2 12.1, running Db2 on OpenShift, and Ansible automation. I also follow IDUG and the IBM community, and I learn a lot from post-incident reviews. Those are the most practical lessons.",
  },

  /* ═══════════════ PERSONAL & CHALLENGING ═══════════════ */
  {
    id: "nl-p-intro",
    category: "personal",
    question: "Tell us something about yourself.",
    whyAsked: "The opener. They judge structure, relevance and whether you can be concise.",
    approach: [
      "60–90 seconds. Present → past → why this role.",
      "14+ years Db2 LUW, enterprise scale, your strongest areas (performance, DPF, HADR).",
      "One or two concrete achievements with numbers.",
      "Why this role/organisation (public value, scale, technical depth).",
      "One personal line (a hobby) is fine in the Netherlands, but keep it short.",
    ],
    modelAnswer:
      "I'm a Db2 LUW DBA with more than fourteen years of experience in large enterprise environments. My strength is performance and tuning: analysing plans, statistics, memory, and making mixed workloads predictable with WLM. I've worked with DPF warehouses and HADR, from version 10.5 up to 12.1, and I automate a lot with shell, Python and Ansible. [One concrete achievement, e.g.: 'At X I reduced the batch window from 7 to 3 hours.'] What appeals to me about this role is the combination of technical depth, the move to OpenShift, and working on systems that citizens depend on every day.",
    avoid: ["Your life story from school onward.", "Starting with weaknesses or apologies.", "Longer than 2 minutes."],
  },
  {
    id: "nl-p-gap",
    category: "personal",
    question: "We see a gap in your CV. Can you tell us about that period?",
    whyAsked: "They want reassurance about reliability and current skills, not medical details.",
    approach: [
      "Short, calm, confident, forward-looking. Rehearse it until it's neutral.",
      "In the Netherlands you are NOT obliged to share health information, and an employer may not ask about your health during selection. You decide what you share.",
      "Honest but general: 'a period to deal with a personal matter, which is behind me'.",
      "Pivot to what you did to stay current and why you are ready now.",
      "Never lie about dates.",
    ],
    modelAnswer:
      "Yes. I deliberately took a period away from work for personal reasons. That's behind me now. In the last months I've done a structured refresh of my Db2 knowledge, focused on 12.1, performance tuning, Db2 on OpenShift and Ansible, in my own lab environment. I'm fully ready, and honestly, I'm looking forward to being back in a serious technical environment.",
    avoid: [
      "Over-explaining or apologising.",
      "Sharing medical detail you don't want to share (you don't have to).",
      "Inventing a job or freelance work that did not exist.",
    ],
    followUps: ["What exactly did you do to stay current? (Have 2–3 concrete things ready.)", "Are you sure you're ready for a demanding role?"],
  },
  {
    id: "nl-p-ready",
    category: "personal",
    question: "This is a demanding role with on-call duty and pressure. How do you handle stress?",
    whyAsked: "Resilience and self-knowledge. A mature answer shows you know your own methods.",
    approach: [
      "Show method: structure, runbooks and checklists reduce stress in incidents.",
      "Knowing your limits is professional: handing over, rest after a night incident.",
      "Concrete example of staying calm during an incident.",
      "Ask what the on-call rota looks like (shows seriousness).",
    ],
    modelAnswer:
      "Structure helps me most. During an incident I work from facts and a runbook, one step at a time, and I communicate at fixed intervals. That keeps me calm and keeps others calm too. I also think it's professional to know your limits: after a long night incident, you hand over and rest, because tired DBAs make mistakes on production. Can you tell me what the on-call rota looks like here?",
    avoid: ["'I never feel stress.'", "Oversharing personal history."],
  },
  {
    id: "nl-p-weakness",
    category: "personal",
    question: "What is your biggest weakness?",
    whyAsked: "Self-reflection. The Dutch often ask 'valkuil' (pitfall), a known Dutch concept from the 'kernkwadranten' model (Ofman).",
    approach: ["A real, work-relevant pitfall that's the flip side of a strength.", "What you do to manage it.", "Tip: 'kernkwaliteit → valkuil' framing is familiar to Dutch interviewers."],
    modelAnswer:
      "My strength is thoroughness. I want to understand the root cause. The pitfall is that I can go deeper into an analysis than the situation requires. During incidents, I manage that by agreeing on a time box and first restoring the service. The deeper analysis comes afterwards, in problem management. And I ask colleagues to point it out if they see me going too deep.",
    avoid: ["Fake weaknesses ('I'm a perfectionist' without substance).", "A weakness that disqualifies you for the role."],
  },
  {
    id: "nl-p-onsite",
    category: "personal",
    question: "This role requires 3 to 5 days on-site in Utrecht or Apeldoorn. Is that feasible for you?",
    whyAsked: "Hard requirement. Hesitation = rejection. Also tests whether you have thought about the practicalities.",
    approach: [
      "Clear 'yes', with evidence you've thought about it: commute plan, travel time, public transport/car.",
      "Show you see value in being on-site (team, incidents, knowledge transfer).",
      "Check facts before the interview: travel time to both locations, NS/OV options.",
    ],
    modelAnswer:
      "Yes, that's feasible. I've looked at the travel options for both locations [mention concrete plan: 'by train it's about X minutes to Utrecht / Y to Apeldoorn']. I also see the benefit: especially in the first months, being on-site is the fastest way to get to know the environment and the team, and during major changes or incidents it's valuable to sit together.",
    avoid: ["'Probably', 'we'll see', or immediately negotiating remote days."],
    followUps: ["Which location do you prefer?", "What if we need you on-site 5 days during a migration period?"],
  },
  {
    id: "nl-p-why-us",
    category: "personal",
    question: "Why do you want to work for the government / for us?",
    whyAsked: "Motivation and fit. Public-sector panels value 'maatschappelijke impact' (societal impact) and stability over money.",
    approach: ["Societal relevance: systems citizens depend on.", "Scale and technical depth: large Db2 estates, DPF, OpenShift modernisation.", "Long-term commitment and a careful, quality-focused culture.", "Research the organisation: mention something specific."],
    modelAnswer:
      "Three reasons. First, the impact: these are systems that millions of citizens depend on, so the quality of my work really matters. Second, the technical challenge: large Db2 environments, DPF and the modernisation to OpenShift is exactly where my experience adds value. And third, I value a culture where carefulness and reliability come before speed. [Add one specific fact about the organisation.]",
    avoid: ["'Job security' as the main reason.", "Generic answers that fit any employer."],
  },
  {
    id: "nl-p-salary",
    category: "personal",
    question: "What are your salary expectations? / What is your hourly rate?",
    whyAsked: "Public sector uses fixed pay scales (e.g. 'schaal' in the CAO Rijk). As a contractor you have a rate. A realistic answer shows you've done your homework.",
    approach: [
      "Employee: refer to the published scale for the vacancy and position yourself within it based on experience ('upper part of scale X').",
      "Contractor/ZZP: have a researched rate range; it's often fixed by the intermediary's framework contract.",
      "Be calm and factual; no apologising.",
    ],
    modelAnswer:
      "I've seen that the vacancy is in scale [X]. Given my fourteen years of Db2 experience, I'd expect to be in the upper part of that scale. I'm open to discussing the total package, including training budget and the secondary benefits.",
    avoid: ["Naming a number far outside the published scale.", "'Whatever you think is fair.'"],
  },
  {
    id: "nl-p-overqualified",
    category: "personal",
    question: "You have a lot of experience. Won't you get bored here, or clash with our current way of working?",
    whyAsked: "Fit and humility. They test whether you'll respect existing teams and processes.",
    approach: ["Every environment is new; you start by learning how things work here and why.", "Experience helps you add value within their processes.", "Mention collaboration and mentoring."],
    modelAnswer:
      "Every environment has its own history and reasons, so I start by listening and learning why things are done the way they are. Where I see improvements, I bring them in with arguments and through the normal processes, not by going my own way. And with experience comes the chance to help colleagues grow. I actually enjoy that.",
  },
  {
    id: "nl-p-why-leave",
    category: "personal",
    question: "Why did you leave your previous employer?",
    whyAsked: "Checks for conflicts or reliability issues.",
    approach: ["Short, neutral, positive. Never negative about a former employer.", "Pivot to what you are looking for now."],
    modelAnswer:
      "After many years there I wanted a new step. I'm now specifically looking for an environment with large-scale Db2, performance challenges and the move to containers, which is exactly what this role offers.",
    avoid: ["Criticising former managers or colleagues."],
  },

  /* ═══════════════ PUBLIC SECTOR ═══════════════ */
  {
    id: "nl-g-bio",
    category: "public-sector",
    question: "What does the BIO mean for your work as a DBA?",
    whyAsked: "The BIO (Baseline Informatiebeveiliging Overheid) is the mandatory security baseline for Dutch government, based on ISO 27001/27002. Knowing it signals public-sector readiness.",
    approach: [
      "Explain what it is in one sentence.",
      "Translate it into DBA practice: least privilege (no SYSADM for applications, separation of SECADM/DBADM roles), auditing (db2audit / audit policies), encryption at rest (native encryption) and in transit (TLS), patch management, logging and retention, backups tested and encrypted, change management, separation of DTAP environments.",
      "Mention risk-based approach and working with the security officer (CISO/ISO).",
    ],
    modelAnswer:
      "The BIO is the baseline for information security for the whole Dutch government, based on ISO 27001 and 27002. For me as a DBA it becomes very concrete: least privilege, meaning applications never get SYSADM or DBADM and I use roles and separation of duties with SECADM. I set up auditing with audit policies for privileged actions and access to sensitive tables. Data is encrypted at rest with native encryption and in transit with TLS. And I do timely patching, tested and encrypted backups, strict separation between DTAP environments, and all changes through change management. Where there's doubt, I coordinate with the security officer.",
    avoid: ["Not knowing what BIO is (look it up and be able to spell it out).", "Treating security as someone else's job."],
  },
  {
    id: "nl-g-avg",
    category: "public-sector",
    question: "How do you deal with personal data (AVG/GDPR) in test and acceptance environments?",
    whyAsked: "A frequent real problem: production copies with citizens' data (and possibly BSN numbers) in test. AVG = Dutch name for GDPR.",
    approach: [
      "Principle: no real personal data in DTA unless there is a legal basis and equivalent protection.",
      "Techniques: masking/pseudonymisation during refresh, synthetic data, subsetting.",
      "BSN (citizen service number) is specially protected; its use is restricted by law.",
      "Access control and logging; involve the privacy officer (FG / DPO).",
    ],
    modelAnswer:
      "The starting point is that real personal data doesn't belong in test and acceptance, unless there's a justified reason and the same protection as production. When we refresh test data, we mask or pseudonymise it, for example names, addresses and especially the BSN, which has extra legal protection. Or we use synthetic data or a subset. That process is automated, so no one is tempted to skip it. For exceptions, I coordinate with the privacy officer and security, and I document it.",
    avoid: ["'We just copy production to test.'"],
  },
  {
    id: "nl-g-screening",
    category: "public-sector",
    question: "This role requires a VOG and possibly a security screening. Is there anything we should know?",
    whyAsked: "VOG = Verklaring Omtrent het Gedrag (certificate of conduct). Some government roles require an AIVD/MIVD-style 'veiligheidsonderzoek' (A/B/C levels) for positions of trust ('vertrouwensfunctie').",
    approach: ["Calm 'no problem, I'll cooperate fully'.", "Know that screening can take weeks, which affects the start date.", "Be honest if anything could be relevant."],
    modelAnswer:
      "No, that's no problem. I'll cooperate fully with the VOG and a possible security screening. I understand that for a role with access to sensitive government data, that's a logical requirement. Do you know roughly how long the screening takes, so I can take that into account for my start date?",
  },
  {
    id: "nl-g-change",
    category: "public-sector",
    question: "How do you feel about strict change management (CAB, RFCs)? Doesn't it slow you down?",
    whyAsked: "Government IT often uses ITIL with Change Advisory Boards. They want someone who works within it without frustration.",
    approach: ["Positive: change management protects citizens' services and you.", "Show how you work efficiently within it: standard changes for recurring work, good RFCs with rollback, automation.", "Emergency change procedure for incidents."],
    modelAnswer:
      "I see change management as protection for the service, and for me as well. A good RFC with a clear impact analysis, test evidence and a rollback plan makes the change better. What I try to do is make it efficient: recurring, low-risk work like fix packs according to a proven playbook can often become a standard change. And for real emergencies there's the emergency change procedure. So I don't experience it as slowing me down, as long as we use it smartly.",
    avoid: ["Complaining about bureaucracy."],
  },
  {
    id: "nl-g-vendor",
    category: "public-sector",
    question: "How do you work with IBM support and external suppliers?",
    whyAsked: "Government relies on vendors and contracts. Independence and control ('regie') matter.",
    approach: ["Open cases with complete data (db2support, db2fodc) and a clear business impact/severity.", "Keep control: you remain responsible, and you validate vendor advice.", "Escalation paths and documentation."],
    modelAnswer:
      "With IBM I open a case with complete diagnostic data right away, db2support and FODC output, and a clear description of the business impact, so we don't lose days asking for data. I stay in control: I validate an advice in acceptance before we apply it, and if it takes too long, I escalate via the agreed channels. Everything is documented in the ticket, so the knowledge stays in the organisation.",
  },
  {
    id: "nl-g-integrity",
    category: "public-sector",
    question: "As a DBA you can see all data. How do you deal with that responsibility?",
    whyAsked: "Integrity ('integriteit') is a core value in Dutch government. There may be an oath or pledge ('eed of belofte') for some roles.",
    approach: ["Only access data when needed for your task, within an assignment/ticket.", "Support technical controls on yourself: auditing of DBA actions, separation of duties, no standing access to sensitive data where possible (e.g. SECADM controls, RCAC/row and column access control).", "Report misuse."],
    modelAnswer:
      "Having access doesn't mean I may look. I only view data when it's necessary for a specific task, and that's traceable in a ticket. I actually support technical measures that limit my own access, like auditing of privileged actions, separation of duties with a separate security administrator, and row and column access control on sensitive data. That protects citizens, and it protects me as a DBA as well.",
  },
  {
    id: "nl-g-cloud",
    category: "public-sector",
    question: "Why would a government organisation run Db2 on its own OpenShift platform instead of a public cloud?",
    whyAsked: "Tests understanding of data sovereignty and government IT policy.",
    approach: ["Data sovereignty / control over where sensitive data resides and which jurisdictions apply.", "Security classification of data (BIO, sensitive personal data, BSN).", "Standardisation and portability (hybrid cloud) with OpenShift.", "Avoid vendor lock-in; cost predictability."],
    modelAnswer:
      "Mainly because of control and data sovereignty: for sensitive citizen data you want to know exactly where it is and which laws apply to it. A private OpenShift platform gives you the benefits of containers, like standardisation, automation and faster provisioning, while the data stays in your own data centres. And because OpenShift is portable, you keep the option to move workloads later without rebuilding everything.",
  },

  /* ═══════════════ CULTURE ═══════════════ */
  {
    id: "nl-c-team",
    category: "culture",
    question: "What role do you usually take in a team?",
    whyAsked: "Dutch teams are flat and consensus-oriented ('poldermodel'). They want a team player who also takes responsibility.",
    approach: ["Specific: the technical anchor for DB2 performance, a sparring partner for developers.", "Collaboration over hierarchy; you share knowledge and ask for input.", "Example."],
    modelAnswer:
      "Usually I'm the technical anchor for the database side, the person developers and colleagues come to with performance questions. I like to be a sparring partner rather than a gatekeeper: I'd rather help a developer write a good query than reject it afterwards. At the same time I take ownership when things go wrong with the database.",
  },
  {
    id: "nl-c-direct",
    category: "culture",
    question: "Dutch colleagues can be very direct. How do you respond to direct feedback?",
    whyAsked: "Culture fit. Directness is normal and not meant personally.",
    approach: ["You appreciate clarity. It's efficient.", "You respond to content, not tone.", "You give feedback the same way: direct, respectful, factual."],
    modelAnswer:
      "I appreciate it. Directness is clear, and it saves time. I focus on the content: is the feedback correct, and what can I do with it? And I give feedback in the same way myself, direct but respectful, and based on facts.",
  },
  {
    id: "nl-c-agile",
    category: "culture",
    question: "Have you worked in Agile/Scrum or SAFe teams? How does a DBA fit in?",
    whyAsked: "Many Dutch government IT organisations work with Agile/SAFe (DevOps teams).",
    approach: ["Experience (honest).", "DBA value: early involvement (refinement) on data models and performance, automation in pipelines, shared responsibility.", "Balance between team speed and operational stability."],
    modelAnswer:
      "Yes [adapt]. I think a DBA adds most value early: in the refinement, when the data model and access patterns are decided, not after go-live. I like to put database changes in pipelines, with schema migrations under version control and automated checks. That way the team keeps its speed and we keep production stable.",
  },
  {
    id: "nl-c-questions",
    category: "culture",
    question: "Do you have any questions for us?",
    whyAsked: "Always asked at the end. 'No' signals low interest. Good questions show seriousness.",
    approach: ["Ask 3–4 prepared questions (see 'Questions to ask' in the Briefing tab).", "At least one about the technical landscape, one about the team, one about expectations for the first months.", "End by asking about next steps."],
    modelAnswer:
      "Yes, a few. What does the Db2 landscape look like now: how many instances, and which versions, run on OpenShift versus VMs? What are the biggest performance challenges at the moment? How is the team organised, and how does on-call work? What would you expect me to have achieved after three months? And what are the next steps in the procedure?",
  },
  {
    id: "nl-c-end",
    category: "culture",
    question: "How did you experience this conversation?",
    whyAsked: "A typical Dutch closing question. It checks reflection and enthusiasm.",
    approach: ["Positive and specific: what you liked.", "Confirm your motivation in one sentence."],
    modelAnswer:
      "Good, and I especially enjoyed the technical depth of the questions about performance and DPF. That's exactly the level I want to work at. It has confirmed my motivation for this role.",
  },
];

/* ─── Briefing ─────────────────────────────────────────── */

export interface BriefingSection {
  title: string;
  points: string[];
}

export const PUBLIC_SECTOR_BRIEFING: BriefingSection[] = [
  {
    title: "Key terms to know (and say correctly)",
    points: [
      "BIO — Baseline Informatiebeveiliging Overheid: mandatory security baseline for all Dutch government layers, based on ISO 27001/27002. Risk-based.",
      "AVG — Algemene verordening gegevensbescherming = GDPR. FG = Functionaris Gegevensbescherming (Data Protection Officer).",
      "BSN — Burgerservicenummer: citizen service number, specially protected; use restricted by law. Never in test data unmasked.",
      "VOG — Verklaring Omtrent het Gedrag: certificate of conduct, standard for government roles.",
      "Veiligheidsonderzoek — security screening for a 'vertrouwensfunctie' (position of trust), levels A/B/C; can take weeks.",
      "DTAP / OTAP — Development, Test, Acceptance, Production (Dutch: Ontwikkel, Test, Acceptatie, Productie). Dutch colleagues say 'OTAP'.",
      "CAB / RFC / wijzigingsbeheer — change management (ITIL). 'Standaard change' vs 'emergency change'.",
      "CISO / ISO / Security Officer — owner of information-security risk decisions.",
      "Schaal / CAO Rijk — civil service pay scales, published per vacancy.",
      "Regie — control/direction over suppliers; government wants to stay in control of its vendors.",
    ],
  },
  {
    title: "What a Dutch public-sector panel values",
    points: [
      "Carefulness ('zorgvuldigheid') over speed. Show you think about risk, rollback and evidence.",
      "Integrity: you only access data for a task, you support auditing of yourself.",
      "Directness with respect: say what you think, based on facts, then accept the decision.",
      "Team over hero: knowledge sharing, documentation, replaceability ('kennisborging').",
      "Honesty about what you don't know: 'I'm not certain; this is how I would find out…' is valued far more than bluffing.",
      "Societal motivation: systems citizens depend on.",
    ],
  },
  {
    title: "Interview format to expect",
    points: [
      "Often 2 rounds: (1) panel with team lead + senior DBA/architect + HR/recruiter, (2) technical deep-dive or case, sometimes an assessment.",
      "Competency-based questions (STAR) are standard in government selection.",
      "Technical round may include a whiteboard design (WLM, HADR, DPF) or an EXPLAIN / SQL to analyse.",
      "The interview is in English, but expect Dutch public-sector terms (BIO, AVG, OTAP, VOG, CAB). Use them correctly.",
      "Punctuality: arrive 10 minutes early. Security desk / visitor registration at government buildings takes time. Bring ID.",
      "Dress: neat, business casual. Suits are usually not needed in Dutch IT, but look tidy.",
    ],
  },
  {
    title: "Your personal framing (prepare out loud)",
    points: [
      "60–90 s introduction: 14+ years Db2 LUW, performance & tuning specialist, DPF, HADR, WLM, 10.5→12.1, automation. One quantified achievement.",
      "CV gap: one calm, rehearsed sentence + what you did to stay current + 'ready and motivated'. You are not required to share health information; Dutch employers may not ask about your health during selection.",
      "OpenShift: be precise about hands-on vs studied/lab experience. Precision earns trust; overclaiming loses it.",
      "On-site 3–5 days: a clear 'yes' with a concrete travel plan for Utrecht and Apeldoorn.",
      "Have 3 STAR stories ready: major incident, performance win, disagreement/conflict. Each maps to several questions.",
    ],
  },
  {
    title: "Autism-friendly preparation (practical)",
    points: [
      "Ask the recruiter in advance for the format, the panel names and the duration. This is a normal question in the Netherlands.",
      "It is acceptable to say 'Let me think about that for a moment' before answering. Pausing reads as careful, not weak.",
      "If a question is ambiguous, ask a clarifying question. Dutch panels see this as precision.",
      "Visit or map the route to the location beforehand, including building entrance and security.",
      "Bring a single printed page with your STAR stories and questions; glancing at notes is acceptable.",
      "Disclosure of autism is your choice. If you want an adjustment (e.g. questions in writing, a quieter room), you can ask for it; you don't need to explain more than you want.",
    ],
  },
];

export const QUESTIONS_TO_ASK: string[] = [
  "What does the Db2 landscape look like: number of instances, versions, and how much already runs on OpenShift?",
  "What are the biggest performance challenges right now?",
  "Is DPF used for a warehouse, and what are its plans (e.g. Db2 Warehouse, 12.1)?",
  "How is the DBA team organised, and how does on-call work?",
  "How mature is automation today: Ansible, pipelines, GitOps?",
  "What would you expect me to have achieved after three months?",
  "How is the split between the Utrecht and Apeldoorn locations organised?",
  "What are the next steps in the procedure, and what is the timeline including screening?",
];
