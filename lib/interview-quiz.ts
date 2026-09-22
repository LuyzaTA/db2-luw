import type { InterviewDomain, QuizQuestion } from "@/types/interview";

/* ─────────────────────────────────────────────────────────
   Interview Readiness — Quiz Bank
   Senior-level. Performance & tuning deliberately over-weighted.
   ───────────────────────────────────────────────────────── */

export const DOMAIN_LABELS: Record<InterviewDomain, string> = {
  tuning:      "Performance & Query Tuning",
  dpf:         "DPF / MPP & Partitioning",
  wlm:         "Workload Management",
  openshift:   "OpenShift / Kubernetes",
  diagnostics: "Diagnostics & Monitoring",
  automation:  "Automation & Linux",
  versions:    "Versions 10.5 → 12.1",
};

/** Share of an Interview Mode exam drawn from each domain (sums to 1). */
export const EXAM_WEIGHTS: Record<InterviewDomain, number> = {
  tuning:      0.45,
  dpf:         0.15,
  wlm:         0.10,
  openshift:   0.10,
  diagnostics: 0.10,
  automation:  0.05,
  versions:    0.05,
};

const NLJOIN_PLAN = `Access Plan:
        Total Cost:   2.14e+06
        Query Degree: 1

                 Rows
                RETURN
                (   1)
                  |
                 1.2
                NLJOIN
                (   2)
          /-------+--------\\
        1.2                  1
       FETCH              TBSCAN
       (   3)             (   5)
     /---+---\\              |
   1.2      2.3e+06      4.8e+07
  IXSCAN  TABLE: APP   TABLE: APP
  (   4)   CUSTOMER      ORDERS
    |
  2.3e+06
  INDEX: APP.IX_CUST_REGION_STATUS

Predicates (operator 4):  REGION = 'NL' AND STATUS = 'ACTIVE'
Section actuals (operator 3): 52 114 rows`;

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  /* ═══════════════ PERFORMANCE & QUERY TUNING ═══════════════ */
  {
    id: "t-nljoin-actuals",
    domain: "tuning",
    difficulty: 5,
    question:
      "Read the plan. Elapsed time is 3 hours instead of the expected seconds. What is the most accurate diagnosis and the best fix?",
    code: NLJOIN_PLAN,
    options: [
      "The TBSCAN on ORDERS is the root cause. Add an index on ORDERS and the problem is solved regardless of statistics.",
      "The outer cardinality is underestimated (1.2 vs 52 114) because REGION and STATUS are correlated. The optimizer chose NLJOIN with a full inner scan per outer row. Collect column-group statistics on (REGION, STATUS), add an index supporting the join column on ORDERS, then re-EXPLAIN.",
      "Query Degree 1 is the problem. Enable INTRA_PARALLEL and the NLJOIN will run in parallel.",
      "The buffer pool is too small. Increase it so that ORDERS stays in memory.",
    ],
    correct: [1],
    explanation:
      "The inner of an NLJOIN is re-evaluated for every outer row. With an estimate of 1.2 outer rows, a TBSCAN inner looks cheap. With 52 114 actual rows it means 52 114 full scans of 48M rows. The root cause is the cardinality error: the optimizer multiplies filter factors assuming column independence. RUNSTATS ... ON ALL COLUMNS AND COLUMNS ((REGION, STATUS)) WITH DISTRIBUTION gives it the real combined cardinality, and a join-column index on ORDERS makes any NLJOIN inner an IXSCAN. After fixing the estimate the optimizer will likely switch to HSJOIN or MSJOIN.",
    trap:
      "An index alone makes this query survivable, but the estimate is still wrong. Every other plan that uses these predicates will keep making bad choices. Interviewers want to hear that you fixed the estimate, not only the symptom.",
  },
  {
    id: "t-skew-markers",
    domain: "tuning",
    difficulty: 5,
    question:
      "A JDBC application runs `SELECT ... FROM CASES WHERE CASE_TYPE = ?`. CASE_TYPE is heavily skewed: one value covers 85% of rows, and 40 other values are rare. Rare values are fast. The common value takes minutes because it uses an index-driven NLJOIN plan. You cannot change the application. Which approach addresses the root cause?",
    options: [
      "Set STMT_CONC = LITERALS in the database configuration.",
      "Apply an optimization profile containing a statement-level REOPT guideline (for example REOPT ALWAYS, or ONCE if the first value is representative) for that statement, so the optimizer sees the actual value when compiling.",
      "Increase PCKCACHESZ so the plan is not evicted.",
      "Collect distribution statistics only. With frequent-value stats the optimizer will pick the right plan for each marker value.",
    ],
    correct: [1],
    explanation:
      "With parameter markers the optimizer compiles once, without knowing the value. It uses an average filter factor, so frequent-value statistics cannot be exploited. REOPT makes the optimizer use the actual host-variable value. An optimization profile applies REOPT to one statement without changing code. For CLI-based applications the REOPT CLI keyword is an alternative. Weigh REOPT ALWAYS (a compile on every execution) against the plan-quality gain.",
    trap:
      "Distribution statistics are necessary but not sufficient: they cannot help a marker the optimizer cannot see. STMT_CONC=LITERALS does the opposite of what you need, because it turns literals into markers.",
  },
  {
    id: "t-stmm-sheapthres",
    domain: "tuning",
    difficulty: 4,
    question:
      "SELF_TUNING_MEM = ON. SORTHEAP and SHEAPTHRES_SHR are both AUTOMATIC. Over weeks, STMM never changes either value, although SORT_OVERFLOWS is high. The buffer pools are being tuned. What is the most likely cause?",
    options: [
      "The instance-level SHEAPTHRES is set to a non-zero value. STMM only tunes sort memory when SHEAPTHRES = 0.",
      "SORTHEAP cannot be AUTOMATIC when intra-partition parallelism is off.",
      "STMM only tunes sort memory on HADR standbys.",
      "SORT_OVERFLOWS is not an input to STMM.",
    ],
    correct: [0],
    explanation:
      "Self-tuning of SORTHEAP/SHEAPTHRES_SHR requires the database manager parameter SHEAPTHRES = 0. That is the shared sort memory model, where sort memory is governed per database by SHEAPTHRES_SHR. A non-zero SHEAPTHRES is a common leftover from old v8/9.x configurations carried through upgrades. Check with `db2 get dbm cfg | grep -i sheapthres`.",
    trap:
      "Many people assume AUTOMATIC means 'tuned'. AUTOMATIC only marks a consumer as eligible. Check the actual STMM activity in the db2diag.log and stmmlog files.",
  },
  {
    id: "t-stmm-two-consumers",
    domain: "tuning",
    difficulty: 4,
    question:
      "A DBA sets SELF_TUNING_MEM = ON but configures only one buffer pool as AUTOMATIC. Everything else has fixed sizes. What does `GET DB CFG SHOW DETAIL` report, and why?",
    options: [
      "ON (ACTIVE). STMM tunes the buffer pool against DATABASE_MEMORY.",
      "ON (INACTIVE). STMM needs at least two tunable memory consumers to trade memory between them.",
      "OFF. STMM switches itself off when fewer than three consumers are AUTOMATIC.",
      "ON (ACTIVE), but only in DPF.",
    ],
    correct: [1],
    explanation:
      "STMM works by moving memory between consumers based on cost-benefit. With only one tunable consumer (and DATABASE_MEMORY not AUTOMATIC) there is nothing to trade against, so the feature is on but effectively inactive. SHOW DETAIL displays this state.",
  },
  {
    id: "t-cur-commit-rs",
    domain: "tuning",
    difficulty: 5,
    question:
      "CUR_COMMIT = ON. A WebSphere-based case-management application still shows heavy read-on-update lock waits: readers block behind uncommitted updates. No application code has changed. What is the most likely explanation?",
    options: [
      "Currently committed only works for column-organized tables.",
      "The data source runs with isolation RS (WebSphere's historical default for Db2), and currently committed semantics apply only to CS scans.",
      "LOCKTIMEOUT is -1, which disables currently committed.",
      "CUR_COMMIT only takes effect after a db2stop/db2start.",
    ],
    correct: [1],
    explanation:
      "Currently committed lets CS readers read the last committed version of a row from the log instead of waiting on an uncommitted update. It does not apply to RS or RR, or to cursors with update intent (FOR UPDATE / positioned updates). WebSphere data sources historically default to TRANSACTION_REPEATABLE_READ, which maps to Db2 RS. Verify with MON_GET_PKG_CACHE_STMT / the package isolation, or in the activity event monitor.",
    trap:
      "CUR_COMMIT does need a database reactivation to change, but the scenario says it is already ON and effective for other apps. Don't jump to configuration before checking the isolation level.",
  },
  {
    id: "t-include-unique",
    domain: "tuning",
    difficulty: 4,
    question:
      "You want index-only access for `SELECT ORDER_DATE, AMOUNT FROM APP.ORDERS WHERE CUSTOMER_ID = ?`. CUSTOMER_ID is not unique. Which DDL achieves index-only access?",
    options: [
      "CREATE INDEX IX1 ON APP.ORDERS (CUSTOMER_ID) INCLUDE (ORDER_DATE, AMOUNT)",
      "CREATE UNIQUE INDEX IX1 ON APP.ORDERS (CUSTOMER_ID) INCLUDE (ORDER_DATE, AMOUNT)",
      "CREATE INDEX IX1 ON APP.ORDERS (CUSTOMER_ID, ORDER_DATE, AMOUNT)",
      "CREATE INDEX IX1 ON APP.ORDERS (CUSTOMER_ID) CLUSTER",
    ],
    correct: [2],
    explanation:
      "In Db2 LUW, INCLUDE columns are only allowed on UNIQUE indexes. On a non-unique key you add the columns to the key itself. A unique index on CUSTOMER_ID would fail with duplicate keys. CLUSTER improves physical ordering but still requires data page access.",
    trap: "Option A is valid in SQL Server and PostgreSQL. In Db2 LUW the statement is rejected, because INCLUDE requires UNIQUE.",
  },
  {
    id: "t-bp-hitratio",
    domain: "tuning",
    difficulty: 5,
    question:
      "A reporting database's main buffer pool shows a data hit ratio of 58% using (POOL_DATA_L_READS − POOL_DATA_P_READS) / POOL_DATA_L_READS. The manager asks you to double the buffer pool. What is the correct professional response?",
    options: [
      "Agree. Anything below 90% is a problem.",
      "First separate synchronous from asynchronous (prefetch) reads, and look at read latency (POOL_READ_TIME per physical read) and the proportion of sync reads. Scan-heavy workloads legitimately show low hit ratios while agents rarely wait on I/O.",
      "Switch the table space to automatic storage. That will raise the hit ratio.",
      "Reduce PREFETCHSIZE so that fewer physical reads are counted.",
    ],
    correct: [1],
    explanation:
      "POOL_DATA_P_READS includes pages brought in by prefetchers (POOL_ASYNC_DATA_READS). In a well-prefetched scan workload many physical reads are asynchronous and do not stall agents, so the naive ratio understates effectiveness. A better picture comes from: sync reads = P_READS − ASYNC_READS; the LBP-based formula using POOL_DATA_LBP_PAGES_FOUND − POOL_ASYNC_DATA_LBP_PAGES_FOUND; and time spent (POOL_READ_TIME, PREFETCH_WAIT_TIME) relative to TOTAL_RQST_TIME. Doubling memory for a scan-dominated workload often changes nothing.",
    trap: "Hit ratio as an absolute target is a junior reflex. A demanding panel will probe whether you know what the counters include.",
  },
  {
    id: "t-parallel-io",
    domain: "tuning",
    difficulty: 4,
    question:
      "A table space has a single container on a LUN striped over 8 physical disks. PREFETCHSIZE is AUTOMATIC and prefetching is visibly under-driving the storage. What is the standard fix?",
    options: [
      "Set NUM_IOSERVERS = 1.",
      "Set the registry variable DB2_PARALLEL_IO for that table space (e.g. DB2_PARALLEL_IO=<tbspid>:8, or *:8) so Db2 treats the container as 8 disks when computing automatic prefetch size and issues parallel prefetch requests.",
      "Increase EXTENTSIZE to 1024 pages.",
      "Convert the table space to DMS raw devices.",
    ],
    correct: [1],
    explanation:
      "Automatic prefetch size is EXTENTSIZE × number of containers × disks per container. With one container Db2 assumes one spindle. DB2_PARALLEL_IO tells it how many disks sit behind each container. If you set `*` without a number, the default is 6 disks per container. The change takes effect at next activation.",
  },
  {
    id: "t-overflow",
    domain: "tuning",
    difficulty: 4,
    question:
      "MON_GET_TABLE shows OVERFLOW_ACCESSES ≈ 40% of ROWS_READ for a table that receives many VARCHAR updates. What is happening, and what is the durable fix?",
    options: [
      "Hash join overflows. Increase SORTHEAP.",
      "Updated rows no longer fit on their page and were moved, leaving pointer records, so each access costs an extra page read. REORG the table, and set ALTER TABLE ... PCTFREE (then REORG) to reserve space for growth.",
      "Index leaf pages are splitting. Run REORG INDEXES ALL.",
      "Lock escalation is writing overflow records. Increase LOCKLIST.",
    ],
    correct: [1],
    explanation:
      "An overflow record is created when an updated row grows beyond the free space on its page. The original RID then points to the new location, so reads touch two pages. REORGCHK flags this with F1. REORG removes existing overflows. PCTFREE (applied at LOAD/REORG time) prevents recurrence. Also consider the update pattern, e.g. growing a status-history VARCHAR in place.",
  },
  {
    id: "t-nonsargable",
    domain: "tuning",
    difficulty: 4,
    question:
      "`WHERE YEAR(REGISTRATION_DATE) = 2025` scans 300M rows. There is an index on REGISTRATION_DATE. Which options allow index-based access? (Select all that apply.)",
    options: [
      "Rewrite as `REGISTRATION_DATE >= '2025-01-01' AND REGISTRATION_DATE < '2026-01-01'`.",
      "Create an expression-based index on YEAR(REGISTRATION_DATE) (Db2 10.5+) and collect statistics on the index.",
      "Add the hint `OPTIMIZE FOR 1 ROW`.",
      "Change the column data type to TIMESTAMP.",
    ],
    correct: [0, 1],
    explanation:
      "A function applied to a column makes the predicate non-indexable against a plain index on that column. Two correct solutions: a sargable range rewrite (preferred, and it also gives the optimizer good range estimates), or an expression-based index, supported since 10.5. For expression-based indexes, run RUNSTATS on the index so statistics exist for the expression.",
  },
  {
    id: "t-not-in-null",
    domain: "tuning",
    difficulty: 5,
    question:
      "A developer proposes rewriting `WHERE C.ID NOT IN (SELECT P.CITIZEN_ID FROM PAYMENTS P)` into `NOT EXISTS (SELECT 1 FROM PAYMENTS P WHERE P.CITIZEN_ID = C.ID)` for performance. PAYMENTS.CITIZEN_ID is nullable. What is your review comment?",
    options: [
      "Approve. The two are always equivalent.",
      "Reject both. Use a LEFT OUTER JOIN only.",
      "The rewrite changes semantics. If any P.CITIZEN_ID is NULL, NOT IN returns no rows, while NOT EXISTS returns rows. Confirm the business intent, then either filter NULLs explicitly or make the column NOT NULL. Only then is the rewrite equivalent (and it usually enables an anti-join).",
      "Approve, but add WITH UR for performance.",
    ],
    correct: [2],
    explanation:
      "NOT IN with a NULL in the subquery evaluates to UNKNOWN for every outer row, so the result set is empty. Db2 can often transform NOT IN into an anti-join only when nullability allows it. That is exactly why declaring NOT NULL matters for the optimizer. In a public-sector system (benefits, tax) silently changing result sets is a serious defect, not a tuning detail.",
  },
  {
    id: "t-sections-actuals",
    domain: "tuning",
    difficulty: 5,
    question:
      "You need per-operator ACTUAL row counts for a problem statement in production, with minimal overhead. Which approach is correct?",
    options: [
      "Run db2expln with the -actuals flag.",
      "Enable section actuals (SECTION_ACTUALS = BASE, or via the workload/WLM COLLECT settings), capture the statement with an ACTIVITIES event monitor (COLLECT ACTIVITY DATA WITH DETAILS, SECTION), then run EXPLAIN_FROM_ACTIVITY and format with db2exfmt.",
      "Use db2advis with -a.",
      "Set DB2_SQLROUTINE_PREPOPTS to EXPLAIN ALL.",
    ],
    correct: [1],
    explanation:
      "Section actuals are collected at runtime per operator. They reach the explain tables through EXPLAIN_FROM_ACTIVITY, using data captured by an activity event monitor that includes the section. Scope collection narrowly, e.g. a dedicated workload for the application, or COLLECT ACTIVITY DATA on a threshold, to keep overhead acceptable. db2exfmt then shows estimated vs actual rows side by side. Estimated-vs-actual gaps are where tuning starts.",
  },
  {
    id: "t-time-units",
    domain: "tuning",
    difficulty: 4,
    question:
      "From MON_GET_PKG_CACHE_STMT for one statement: STMT_EXEC_TIME = 412 000, TOTAL_CPU_TIME = 9 800 000, LOCK_WAIT_TIME = 350 000, POOL_READ_TIME = 21 000. What is the correct conclusion?",
    options: [
      "CPU dominates (9.8M vs 412K). Tune the access plan.",
      "The units differ: TOTAL_CPU_TIME is in microseconds (9.8 s), and the time-spent elements are in milliseconds (412 s elapsed, 350 s lock wait). Lock waiting dominates, so plan tuning will not fix it. Investigate lock holders.",
      "POOL_READ_TIME dominates. Add buffer pool memory.",
      "The numbers are inconsistent, so the monitor is broken.",
    ],
    correct: [1],
    explanation:
      "TOTAL_CPU_TIME is reported in microseconds. STMT_EXEC_TIME, LOCK_WAIT_TIME and POOL_READ_TIME are in milliseconds. Here ~85% of elapsed time is lock wait. Next steps: MON_GET_APPL_LOCKWAIT / db2pd -wlocks for the blocker, and a LOCKING event monitor with lock wait history. Also check isolation level, commit frequency of the holder, and whether an index would reduce rows locked by scans.",
    trap: "Unit confusion is one of the most common mistakes in real incident reviews. Panels test it on purpose.",
  },
  {
    id: "t-stmt-conc",
    domain: "tuning",
    difficulty: 4,
    question:
      "An ORM generates SQL with literals. PKG_CACHE_INSERTS is almost equal to PKG_CACHE_LOOKUPS, TOTAL_COMPILE_TIME is ~30% of request time, and the package cache keeps growing (PCKCACHESZ AUTOMATIC). What do you propose, and what is the risk?",
    options: [
      "Set PCKCACHESZ to a large fixed value. No risk.",
      "Enable the statement concentrator (STMT_CONC = LITERALS) so statements that differ only in literals share one section. The risk is plan quality loss on skewed columns, because the optimizer no longer sees the literal. Mitigate with REOPT guidelines or by excluding specific statements.",
      "Set DFT_QUERYOPT = 0 to make compiles cheaper. No risk.",
      "Flush the package cache every hour.",
    ],
    correct: [1],
    explanation:
      "The symptoms show near-100% compile per execution. The statement concentrator replaces literals with system-generated markers so the section is reused. The trade-off mirrors parameter markers: skew-sensitive predicates lose value-specific estimates. The permanent fix is ORM configuration that uses bind parameters. Present both, with ownership (the application team) and a timeline.",
  },
  {
    id: "t-ctq",
    domain: "tuning",
    difficulty: 4,
    question: "In the EXPLAIN of a query against column-organized (BLU) tables, what does the CTQ operator indicate, and where do you want it?",
    options: [
      "Coordinator Table Queue. It should be at the bottom of the plan.",
      "Column-to-row transition. Operators below CTQ run in the columnar engine, and above it in the row engine. You want CTQ as high in the plan as possible, so that most work (joins, aggregation) stays columnar.",
      "Compressed Temp Queue. Its presence means sort spills.",
      "Cluster Table Qualifier. It shows zone-map usage.",
    ],
    correct: [1],
    explanation:
      "Work below CTQ benefits from vector processing on encoded data. If CTQ sits low (e.g. directly over the scans), joins and aggregation fall back to the row engine, typically because of an unsupported function, data type or operation. Rewriting to keep operations columnar often gives order-of-magnitude gains.",
  },
  {
    id: "t-stat-views",
    domain: "tuning",
    difficulty: 5,
    question:
      "In a star schema, `WHERE D.MUNICIPALITY = 'Apeldoorn'` filters the fact table heavily, but the optimizer assumes a uniform fact distribution across municipalities and badly misestimates the join result. Column statistics on both tables are fresh. What is the targeted fix?",
    options: [
      "Column-group statistics on the dimension table.",
      "A statistical view over the fact-dimension join (CREATE VIEW ... ; ALTER VIEW ... ENABLE QUERY OPTIMIZATION; RUNSTATS on the view WITH DISTRIBUTION), so the optimizer knows the fact-side distribution by dimension attribute.",
      "A clustering index on the fact table.",
      "Set the optimization class to 9.",
    ],
    correct: [1],
    explanation:
      "Base-table statistics cannot express how fact rows spread across a dimension attribute, because the correlation sits across the join. A statistical view captures exactly that. The view is never used to answer queries. It only feeds the optimizer's cardinality estimates. This is a classic senior-level tool that is often forgotten.",
  },
  {
    id: "t-hsjoin-build",
    domain: "tuning",
    difficulty: 4,
    question:
      "In a Db2 HSJOIN, which input builds the hash table, and which monitor element tells you the join spilled?",
    options: [
      "Outer (left) input. SORT_OVERFLOWS.",
      "Inner (right) input. HASH_JOIN_OVERFLOWS (and HASH_JOIN_SMALL_OVERFLOWS).",
      "Whichever input is larger. POOL_TEMP_DATA_L_READS.",
      "Both inputs are hashed. TOTAL_SORTS.",
    ],
    correct: [1],
    explanation:
      "The inner (right-hand, displayed on the right in db2exfmt) is the build side. If its estimate is too low, the hash table exceeds its sort-memory allotment and spills to temp, recorded as hash join overflows. Diagnose it the same way as NLJOIN issues: compare estimated and actual cardinality of the build side.",
  },
  {
    id: "t-optguideline",
    domain: "tuning",
    difficulty: 4,
    question:
      "A developer embeds `/* <OPTGUIDELINES><IXSCAN TABLE='C' INDEX='IX_CASE_STATUS'/></OPTGUIDELINES> */` in a dynamic statement. EXPLAIN shows the guideline was ignored, without warning in the output. What is the most likely reason?",
    options: [
      "Guidelines only work in static SQL.",
      "The registry variable DB2_OPTPROFILE=YES is not set, which is required for embedded statement-level guidelines to be recognised.",
      "Guidelines must be in uppercase XML.",
      "IXSCAN guidelines require REOPT ALWAYS.",
    ],
    correct: [1],
    explanation:
      "Embedded guidelines are only honoured with DB2_OPTPROFILE=YES. When a guideline is recognised but not applicable, db2exfmt reports it in the extended diagnostic information and profile information sections. The table reference must match the exposed name or correlation name used in the statement. Guidelines are a controlled, documented exception, not a default tuning tool. Mention that in an interview.",
  },
  {
    id: "t-load-stats",
    domain: "tuning",
    difficulty: 3,
    question:
      "A nightly job truncates a table and LOADs 50M rows. The first reporting queries after the load take 20× longer than on other days, then improve later. What is the best fix?",
    options: [
      "Rely on automatic RUNSTATS. It will catch up.",
      "Collect statistics as part of the load (LOAD ... STATISTICS USE PROFILE, with a registered statistics profile), or run RUNSTATS explicitly before the reporting window, and make it a job dependency.",
      "Rebind all packages weekly.",
      "Use a larger log buffer.",
    ],
    correct: [1],
    explanation:
      "After TRUNCATE + LOAD the catalog statistics describe the old (or empty) table until auto-RUNSTATS evaluates it, which is asynchronous and not guaranteed to happen before your window. Real-time statistics may fabricate stats in some cases, but you should not depend on that for a critical batch chain. Statistics belong in the job flow, with dependencies in the scheduler.",
  },
  {
    id: "t-log-latency",
    domain: "tuning",
    difficulty: 4,
    question:
      "OLTP commit latency is high. MON_GET_TRANSACTION_LOG shows LOG_WRITE_TIME / NUM_LOG_WRITE_IO ≈ 9 ms, and LOG_DISK_WAIT_TIME is the largest wait in MON_GET_WORKLOAD. Which change targets the cause?",
    options: [
      "Increase LOGFILSIZ.",
      "Move the active log path to low-latency dedicated storage (target ≈ ≤1–2 ms per log write), separate from data containers, and verify the storage write cache/path. Consider LOGBUFSZ only if NUM_LOG_BUFFER_FULL > 0.",
      "Increase LOGPRIMARY.",
      "Set MINCOMMIT to 25.",
    ],
    correct: [1],
    explanation:
      "Commit is synchronous with the log write, so per-write latency drives commit latency. LOGFILSIZ and LOGPRIMARY affect capacity and archiving frequency, not write latency. MINCOMMIT is deprecated and ignored in modern releases. NUM_LOG_BUFFER_FULL tells you whether LOGBUFSZ is a factor. With HADR SYNC/NEARSYNC, also check LOG_HADR_WAIT_TIME, since network latency adds to commit time.",
  },
  {
    id: "t-optimize-for",
    domain: "tuning",
    difficulty: 3,
    question:
      "A screen shows the first 20 rows of a large result sorted by date. Which clause both communicates intent to the optimizer and limits the result?",
    options: [
      "OPTIMIZE FOR 20 ROWS only",
      "FETCH FIRST 20 ROWS ONLY (which also implies OPTIMIZE FOR 20 ROWS). With a supporting index on the sort column the optimizer can avoid the full sort.",
      "WITH UR",
      "FOR READ ONLY",
    ],
    correct: [1],
    explanation:
      "FETCH FIRST n ROWS ONLY limits the result and makes the optimizer favour plans that deliver the first rows quickly, such as an index providing order instead of a SORT. OPTIMIZE FOR alone influences plan and blocking but does not limit the rows returned.",
  },
  {
    id: "t-jumpscan",
    domain: "tuning",
    difficulty: 4,
    question:
      "Index on (REGION, CASE_TYPE, CREATED_TS). The predicate is `REGION = ? AND CREATED_TS > ?`, with no predicate on CASE_TYPE. What does Db2 10.1+ do, and how do you confirm it?",
    options: [
      "It cannot use the index beyond REGION, so everything after is a sargable filter. Nothing to confirm.",
      "It can use a jump scan (gap avoidance) over CASE_TYPE values, probing the CREATED_TS range per distinct CASE_TYPE. Confirm with the JUMPSCAN / gap information in the IXSCAN operator details in db2exfmt. Efficiency depends on the number of distinct CASE_TYPE values.",
      "It always converts the query to a TBSCAN.",
      "It uses index ANDing between two scans of the same index.",
    ],
    correct: [1],
    explanation:
      "Jump scan (introduced in 10.1) lets Db2 use start/stop keys on non-leading columns when there is a gap. It is effective when the gap column has low cardinality. db2exfmt shows the jump-scan / gap arguments on the IXSCAN operator. This often removes the need for an additional index. Say so when an interviewer asks about 'index proliferation'.",
  },
  {
    id: "t-lock-escal",
    domain: "tuning",
    difficulty: 4,
    question:
      "Nightly: LOCK_ESCALS increases and online users get lock timeouts from 01:00 to 02:30 while an UPDATE batch runs. LOCKLIST and MAXLOCKS are AUTOMATIC. What is the most effective fix?",
    options: [
      "Set MAXLOCKS = 100.",
      "Have the batch commit in bounded units of work (e.g. every N thousand rows, restartable). If the batch deliberately needs the whole table, schedule it in isolation and use LOCK TABLE explicitly instead of relying on escalation.",
      "Set LOCKTIMEOUT = -1 for online users.",
      "Increase LOCKLIST to its maximum and disable STMM.",
    ],
    correct: [1],
    explanation:
      "Escalation is a symptom of a unit of work holding too many row locks. Bounded commits fix the cause and also reduce log usage and rollback time. MAXLOCKS=100 lets one application consume the entire lock list, which harms everyone. LOCKTIMEOUT=-1 converts timeouts into hangs. Also check the lock-escalation messages in db2diag.log to identify the table and application.",
  },

  /* ═══════════════ DPF / MPP ═══════════════ */
  {
    id: "d-colocation",
    domain: "dpf",
    difficulty: 4,
    question: "Which of the following are REQUIRED for a collocated join between two tables in DPF? (Select all that apply.)",
    options: [
      "Both tables are in the same database partition group (or groups with identical partition maps).",
      "The distribution keys have the same number of columns, with pairwise compatible data types.",
      "The join includes equality predicates on all distribution key columns, pairwise.",
      "The distribution key columns have identical names in both tables.",
    ],
    correct: [0, 1, 2],
    explanation:
      "Collocation means matching rows hash to the same partition, so the join happens locally with no table queue. That needs the same partition map, the same number of key columns with compatible types (so hashing matches), and equality joins on all key columns. Column names are irrelevant.",
  },
  {
    id: "d-btq",
    domain: "dpf",
    difficulty: 5,
    question:
      "An EXPLAIN on a 16-partition warehouse shows a BTQ feeding the inner of an HSJOIN, with an estimated 380M rows. The query takes hours. What is the correct interpretation and direction?",
    options: [
      "BTQ is the fastest table queue. The problem is elsewhere.",
      "A broadcast table queue sends every row to every partition, here 380M × 16. That is only acceptable for small tables. Make the join collocated (align distribution keys), or for small dimensions use replicated MQTs. Also verify the cardinality estimate, because a BTQ is sometimes chosen on a wrong estimate.",
      "Increase FCM_NUM_BUFFERS and the BTQ will be fast.",
      "Switch to a single-partition database.",
    ],
    correct: [1],
    explanation:
      "Table queue types: DTQ (directed by hash to one partition), BTQ (broadcast to all), MDTQ/MBTQ (merging variants that preserve order). Broadcasting a large table multiplies network and memory load by the partition count. Seeing a BTQ or DTQ on a large table is the signal to review distribution-key design for that join.",
  },
  {
    id: "d-skew",
    domain: "dpf",
    difficulty: 4,
    question:
      "A fact table is distributed on MUNICIPALITY_CODE. Partition 5 holds 31% of rows (it contains Amsterdam, Rotterdam and Utrecht). Every query's elapsed time equals partition 5's time. What is the correct remedy?",
    options: [
      "Add partitions. The hashing will redistribute the data evenly.",
      "Choose a higher-cardinality, evenly distributed key that still supports the main joins (e.g. CITIZEN_ID / CASE_ID), and rebuild the table with the new DISTRIBUTE BY HASH, for example with ADMIN_MOVE_TABLE to a pre-created target or an unload/load. Validate the new distribution first with DBPARTITIONNUM() counts.",
      "Increase the buffer pool on partition 5 only.",
      "Use REDISTRIBUTE DATABASE PARTITION GROUP with the default options.",
    ],
    correct: [1],
    explanation:
      "In MPP the slowest partition sets the pace. A low-cardinality key concentrates values on few partitions, and adding partitions or running REDISTRIBUTE does not split a single hash value. Check skew with `SELECT DBPARTITIONNUM(col), COUNT(*) ... GROUP BY 1`. Key selection trades even distribution against join collocation.",
  },
  {
    id: "d-three-levels",
    domain: "dpf",
    difficulty: 3,
    question:
      "A table uses DISTRIBUTE BY HASH (CASE_ID), PARTITION BY RANGE (CASE_MONTH), and ORGANIZE BY DIMENSIONS (REGION). What does each level control?",
    options: [
      "All three spread rows across database partitions.",
      "DISTRIBUTE: which database partition (MPP node) stores the row. PARTITION BY RANGE: which data partition (range, attach/detach unit) within each database partition. ORGANIZE BY DIMENSIONS: block-level clustering by REGION within each data partition.",
      "DISTRIBUTE: clustering. PARTITION: parallelism. ORGANIZE: compression.",
      "They are mutually exclusive, so only one can be used.",
    ],
    correct: [1],
    explanation:
      "The three work together. Hash distribution gives parallelism across nodes. Range partitioning gives roll-in/roll-out and partition elimination ('DP Elim Predicates' in EXPLAIN). MDC gives block indexes and clustered dimension access. Explaining this layering clearly is a strong signal in a DPF interview.",
  },
  {
    id: "d-coordinator",
    domain: "dpf",
    difficulty: 4,
    question: "Why do many large DPF designs keep the catalog partition (usually 0) free of large fact data?",
    options: [
      "The catalog partition cannot store user tables.",
      "The coordinator agent runs on the partition the application connects to, and often does final sorts, aggregations and result return. Combined with catalog activity, adding a full data share on the same partition creates an imbalanced hot spot.",
      "HADR only replicates partition 0.",
      "Partition 0 has no FCM.",
    ],
    correct: [1],
    explanation:
      "A dedicated administration/coordinator partition, with small tables and the catalog, keeps coordinator work predictable. Applications connect there (or across a set of coordinator partitions), and data partitions do uniform parallel work.",
  },
  {
    id: "d-attach",
    domain: "dpf",
    difficulty: 5,
    question:
      "Monthly roll-in: ALTER TABLE ... ATTACH PARTITION, then SET INTEGRITY takes 3 hours because nonpartitioned (global) indexes are maintained. What is the best design correction?",
    options: [
      "Drop all indexes before attach and recreate them after.",
      "Use partitioned indexes. Before ATTACH, create indexes on the staging table that match every partitioned index of the target, so the attached index partitions are reused. Keep nonpartitioned indexes only where required (e.g. a unique index not containing the partitioning key).",
      "Use LOAD REPLACE on the whole table instead.",
      "Run SET INTEGRITY with IMMEDIATE UNCHECKED on all indexes.",
    ],
    correct: [1],
    explanation:
      "With partitioned indexes, index maintenance for ATTACH becomes a metadata operation if the source table has matching indexes. Otherwise SET INTEGRITY builds the index partitions. Global indexes require maintenance proportional to the new data. Unique indexes must include the partitioning key to be partitioned, which is an important design constraint. DETACH is asynchronous (asynchronous partition detach), so remember to check for dependent MQTs.",
  },
  {
    id: "d-fcm",
    domain: "dpf",
    difficulty: 3,
    question: "During heavy parallel queries, applications receive SQL6040C. What does this indicate?",
    options: [
      "The catalog partition is down.",
      "No FCM buffers are available. Review FCM_NUM_BUFFERS / FCM_NUM_CHANNELS (preferably AUTOMATIC), check instance memory headroom, and look at concurrency. WLM concurrency control is often the real fix.",
      "Lock list is full.",
      "Log full on one partition.",
    ],
    correct: [1],
    explanation:
      "FCM (Fast Communication Manager) carries table queue traffic between partitions. Exhaustion means too much concurrent inter-partition traffic for the configured buffers. Use db2pd -fcm to view usage. Raising buffers helps, but bounding concurrent heavy queries with WLM is usually the sustainable control.",
  },
  {
    id: "d-stmm-dpf",
    domain: "dpf",
    difficulty: 4,
    question: "How does STMM behave in a DPF database, and when is that a problem?",
    options: [
      "Each partition tunes itself independently.",
      "STMM selects a tuning partition and propagates its tuning decisions to the other partitions. If partitions have different workloads or hardware (e.g. a coordinator partition vs data partitions), the propagated values can be wrong. Choose the tuning partition deliberately, or disable STMM on atypical partitions.",
      "STMM is not supported with DPF.",
      "STMM only tunes the catalog partition.",
    ],
    correct: [1],
    explanation:
      "The tuning partition can be viewed and set (e.g. with ADMIN_CMD / the STMM tuning member settings). Homogeneous data partitions make the propagation model work. A mixed coordinator/data layout needs deliberate choices.",
  },
  {
    id: "d-blu-mpp",
    domain: "dpf",
    difficulty: 3,
    question: "Since which version can column-organized (BLU) tables be used in a DPF (MPP) database?",
    options: ["10.5", "11.1", "11.5", "12.1"],
    correct: [1],
    explanation:
      "BLU Acceleration arrived in 10.5 but only for single-partition databases. 11.1 added column-organized tables in DPF environments, which is the basis of Db2 Warehouse-style MPP. On 10.5 estates you may encounter row-organized warehouses for this reason.",
  },

  /* ═══════════════ WLM ═══════════════ */
  {
    id: "w-predictive",
    domain: "wlm",
    difficulty: 4,
    question: "Which WLM threshold is PREDICTIVE (evaluated before the activity starts executing)?",
    options: ["ACTIVITYTOTALTIME", "ESTIMATEDSQLCOST", "SQLROWSRETURNED", "CPUTIME"],
    correct: [1],
    explanation:
      "ESTIMATEDSQLCOST compares the optimizer's timeron estimate before execution, which makes it useful to stop or queue monster ad-hoc queries up front. It depends on estimate quality, so bad statistics equal bad WLM decisions. The others are reactive: they trigger once the measured value is exceeded during execution.",
  },
  {
    id: "w-cpu-limit",
    domain: "wlm",
    difficulty: 4,
    question:
      "Policy requirement: 'The ETL service class must never exceed 30% of CPU, even when the system is idle.' With the WLM dispatcher enabled (WLM_DISPATCHER = YES), which setting meets this exactly?",
    options: [
      "SOFT CPU SHARES 300",
      "CPU LIMIT 30 on the ETL service class",
      "HARD CPU SHARES 3000",
      "Agent priority -10",
    ],
    correct: [1],
    explanation:
      "CPU LIMIT is an absolute cap, enforced regardless of idle capacity. CPU shares express relative entitlement under contention, and soft shares in particular may borrow idle CPU. Agent priority is the legacy OS-priority approach. Use MON_GET_SERVICE_SUBCLASS_STATS (CPU utilization and velocity) to verify the effect.",
  },
  {
    id: "w-remap",
    domain: "wlm",
    difficulty: 5,
    question:
      "Ad-hoc queries start in a HIGH subclass. Any query that consumes more than 60 s of CPU in that subclass should continue with lower priority, not be killed. Which mechanism implements this?",
    options: [
      "An ESTIMATEDSQLCOST threshold with STOP EXECUTION.",
      "A CPUTIMEINSC threshold (with a CHECKING EVERY interval) on the HIGH subclass with the action REMAP ACTIVITY TO the LOW subclass of the same superclass.",
      "A work action set with PREVENT EXECUTION.",
      "An ACTIVITYTOTALTIME threshold with CONTINUE.",
    ],
    correct: [1],
    explanation:
      "Remapping works only between subclasses of the same service superclass and uses the 'in service class' thresholds (CPUTIMEINSC, SQLROWSREADINSC). This is the classic 'priority aging' design. Combine it with COLLECT ACTIVITY DATA on the threshold to capture offenders for tuning follow-up.",
  },
  {
    id: "w-defaults",
    domain: "wlm",
    difficulty: 3,
    question: "Where does work from an unmapped user connection run, by default?",
    options: [
      "SYSDEFAULTADMWORKLOAD → SYSDEFAULTSYSTEMCLASS",
      "SYSDEFAULTUSERWORKLOAD → SYSDEFAULTSUBCLASS under SYSDEFAULTUSERCLASS",
      "SYSDEFAULTMAINTENANCECLASS",
      "It is rejected until a workload is defined.",
    ],
    correct: [1],
    explanation:
      "Every connection maps to a workload. Unmatched user connections go to SYSDEFAULTUSERWORKLOAD, which maps to SYSDEFAULTUSERCLASS / SYSDEFAULTSUBCLASS. SYSDEFAULTADMWORKLOAD is for administrative connections (SET WORKLOAD TO SYSDEFAULTADMWORKLOAD). Internal system work and maintenance run in their own default superclasses.",
  },
  {
    id: "w-queue-monitor",
    domain: "wlm",
    difficulty: 4,
    question:
      "With a CONCURRENTDBCOORDACTIVITIES threshold that queues, users complain that 'the database is slow'. Which source shows whether their time is spent queued rather than executing?",
    options: [
      "db2diag.log",
      "MON_GET_QUEUE_STATS for queue sizes/times per threshold, and the WLM_QUEUE_TIME_TOTAL / WLM_QUEUE_ASSIGNMENTS_TOTAL elements in MON_GET_WORKLOAD / MON_GET_SERVICE_SUBCLASS",
      "db2pd -hadr",
      "SYSIBMADM.SNAPDB only",
    ],
    correct: [1],
    explanation:
      "Queue time is part of request time but is not a database 'slowness' problem. It is policy. Showing management the queue-time share lets them make an informed decision on concurrency limits versus hardware. This matters in public-sector capacity discussions.",
  },

  /* ═══════════════ OPENSHIFT / KUBERNETES ═══════════════ */
  {
    id: "o-operator-vs-helm",
    domain: "openshift",
    difficulty: 3,
    question: "What is the essential difference between deploying Db2 with a Helm chart and with the Db2 (Db2U) operator on OpenShift?",
    options: [
      "Helm is only for development, and operators only for production.",
      "Helm renders and applies templates at install/upgrade time. An operator runs a controller that continuously reconciles a custom resource, automating day-2 tasks (scaling, upgrades, self-healing, configuration drift correction).",
      "Operators cannot use persistent storage.",
      "Helm installs the operator's CRDs automatically.",
    ],
    correct: [1],
    explanation:
      "Helm is a package manager with no ongoing reconciliation of its own. An operator encodes operational knowledge in a controller watching CRs (e.g. Db2uInstance / Db2uCluster). Many estates use Helm or OLM to install the operator and then manage Db2 through CRs.",
  },
  {
    id: "o-drift",
    domain: "openshift",
    difficulty: 4,
    question:
      "On an operator-managed Db2 deployment, a colleague ran `oc exec` into the pod and changed several DB CFG parameters. Some settings reverted after a pod restart. What is the correct practice?",
    options: [
      "Always run changes via oc exec and re-run them in a startup script.",
      "Treat the custom resource (and its GitOps source) as the source of truth. Apply supported configuration through the CR spec so the operator reconciles it, and record the change in version control and in the change process.",
      "Disable the operator after installation.",
      "Mount a ConfigMap over db2systm.",
    ],
    correct: [1],
    explanation:
      "Operators reconcile toward the declared state. Imperative changes inside a pod may be overwritten or lost when a pod is rescheduled, and they are invisible to audit. Declarative, reviewed changes support BIO/ISO 27001-style change control, which a Dutch public-sector employer will expect you to respect.",
  },
  {
    id: "o-sysctl",
    domain: "openshift",
    difficulty: 5,
    question:
      "Db2 needs IPC kernel parameters (kernel.shm*, kernel.msg*, kernel.sem) set per pod. On OpenShift, what is the Kubernetes-native way to allow this?",
    options: [
      "SSH to each worker and edit /etc/sysctl.conf.",
      "Allow these namespaced 'unsafe' sysctls on the relevant worker nodes through a KubeletConfig (allowedUnsafeSysctls) bound to a MachineConfigPool. The pod spec (set by the operator) can then set them in its securityContext.",
      "Set them in the Db2 registry with db2set.",
      "They cannot be set on OpenShift, so Db2 must run on VMs.",
    ],
    correct: [1],
    explanation:
      "The IPC sysctls are namespaced, so they can be set per pod. They are not in the 'safe' set, though, so the kubelet must explicitly allow them. On OCP that is done with a KubeletConfig CR targeting a MachineConfigPool, which applies through the Machine Config Operator and reboots the nodes. Node-level SSH edits are not durable on RHCOS and bypass change control.",
  },
  {
    id: "o-storage",
    domain: "openshift",
    difficulty: 4,
    question: "For a Db2 MPP deployment on OpenShift, which storage statement is correct?",
    options: [
      "All volumes must be ReadWriteOnce.",
      "Shared metadata (the instance home/sqllib shared across partition pods) needs ReadWriteMany storage (e.g. CephFS/ODF, NFS). Per-partition data and active logs are typically block ReadWriteOnce volumes, chosen for low latency.",
      "Everything should be on emptyDir for performance.",
      "Active logs must be on ReadWriteMany NFS for HADR.",
    ],
    correct: [1],
    explanation:
      "MPP pods share instance metadata, which requires RWX. Data and logs are performance-critical and per-pod, so block storage (RWO) is preferred. Active logs on NFS are a classic latency mistake. Archive logs and backups often go to RWX or object storage. Know the storage class capabilities and the IOPS/latency figures of your cluster.",
  },
  {
    id: "o-hadr-dns",
    domain: "openshift",
    difficulty: 4,
    question: "You configure HADR between two Db2 deployments in OpenShift. Which value should HADR_REMOTE_HOST reference?",
    options: [
      "The current pod IP of the standby.",
      "A stable network identity: a Kubernetes Service name/DNS entry (or a route/external address for cross-cluster), never an ephemeral pod IP.",
      "The worker node hostname.",
      "localhost, with port-forwarding.",
    ],
    correct: [1],
    explanation:
      "Pod IPs change on reschedule, so HADR would break after any restart. Services give stable DNS names. Cross-cluster HADR (e.g. two data centres) requires exposed endpoints with predictable addressing and firewall rules for the HADR ports.",
  },
  {
    id: "o-oom",
    domain: "openshift",
    difficulty: 4,
    question: "A Db2 pod is repeatedly OOMKilled under load. What is the correct combination of actions?",
    options: [
      "Remove the memory limit.",
      "Give the pod Guaranteed QoS (requests = limits), and set INSTANCE_MEMORY explicitly below the container limit with headroom for non-Db2 processes and FCM/OS overhead. Then check which Db2 pool grew, using db2pd -dbptnmem and MON_GET_MEMORY_POOL.",
      "Increase swap on the node.",
      "Set DATABASE_MEMORY to COMPUTED.",
    ],
    correct: [1],
    explanation:
      "The kernel OOM killer acts on the cgroup limit, not on Db2's view of available memory. An explicit INSTANCE_MEMORY below the limit keeps Db2 within the cgroup. Guaranteed QoS also protects the pod from eviction under node pressure. Removing limits shifts the risk to the whole node, which is unacceptable on a shared cluster.",
  },
  {
    id: "o-antiaffinity",
    domain: "openshift",
    difficulty: 3,
    question: "How do you guarantee that the HADR primary and standby pods never run on the same worker node?",
    options: [
      "Use different namespaces.",
      "Use podAntiAffinity with requiredDuringSchedulingIgnoredDuringExecution and topologyKey kubernetes.io/hostname (or a zone key for zone separation).",
      "Use nodeSelector with the same label.",
      "Use a PodDisruptionBudget.",
    ],
    correct: [1],
    explanation:
      "Required anti-affinity is a hard scheduling rule. A PDB limits voluntary disruptions (like drains) but does not control placement. For DC-level resilience, use the zone topology key or separate clusters.",
  },
  {
    id: "o-backup-remote",
    domain: "openshift",
    difficulty: 4,
    question:
      "Backups of a Db2 pod must go to S3-compatible object storage, without staging on a local volume first. Which Db2 11.5+ mechanism supports this?",
    options: [
      "BACKUP ... TO /mnt/s3 with s3fs",
      "CATALOG STORAGE ACCESS ALIAS for the object store, then BACKUP DATABASE ... TO DB2REMOTE://<alias>/<container>/<path>",
      "db2move EXPORT",
      "HADR to an S3 bucket",
    ],
    correct: [1],
    explanation:
      "Remote storage aliases let BACKUP, LOAD and archive logging target object storage directly. Credentials are stored in the keystore-protected alias, not in scripts. In a public-sector context, confirm where the object store physically resides (data sovereignty) and that encryption is enabled.",
  },

  /* ═══════════════ DIAGNOSTICS ═══════════════ */
  {
    id: "x-edus",
    domain: "diagnostics",
    difficulty: 4,
    question:
      "`top` shows db2sysc at 100% of one core. How do you get from the OS thread to the SQL statement responsible?",
    options: [
      "db2diag -g level=Severe",
      "db2pd -edus interval=5 top=5 (identifies the hot EDU and its thread ID and CPU delta). Map the EDU to an agent and application handle with db2pd -agents / -apinfo, then get the current statement from db2pd -apinfo or MON_GET_ACTIVITY for that application handle.",
      "db2 list applications show detail",
      "db2trc on -f trc.dmp",
    ],
    correct: [1],
    explanation:
      "db2pd -edus with interval/top reports CPU used by each EDU during the interval, which is far more precise than instance-level top. The agent EDU maps to an application handle, and from there to the statement text and its metrics. This chain is a standard senior diagnostic flow.",
  },
  {
    id: "x-wlocks",
    domain: "diagnostics",
    difficulty: 3,
    question: "Which command gives the quickest live view of lock waiters together with the lock holders?",
    options: ["db2pd -db <db> -wlocks", "db2pd -db <db> -tcbstats", "db2pd -db <db> -bufferpools", "db2pd -db <db> -hadr"],
    correct: [0],
    explanation:
      "-wlocks shows lock waits with holder and waiter, lock name and mode. Use -wlocks detail for more. From SQL, use MON_GET_APPL_LOCKWAIT. For history, use a LOCKING event monitor with MON_LOCKWAIT/MON_LOCKTIMEOUT/MON_DEADLOCK configured.",
  },
  {
    id: "x-db2diag-filter",
    domain: "diagnostics",
    difficulty: 3,
    question: "Which db2diag command shows only Severe and Error records from the last 2 hours?",
    options: [
      "db2diag -level Severe,Error -H 2h",
      "db2diag -g level=Severe -time 2",
      "grep SEVERE db2diag.log | tail -2",
      "db2diag -readfile -last 2h",
    ],
    correct: [0],
    explanation:
      "db2diag -level filters by record level, and -H (history) limits by relative time (e.g. 2h, 1d). -g/-gi filter on field values (e.g. -g db=PRODDB). Know -fmt for custom output and -merge for DPF / multiple files.",
  },
  {
    id: "x-activity-vs-cache",
    domain: "diagnostics",
    difficulty: 4,
    question: "A statement has been running for 45 minutes. Which interface shows its in-flight metrics and state?",
    options: [
      "MON_GET_PKG_CACHE_STMT",
      "MON_GET_ACTIVITY (the replacement for MON_GET_ACTIVITY_DETAILS) filtered on the application handle",
      "SYSCAT.PACKAGES",
      "db2diag.log",
    ],
    correct: [1],
    explanation:
      "MON_GET_ACTIVITY reports currently executing activities with their accumulated metrics (rows read, wait times, state). The package cache view aggregates per statement across executions. Pair it with EXPLAIN_FROM_SECTION using the executable ID to get the plan actually in use.",
  },
  {
    id: "x-diagsize",
    domain: "diagnostics",
    difficulty: 3,
    question: "A runaway db2diag.log filled the diagnostic filesystem and blocked the instance. What prevents recurrence?",
    options: [
      "Set DIAGLEVEL to 0.",
      "Set DIAGSIZE (dbm cfg) to enable rotating diagnostic logs (db2diag.N.log) with a bounded total size. Put DIAGPATH on its own filesystem, add monitoring, and fix the source of the repeated messages.",
      "Delete db2diag.log with a cron job.",
      "Move DIAGPATH to /tmp.",
    ],
    correct: [1],
    explanation:
      "DIAGSIZE gives bounded rotation. DIAGLEVEL 0 blinds you for the next incident. The underlying repeated message is usually the actual problem to fix.",
  },
  {
    id: "x-latch",
    domain: "diagnostics",
    difficulty: 5,
    question:
      "High concurrency. CPU is moderate, throughput is flat, and TOTAL_EXTENDED_LATCH_WAIT_TIME is growing fast in MON_GET_WORKLOAD. Which step identifies the contended latch?",
    options: [
      "db2pd -latches (live holders/waiters) and MON_GET_EXTENDED_LATCH_WAIT (cumulative waits by latch name), then map the latch name to its component (e.g. buffer pool hash bucket, log, package cache).",
      "RUNSTATS on all tables.",
      "db2pd -hadr",
      "Increase LOCKLIST.",
    ],
    correct: [0],
    explanation:
      "Latches are short internal serialisation points, unrelated to locks. The latch name points at the subsystem: a hot index page, logging, catalog cache and so on. Remedies differ per latch. For example, hot insert contention on an ascending index can be relieved with RANDOM index ordering or by redesigning the key. Collecting db2fodc -hang or perf data is appropriate when it is severe.",
  },
  {
    id: "x-fodc",
    domain: "diagnostics",
    difficulty: 3,
    question: "The instance appears hung (no new connections, existing sessions frozen). What do you collect BEFORE restarting, for IBM support?",
    options: [
      "Nothing. Restart immediately to restore service.",
      "db2fodc -hang full (stacks, db2pd output, OS data), or at least several db2pd -stack all / -edus / -latches snapshots a few minutes apart. Then run db2support, open a case, and restart per incident process.",
      "Only the db2diag.log.",
      "A db2look of the database.",
    ],
    correct: [1],
    explanation:
      "Without data captured during the hang, root cause is usually impossible to establish, and it will recur. A quick, time-boxed collection (agreed in the runbook with the incident manager) balances service restoration against root-cause analysis. That balance is a typical interview discussion point.",
  },

  /* ═══════════════ AUTOMATION ═══════════════ */
  {
    id: "a-clp-rc",
    domain: "automation",
    difficulty: 4,
    question:
      "A shell script runs `db2 \"DELETE FROM STAGE.X WHERE LOAD_ID = $ID\"` and aborts with `if [ $? -ne 0 ]` on days when there is nothing to delete. Why?",
    options: [
      "The CLP returns 1 when no rows were found (SQL0100W), 2 for other warnings, 4 for errors, and 8 for system errors. The script must treat 0 and 1 (and possibly 2) as success.",
      "DELETE always returns 4 without COMMIT.",
      "The shell variable is not exported.",
      "The db2 command needs -s.",
    ],
    correct: [0],
    explanation:
      "The CLP return codes are a frequent source of fragile automation. Test explicitly: `rc=$?; if [ $rc -ge 4 ]; then fail; fi`, and capture SQLCODEs in logs. Also source db2profile, use `db2 -v` for audit output, and use `db2 -tvsf` for scripts (terminator ;, echo, stop on error).",
  },
  {
    id: "a-ansible-profile",
    domain: "automation",
    difficulty: 4,
    question:
      "An Ansible task with `become_user: db2inst1` and the `shell` module fails with `db2: command not found`. What is the cause, and what is the clean fix?",
    options: [
      "Ansible cannot run as non-root users.",
      "become does not start a login shell, so db2inst1's profile, and with it sqllib/db2profile, is not sourced. Source it explicitly (`. ~db2inst1/sqllib/db2profile && db2 ...`), or use become_flags '-i' where appropriate.",
      "The db2 binary must be copied to /usr/bin.",
      "Use the `command` module instead of `shell`.",
    ],
    correct: [1],
    explanation:
      "The CLP needs the instance environment (DB2INSTANCE, PATH, library path). Sourcing db2profile explicitly is deterministic and auditable. Also make tasks idempotent: query the current value first, set `changed_when` from the result, and use `failed_when` with the CLP return codes.",
  },
  {
    id: "a-rolling-fp",
    domain: "automation",
    difficulty: 5,
    question: "Correct order for a rolling fix pack update of an HADR pair (same Db2 version) with minimal downtime?",
    options: [
      "Update primary → update standby → db2updv on both.",
      "Update standby (stop instance, install FP, db2iupdt, start, verify PEER) → TAKEOVER HADR (graceful) on standby → update the old primary (now standby) → verify PEER → optionally fail back → run db2updv<ver> on the primary once all members are updated.",
      "Stop HADR, update both, re-initialise the standby from backup.",
      "Update both simultaneously with Ansible forks = 2.",
    ],
    correct: [1],
    explanation:
      "Rolling updates rely on the standby being allowed to run a newer fix pack level than the primary. In Ansible: `serial: 1`, explicit ordering by HADR role (queried at runtime, not hard-coded), health gates (db2pd -hadr: HADR_STATE = PEER, HADR_LOG_GAP ≈ 0) between steps, and a stop-on-failure strategy.",
  },
  {
    id: "a-python-inject",
    domain: "automation",
    difficulty: 3,
    question: "In a Python (ibm_db) housekeeping tool, which pattern is correct for a user-supplied schema filter?",
    options: [
      "ibm_db.exec_immediate(conn, f\"SELECT ... WHERE TABSCHEMA = '{schema}'\")",
      "stmt = ibm_db.prepare(conn, 'SELECT ... WHERE TABSCHEMA = ?'); ibm_db.execute(stmt, (schema,)), with credentials from a vault/secret, not in the script",
      "Build the SQL with .format() and escape quotes manually.",
      "Use the ibm_db_dbi cursor with % string formatting.",
    ],
    correct: [1],
    explanation:
      "Parameter markers prevent injection and also improve package cache reuse. Credentials come from Ansible Vault, a Kubernetes Secret, or an enterprise vault. Hard-coded passwords fail any BIO audit.",
  },

  /* ═══════════════ VERSIONS ═══════════════ */
  {
    id: "v-upgrade-path",
    domain: "versions",
    difficulty: 4,
    question: "A 10.5 FP11 database must end up on Db2 12.1. What is the supported path?",
    options: [
      "Direct upgrade 10.5 → 12.1.",
      "10.5 → 11.5 (a supported direct upgrade), then 11.5 → 12.1. Db2 12.1 supports direct upgrade from 11.5 and 11.1, not from 10.5.",
      "Only via db2move export/import.",
      "10.5 → 11.1 → 11.5 → 12.1 is mandatory.",
    ],
    correct: [1],
    explanation:
      "Each major release supports upgrade from the previous two releases. Plan each hop with db2ckupgrade, a backup, rebind/RUNSTATS strategy, explain-plan regression checks for critical SQL, and a fallback plan. Before committing to dates, verify the exact minimum fix pack levels in the current IBM upgrade documentation.",
  },
  {
    id: "v-hadr-upgrade",
    domain: "versions",
    difficulty: 5,
    question: "Upgrading an HADR pair to a new MAJOR version (e.g. 11.5 → 12.1). Which statement is correct?",
    options: [
      "It can be done fully rolling, with zero downtime, like a fix pack.",
      "A version upgrade requires an outage (rolling is only for fix/mod packs within a release). Since 11.1, the documented procedure lets the standby be upgraded without re-initialising it from a backup, as the standby replays the upgrade from the primary's logs.",
      "The standby must always be rebuilt from a new backup.",
      "HADR must be replaced by Q Replication for the upgrade.",
    ],
    correct: [1],
    explanation:
      "Major version upgrades change catalog and log formats, so there is no mixed-version HADR pair across major versions. Avoiding standby re-initialisation saves hours on large databases. Follow the documented order of instance and database upgrade on primary and standby exactly, and rehearse it on test first.",
  },
  {
    id: "v-post-upgrade",
    domain: "versions",
    difficulty: 4,
    question: "After a version upgrade, which step best protects critical query performance?",
    options: [
      "Nothing. The optimizer always improves.",
      "Capture EXPLAIN/plan baselines of critical statements BEFORE the upgrade. After it, collect statistics and rebind (db2rbind all), compare plans and timings against the baseline, and keep optimization profiles ready as a controlled fallback for regressions.",
      "Set DFT_QUERYOPT to 0.",
      "Disable automatic maintenance permanently.",
    ],
    correct: [1],
    explanation:
      "Optimizer changes between releases can alter plans. Some regressions are inevitable. A baseline lets you prove and quickly fix them. This is exactly the 'objective, evidence-based' approach public-sector change boards expect.",
  },
];
