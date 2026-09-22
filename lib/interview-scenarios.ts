import type { ProblemScenario } from "@/types/interview";

/* ─────────────────────────────────────────────────────────
   Interview Readiness — Problem Scenarios
   Reason first, write your proposal, then reveal.
   ───────────────────────────────────────────────────────── */

export const PROBLEM_SCENARIOS: ProblemScenario[] = [
  /* ───────────────────────── 1 ───────────────────────── */
  {
    id: "sc-upgrade-regression",
    title: "Month-end batch regression after upgrade to 12.1",
    domain: "tuning",
    difficulty: 5,
    environment: "Db2 11.5.9 → 12.1, single partition, 6 TB, benefits-payment system, HADR NEARSYNC",
    context:
      "Last weekend the benefits-payment database was upgraded from 11.5.9 to 12.1 by another team. Tonight the month-end payment batch must finish before 06:00, because payments to citizens depend on it. At 02:10 the batch is 70% slower than last month. The step 'CALC_ENTITLEMENTS' has been running 95 minutes (normally 25). The incident manager asks you: what is happening, what do you do NOW, and what do you do AFTER?",
    evidence: [
      {
        title: "MON_GET_ACTIVITY (the long-running statement)",
        content: `APPLICATION_HANDLE   : 48213
ACTIVITY_STATE       : EXECUTING
ELAPSED (min)        : 95
ROWS_READ            : 18 440 112 903
ROWS_RETURNED        : 1 204 551
TOTAL_CPU_TIME (µs)  : 5 412 000 000
POOL_DATA_L_READS    : 912 004 118
LOCK_WAIT_TIME (ms)  : 0
TOTAL_SORTS          : 2
SORT_OVERFLOWS       : 0`,
      },
      {
        title: "Upgrade log (from the other team)",
        content: `- db2ckupgrade OK
- UPGRADE DATABASE PAYDB -- OK
- db2rbind PAYDB -l rbind.log all  -- OK
- RUNSTATS: "not required, statistics were kept"
- Explain baseline before upgrade: not captured`,
      },
      {
        title: "Current plan fragment (EXPLAIN_FROM_SECTION)",
        content: `            1.2e+06
            NLJOIN
            (  7)
        /------+-------\\
    1.2e+06           1
    TBSCAN          FETCH
    (  8)           (  9)
      |            /---+---\\
   1.2e+06       1       3.1e+08
  TABLE: PAY   IXSCAN   TABLE: PAY
  ENTITLE_TMP  ( 10)    PAYMENT_LINE
                 |
               3.1e+08
  INDEX: PAY.IX_PL_PERSON (PERSON_ID)   -- predicate on PERIOD applied at FETCH`,
      },
    ],
    tasks: [
      "What is your diagnosis, based ONLY on the evidence? What does ROWS_READ vs ROWS_RETURNED tell you?",
      "What do you do in the next 30 minutes to protect the 06:00 deadline? Name the risks of each option.",
      "What is the structural follow-up (after the incident), and what goes wrong in this upgrade process?",
    ],
    hints: [
      "Rows read per row returned is ~15 000. Where would that many reads come from in a NLJOIN whose inner returns 1 row?",
      "Look at the index used for the inner and at where the PERIOD predicate is applied. Is there a better index on PAYMENT_LINE (e.g. PERSON_ID, PERIOD)? Did the plan pick it before?",
      "ENTITLE_TMP is a staging table filled by the batch itself. What do its statistics say at compile time?",
    ],
    solution: {
      analysis:
        "No lock waits and no sort spills. The statement is CPU- and logical-read-bound (912M logical reads, ~15 000 rows read per row returned). The inner FETCH uses IX_PL_PERSON (PERSON_ID only) and applies the PERIOD predicate as a residual on the data page, so for every outer person it reads all historic payment lines of that person across all periods. A plan using a (PERSON_ID, PERIOD) index, or an HSJOIN with PERIOD pushed down, was probably used on 11.5. Contributing factors: (1) the 12.1 optimizer re-costed the plan after db2rbind. (2) ENTITLE_TMP is a batch-staging table whose catalog statistics are stale or unrepresentative. (3) There was no baseline, so we cannot prove the old plan. The upgrade team's 'statistics were kept' is true but irrelevant: statistics on volatile staging tables were never representative, and the new optimizer weighs them differently.",
      actions: [
        "Communicate first: tell the incident manager the diagnosis, the options and an ETA for a decision. Do not silently experiment on production during a critical batch.",
        "Check whether an index on PAYMENT_LINE (PERSON_ID, PERIOD ...) exists that the 11.5 plan used. Get the old plan from the HADR standby's snapshot, from test (still on 11.5), or from the batch logs/Data Server Manager history if available.",
        "Option A (fastest, lowest risk if the index exists): let the running step continue if its projected end is before 06:00. In parallel, prepare an optimization profile (statement-level guideline forcing the right index or join method) for that statement, tested on the pre-production copy.",
        "Option B: if the projected end is past 06:00, stop the step via the agreed batch-restart procedure (the step must be restartable, so check with the batch owner). Run RUNSTATS on ENTITLE_TMP (WITH DISTRIBUTION, INDEXES ALL) and on PAYMENT_LINE if needed, flush that statement from the package cache (or let the new stats invalidate it), EXPLAIN to confirm the good plan, then restart the step.",
        "Do not create a new index on a 310M-row table during the incident window without calculating build time, log volume and the HADR impact on the standby.",
        "After the incident: make RUNSTATS (or a registered statistics profile) on staging tables an explicit batch step after they are filled, or mark them VOLATILE if index access is always right.",
        "Process fix: add to the upgrade runbook a pre-upgrade capture of EXPLAIN baselines for the top-N critical statements (by business criticality, not only by cost), a post-upgrade plan comparison, and a batch dress-rehearsal on a pre-production copy on 12.1 before the production date.",
        "Keep optimization profiles as a documented, temporary control with an owner and an expiry. Record them in the CMDB/change so they are not forgotten.",
      ],
      commands: `-- In-flight plan of the running statement
SELECT EXECUTABLE_ID FROM TABLE(MON_GET_ACTIVITY(48213, -2));
CALL EXPLAIN_FROM_SECTION(x'<executable_id>', 'M', NULL, 0, NULL, ?, ?, ?, ?, ?);
db2exfmt -d PAYDB -1 -o plan_now.txt

-- Fix stats on the staging table
RUNSTATS ON TABLE PAY.ENTITLE_TMP WITH DISTRIBUTION AND SAMPLED DETAILED INDEXES ALL;

-- Optionally make statistics part of the job
RUNSTATS ON TABLE PAY.ENTITLE_TMP WITH DISTRIBUTION AND INDEXES ALL SET PROFILE;`,
      pitfalls: [
        "Killing the batch without knowing whether the step is restartable.",
        "Running RUNSTATS on the 310M-row table in the middle of the window without estimating its duration.",
        "Blaming '12.1 is slower' without evidence.",
        "Fixing only the query and not the upgrade process that allowed it.",
      ],
      keyPoints: [
        "Reads the evidence: CPU/logical-read bound, no lock/sort issue",
        "Identifies residual predicate on FETCH / wrong index on inner",
        "Identifies staging-table statistics as the likely trigger",
        "Separates incident action (deadline) from problem management (root cause)",
        "Communicates options and risk to the incident manager",
        "Proposes baseline capture + plan comparison in the upgrade runbook",
        "Treats optimization profiles as a controlled, temporary measure",
      ],
    },
  },

  /* ───────────────────────── 2 ───────────────────────── */
  {
    id: "sc-oltp-lockwaits",
    title: "Citizen portal slows every morning at 09:00",
    domain: "tuning",
    difficulty: 4,
    environment: "Db2 11.5, OLTP, WebSphere Liberty + legacy WAS, 1 800 connections, CUR_COMMIT=ON",
    context:
      "Every working day between 09:00 and 09:40 the citizen portal's response times go from 150 ms to 6–12 s, and some users get timeouts. The application team says 'the database is slow'. Infrastructure says CPU is at 35% and storage latency is normal. You are asked to find the cause and propose a solution.",
    evidence: [
      {
        title: "MON_GET_WORKLOAD (09:00–09:40 delta)",
        content: `WORKLOAD         TOTAL_RQST_TIME  LOCK_WAIT_TIME  LOCK_WAITS  LOCK_TIMEOUTS  DEADLOCKS
PORTAL_WL           9 812 400        7 204 110      41 233         1 180          3
BATCH_WL              622 000            1 200           4             0          0`,
      },
      {
        title: "db2pd -db PORTDB -wlocks (09:12)",
        content: `Locks being waited on :
AppHandl [nod-index] TranHdl  Lockname                   Type   Mode Conv Sts CoorEDU  AppName  AuthID
2011     [000-02011] 41       0300160005000000...0052   Row    ..X       G   9812     java     SVC_NOTIF
1733     [000-01733] 88       0300160005000000...0052   Row    .NS       W   7710     java     SVC_PORTAL
1734     [000-01734] 89       0300160005000000...0052   Row    .NS       W   7722     java     SVC_PORTAL
... (212 more waiters on rows of table PORTAL.CASE_STATUS)`,
      },
      {
        title: "Application info",
        content: `SVC_NOTIF = 'notification job' (legacy WAS 8.5 app), started 09:00 by scheduler.
  It loops over all open cases, updates CASE_STATUS.LAST_NOTIFIED and sends an e-mail per case,
  committing at the end of the loop (~35 min).
SVC_PORTAL = Liberty data source, isolation level not explicitly configured.
PORTAL.CASE_STATUS: 2.1M rows, 420k open cases.`,
      },
    ],
    tasks: [
      "What is the cause? Be precise about why currently committed does not help here.",
      "What are the short-term and structural fixes? Who owns each one?",
      "How do you prove your fix worked?",
    ],
    hints: [
      "Waiters request NS (next-key share) locks. Which isolation level takes NS locks on rows read, and does CUR_COMMIT apply?",
      "How long does SVC_NOTIF hold its X locks? What does an e-mail send inside a database transaction mean?",
    ],
    solution: {
      analysis:
        "The notification job updates ~420k rows in a single unit of work and holds the X locks for ~35 minutes, because it commits only at the end and performs slow external I/O (e-mail) inside the transaction. Portal readers wait for those rows. Currently committed should let CS readers skip the wait, but the waiters request NS locks, which is typical of RS (or RR) isolation. Currently committed only applies to CS, so the Liberty/WAS data source is most likely running at the JDBC default of TRANSACTION_REPEATABLE_READ (Db2 RS) or a configured RS. Lock waits make up 73% of portal request time, which confirms the problem is concurrency, not CPU or I/O.",
      actions: [
        "Short term (operations): move the notification job's start to outside peak hours (e.g. 06:30) via the scheduler. This is immediate, low risk, and the batch owner decides.",
        "Application fix (notification team): commit per case or per small batch (e.g. every 500 rows, restartable via LAST_NOTIFIED), and move the e-mail send outside the database transaction (outbox pattern).",
        "Isolation fix (portal team): set the data source isolation to READ_COMMITTED (Db2 CS) where the business logic allows, after verifying that no screen depends on RS semantics. With CS, CUR_COMMIT removes the read-on-update waits.",
        "Database side: confirm the isolation per package/statement (MON_GET_PKG_CACHE_STMT.ISOLATION or activity data). Set up a LOCKING event monitor (MON_LOCKWAIT = HIST_AND_VALUES with a threshold, e.g. 5 s) for evidence. Keep LOCKTIMEOUT at a bounded value (not -1).",
        "Verification: compare the MON_GET_WORKLOAD LOCK_WAIT_TIME share of TOTAL_RQST_TIME for 09:00–09:40 before and after, plus portal p95 response times from APM. Present both to the stakeholders.",
      ],
      commands: `SELECT SUBSTR(STMT_TEXT,1,80), ISOLATION, NUM_EXECUTIONS, LOCK_WAIT_TIME
  FROM TABLE(MON_GET_PKG_CACHE_STMT(NULL,NULL,NULL,-2))
 WHERE LOCK_WAIT_TIME > 0 ORDER BY LOCK_WAIT_TIME DESC FETCH FIRST 10 ROWS ONLY;

SELECT * FROM TABLE(MON_GET_APPL_LOCKWAIT(NULL,-2));

CREATE EVENT MONITOR LOCKEVMON FOR LOCKING WRITE TO UNFORMATTED EVENT TABLE;
UPDATE DB CFG FOR PORTDB USING MON_LOCKWAIT HIST_AND_VALUES MON_LW_THRESH 5000000;`,
      pitfalls: [
        "Increasing LOCKTIMEOUT or setting it to -1, which only turns timeouts into hangs.",
        "Suggesting WITH UR everywhere, which can show citizens uncommitted data and is a data-integrity risk.",
        "Blaming hardware when the evidence clearly shows lock time.",
      ],
      keyPoints: [
        "Reads NS lock mode → RS/RR isolation → CUR_COMMIT not applicable",
        "Identifies long unit of work with external I/O inside transaction",
        "Separates owners: scheduler, notification team, portal team, DBA",
        "Proposes measurable before/after evidence",
        "Rejects UR / LOCKTIMEOUT -1 with reasoning",
      ],
    },
  },

  /* ───────────────────────── 3 ───────────────────────── */
  {
    id: "sc-dpf-skew",
    title: "DPF warehouse: one partition always the slowest",
    domain: "dpf",
    difficulty: 5,
    environment: "Db2 11.5 DPF, 1 coordinator + 16 data partitions on 4 hosts, 42 TB, statistics warehouse",
    context:
      "Analysts report that queries on the registrations fact table are 'randomly' slow. The architecture team proposes adding 8 more partitions. Before that €€€ decision you are asked for an independent analysis.",
    evidence: [
      {
        title: "Row distribution",
        content: `SELECT DBPARTITIONNUM(MUNICIPALITY_CD) P, COUNT(*) ROWS
  FROM DWH.F_REGISTRATION GROUP BY DBPARTITIONNUM(MUNICIPALITY_CD) ORDER BY 1;

P   ROWS
1   148 220 110
2   151 004 551
...
7   612 880 402   <--
...
16  139 008 200
(avg 176M, max 612M)`,
      },
      {
        title: "DDL (abridged)",
        content: `CREATE TABLE DWH.F_REGISTRATION (
  REG_ID BIGINT NOT NULL, PERSON_ID BIGINT NOT NULL,
  MUNICIPALITY_CD CHAR(4) NOT NULL, REG_DATE DATE NOT NULL, ... )
  DISTRIBUTE BY HASH (MUNICIPALITY_CD)
  PARTITION BY RANGE (REG_DATE) (STARTING '2010-01-01' ENDING '2026-12-31' EVERY 1 MONTH);

CREATE TABLE DWH.D_PERSON (PERSON_ID BIGINT NOT NULL, ...) DISTRIBUTE BY HASH (PERSON_ID);  -- 30M rows
CREATE TABLE DWH.D_MUNICIPALITY (...)  DISTRIBUTE BY HASH (MUNICIPALITY_CD);                -- 342 rows`,
      },
      {
        title: "Typical plan fragment (F_REGISTRATION ⋈ D_PERSON)",
        content: `          HSJOIN
         /      \\
     DTQ          TBSCAN
      |            D_PERSON
   TBSCAN
 F_REGISTRATION   (2.8e+09 rows re-hashed on PERSON_ID)`,
      },
    ],
    tasks: [
      "Will adding 8 partitions fix the problem? Prove it.",
      "Propose a new distribution design, including the trade-offs.",
      "How do you migrate 42 TB with minimal impact, and how do you validate?",
    ],
    hints: [
      "MUNICIPALITY_CD has 342 distinct values, which are very unevenly sized. What does hashing do with a single value that has 400M rows?",
      "Which join is most frequent and most expensive? Which key would make it collocated?",
    ],
    solution: {
      analysis:
        "The distribution key has 342 values with extreme size differences (the large cities). Hashing maps each value to exactly one partition, so partition 7 holds 3.5× the average and every parallel query waits for it. Adding partitions does not split a single hash value: the big municipalities stay on one partition each, and skew may even get relatively worse. In addition, the most common join (to D_PERSON on PERSON_ID) is not collocated, so every query re-hashes billions of rows through a DTQ. Both problems are caused by the same key choice.",
      actions: [
        "Recommendation: redistribute F_REGISTRATION on PERSON_ID (high cardinality, even spread, and it collocates with D_PERSON, the dominant join). Validate first by building a 1% sample into a test table distributed by PERSON_ID and checking DBPARTITIONNUM counts (max/avg < ~1.1).",
        "Keep D_MUNICIPALITY small and replicated (a replicated MQT, DISTRIBUTE BY REPLICATION) so joins on municipality stay local regardless of the fact key.",
        "Check other frequent joins (workload analysis from MON_GET_PKG_CACHE_STMT / the activity monitor over a representative period). If a second large fact joins on REG_ID, weigh collocation for it.",
        "Migration: ADMIN_MOVE_TABLE with a pre-created target table (new DISTRIBUTE BY HASH (PERSON_ID), same range partitioning and indexes), keeping the source online. Alternatively, since data is range partitioned, rebuild month by month into a new table and switch with a view or rename in a maintenance window. Estimate the log and FCM volume, schedule it outside ETL, and take a backup afterwards.",
        "Validation: EXPLAIN key queries (DTQ between fact and D_PERSON should disappear), check per-partition elapsed and CPU (MON_GET_* per member), and compare analyst query timings before and after.",
        "Business case: present the €0 hardware alternative versus 8 partitions, with evidence. This is exactly the objective advice a public-sector client values.",
      ],
      commands: `-- Skew per partition from monitoring
SELECT MEMBER, SUM(ROWS_READ) FROM TABLE(MON_GET_TABLE('DWH','F_REGISTRATION',-2))
 GROUP BY MEMBER ORDER BY MEMBER;

-- Replicated dimension
CREATE TABLE DWH.D_MUNICIPALITY_R AS (SELECT * FROM DWH.D_MUNICIPALITY)
  DATA INITIALLY DEFERRED REFRESH IMMEDIATE
  DISTRIBUTE BY REPLICATION IN TS_DIM_R;
REFRESH TABLE DWH.D_MUNICIPALITY_R;
RUNSTATS ON TABLE DWH.D_MUNICIPALITY_R WITH DISTRIBUTION;`,
      pitfalls: [
        "Accepting 'more partitions' without analysing skew.",
        "Picking a new key only for even distribution while ignoring join collocation.",
        "Using REDISTRIBUTE, which rebalances hash buckets but cannot split one hash value.",
      ],
      keyPoints: [
        "Explains why hashing a skewed low-cardinality key cannot be fixed by more partitions",
        "Links key choice to both skew and DTQ (non-collocated join)",
        "Proposes validated new key + replicated small dimension",
        "Online migration method with capacity estimates",
        "Frames recommendation as an evidence-based business case",
      ],
    },
  },

  /* ───────────────────────── 4 ───────────────────────── */
  {
    id: "sc-temp-explosion",
    title: "Temp table space explodes during reporting hours",
    domain: "wlm",
    difficulty: 4,
    environment: "Db2 11.5, 8 TB mixed OLTP + reporting, STMM ON, SHEAPTHRES = 0",
    context:
      "Between 10:00 and 12:00 the system temporary table space grows to 1.4 TB and twice filled the filesystem last month, causing SQL0968C for OLTP users. Reporting users run ad-hoc SQL through a BI tool. Management wants 'a guarantee that this never happens again'.",
    evidence: [
      {
        title: "MON_GET_SERVICE_SUBCLASS (10:00–12:00)",
        content: `SERVICE_SUPERCLASS   SUBCLASS          ACT_COMPLETED  SORT_OVERFLOWS  HASH_JOIN_OVERFLOWS  AVG_TEMP_MB
SYSDEFAULTUSERCLASS  SYSDEFAULTSUBCLASS        512 331           9 844                3 211          820`,
      },
      {
        title: "Top statements by temp usage (activity monitor)",
        content: `APPL_NAME     EST_COST(timerons)  ACTUAL_TEMP_MB  ROWS_RETURNED
BI_TOOL           88 412 000           412 000        1 200 000
BI_TOOL           61 200 115           298 400          340 000
BI_TOOL              912 000             4 100          12 000`,
      },
    ],
    tasks: [
      "Design a WLM configuration that protects OLTP and bounds temp usage. Be specific about objects and thresholds.",
      "What is the role of tuning versus WLM here?",
      "How do you introduce this safely?",
    ],
    hints: [
      "Everything runs in the default subclass. Start by separating the work.",
      "Which thresholds are predictive and which are reactive? Which one directly bounds temp usage?",
    ],
    solution: {
      analysis:
        "All work runs in SYSDEFAULTSUBCLASS, so a few ad-hoc BI queries (estimated costs of tens of millions of timerons) compete with OLTP for sort memory and temp space. There is no control point. WLM provides isolation and bounds. Tuning (indexes, statistics, statistical views, rewrites of the top offenders) reduces the need for temp. You need both.",
      actions: [
        "Create service superclasses, e.g. SC_OLTP and SC_REPORTING (subclasses RPT_SHORT, RPT_LONG), and optionally SC_BATCH.",
        "Create workloads mapping connections by APPLNAME / SESSION_USER / client info: WL_OLTP (application user), WL_BI (BI_TOOL service account), WL_BATCH. Leave SYSDEFAULTUSERWORKLOAD for the rest and monitor it.",
        "In SC_REPORTING, use a work class set by estimated cost: < ~1M timerons → RPT_SHORT, otherwise RPT_LONG. Add a CONCURRENTDBCOORDACTIVITIES threshold on RPT_LONG (e.g. 3 concurrent, with queueing) so big queries queue instead of all spilling at once.",
        "Add an SQLTEMPSPACE threshold on SC_REPORTING (e.g. 150 GB per activity per partition) with STOP EXECUTION and COLLECT ACTIVITY DATA. This is the direct 'guarantee' on temp growth, and it captures the offending SQL for follow-up.",
        "Optionally add ESTIMATEDSQLCOST with STOP EXECUTION for absurd estimates (e.g. > 500M timerons) and a documented escalation path for legitimate cases. Remember it depends on statistics quality.",
        "CPU: enable the WLM dispatcher with shares favouring SC_OLTP, or a CPU LIMIT on reporting.",
        "Rollout: first create everything with thresholds in monitoring mode (CONTINUE + COLLECT ACTIVITY DATA) for 1–2 weeks to calibrate values. Then agree limits with the business owners of the BI function and communicate to users. Go live through a change, with a rollback script.",
        "Tuning track: take the top 10 temp consumers from the activity data, give feedback to the BI team, and consider statistical views/MQTs for common reporting patterns.",
        "Separately, put temp table spaces on their own filesystem with monitoring so OLTP is never impacted by a full filesystem.",
      ],
      commands: `CREATE SERVICE CLASS SC_REPORTING;
CREATE SERVICE CLASS RPT_SHORT UNDER SC_REPORTING;
CREATE SERVICE CLASS RPT_LONG  UNDER SC_REPORTING;

CREATE WORKLOAD WL_BI APPLNAME('BI_TOOL') SERVICE CLASS SC_REPORTING;
GRANT USAGE ON WORKLOAD WL_BI TO PUBLIC;

CREATE WORK CLASS SET WCS_RPT
 (WORK CLASS WC_SMALL WORK TYPE READ FOR TIMERONCOST FROM 0 TO 999999,
  WORK CLASS WC_BIG   WORK TYPE READ FOR TIMERONCOST FROM 1000000 TO UNBOUNDED);
CREATE WORK ACTION SET WAS_RPT FOR SERVICE CLASS SC_REPORTING USING WORK CLASS SET WCS_RPT
 (WORK ACTION WA_SMALL ON WORK CLASS WC_SMALL MAP ACTIVITY TO RPT_SHORT,
  WORK ACTION WA_BIG   ON WORK CLASS WC_BIG   MAP ACTIVITY TO RPT_LONG);

CREATE THRESHOLD TH_RPT_LONG_CONC FOR SERVICE CLASS RPT_LONG UNDER SC_REPORTING ACTIVITIES
 ENFORCEMENT DATABASE WHEN CONCURRENTDBCOORDACTIVITIES > 3 AND QUEUEDACTIVITIES > 20
 STOP EXECUTION;

CREATE THRESHOLD TH_RPT_TEMP FOR SERVICE CLASS SC_REPORTING ACTIVITIES
 ENFORCEMENT DATABASE PARTITION WHEN SQLTEMPSPACE > 150 G
 COLLECT ACTIVITY DATA WITH DETAILS, SECTION STOP EXECUTION;`,
      pitfalls: [
        "Only adding disk.",
        "Turning on STOP EXECUTION without a calibration period and without informing users.",
        "Relying only on ESTIMATEDSQLCOST, which is only as good as the statistics.",
      ],
      keyPoints: [
        "Separates workloads into service classes by identity",
        "Uses a predictive (cost/work class) + reactive (SQLTEMPSPACE) combination",
        "Concurrency queueing for heavy work",
        "Monitor-first rollout with calibration and communication",
        "Tuning track for top offenders, not WLM alone",
      ],
    },
  },

  /* ───────────────────────── 5 ───────────────────────── */
  {
    id: "sc-wlm-design",
    title: "Design WLM for a mixed government workload",
    domain: "wlm",
    difficulty: 4,
    environment: "Db2 12.1, 32 cores, one database serving 4 consumers",
    context:
      "A new consolidated database will serve: (1) a citizen-facing portal (24/7, p95 < 300 ms), (2) internal case workers (08:00–18:00), (3) nightly ETL to the data warehouse (22:00–05:00), and (4) a data-science team running ad-hoc queries. The architect asks you to present a WLM design in the interview, on a whiteboard, in 10 minutes.",
    evidence: [
      {
        title: "Requirements from the business",
        content: `- Portal must never be starved, not even during ETL.
- Case workers second priority during office hours.
- Data science 'best effort'; must not run a query longer than 30 min without review.
- ETL must finish by 05:00; may use everything at night except portal's share.
- Audit: prove per consumer how much resource was used per month (chargeback / capacity).`,
      },
    ],
    tasks: [
      "Draw the service classes, workloads, and mapping.",
      "Which controls (shares, limits, thresholds) do you use for each class, and why?",
      "How do you monitor and report per consumer?",
    ],
    hints: [
      "Soft shares let classes borrow idle CPU. Which classes should be allowed to borrow?",
      "What does 'review after 30 min' translate to: STOP, or remap plus collect?",
    ],
    solution: {
      analysis:
        "The goal is predictable service for the portal, fair use for the others, and evidence for chargeback. The design identifies work by connection attributes, isolates it in superclasses, controls CPU with dispatcher shares and limits, and controls runaway work with thresholds. Monitoring through WLM statistics feeds reporting.",
      actions: [
        "Superclasses: SC_PORTAL, SC_CASEWORK, SC_ETL, SC_DATASCIENCE (subclasses DS_NORMAL, DS_LOW). Workloads map by SESSION_USER / APPLNAME / client accounting strings. Unmapped work stays in the default class, which you monitor and alert on.",
        "CPU: WLM_DISPATCHER = YES. Give SC_PORTAL high soft shares (it can take idle CPU and is always prioritised under contention), SC_CASEWORK medium soft shares, SC_ETL soft shares, and SC_DATASCIENCE hard shares, or a CPU LIMIT of e.g. 20%, so it never takes over.",
        "Time-based priority: a scheduled script (or the DB's task scheduler) alters shares at 22:00 and 07:00 so that ETL gets more at night and case workers more during the day. Document it as part of the design.",
        "Thresholds: for data science, CPUTIMEINSC on DS_NORMAL remaps to DS_LOW. ACTIVITYTOTALTIME > 30 min with COLLECT ACTIVITY DATA and STOP EXECUTION (or CONTINUE plus an alert, per the business's 'review' definition). Add a concurrency threshold for DS heavy work. For the portal, use an ACTIVITYTOTALTIME threshold of a few seconds with COLLECT only, to catch regressions early.",
        "Memory: sort memory is shared per database. The concurrency controls on DS/ETL are what protect the portal from sort-memory starvation.",
        "Monitoring: WLM_COLLECT_INT plus a STATISTICS event monitor to tables, and MON_GET_SERVICE_SUBCLASS_STATS / MON_GET_WORKLOAD for CPU, request time and queue time per consumer. Produce a monthly report from the event monitor tables (capacity and chargeback).",
        "Governance: document the design, the owners per consumer, and the change procedure for threshold changes.",
      ],
      commands: `UPDATE DBM CFG USING WLM_DISPATCHER YES WLM_DISP_CPU_SHARES YES;
ALTER SERVICE CLASS SC_PORTAL      SOFT CPU SHARES 6000;
ALTER SERVICE CLASS SC_CASEWORK    SOFT CPU SHARES 3000;
ALTER SERVICE CLASS SC_ETL         SOFT CPU SHARES 2000;
ALTER SERVICE CLASS SC_DATASCIENCE HARD CPU SHARES 1000 CPU LIMIT 20;

CREATE THRESHOLD TH_DS_AGE FOR SERVICE CLASS DS_NORMAL UNDER SC_DATASCIENCE ACTIVITIES
 ENFORCEMENT DATABASE PARTITION WHEN CPUTIMEINSC > 120 SECONDS CHECKING EVERY 10 SECONDS
 COLLECT ACTIVITY DATA WITH DETAILS REMAP ACTIVITY TO DS_LOW;

CREATE EVENT MONITOR WLMSTATS FOR STATISTICS WRITE TO TABLE;
UPDATE DB CFG USING WLM_COLLECT_INT 15;`,
      pitfalls: [
        "Designing only priorities without identifying/mapping work properly.",
        "No monitoring or reporting, so no way to prove the SLA or do chargeback.",
        "Using STOP EXECUTION for data science without an agreed review process.",
      ],
      keyPoints: [
        "Clear identity → workload → service class mapping",
        "Soft vs hard shares vs CPU LIMIT used purposefully",
        "Remap for priority aging",
        "Time-of-day adaptation",
        "Monitoring + reporting for SLA/chargeback",
        "Governance and ownership",
      ],
    },
  },

  /* ───────────────────────── 6 ───────────────────────── */
  {
    id: "sc-ocp-crashloop",
    title: "Db2 pod in CrashLoopBackOff after node maintenance",
    domain: "openshift",
    difficulty: 5,
    environment: "OpenShift 4.x, Db2U operator, Db2 11.5 SMP, ODF storage, HADR to a second cluster",
    context:
      "During a planned worker-node drain (OCP upgrade) the Db2 primary pod was evicted and rescheduled. It now cycles through CrashLoopBackOff. The platform team says 'the operator will fix it'. The HADR standby in the other cluster is healthy. 40 minutes have passed and the portal is down.",
    evidence: [
      {
        title: "oc describe pod c-paydb-db2u-0 (abridged)",
        content: `Events:
  Warning  FailedAttachVolume  12m  attachdetach-controller
           Multi-Attach error for volume "pvc-9a1..." Volume is already exclusively attached to one node
  Normal   Started   6m   kubelet  Started container db2u
  Warning  Unhealthy 4m   kubelet  Liveness probe failed: db2 not responding
  Normal   Killing   4m   kubelet  Container db2u failed liveness probe, will be restarted`,
      },
      {
        title: "db2diag.log inside the pod (last start)",
        content: `ADM1530E  Crash recovery has been initiated.
...
ADM1533W  Database has recovered. However, one or more ...  (never reached — killed at ~3 min)`,
      },
    ],
    tasks: [
      "What sequence of problems do you see?",
      "What do you do right now? Consider the HADR standby.",
      "What must change to prevent this, and who owns what?",
    ],
    hints: [
      "The first event is about the volume. The second is about the probe. They are related to timing.",
      "Crash recovery duration depends on the amount of log to replay. What does a liveness probe do to a long crash recovery?",
    ],
    solution: {
      analysis:
        "Two problems chain together. (1) The RWO block volume was still attached to the old node, so the new pod could not start until the attachment was released (Multi-Attach). (2) Once it started, Db2 began crash recovery, which on a busy OLTP database can take longer than the liveness probe's failure window. The probe killed the container mid-recovery, the next start began crash recovery again, and so on: a loop that never completes. The operator cannot 'fix' this, because it is the probe configuration that kills the pod.",
      actions: [
        "Now: decide with the incident manager on a HADR TAKEOVER to the healthy standby in the other cluster. Service restoration comes first, and it is a known, tested procedure. Because the primary is down, this is a forced takeover (BY FORCE, with PEER WINDOW ONLY if a peer window is configured) per the runbook. Redirect applications (ACR / client reroute or a DNS/service switch).",
        "In parallel, on the failed side, stop the probe-restart loop: temporarily relax or disable the liveness probe per operator guidance, or scale down, so that crash recovery can complete. Check the Multi-Attach condition is resolved (VolumeAttachment objects).",
        "After recovery: reintegrate the old primary as the new standby (START HADR AS STANDBY), verify PEER, and plan a controlled fail-back if required.",
        "Prevention (platform plus DBA): use a startup probe with a generous failureThreshold so liveness only begins after Db2 is up. Size liveness timeouts for crash recovery (or rely on the operator's supported probe settings). Add a PodDisruptionBudget and a drain procedure that first does a graceful HADR role switch or db2stop before evicting the primary. Check storage detach behaviour (ODF/CSI) during drains.",
        "Reduce crash recovery time: tune page cleaning (PAGE_AGE_TRGT_MCR / SOFTMAX on older configurations) so less log must be replayed.",
        "Document it in the runbook: 'OCP node maintenance with Db2 primary', with the owners (platform team: drain procedure, probes; DBA: HADR switch, recovery tuning).",
      ],
      commands: `# On standby cluster
oc exec -it c-paydb-db2u-0 -- su - db2inst1 -c "db2pd -db PAYDB -hadr"
oc exec -it c-paydb-db2u-0 -- su - db2inst1 -c "db2 takeover hadr on db PAYDB by force peer window only"

# Failed side diagnostics
oc get volumeattachment | grep pvc-9a1
oc get pod c-paydb-db2u-0 -o yaml | grep -A12 livenessProbe
oc logs c-paydb-db2u-0 --previous`,
      pitfalls: [
        "Waiting for 'the operator' while the service is down and a healthy standby exists.",
        "Deleting the PVC to 'force' a fresh start, which risks data loss.",
        "Disabling probes permanently instead of adding a startup probe.",
      ],
      keyPoints: [
        "Correct chain: Multi-Attach delay → probe kills crash recovery → loop",
        "Service first: HADR takeover decision with incident manager",
        "Startup probe / probe sizing as structural fix",
        "Maintenance procedure with graceful role switch before drain",
        "Clear ownership between platform and DBA",
      ],
    },
  },

  /* ───────────────────────── 7 ───────────────────────── */
  {
    id: "sc-compile-storm",
    title: "High CPU with nothing 'slow' in the top SQL",
    domain: "tuning",
    difficulty: 4,
    environment: "Db2 11.5, 24 cores, new microservice (Hibernate) went live last week",
    context:
      "Since last week's go-live of a new microservice, CPU has been at 85–95% during office hours. The top-10 statements by execution time look normal. Nobody can find 'the slow query'.",
    evidence: [
      {
        title: "MON_GET_DATABASE (1 hour delta)",
        content: `TOTAL_RQST_TIME        : 18 204 000 ms
TOTAL_COMPILE_TIME     : 6 902 000 ms     (37.9 %)
TOTAL_COMPILE_PROC_TIME: 6 650 000 ms
PKG_CACHE_LOOKUPS      : 4 120 332
PKG_CACHE_INSERTS      : 3 988 010
PKG_CACHE_NUM_OVERFLOWS: 212
CAT_CACHE_LOOKUPS      : 22 400 118
CAT_CACHE_INSERTS      :  1 902 441`,
      },
      {
        title: "Sample from MON_GET_PKG_CACHE_STMT (NUM_EXECUTIONS = 1)",
        content: `SELECT ... FROM REG.PERSON_ADDRESS WHERE PERSON_ID = 88120331 AND VALID_TO IS NULL
SELECT ... FROM REG.PERSON_ADDRESS WHERE PERSON_ID = 17220019 AND VALID_TO IS NULL
SELECT ... FROM REG.PERSON_ADDRESS WHERE PERSON_ID = 90213345 AND VALID_TO IS NULL
... ~3.9 million distinct statement texts`,
      },
    ],
    tasks: ["Diagnose.", "Propose short-term and structural fixes, with risks.", "How would you have caught this before go-live?"],
    hints: ["Look at inserts vs lookups in the package cache, and the compile share of request time."],
    solution: {
      analysis:
        "Nearly every execution compiles a new statement (inserts ≈ lookups), because the microservice sends literals instead of bind parameters. Compilation accounts for ~38% of request time and burns CPU. The package cache overflows and catalog cache inserts are elevated too. No individual statement is slow, so top-SQL-by-time analysis misses it. The cost is in aggregate compile work.",
      actions: [
        "Short term: enable the statement concentrator (UPDATE DB CFG USING STMT_CONC LITERALS; dynamic, effective for new statements). Check the most important skew-sensitive statements afterwards. PERSON_ID equality is not skew-sensitive, so the risk here is low.",
        "Also check that PCKCACHESZ and CATALOGCACHE_SZ are sized sensibly (AUTOMATIC / STMM for the package cache). This is secondary to the concentrator.",
        "Structural fix (application team): configure Hibernate/JPA to use bind parameters (e.g. avoid literal inlining settings, use parameterised queries). Retest with the concentrator off.",
        "Verify: TOTAL_COMPILE_TIME share and PKG_CACHE_INSERTS/LOOKUPS drop, and CPU falls. Show before/after figures.",
        "Prevention: a performance gate before go-live that checks compile share and package cache insert ratio in a load test, plus a DBA review of new applications' SQL patterns. This is a governance point worth raising in the interview.",
      ],
      commands: `SELECT TOTAL_COMPILE_TIME*100.0/NULLIF(TOTAL_RQST_TIME,0) AS PCT_COMPILE,
       PKG_CACHE_INSERTS*100.0/NULLIF(PKG_CACHE_LOOKUPS,0) AS PCT_INSERT
  FROM TABLE(MON_GET_DATABASE(-2));

UPDATE DB CFG FOR REGDB USING STMT_CONC LITERALS;`,
      pitfalls: ["Only adding CPU.", "Looking only at top SQL by elapsed time.", "Enabling the concentrator without checking skew-sensitive statements."],
      keyPoints: [
        "Uses compile time share + package cache insert ratio",
        "Understands why top-N by time misses aggregate compile cost",
        "Concentrator as short-term, application fix as structural",
        "Measurable verification",
        "Pre-go-live performance gate",
      ],
    },
  },

  /* ───────────────────────── 8 ───────────────────────── */
  {
    id: "sc-rewrite",
    title: "Rewrite this SQL (live coding round)",
    domain: "tuning",
    difficulty: 5,
    environment: "Db2 11.5, row-organized, CASES 120M rows, DOCUMENTS 900M rows",
    context:
      "The panel gives you this query from a case-management report and asks you to explain what is wrong and rewrite it, out loud, in 10 minutes. Result correctness must be preserved.",
    evidence: [
      {
        title: "Original SQL",
        content: `SELECT C.CASE_ID,
       C.CITIZEN_ID,
       (SELECT MAX(D.CREATED_TS) FROM APP.DOCUMENTS D WHERE D.CASE_ID = C.CASE_ID) AS LAST_DOC,
       (SELECT COUNT(*)          FROM APP.DOCUMENTS D WHERE D.CASE_ID = C.CASE_ID) AS DOC_CNT
  FROM APP.CASES C
 WHERE SUBSTR(C.CASE_REF, 1, 3) = 'BZW'
   AND DATE(C.CREATED_TS) >= CURRENT DATE - 90 DAYS
   AND (C.STATUS = 'OPEN' OR C.ASSIGNED_TO IS NULL)
   AND C.CASE_ID NOT IN (SELECT A.CASE_ID FROM APP.ARCHIVE_QUEUE A)
 ORDER BY LAST_DOC DESC`,
      },
      {
        title: "Available indexes",
        content: `CASES:        PK (CASE_ID), IX_CASES_REF (CASE_REF), IX_CASES_CRTS (CREATED_TS), IX_CASES_STATUS (STATUS)
DOCUMENTS:    PK (DOC_ID), IX_DOC_CASE (CASE_ID)
ARCHIVE_QUEUE: no indexes; CASE_ID nullable`,
      },
    ],
    tasks: [
      "List every problem, in order of impact.",
      "Write the rewritten query and state any assumptions that need business confirmation.",
      "Which index changes (if any) do you propose?",
    ],
    hints: [
      "Three predicates are non-sargable as written. Which ones, and how do you rewrite each?",
      "Two correlated subqueries hit the same table. How many passes over DOCUMENTS can you reduce them to?",
      "NOT IN + nullable column: what does a single NULL do?",
    ],
    solution: {
      analysis:
        "(1) SUBSTR(CASE_REF,1,3) = 'BZW' is non-sargable; rewrite it as CASE_REF LIKE 'BZW%' (index range on IX_CASES_REF). (2) DATE(CREATED_TS) >= ... is non-sargable; rewrite it as CREATED_TS >= TIMESTAMP(CURRENT DATE - 90 DAYS). (3) Two correlated scalar subqueries each probe DOCUMENTS, so aggregate once with GROUP BY and join. (4) NOT IN against a nullable column without an index returns NO rows if any NULL exists, which is a potential correctness bug today. If NULLs are not meaningful, rewrite with NOT EXISTS (anti-join), after business confirmation. (5) The OR across different columns hampers index use; the optimizer may use index ORing, but the date predicate is the most selective anchor anyway. (6) Cases without documents: the original returns NULL/0 for them, so the rewrite must use a LEFT JOIN to keep them.",
      actions: [
        "Confirm with the business/owner: should cases be excluded when ARCHIVE_QUEUE contains NULL CASE_IDs? (Currently the whole report is empty in that case.) The rewrite assumes 'no'.",
        "Rewrite with sargable predicates, a pre-aggregated derived table on DOCUMENTS limited to the candidate cases, a LEFT JOIN to keep cases without documents, and NOT EXISTS.",
        "Indexes: an index on ARCHIVE_QUEUE(CASE_ID) (or make it NOT NULL plus index). Consider DOCUMENTS (CASE_ID, CREATED_TS) so MAX and COUNT come from an index-only scan. Evaluate the write cost on a 900M-row table first.",
        "Validate: compare result sets old vs new (EXCEPT both ways) on a test copy, EXPLAIN both, and compare actuals.",
      ],
      commands: `WITH CAND AS (
  SELECT C.CASE_ID, C.CITIZEN_ID
    FROM APP.CASES C
   WHERE C.CASE_REF LIKE 'BZW%'
     AND C.CREATED_TS >= TIMESTAMP(CURRENT DATE - 90 DAYS)
     AND (C.STATUS = 'OPEN' OR C.ASSIGNED_TO IS NULL)
     AND NOT EXISTS (SELECT 1 FROM APP.ARCHIVE_QUEUE A WHERE A.CASE_ID = C.CASE_ID)
),
DOCS AS (
  SELECT D.CASE_ID, MAX(D.CREATED_TS) AS LAST_DOC, COUNT(*) AS DOC_CNT
    FROM APP.DOCUMENTS D
   WHERE D.CASE_ID IN (SELECT CASE_ID FROM CAND)
   GROUP BY D.CASE_ID
)
SELECT C.CASE_ID, C.CITIZEN_ID, D.LAST_DOC, COALESCE(D.DOC_CNT, 0) AS DOC_CNT
  FROM CAND C
  LEFT JOIN DOCS D ON D.CASE_ID = C.CASE_ID
 ORDER BY D.LAST_DOC DESC;

CREATE INDEX APP.IX_AQ_CASE  ON APP.ARCHIVE_QUEUE (CASE_ID);
CREATE INDEX APP.IX_DOC_CASE_TS ON APP.DOCUMENTS (CASE_ID, CREATED_TS);  -- evaluate write cost`,
      pitfalls: [
        "Converting NOT IN to NOT EXISTS without mentioning the NULL semantics.",
        "Using an INNER JOIN to DOCS, which drops cases without documents.",
        "Forgetting that DOC_CNT must be 0, not NULL.",
        "Not validating results old vs new.",
      ],
      keyPoints: [
        "Identifies all non-sargable predicates and rewrites them correctly",
        "Collapses correlated subqueries into one aggregation",
        "Catches the NOT IN / NULL correctness trap and asks the business",
        "Preserves semantics (LEFT JOIN, COALESCE)",
        "Proposes result validation and EXPLAIN comparison",
      ],
    },
  },

  /* ───────────────────────── 9 ───────────────────────── */
  {
    id: "sc-io-migration",
    title: "Read latency doubled after storage migration",
    domain: "tuning",
    difficulty: 4,
    environment: "Db2 11.5 on RHEL, 12 TB, storage moved from FC SAN to a new NVMe-backed array over iSCSI",
    context:
      "After the weekend storage migration, batch jobs are 40% slower and OLTP p95 latency went from 40 ms to 95 ms. The storage vendor says 'the array shows 0.3 ms latency'. You need to find the truth.",
    evidence: [
      {
        title: "MON_GET_BUFFERPOOL / MON_GET_TABLESPACE deltas (1 h, before → after)",
        content: `                        BEFORE      AFTER
POOL_DATA_P_READS      8.1M        8.3M
POOL_ASYNC_DATA_READS  6.0M        3.1M
POOL_READ_TIME (ms)    9.7M       24.8M     -> per read: 1.2 ms → 3.0 ms
PREFETCH_WAIT_TIME     0.4M        5.9M
DIRECT_READ_TIME       ...         ...
Table space containers: BEFORE 8 LUNs, AFTER 1 large LUN (consolidated)`,
      },
      {
        title: "OS",
        content: `iostat -x: 1 device dm-4, avgqu-sz 64, await 3.1 ms, %util 100
multipath -ll: 1 active path (other path 'failed faulty')
DB2_PARALLEL_IO: not set`,
      },
    ],
    tasks: ["Build the diagnosis from Db2 metrics down to the OS.", "What changes do you propose, in what order?"],
    hints: [
      "Async reads halved while sync reads increased. What changed for the prefetchers?",
      "One device, queue depth maxed, one multipath path failed.",
    ],
    solution: {
      analysis:
        "The array may be fast, but the host path is not. Consolidating from 8 LUNs to 1 LUN changed Db2's view: with one container, automatic prefetch size and prefetch parallelism collapse (prefetch is computed per container), so async reads halved and agents do synchronous reads and wait on prefetch. At OS level the single device is saturated (queue at the limit, 100% util), and only one iSCSI multipath path is active, which halves bandwidth. Latency per read measured by Db2 (3 ms) is the truth the application feels. The array-side 0.3 ms excludes host queueing.",
      actions: [
        "Fix the multipath failure with the storage/network team (the failed iSCSI path). This is immediate and has no Db2 change.",
        "Set DB2_PARALLEL_IO for the affected table spaces (e.g. *:8 or the real number of back-end devices) so prefetch size and parallelism reflect the storage. It takes effect at database reactivation, so plan it via a change.",
        "Review the OS queue depth / nr_requests and the I/O scheduler for the NVMe/iSCSI device (e.g. none/mq-deadline), together with the Linux team.",
        "Medium term: go back to multiple LUNs/containers (or multiple storage paths in the storage group) for parallelism, and keep active logs on a separate device.",
        "Verify with the same Db2 metrics: per-read POOL_READ_TIME, the async/sync ratio and PREFETCH_WAIT_TIME, before and after each change. Change one variable at a time.",
      ],
      commands: `SELECT BP_NAME,
       POOL_DATA_P_READS, POOL_ASYNC_DATA_READS,
       POOL_READ_TIME * 1.0 / NULLIF(POOL_DATA_P_READS + POOL_INDEX_P_READS, 0) AS MS_PER_READ,
       PREFETCH_WAIT_TIME
  FROM TABLE(MON_GET_BUFFERPOOL(NULL,-2));

db2set DB2_PARALLEL_IO=*:8`,
      pitfalls: [
        "Accepting the vendor's array latency as end-to-end latency.",
        "Increasing buffer pools to hide I/O.",
        "Changing several parameters at once without measuring.",
      ],
      keyPoints: [
        "Connects container count to prefetch behaviour",
        "Uses per-read latency and async/sync ratio",
        "Goes down to OS: queue, multipath",
        "Stepwise change with measurement",
      ],
    },
  },

  /* ───────────────────────── 10 ───────────────────────── */
  {
    id: "sc-ansible-fleet",
    title: "Automate fix pack rollout for 60 instances",
    domain: "automation",
    difficulty: 4,
    environment: "60 Db2 11.5 instances on RHEL (20 HADR pairs + 20 standalone), Ansible AWX, change windows per environment",
    context:
      "Fix packs are currently applied by hand, which takes weeks, and deviations exist between servers. You are asked to design the Ansible approach and present how you guarantee safety in a public-sector environment with strict change management.",
    evidence: [
      {
        title: "Constraints",
        content: `- Change windows: DEV anytime, TST Tue/Thu 18-22, ACC weekends, PRD 1st Sunday 06-10
- Every PRD change needs an approved RFC and evidence of test in ACC
- Passwords may not be stored in plaintext; audit logs retained 1 year
- Some HADR pairs have ROS (reads on standby) used by reporting`,
      },
    ],
    tasks: ["Describe the playbook structure and the control flow for HADR pairs.", "How do you make it safe, idempotent and auditable?"],
    hints: [
      "Roles and pre-checks: what must be true before touching a node?",
      "Never hard-code HADR roles; query them.",
    ],
    solution: {
      analysis:
        "A good design is inventory-driven (environment, pair, role discovered at runtime), strictly ordered for HADR pairs, gated by health checks, idempotent (it skips nodes already at the target level), and integrated with change management (the RFC number as a required variable, logs to central storage).",
      actions: [
        "Inventory: groups per environment and per HADR pair (host_vars: instance, db list, pair id). Keep secrets in Ansible Vault / AWX credentials, never in variables files.",
        "Roles: db2_precheck (level, disk space, db2ckupgrade-free fix pack prerequisites, backups recent, HADR state PEER, log gap ≈ 0), db2_fixpack_install (stage image, installFixPack with -b, db2iupdt), db2_postcheck (db2level, db2start, HADR back in PEER, connectivity test, db2updv on primary at the end), db2_report.",
        "Control flow per pair: discover roles at runtime (db2pd -hadr / MON_GET_HADR). Patch the standby, wait for PEER, run a graceful TAKEOVER, patch the old primary, wait for PEER, optionally fail back, then run db2updv115 on the current primary. Use serial: 1 per pair, max_fail_percentage: 0 and any_errors_fatal: true for PRD.",
        "Idempotency: compare db2level against the target and skip if equal. Every shell task has changed_when/failed_when based on real output and return codes (CLP rc ≥ 4 = failure).",
        "ROS consideration: the takeover moves the read-only workload. Coordinate with the reporting owners or configure clients for ACR.",
        "Governance: the RFC ID is a mandatory extra var and a pre-task checks it. Runs happen in AWX with RBAC, logs are shipped to central logging (1-year retention), and the same playbook is used in DEV → TST → ACC → PRD, with ACC run evidence attached to the PRD RFC.",
        "Rollback: keep the previous fix pack image staged and a documented fix pack rollback procedure (for the instance level, before db2updv). Take a backup before the change for the database level.",
      ],
      commands: `- hosts: "{{ pair }}"
  serial: 1
  any_errors_fatal: true
  pre_tasks:
    - assert: { that: [ "rfc_id is defined" ] }
    - name: Discover HADR role
      shell: ". ~/sqllib/db2profile && db2pd -db {{ db }} -hadr | awk '/HADR_ROLE/ {print $3}'"
      become: true
      become_user: "{{ instance }}"
      register: hadr_role
      changed_when: false
  roles:
    - db2_precheck
    - role: db2_fixpack_install
      when: current_level.stdout != target_level`,
      pitfalls: [
        "Hard-coding which node is primary.",
        "No health gates between steps.",
        "Using shell tasks that always report 'changed' (no idempotency).",
        "Bypassing change management 'because it is automated'.",
      ],
      keyPoints: [
        "Runtime role discovery and correct HADR order",
        "Health gates (PEER, log gap) and fail-fast",
        "Idempotency and correct CLP return code handling",
        "Vault/AWX credentials, audit logging",
        "Integration with RFC/change process and DTAP flow",
      ],
    },
  },

  /* ───────────────────────── 11 ───────────────────────── */
  {
    id: "sc-memory-oom",
    title: "Three instances, one host, the Linux OOM killer strikes",
    domain: "tuning",
    difficulty: 4,
    environment: "RHEL 8, 256 GB RAM, 3 Db2 11.5 instances (PRD-A, PRD-B, ACC), STMM ON everywhere, INSTANCE_MEMORY AUTOMATIC",
    context:
      "Twice this month the OOM killer terminated db2sysc of PRD-B at night during ETL. Each team claims their instance is 'small'. You must stabilise the host.",
    evidence: [
      {
        title: "db2pd -dbptnmem (each instance, at peak)",
        content: `PRD-A  Memory Limit: 230 GB (AUTOMATIC)  Current usage: 118 GB  HWM: 131 GB
PRD-B  Memory Limit: 230 GB (AUTOMATIC)  Current usage:  96 GB  HWM: 104 GB
ACC    Memory Limit: 230 GB (AUTOMATIC)  Current usage:  41 GB  HWM:  58 GB`,
      },
      {
        title: "OS",
        content: `free -g: total 251, used 247, free 1, buff/cache 3
/proc/sys/vm/overcommit_memory = 0
dmesg: Out of memory: Killed process 44102 (db2sysc) ...`,
      },
    ],
    tasks: ["Why did this happen?", "Propose a memory plan for the host."],
    hints: ["With INSTANCE_MEMORY AUTOMATIC, what does each instance think it may use?"],
    solution: {
      analysis:
        "With INSTANCE_MEMORY AUTOMATIC each instance computes its limit (around 90% of RAM) as if it were alone on the host, so the three limits together far exceed physical memory. STMM in each instance grows buffer pools and sort memory independently. At night, peaks overlap (131 + 104 + 58 GB > 251 GB), the OS runs out, and the OOM killer takes the largest recent grower. Nothing is 'small'. The configuration is uncoordinated.",
      actions: [
        "Set an explicit INSTANCE_MEMORY per instance that sums to ~85% of RAM, leaving the rest for the OS, file cache, backups and monitoring agents. For example PRD-A 110 GB, PRD-B 90 GB, ACC 20 GB, based on measured HWM and priority.",
        "Keep STMM, but within those bounds (DATABASE_MEMORY AUTOMATIC under a fixed INSTANCE_MEMORY). STMM then trades memory inside the instance rather than competing for the host.",
        "ACC should not share a host with production. Put that on the roadmap with the risk documented (and BIO separation-of-environments arguments).",
        "Monitor per instance with db2pd -dbptnmem / MON_GET_MEMORY_SET plus OS memory alerting. Add an ETL-window check.",
        "Implement via change, one instance at a time (INSTANCE_MEMORY is dynamic in many cases, but validate the effect of lowering it below current usage).",
      ],
      commands: `db2 update dbm cfg using INSTANCE_MEMORY 28835840   -- 110 GB in 4K pages
db2pd -dbptnmem
SELECT MEMORY_SET_TYPE, MEMORY_SET_USED/1024 AS MB, MEMORY_SET_USED_HWM/1024 AS HWM_MB
  FROM TABLE(MON_GET_MEMORY_SET(NULL,NULL,-2));`,
      pitfalls: ["Adding swap.", "Disabling STMM entirely.", "Setting limits without looking at HWM data."],
      keyPoints: [
        "Understands AUTOMATIC INSTANCE_MEMORY assumes exclusive host",
        "Budget per instance summing below physical RAM",
        "STMM inside a bound",
        "Environment separation as risk item",
      ],
    },
  },

  /* ───────────────────────── 12 ───────────────────────── */
  {
    id: "sc-hadr-dc",
    title: "HADR sync mode between Utrecht and Apeldoorn data centres",
    domain: "tuning",
    difficulty: 5,
    environment: "Db2 12.1 OLTP, primary DC Utrecht region, standby DC Apeldoorn region (~70 km), dark fibre, RPO requirement '0 committed transactions lost'",
    context:
      "The security officer demands RPO = 0. The application owner complains that commit latency rose from 1.5 ms to 4 ms after switching HADR from ASYNC to SYNC. The CIO asks for your advice on the right mode and the trade-offs.",
    evidence: [
      {
        title: "MON_GET_HADR / MON_GET_TRANSACTION_LOG",
        content: `HADR_SYNCMODE         : SYNC
HADR_STATE            : PEER
HADR_LOG_GAP          : 0
LOG_HADR_WAIT_TIME    : 2 410 000 ms / 1h
LOG_HADR_WAITS_TOTAL  : 912 000
PRIMARY_LOG_TIME / STANDBY_LOG_TIME  equal
Network RTT (ping)    : 1.1 ms
Standby log write     : 1.3 ms`,
      },
    ],
    tasks: ["Compare SYNC, NEARSYNC, ASYNC, SUPERASYNC for this situation.", "Give your recommendation, with the conditions and residual risk."],
    hints: ["What exactly must be true on the standby before the primary commit returns in SYNC vs NEARSYNC?"],
    solution: {
      analysis:
        "SYNC: commit returns after the log is written to disk on both primary and standby, so the added latency is RTT plus the standby disk write (≈ 1.1 + 1.3 ms, matching the observation of ~2.6 ms average HADR wait per commit). NEARSYNC: commit returns when the log is in the standby's memory. Data is only lost if both sites fail simultaneously (a double failure) before the standby writes the log. ASYNC/SUPERASYNC give no zero-RPO guarantee. With a 70 km separation the chance of a simultaneous loss of both sites is very low, so NEARSYNC is the common enterprise choice, while SYNC is the strict interpretation of RPO = 0.",
      actions: [
        "Clarify the requirement: is 'RPO = 0' defined for a single-site failure (NEARSYNC satisfies it) or for a simultaneous two-site failure (only SYNC)? Put this in writing, because it is a risk decision for the business/CISO, not a DBA decision.",
        "If NEARSYNC is acceptable: switch (it can be changed with the documented procedure), expect ~1.1–1.5 ms commit overhead, and document the residual risk.",
        "If SYNC is mandatory: reduce the standby log write latency (faster log device on the standby), check the network path (MTU, no firewall inspection on the HADR port), and consider HADR_SPOOL_LIMIT / peer window settings. Explain that commit latency cannot drop below RTT + standby write.",
        "Set HADR_PEER_WINDOW to define behaviour when the standby disconnects (hold commits vs continue unprotected). This is also a business decision about availability versus RPO.",
        "Monitor LOG_HADR_WAIT_TIME per commit continuously and alert when it rises, since network degradation directly hits the citizen portal.",
      ],
      commands: `SELECT HADR_SYNCMODE, HADR_STATE, HADR_LOG_GAP, PEER_WINDOW
  FROM TABLE(MON_GET_HADR(NULL));
SELECT LOG_HADR_WAIT_TIME * 1.0 / NULLIF(LOG_HADR_WAITS_TOTAL,0) AS MS_PER_WAIT
  FROM TABLE(MON_GET_TRANSACTION_LOG(-2));`,
      pitfalls: [
        "Deciding the sync mode yourself without the business risk owner.",
        "Claiming NEARSYNC is 'zero data loss in all cases'.",
        "Ignoring standby disk latency as part of SYNC cost.",
      ],
      keyPoints: [
        "Precise definition of each sync mode's commit point",
        "Quantifies latency: RTT + standby write",
        "Frames RPO interpretation as a business/CISO decision",
        "Peer window and monitoring",
      ],
    },
  },

  /* ───────────────────────── 13 ───────────────────────── */
  {
    id: "sc-rollin",
    title: "Monthly roll-in blocks queries for 3 hours",
    domain: "dpf",
    difficulty: 4,
    environment: "Db2 11.5 DPF, 8 data partitions, range-partitioned fact (monthly), 2 nonpartitioned indexes, 1 MQT",
    context:
      "The monthly load process attaches a new month. SET INTEGRITY runs for 3 hours, and reporting queries against the fact are blocked or slow during that time. You must redesign the roll-in.",
    evidence: [
      {
        title: "Current process",
        content: `1. LOAD staging table STG_2026_09 (no indexes)
2. ALTER TABLE DWH.F_TAX_EVENT ATTACH PARTITION P2026_09 ... FROM STG_2026_09
3. SET INTEGRITY FOR DWH.F_TAX_EVENT, DWH.MQT_TAX_MONTH IMMEDIATE CHECKED
Indexes: IX_EVENT_ID UNIQUE (EVENT_ID) NOT PARTITIONED, IX_PERSON (PERSON_ID) NOT PARTITIONED`,
      },
    ],
    tasks: ["Why does it take so long?", "Redesign the roll-in, including index and MQT strategy."],
    hints: [
      "Which indexes must be maintained during SET INTEGRITY?",
      "Can IX_EVENT_ID be partitioned? What would that require?",
    ],
    solution: {
      analysis:
        "SET INTEGRITY must insert every new row into both nonpartitioned (global) indexes and validate the range constraints. The refresh of the dependent MQT in the same statement adds even more time. The unique index cannot be partitioned because EVENT_ID does not include the partitioning key.",
      actions: [
        "Make IX_PERSON a partitioned index. Evaluate whether the unique constraint can include the partitioning column (e.g. UNIQUE (EVENT_ID, EVENT_MONTH)) or whether uniqueness can be guaranteed upstream. Then it can be partitioned too.",
        "Before ATTACH, create indexes on the staging table matching every partitioned index. The attach then reuses them and SET INTEGRITY avoids index builds.",
        "Separate the MQT: SET INTEGRITY for the fact first, then refresh the MQT incrementally (REFRESH TABLE ... INCREMENTAL, if the MQT is eligible and staging tables exist), or schedule the MQT refresh outside reporting hours.",
        "Use ALLOW WRITE ACCESS / ALLOW READ ACCESS options where possible so queries can continue on existing partitions.",
        "Consider the target: attach to a pre-loaded partition that is validated in staging (with check constraints matching the range), so SET INTEGRITY is quick.",
        "Measure: the SET INTEGRITY duration per step in ACC before the PRD change.",
      ],
      commands: `CREATE INDEX STG.IX_PERSON_STG ON STG.STG_2026_09 (PERSON_ID);  -- matches partitioned IX_PERSON
ALTER TABLE DWH.F_TAX_EVENT ATTACH PARTITION P2026_09
  STARTING '2026-09-01' ENDING '2026-09-30' FROM STG.STG_2026_09;
SET INTEGRITY FOR DWH.F_TAX_EVENT ALLOW READ ACCESS IMMEDIATE CHECKED;
REFRESH TABLE DWH.MQT_TAX_MONTH;   -- separate, scheduled`,
      pitfalls: ["Dropping and recreating all indexes monthly.", "Ignoring the unique index constraint when proposing partitioned indexes."],
      keyPoints: [
        "Global index maintenance as cause",
        "Partitioned indexes + matching staging indexes",
        "Unique index must contain partitioning key",
        "MQT refresh decoupled",
        "Access-level options for availability",
      ],
    },
  },
];
