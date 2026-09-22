import type { ConceptArea, TechConcept } from "@/types/interview";

/* ─────────────────────────────────────────────────────────
   IBM Interview — Technical Concept Library
   Covers every technical area named in the position.
   ───────────────────────────────────────────────────────── */

export const AREA_LABELS: Record<ConceptArea, string> = {
  core:        "Db2 LUW Core (10.5 → 12.1)",
  dpf:         "DPF / MPP & Partitioning",
  wlm:         "Workload Management",
  openshift:   "OpenShift / Kubernetes",
  tuning:      "Query Tuning & Memory",
  diagnostics: "Diagnostics & Monitoring",
  automation:  "Automation & Linux",
};

export const AREA_VACANCY_LINE: Record<ConceptArea, string> = {
  core:        "Extensive track record managing large-scale, high-concurrency enterprise Db2 environments (v10.5 through v12.1.5)",
  dpf:         "Expert knowledge of multi-partition topologies, MPP concepts, distribution keys, co-located joins, and table partitioning",
  wlm:         "WLM setup and tuning",
  openshift:   "Deploying and managing containerized Db2 environments on Red Hat OpenShift using Operators and Helm charts",
  tuning:      "Read complex EXPLAIN output, rewrite problematic SQL, optimize memory usage",
  diagnostics: "Leverage diagnostic tools (db2diag.log, db2pd, MON_GET routines)",
  automation:  "Linux/Unix administration, Shell scripting, Python, and Ansible for database lifecycle automation",
};

export const TECH_CONCEPTS: TechConcept[] = [
  /* ═══════════════════ CORE ═══════════════════ */
  {
    id: "core-architecture",
    area: "core",
    title: "Instance, database and the process model",
    summary:
      "What actually runs when a client connects: one multi-threaded engine process per member, with agents doing the work and background EDUs doing I/O. This is the map behind every diagnostic you will run.",
    blocks: [
      {
        heading: "The object hierarchy",
        body:
          "An installation can host several instances. An instance (db2inst1) is one database manager, with its own configuration (dbm cfg), its own port and its own sqllib. Inside an instance you have databases, each with its own configuration (db cfg), its own catalog, its own log stream and its own buffer pools.\n\nThe practical consequence: dbm-level parameters (SHEAPTHRES, INSTANCE_MEMORY, FCM) affect every database in the instance, while db-level parameters do not. Interviewers often check this boundary by asking where a specific parameter lives.",
        bullets: [
          "Instance-level: db2start/db2stop, dbm cfg, registry (db2set), FCM, connection port.",
          "Database-level: db cfg, buffer pools, table spaces, logs, catalog.",
          "Registry variables (db2set) usually need an instance recycle; many db cfg parameters are dynamic — know which are not.",
        ],
      },
      {
        heading: "Threads, not processes",
        body:
          "Since 9.5 on Linux, Db2 uses a threaded engine: one db2sysc process per member holds all EDUs (engine dispatchable units). Each connection gets a coordinator agent (db2agent); with intra-partition parallelism it spawns subagents (db2agntp). Prefetchers (db2pfchr) read ahead, page cleaners (db2pclnr) write dirty pages, and the logger (db2loggw/db2loggr) handles the log.\n\nThat is why `top` only ever shows db2sysc at high CPU, and why db2pd -edus is the tool that tells you which thread inside it is hot.",
        diagram: "process-model",
      },
      {
        heading: "Connection concurrency",
        body:
          "In high-concurrency estates, how agents are allocated matters as much as SQL quality. MAXAPPLS, MAX_COORDAGENTS and NUM_POOLAGENTS govern agent supply. Connection concentrator (MAX_CONNECTIONS > MAX_COORDAGENTS) lets many connections share fewer agents, which suits many short transactions.\n\nIn practice most enterprise estates put the pooling in the application server (JDBC connection pool) and keep the database side simple. Know both, and know that an oversized application pool is a common root cause of 'the database is slow'.",
      },
    ],
    mustKnow: [
      "One db2sysc process per member; work is done by EDUs (threads), not separate processes.",
      "Coordinator agent per connection; subagents only with INTRA_PARALLEL.",
      "dbm cfg vs db cfg vs registry — which level a parameter lives at, and what it takes to activate it.",
      "db2pd -edus is how you find the hot thread inside db2sysc.",
    ],
    interviewAngle:
      "Usually asked as 'walk me through what happens when an application runs a query' or 'CPU is at 100%, how do you find out what is doing it?'. They are checking whether your mental model is concrete.",
    relatedQuizIds: ["x-edus"],
  },
  {
    id: "core-memory",
    area: "core",
    title: "Memory model and STMM",
    summary:
      "A hierarchy of bounded sets: instance memory contains database shared memory, which contains buffer pools, sort, lock list and caches. Optimising memory is explicitly in the job description.",
    blocks: [
      {
        heading: "The hierarchy",
        body:
          "INSTANCE_MEMORY caps the whole instance. DATABASE_MEMORY covers database shared memory, from which the consumers are funded. Agent private memory (sort for private sorts, application heaps) sits alongside.\n\nAUTOMATIC values are computed as if the machine is yours alone. On a host with three instances, or inside a container, that assumption is false and is a classic cause of OOM kills.",
        diagram: "memory-model",
      },
      {
        heading: "STMM: what it does and what it needs",
        body:
          "The self-tuning memory manager measures the benefit of memory per consumer and moves it between them, in bounded steps, every few minutes. It tunes buffer pools, sort memory, lock list, package cache and database memory — but only the consumers set to AUTOMATIC.\n\nTwo conditions catch people out: STMM needs at least two tunable consumers to have something to trade between, and sort memory tuning requires the instance parameter SHEAPTHRES = 0 (the shared sort model). Its decisions are logged, so you can see what it actually did rather than guess.",
        bullets: [
          "Good fit: variable workloads where you cannot hand-tune every pool.",
          "Poor fit: several instances per host, containers with hard limits, DPF with heterogeneous members, sharp short spikes (STMM reacts in minutes).",
          "Always bound it: set INSTANCE_MEMORY explicitly in shared or containerised hosts, then let STMM work inside that bound.",
        ],
        code: {
          label: "Inspecting memory",
          content: `db2pd -db PRODDB -dbptnmem
db2pd -db PRODDB -memsets
db2 get db cfg for PRODDB show detail | grep -i -E "self_tuning|sortheap|locklist|pckcachesz"

SELECT MEMORY_SET_TYPE, MEMORY_SET_USED/1024 AS MB, MEMORY_SET_USED_HWM/1024 AS HWM_MB
  FROM TABLE(MON_GET_MEMORY_SET(NULL, NULL, -2));

SELECT MEMORY_POOL_TYPE, MEMORY_POOL_USED/1024 AS MB
  FROM TABLE(MON_GET_MEMORY_POOL(NULL, NULL, -2))
 ORDER BY MEMORY_POOL_USED DESC FETCH FIRST 10 ROWS ONLY;`,
        },
      },
      {
        heading: "Sort memory in particular",
        body:
          "SORTHEAP is the per-sort allotment; SHEAPTHRES_SHR is the database-wide ceiling for shared sorts. Sorts, hash joins and table queues all consume it. When a sort exceeds its allotment it spills to a system temporary table space, which turns memory work into I/O work.\n\nDiagnose with SORT_OVERFLOWS, HASH_JOIN_OVERFLOWS and TOTAL_SORTS. Raising SORTHEAP blindly is a trap: it is per-sort, so with high concurrency you can exhaust shared sort memory and make things worse. Often the real fix is a better plan (an index that removes the sort) or WLM concurrency control.",
      },
    ],
    mustKnow: [
      "INSTANCE_MEMORY → DATABASE_MEMORY → buffer pools / sort / lock list / package cache.",
      "STMM needs ≥ 2 AUTOMATIC consumers; sort tuning needs dbm SHEAPTHRES = 0.",
      "AUTOMATIC assumes exclusive use of the host — dangerous with multiple instances or containers.",
      "SORTHEAP is per sort; SHEAPTHRES_SHR is the shared ceiling. Overflows mean spilling to temp.",
    ],
    interviewAngle:
      "'How would you tune memory?' — a weak answer names parameters, a strong answer describes the hierarchy, what you measure first, and the boundary conditions where you would not trust STMM.",
    relatedQuizIds: ["t-stmm-sheapthres", "t-stmm-two-consumers", "o-oom"],
    relatedScenarioIds: ["sc-memory-oom", "sc-temp-explosion"],
  },
  {
    id: "core-storage",
    area: "core",
    title: "Storage: table spaces, buffer pools and I/O",
    summary:
      "How pages get from disk into memory, and the knobs that govern it: page size, extents, prefetch, containers and cleaning.",
    blocks: [
      {
        heading: "Automatic storage and table spaces",
        body:
          "Modern databases use automatic storage with storage groups (CREATE STOGROUP), where Db2 manages containers for you. Table spaces are regular (data), large (default for table data, supports LOBs and large RIDs), system temporary (sorts, hash joins, reorgs) and user temporary (declared global temp tables).\n\nPage size (4/8/16/32 KB) is fixed at creation and must be matched by a buffer pool of the same page size. A system temporary table space of the largest page size you use is a common requirement people forget.",
        bullets: [
          "EXTENTSIZE: the striping unit across containers. PREFETCHSIZE: how much is read ahead — best left AUTOMATIC.",
          "Automatic prefetch = extent size × containers × disks per container, so a single container makes Db2 assume one spindle. DB2_PARALLEL_IO corrects that.",
          "NUM_IOSERVERS (prefetchers) and NUM_IOCLEANERS (page cleaners) are normally AUTOMATIC.",
        ],
      },
      {
        heading: "Buffer pools and hit ratio honesty",
        body:
          "Buffer pools cache data and index pages. The naive hit ratio (logical − physical) / logical counts prefetched pages as misses, so a well-prefetched scan workload looks bad while agents never actually wait.\n\nJudge effectiveness by time, not ratio: POOL_READ_TIME per physical read, the share of synchronous versus asynchronous reads, and PREFETCH_WAIT_TIME. Separate buffer pools per workload (e.g. a small pool for a hot lookup table) give you control and clearer measurements.",
        code: {
          label: "I/O reality check",
          content: `SELECT BP_NAME,
       POOL_DATA_P_READS, POOL_ASYNC_DATA_READS,
       POOL_READ_TIME*1.0 / NULLIF(POOL_DATA_P_READS+POOL_INDEX_P_READS,0) AS MS_PER_READ,
       PREFETCH_WAIT_TIME, POOL_DATA_WRITES
  FROM TABLE(MON_GET_BUFFERPOOL(NULL, -2));`,
        },
      },
      {
        heading: "Reorg and space maintenance",
        body:
          "Updates that grow a row beyond its free space create overflow records (an extra page access per read). Deletes leave sparse pages. REORGCHK reports the classic F1–F8 formulas; MON_GET_TABLE gives OVERFLOW_ACCESSES and MON_GET_INDEX gives index health.\n\nClassic REORG rebuilds the table (offline or with ALLOW READ ACCESS); inplace/online REORG is incremental and resumable but less thorough. Set PCTFREE to leave room for growth, and remember indexes need REORG too. Automatic maintenance can handle routine cases, but you should be able to argue when to schedule it yourself.",
      },
    ],
    mustKnow: [
      "Page size is fixed at creation and needs a matching buffer pool; keep a large-page temp table space.",
      "Automatic prefetch size depends on the container count — DB2_PARALLEL_IO fixes single-LUN setups.",
      "Hit ratio alone is misleading; use per-read latency and sync/async split.",
      "Overflow records come from growing updates; fix with REORG + PCTFREE.",
    ],
    interviewAngle:
      "Often arrives as a war story: 'storage was migrated and everything got slower — what do you check?'. They want Db2 metrics tied down to OS evidence.",
    relatedQuizIds: ["t-bp-hitratio", "t-parallel-io", "t-overflow"],
    relatedScenarioIds: ["sc-io-migration"],
  },
  {
    id: "core-logging-recovery",
    area: "core",
    title: "Logging, backup and recovery",
    summary:
      "Write-ahead logging, the archive chain, and the recovery options you must be able to explain under pressure — including what each choice costs in RTO and RPO.",
    blocks: [
      {
        heading: "Write-ahead logging",
        body:
          "Every change is written to the log buffer and flushed to the active log before commit returns. Commit latency is therefore bounded by log write latency, which is why the active log belongs on the lowest-latency storage you have, separate from data containers.\n\nCircular logging (no roll-forward) is only for throwaway databases. Production uses archive logging (LOGARCHMETH1 to disk, TSM or object storage), which enables online backups and roll-forward recovery.",
        bullets: [
          "LOGPRIMARY / LOGSECOND / LOGFILSIZ size the active log; running out gives SQL0964C (transaction log full).",
          "The usual cause of log full is one long transaction without commits, not undersized logs.",
          "LOGBUFSZ matters only if NUM_LOG_BUFFER_FULL > 0. MINCOMMIT is deprecated.",
          "LOGINDEXBUILD controls whether index builds are logged — important for HADR standby consistency.",
        ],
      },
      {
        heading: "Backup and restore",
        body:
          "Online backups need archive logging; INCLUDE LOGS makes a backup self-contained. Incremental (since last full) and delta (since last backup of any type) reduce volume at the cost of restore complexity — TRACKMOD must be on.\n\nRestore then roll forward to end of logs or to a point in time. The recovery history file records what exists; db2ckrst tells you the restore sequence you will need. Backups to object storage work directly through a storage access alias (DB2REMOTE://), which is how containerised estates usually do it.",
        code: {
          label: "The commands you should say without hesitating",
          content: `BACKUP DATABASE PRODDB ONLINE TO DB2REMOTE://s3alias/bucket/proddb
  COMPRESS INCLUDE LOGS;

RESTORE DATABASE PRODDB FROM /backup TAKEN AT 20260921120000;
ROLLFORWARD DATABASE PRODDB TO 2026-09-21-14.30.00 USING LOCAL TIME AND COMPLETE;

db2ckrst -d PRODDB -t 20260921120000 -r database
SELECT * FROM SYSIBMADM.DB_HISTORY WHERE OPERATION = 'B' ORDER BY START_TIME DESC;`,
        },
      },
      {
        heading: "Crash recovery and why it matters in containers",
        body:
          "After an abnormal termination, Db2 replays committed work and undoes uncommitted work at activation. Duration depends on how much log must be replayed, which page cleaning influences (PAGE_AGE_TRGT_MCR in current releases; SOFTMAX in older ones).\n\nIn Kubernetes this becomes an availability problem: a liveness probe that is shorter than crash recovery kills the pod mid-recovery and creates a restart loop. Knowing that link between a classic Db2 concept and a container behaviour is exactly the kind of answer that separates candidates.",
      },
    ],
    mustKnow: [
      "Commit waits for the log write: log latency = commit latency.",
      "Archive logging enables online backup and roll-forward; circular does not.",
      "SQL0964C is usually a long uncommitted transaction, not small logs.",
      "Crash recovery time is driven by log replay volume; page cleaning tunes it.",
    ],
    interviewAngle:
      "Expect a recovery scenario with a time limit: 'a table was dropped at 14:20, the last full backup is from 02:00 — what do you do?'. Talk through options, RTO/RPO and who decides.",
    relatedQuizIds: ["t-log-latency"],
    relatedScenarioIds: ["sc-ocp-crashloop"],
  },
  {
    id: "core-hadr",
    area: "core",
    title: "HADR and high availability",
    summary:
      "Log shipping to one or more standbys, with four synchronisation modes that trade commit latency against data loss. The mode choice is a business decision you must be able to frame.",
    blocks: [
      {
        heading: "Sync modes and commit points",
        body:
          "The only difference between the modes is how far the log record must travel before the primary's commit returns. That single fact answers most HADR questions.",
        diagram: "hadr-modes",
      },
      {
        heading: "States, takeover and reads on standby",
        body:
          "A healthy pair is in PEER state with a log gap near zero. A graceful TAKEOVER switches roles with no data loss; TAKEOVER BY FORCE is for when the primary is gone, and the peer window governs how much protection you had at that moment.\n\nReads on standby (ROS) lets reporting run against the standby, with the caveat that replay can block readers and that uncommitted-read semantics apply in some cases. Multiple standbys are supported through a target list (one principal plus auxiliaries), which is common for a DR site plus a local HA standby.",
        bullets: [
          "Monitor with db2pd -hadr or MON_GET_HADR: state, log gap, LOG_HADR_WAIT_TIME per commit.",
          "Automatic failover needs a cluster manager — Pacemaker is the supported integrated option in current releases; TSA/db2haicu is the legacy path.",
          "Client reroute (ACR) or a virtual address is what actually moves the applications; HADR alone does not.",
          "Rolling fix packs across an HADR pair are supported; a major version upgrade requires an outage.",
        ],
        code: {
          label: "HADR health",
          content: `db2pd -db PRODDB -hadr

SELECT HADR_ROLE, HADR_STATE, HADR_SYNCMODE, HADR_CONNECT_STATUS,
       HADR_LOG_GAP, PRIMARY_LOG_TIME, STANDBY_REPLAY_LOG_TIME
  FROM TABLE(MON_GET_HADR(NULL));

TAKEOVER HADR ON DATABASE PRODDB;                      -- graceful, run on standby
TAKEOVER HADR ON DATABASE PRODDB BY FORCE PEER WINDOW ONLY;  -- primary lost`,
        },
      },
    ],
    mustKnow: [
      "SYNC = standby disk; NEARSYNC = standby memory; ASYNC = network layer; SUPERASYNC = never waits.",
      "PEER state + log gap ≈ 0 is the health check before any maintenance action.",
      "Graceful takeover vs by force, and what the peer window protects.",
      "HADR moves the database; client reroute moves the applications.",
    ],
    interviewAngle:
      "'We need RPO zero between two data centres' — they want you to quantify the latency cost, state the residual risk, and give the decision back to the risk owner with a recommendation.",
    relatedQuizIds: ["v-hadr-upgrade", "o-hadr-dns"],
    relatedScenarioIds: ["sc-hadr-dc", "sc-ocp-crashloop"],
  },
  {
    id: "core-concurrency",
    area: "core",
    title: "Concurrency: isolation, locking and currently committed",
    summary:
      "In high-concurrency OLTP, most 'slow database' complaints are concurrency problems. You need the isolation levels, the lock modes and the escalation mechanics cold.",
    blocks: [
      {
        heading: "Isolation levels",
        bullets: [
          "RR (repeatable read): locks the whole scanned set; no phantoms; most restrictive.",
          "RS (read stability): locks qualifying rows; phantoms possible. WebSphere's historical default for Db2.",
          "CS (cursor stability): the default; locks the current row only. With CUR_COMMIT on, readers see the last committed version instead of waiting.",
          "UR (uncommitted read): reads uncommitted data. Fine for some reporting, a data-integrity risk for citizen-facing output.",
        ],
        body:
          "Currently committed (CUR_COMMIT, default on from 9.7) is the reason modern Db2 OLTP rarely has reader-writer waits — but it applies to CS only. If you see waiters requesting NS locks, someone is running RS and CUR_COMMIT will not save them.",
      },
      {
        heading: "Locks, waits and escalation",
        body:
          "Locks live in the LOCKLIST. When one application exceeds MAXLOCKS percent of it, or the list fills, Db2 escalates row locks to a table lock — cheap for memory, catastrophic for concurrency. The db2diag.log records escalations with the table and application.\n\nThe durable fix is almost always in the application: bounded units of work, commit frequency, and not doing slow external I/O inside a transaction. LOCKTIMEOUT should be a bounded value; -1 turns timeouts into hangs. DLCHKTIME governs deadlock detection, and the victim is chosen by the engine.",
        code: {
          label: "Finding the blocker",
          content: `db2pd -db PRODDB -wlocks               -- live: holder and waiters
SELECT * FROM TABLE(MON_GET_APPL_LOCKWAIT(NULL, -2));

-- History (set up before the incident, not during)
CREATE EVENT MONITOR LOCKEVMON FOR LOCKING WRITE TO UNFORMATTED EVENT TABLE;
UPDATE DB CFG FOR PRODDB USING MON_LOCKWAIT HIST_AND_VALUES MON_LW_THRESH 5000000;`,
        },
      },
    ],
    mustKnow: [
      "Currently committed works for CS only, not RS/RR, and not for cursors with update intent.",
      "NS lock mode in a wait chain points at RS isolation.",
      "Lock escalation is a symptom of a too-large unit of work; MAXLOCKS = 100 is not a fix.",
      "LOCKTIMEOUT -1 converts a timeout into an outage.",
    ],
    interviewAngle:
      "The 'every morning at 9 the portal is slow' scenario. They listen for: measure where time goes first, then find the holder, then fix ownership — application, scheduler or DBA.",
    relatedQuizIds: ["t-cur-commit-rs", "t-lock-escal", "x-wlocks"],
    relatedScenarioIds: ["sc-oltp-lockwaits"],
  },
  {
    id: "core-versions",
    area: "core",
    title: "Version landscape 10.5 → 12.1 and upgrades",
    summary:
      "The estate in this role spans several major releases. You need the upgrade paths, what changed at each step, and how you protect performance across an upgrade.",
    blocks: [
      {
        heading: "What each release brought (the parts that matter operationally)",
        bullets: [
          "10.5 — BLU Acceleration (column-organized tables, single partition), adaptive compression, expression-based indexes.",
          "11.1 — column-organized tables in DPF/MPP, HADR upgrade without re-initialising the standby, optimizer and BLU improvements.",
          "11.5 — the long-lived enterprise baseline: integrated Pacemaker for HA, remote storage aliases (DB2REMOTE://), continued BLU and container investment.",
          "12.1 — the current family, with AI/ML-assisted optimizer capability among its headline features. Confirm mod-pack specifics in the documentation for the exact level the client runs.",
        ],
        body:
          "Be careful with feature-by-mod-pack claims in an interview. It is stronger to say 'that arrived in the 11.x family, and I would confirm the exact fix pack in the docs' than to state a wrong number confidently.",
      },
      {
        heading: "Upgrade paths and method",
        body:
          "A release supports direct upgrade from the previous two releases. So 10.5 → 12.1 is a two-hop journey (10.5 → 11.5 → 12.1), while 11.5 → 12.1 is direct. Always verify minimum fix pack prerequisites for the exact source level.\n\nThe method matters more than the commands: db2ckupgrade, a full backup, a rehearsal in acceptance with production-like data and a fallback that you have actually tested.",
        code: {
          label: "Upgrade skeleton",
          content: `db2ckupgrade PRODDB -l /tmp/ckupgrade.log      # before anything
db2 backup database PRODDB to /backup             # fallback
db2stop ; db2iupgrade /opt/ibm/db2/V12.1 ...      # instance
db2 UPGRADE DATABASE PRODDB                        # database
db2rbind PRODDB -l /tmp/rbind.log all              # rebind packages
RUNSTATS ...                                       # refresh statistics`,
        },
      },
      {
        heading: "Protecting performance across the hop",
        body:
          "Optimizer behaviour changes between releases, so some plans will change — usually for the better, occasionally not. The professional control is a baseline: capture EXPLAIN plans and timings for your critical statements before the upgrade, compare after, and keep optimization profiles ready as a documented, temporary fallback for any regression.\n\nThis is the single most valuable thing to say about upgrades in a public-sector interview, because it converts 'trust me' into evidence.",
      },
    ],
    mustKnow: [
      "12.1 upgrades directly from 11.5 and 11.1 — not from 10.5.",
      "Rolling updates apply to fix packs, not major versions; a version upgrade needs an outage.",
      "Since 11.1 the HADR standby need not be re-initialised during an upgrade.",
      "Baseline plans before, compare after, rebind and re-collect statistics.",
    ],
    interviewAngle:
      "'How would you take our 10.5 estate to 12.1?' — they are testing planning, risk and honesty about what you would verify rather than recite.",
    relatedQuizIds: ["v-upgrade-path", "v-hadr-upgrade", "v-post-upgrade", "d-blu-mpp"],
    relatedScenarioIds: ["sc-upgrade-regression"],
  },

  /* ═══════════════════ DPF ═══════════════════ */
  {
    id: "dpf-topology",
    area: "dpf",
    title: "Multi-partition topology and MPP concepts",
    summary:
      "Shared-nothing parallelism: one logical database spread over members that each own their slice of data, CPU and storage.",
    blocks: [
      {
        heading: "How the pieces fit",
        body:
          "db2nodes.cfg defines the members (partition number, host, logical port). A database partition group spans a set of members; table spaces are created in a partition group, and tables inherit that span. The catalog lives on the catalog partition, and applications connect to a coordinator, which distributes work and assembles results.\n\nBecause nothing is shared, scaling is horizontal, but every design question becomes 'where does this row live, and does the work stay local?'.",
        diagram: "dpf-topology",
      },
      {
        heading: "The economics of MPP",
        bullets: [
          "Elapsed time equals the slowest member: skew is the primary enemy, ahead of hardware.",
          "FCM carries rows between members; exhaustion shows up as SQL6040C. Monitor with db2pd -fcm.",
          "A coordinator/catalog partition usually holds no large fact data, because it does final aggregation and result return.",
          "Small tables live in a single-partition group or are replicated; large facts are spread.",
          "Intra-partition parallelism (INTRA_PARALLEL, DFT_DEGREE, or per-workload MAXIMUM DEGREE) multiplies with inter-partition parallelism — be deliberate, not greedy.",
        ],
        code: {
          label: "Topology basics",
          content: `db2 "SELECT * FROM TABLE(DB_PARTITIONS())"
db2 list database partition groups show detail
db2_all "db2pd -db DWHDB -tablespaces | head"       -- run across members
db2 "SELECT DBPARTITIONNUM(PERSON_ID) AS P, COUNT(*) FROM DWH.F_EVENT GROUP BY 1 ORDER BY 1"`,
        },
      },
    ],
    mustKnow: [
      "Shared-nothing: each member owns data, memory and CPU; db2nodes.cfg defines them.",
      "Partition groups scope table spaces and therefore tables.",
      "The slowest member defines query elapsed time.",
      "FCM is the inter-member transport; SQL6040C means buffer exhaustion.",
    ],
    interviewAngle:
      "Often opens with 'explain MPP to me' and then narrows to a design decision. Keep the explanation short and move quickly to trade-offs — that is what marks experience.",
    relatedQuizIds: ["d-coordinator", "d-fcm", "d-stmm-dpf"],
    relatedScenarioIds: ["sc-dpf-skew"],
  },
  {
    id: "dpf-distribution",
    area: "dpf",
    title: "Distribution keys and skew",
    summary:
      "The single most consequential design decision in DPF. A hash of the key picks the member, so key choice determines both balance and whether joins stay local.",
    blocks: [
      {
        heading: "How distribution works",
        body:
          "DISTRIBUTE BY HASH (cols) hashes the key value into a partitioning map entry, which maps to a member. Identical values always land on the same member — which is why a low-cardinality key with dominant values cannot be balanced by adding members or by REDISTRIBUTE.\n\nChoose for: high cardinality, even value distribution, stability (not frequently updated), and alignment with the dominant join. Those goals compete, and saying so out loud is the mark of a designer rather than a reciter.",
        bullets: [
          "Validate before committing: DBPARTITIONNUM() counts on a sample, target max/avg close to 1.",
          "Changing the key on an existing table means rebuilding it (ADMIN_MOVE_TABLE onto a pre-created target, or unload/load).",
          "REDISTRIBUTE rebalances the map after adding members; it cannot split a single hash value.",
          "Random or generated keys distribute perfectly but destroy collocation — a common and costly mistake.",
        ],
      },
    ],
    mustKnow: [
      "Same value → same member, always.",
      "Skew is measured with DBPARTITIONNUM(), not assumed.",
      "Adding members does not fix skew from a low-cardinality key.",
      "Key choice trades even spread against join collocation.",
    ],
    interviewAngle:
      "Expect 'how do you choose a distribution key' followed by 'this table is skewed, what now?'. The second question is where they find out if you have really done it.",
    relatedQuizIds: ["d-skew"],
    relatedScenarioIds: ["sc-dpf-skew"],
  },
  {
    id: "dpf-joins",
    area: "dpf",
    title: "Co-located joins and table queues",
    summary:
      "Whether a join is local or needs to move rows across the interconnect is visible in the plan as a table queue — and it usually decides whether a query takes seconds or hours.",
    blocks: [
      {
        heading: "The three strategies",
        body:
          "A collocated join runs entirely within each member, with no table queue. If the rows are not where they need to be, the optimizer either directs them (DTQ, re-hash one side to the matching member) or broadcasts them (BTQ, every row to every member). Broadcasting a large table multiplies work by the member count.",
        diagram: "join-strategies",
      },
      {
        heading: "Requirements for collocation",
        bullets: [
          "Both tables in the same partition group (identical partitioning map).",
          "Distribution keys with the same number of columns and pairwise compatible types.",
          "Equality join predicates on all distribution key columns.",
          "Column names are irrelevant — a favourite trick question.",
        ],
        body:
          "For small dimensions, a replicated MQT (DISTRIBUTE BY REPLICATION) puts a copy on every member so joins are always local. Remember to refresh it and run statistics, and to weigh the maintenance cost against the join benefit.",
        code: {
          label: "Replicated dimension",
          content: `CREATE TABLE DWH.D_MUNICIPALITY_R AS (SELECT * FROM DWH.D_MUNICIPALITY)
  DATA INITIALLY DEFERRED REFRESH IMMEDIATE
  DISTRIBUTE BY REPLICATION IN TS_DIM_R;
REFRESH TABLE DWH.D_MUNICIPALITY_R;
RUNSTATS ON TABLE DWH.D_MUNICIPALITY_R WITH DISTRIBUTION;`,
        },
      },
    ],
    mustKnow: [
      "TQ types: DTQ directed, BTQ broadcast, merging variants preserve order.",
      "A BTQ over a large table means wrong key design or a wrong estimate.",
      "Collocation needs same group, same key shape, equality on all key columns.",
      "Replicated MQTs are the standard answer for small dimensions.",
    ],
    interviewAngle:
      "They may show a plan fragment and ask what is wrong. Name the operator, explain the data movement, then give both fixes: design (key/replication) and statistics (estimate).",
    relatedQuizIds: ["d-colocation", "d-btq"],
    relatedScenarioIds: ["sc-dpf-skew"],
  },
  {
    id: "dpf-table-partitioning",
    area: "dpf",
    title: "Table partitioning, MDC and roll-in/roll-out",
    summary:
      "Range partitioning within each member: the mechanism behind fast data lifecycle management and partition elimination. Composable with hash distribution and MDC.",
    blocks: [
      {
        heading: "Three orthogonal levels",
        body:
          "Distribution spreads rows across members; range partitioning splits each member's data into data partitions by a range (usually time); MDC clusters rows into blocks by dimension values. They compose, and being able to state which does what is a standard check.",
        diagram: "partitioning-levels",
      },
      {
        heading: "Roll-in and roll-out",
        body:
          "ATTACH PARTITION brings a pre-loaded staging table in as a new partition; DETACH removes one (asynchronously) into a standalone table. This turns a monthly load and purge into metadata operations instead of mass INSERT/DELETE — no log explosion, no long locks.\n\nThe cost sits in SET INTEGRITY after an attach: it validates ranges and maintains indexes. Nonpartitioned (global) indexes must be updated for every new row, which is what makes attaches slow. With partitioned indexes and matching indexes pre-built on the staging table, the index work largely disappears.",
        bullets: [
          "A unique index can only be partitioned if it includes the range-partitioning key — a real design constraint.",
          "Use the ALLOW READ/WRITE ACCESS options on SET INTEGRITY to protect availability.",
          "Dependent MQTs are refreshed separately; do not bundle them into the same window.",
          "Partition elimination shows up in db2exfmt as DP Elim Predicates.",
        ],
        code: {
          label: "Monthly roll-in",
          content: `CREATE INDEX STG.IX_PERSON ON STG.STG_2026_09 (PERSON_ID);   -- match partitioned indexes first
ALTER TABLE DWH.F_TAX_EVENT ATTACH PARTITION P2026_09
  STARTING '2026-09-01' ENDING '2026-09-30' FROM STG.STG_2026_09;
SET INTEGRITY FOR DWH.F_TAX_EVENT ALLOW READ ACCESS IMMEDIATE CHECKED;

ALTER TABLE DWH.F_TAX_EVENT DETACH PARTITION P2019_09 INTO STG.OLD_2019_09;`,
        },
      },
    ],
    mustKnow: [
      "ATTACH/DETACH make lifecycle management metadata work, not data movement.",
      "SET INTEGRITY cost is driven by global index maintenance.",
      "Partitioned indexes + matching staging indexes make attach fast.",
      "Unique indexes must contain the partitioning key to be partitioned.",
    ],
    interviewAngle:
      "'How do you load a new month into a 40 TB fact table without impacting users?' — a scenario where they expect attach/detach, index strategy and availability options.",
    relatedQuizIds: ["d-attach", "d-three-levels"],
    relatedScenarioIds: ["sc-rollin"],
  },

  /* ═══════════════════ WLM ═══════════════════ */
  {
    id: "wlm-objects",
    area: "wlm",
    title: "WLM objects: identify, place, classify",
    summary:
      "Workload management starts by making work identifiable. Everything else — priority, limits, reporting — depends on that first step.",
    blocks: [
      {
        heading: "The object chain",
        body:
          "A connection is matched to a WORKLOAD by its attributes (session user, application name, client accounting string, address). The workload assigns it to a SERVICE SUPERCLASS. Within a superclass, a work action set can map individual activities to SUBCLASSES based on a work class (typically estimated cost in timerons).\n\nUnmatched connections land in SYSDEFAULTUSERWORKLOAD → SYSDEFAULTUSERCLASS. Monitoring that default class is how you discover work nobody told you about.",
        diagram: "wlm-hierarchy",
      },
      {
        heading: "A worked example",
        code: {
          label: "Separating reporting from OLTP",
          content: `CREATE SERVICE CLASS SC_REPORTING;
CREATE SERVICE CLASS RPT_SHORT UNDER SC_REPORTING;
CREATE SERVICE CLASS RPT_LONG  UNDER SC_REPORTING;

CREATE WORKLOAD WL_BI APPLNAME('BI_TOOL') SERVICE CLASS SC_REPORTING;
GRANT USAGE ON WORKLOAD WL_BI TO PUBLIC;

CREATE WORK CLASS SET WCS_RPT
 (WORK CLASS WC_SMALL WORK TYPE READ FOR TIMERONCOST FROM 0 TO 999999,
  WORK CLASS WC_BIG   WORK TYPE READ FOR TIMERONCOST FROM 1000000 TO UNBOUNDED);

CREATE WORK ACTION SET WAS_RPT FOR SERVICE CLASS SC_REPORTING USING WORK CLASS SET WCS_RPT
 (WORK ACTION WA_SMALL ON WORK CLASS WC_SMALL MAP ACTIVITY TO RPT_SHORT,
  WORK ACTION WA_BIG   ON WORK CLASS WC_BIG   MAP ACTIVITY TO RPT_LONG);`,
        },
      },
    ],
    mustKnow: [
      "Workload = identity; service class = placement; work class/action = classification by cost.",
      "SYSDEFAULTUSERWORKLOAD catches everything unmapped — watch it.",
      "Remapping only works between subclasses of the same superclass.",
      "GRANT USAGE on a workload, or nothing will use it.",
    ],
    interviewAngle:
      "'Design WLM for our mixed workload' is a whiteboard favourite. Structure your answer as identify → place → classify → bound → monitor and you will sound like someone who has built it.",
    relatedQuizIds: ["w-defaults", "w-remap"],
    relatedScenarioIds: ["sc-wlm-design", "sc-temp-explosion"],
  },
  {
    id: "wlm-controls",
    area: "wlm",
    title: "Thresholds, CPU control and WLM monitoring",
    summary:
      "The enforcement layer: what stops a runaway query, what guarantees CPU to the portal, and how you prove afterwards that the policy worked.",
    blocks: [
      {
        heading: "Predictive vs reactive thresholds",
        bullets: [
          "Predictive — ESTIMATEDSQLCOST, evaluated before execution. Great for blocking monsters up front; only as good as your statistics.",
          "Reactive — ACTIVITYTOTALTIME, CPUTIME, SQLTEMPSPACE, SQLROWSRETURNED, evaluated during execution.",
          "Concurrency — CONCURRENTDBCOORDACTIVITIES, which queues rather than rejects.",
          "Actions — COLLECT ACTIVITY DATA (evidence), CONTINUE (monitor only), STOP EXECUTION (kill), REMAP ACTIVITY (priority aging).",
        ],
        body:
          "The introduction method matters as much as the values: run everything in CONTINUE + COLLECT mode for a week or two, calibrate against real data, agree limits with the business owner, then enforce. Turning on STOP EXECUTION on day one is how DBAs lose the trust of their users.",
      },
      {
        heading: "CPU: shares versus limits",
        body:
          "With the WLM dispatcher enabled, service classes get CPU shares. Soft shares may borrow idle CPU; hard shares are bounded under contention; CPU LIMIT is an absolute cap that applies even when the machine is idle. If the requirement is 'never more than 30%, ever', that is CPU LIMIT — the distinction is a favourite interview detail.",
        code: {
          label: "Controls and evidence",
          content: `UPDATE DBM CFG USING WLM_DISPATCHER YES WLM_DISP_CPU_SHARES YES;
ALTER SERVICE CLASS SC_PORTAL SOFT CPU SHARES 6000;
ALTER SERVICE CLASS SC_ETL    HARD CPU SHARES 1000 CPU LIMIT 30;

CREATE THRESHOLD TH_RPT_TEMP FOR SERVICE CLASS SC_REPORTING ACTIVITIES
 ENFORCEMENT DATABASE PARTITION WHEN SQLTEMPSPACE > 150 G
 COLLECT ACTIVITY DATA WITH DETAILS, SECTION STOP EXECUTION;

SELECT SERVICE_SUPERCLASS_NAME, SERVICE_SUBCLASS_NAME,
       COORD_ACT_COMPLETED_TOTAL, CONCURRENT_ACT_TOP, TOTAL_CPU_TIME
  FROM TABLE(MON_GET_SERVICE_SUBCLASS_STATS(NULL,NULL,-2,NULL));`,
        },
      },
    ],
    mustKnow: [
      "ESTIMATEDSQLCOST is the predictive one; the rest are reactive.",
      "CPU LIMIT caps absolutely; soft shares borrow idle capacity.",
      "Queue time is policy, not slowness — and you can prove it with MON_GET_QUEUE_STATS.",
      "Always calibrate in monitor mode before enforcing.",
    ],
    interviewAngle:
      "A public-sector panel will care about the governance as much as the syntax: who agreed the limits, how users were informed, and how you report per consumer.",
    relatedQuizIds: ["w-predictive", "w-cpu-limit", "w-queue-monitor"],
    relatedScenarioIds: ["sc-wlm-design", "sc-temp-explosion"],
  },

  /* ═══════════════════ OPENSHIFT ═══════════════════ */
  {
    id: "ocp-operator",
    area: "openshift",
    title: "Operators, Helm and the Db2U deployment model",
    summary:
      "On OpenShift you stop administering a server and start declaring a desired state. Understanding the reconciliation loop explains most of the day-to-day differences.",
    blocks: [
      {
        heading: "Helm vs Operator",
        body:
          "Helm is a package manager: it renders templates and applies them at install or upgrade time, then stops. An operator is a controller that runs continuously, watching a custom resource and reconciling the cluster toward it — so it handles day-2 work like scaling, upgrades and self-healing.\n\nIn practice you often use both: OLM or Helm installs the operator, and Db2 itself is then managed through custom resources (Db2uInstance / Db2uCluster).",
        diagram: "db2u-openshift",
      },
      {
        heading: "Consequences for a DBA",
        bullets: [
          "The CR is the source of truth. Imperative changes via oc exec may be reconciled away and are invisible to audit.",
          "Keep CRs in Git (GitOps), reviewed and versioned — this maps directly onto public-sector change management.",
          "Know the Db2U component layout: the engine pod(s), plus operator-managed sidecars and supporting services.",
          "oc/kubectl fluency is expected: get/describe/logs/exec, events, and reading a failing pod's status.",
        ],
        code: {
          label: "Daily commands",
          content: `oc get db2uinstance -n db2                     # the CR and its status
oc describe pod c-db2-db2u-0 -n db2            # events: scheduling, probes, volumes
oc logs c-db2-db2u-0 -c db2u --previous        # why the last container died
oc exec -it c-db2-db2u-0 -- su - db2inst1 -c "db2pd -db PRODDB -hadr"
oc get pvc,sc -n db2                           # storage classes and claims`,
        },
      },
    ],
    mustKnow: [
      "Helm = install-time templating; operator = continuous reconciliation.",
      "Configuration belongs in the CR, not in the pod.",
      "Db2uInstance / Db2uCluster are the custom resources you work with.",
      "Everything auditable goes through Git and change control.",
    ],
    interviewAngle:
      "Be precise about hands-on depth. Saying 'I have run these commands in a lab, and here is the model I understand' earns more trust than implying production years you do not have.",
    relatedQuizIds: ["o-operator-vs-helm", "o-drift"],
  },
  {
    id: "ocp-storage-network",
    area: "openshift",
    title: "Storage, networking and HADR in containers",
    summary:
      "The two places where container Db2 differs most from VMs: how volumes are attached and how stable network identity is provided.",
    blocks: [
      {
        heading: "Storage",
        bullets: [
          "Shared metadata for MPP needs ReadWriteMany (CephFS/ODF, NFS) because pods share the instance home.",
          "Data and active logs want low-latency block storage, ReadWriteOnce, one claim per pod.",
          "Active logs on NFS is a classic latency mistake — commit latency is log write latency.",
          "Backups and archive logs go to RWX volumes or straight to object storage via DB2REMOTE://.",
          "RWO volumes attach to one node at a time: during a node failure you may see Multi-Attach errors until the old attachment is released.",
        ],
      },
      {
        heading: "Networking and HADR",
        body:
          "Pods are ephemeral and their IPs change, so HADR_REMOTE_HOST must point at a stable Service DNS name (or an exposed route/address for cross-cluster). Applications reach the database through a Service, which is also what makes a role switch transparent.\n\nFor resilience, primary and standby must not share a node: podAntiAffinity with requiredDuringScheduling and topologyKey kubernetes.io/hostname, or a zone key for data-centre separation. A PodDisruptionBudget limits voluntary disruption but does not control placement.",
      },
    ],
    mustKnow: [
      "RWX for shared instance metadata in MPP; RWO block for data and logs.",
      "HADR endpoints must be Service DNS names, never pod IPs.",
      "Required podAntiAffinity on the hostname key separates primary and standby.",
      "Multi-Attach errors are an RWO detach timing problem, not a Db2 bug.",
    ],
    interviewAngle:
      "'What breaks when a worker node is drained?' is the question that separates people who have operated containerised databases from people who have installed one.",
    relatedQuizIds: ["o-storage", "o-hadr-dns", "o-antiaffinity", "o-backup-remote"],
    relatedScenarioIds: ["sc-ocp-crashloop"],
  },
  {
    id: "ocp-runtime",
    area: "openshift",
    title: "Resources, probes and kernel settings",
    summary:
      "The runtime details that decide whether a Db2 pod is stable: memory limits, health probes and the IPC kernel parameters Db2 needs.",
    blocks: [
      {
        heading: "Memory and QoS",
        body:
          "The kernel OOM killer acts on the cgroup limit, not on Db2's idea of available memory. So set INSTANCE_MEMORY explicitly below the container limit, leaving headroom for non-engine processes. Requests equal to limits give the pod Guaranteed QoS, which protects it from eviction under node pressure.\n\nRemoving the limit is not a fix: it just moves the risk to every other workload on the node, which on a shared government cluster is unacceptable.",
      },
      {
        heading: "Probes vs crash recovery",
        body:
          "A liveness probe whose failure window is shorter than crash recovery will kill the pod mid-recovery, and the next start begins recovery again — a loop that never completes. Use a startup probe with a generous failure threshold so liveness only begins once Db2 is up, and tune page cleaning so there is less log to replay.",
      },
      {
        heading: "Kernel parameters",
        body:
          "Db2 needs IPC settings (kernel.shm*, kernel.msg*, kernel.sem). These are namespaced sysctls, so they can be set per pod, but they are not in the kubelet's 'safe' list. On OpenShift you allow them with a KubeletConfig (allowedUnsafeSysctls) bound to a MachineConfigPool, which rolls out through the Machine Config Operator. Editing sysctl.conf over SSH on RHCOS nodes is neither durable nor auditable.",
      },
    ],
    mustKnow: [
      "INSTANCE_MEMORY below the pod limit; requests = limits for Guaranteed QoS.",
      "Startup probe protects crash recovery; liveness alone causes CrashLoopBackOff.",
      "IPC sysctls are enabled via KubeletConfig allowedUnsafeSysctls, not node edits.",
      "Node drains need a graceful HADR role switch first.",
    ],
    interviewAngle:
      "Expect the CrashLoopBackOff scenario. They want the chain of causes and the structural fix, plus clarity on which team owns which part.",
    relatedQuizIds: ["o-oom", "o-sysctl"],
    relatedScenarioIds: ["sc-ocp-crashloop"],
  },

  /* ═══════════════════ TUNING ═══════════════════ */
  {
    id: "tun-optimizer",
    area: "tuning",
    title: "How the optimizer decides",
    summary:
      "A cost-based optimizer that rewrites your query, estimates cardinalities from statistics, and picks the cheapest plan it can model. Nearly every tuning problem is a broken input to that process.",
    blocks: [
      {
        heading: "The compilation pipeline",
        body:
          "Parse → semantic check → query rewrite → access plan selection → code generation. The rewrite phase is aggressive and mostly invisible: predicate pushdown, decorrelation of subqueries, transforming subqueries into joins, view merging, MQT routing, redundant DISTINCT elimination.\n\nThe optimizer then enumerates plans and costs them in timerons, a synthetic unit combining I/O and CPU. Timerons are only comparable between plans for the same statement on the same system — never across systems.",
      },
      {
        heading: "Statistics are the fuel",
        bullets: [
          "Basic: table cardinality, page counts, column cardinality (COLCARD), high/low values.",
          "Distribution (WITH DISTRIBUTION): frequent values and quantiles — essential for skewed data and range predicates.",
          "Column group statistics (ON COLUMNS ((A,B))): the fix for correlated columns, where independence assumptions cause massive underestimation.",
          "Index statistics (DETAILED): cluster ratio and page-fetch behaviour.",
          "Statistical views: cardinality of a join result, the only way to express cross-table correlation.",
          "auto_runstats / real-time statistics keep routine cases fresh, but volatile staging tables need explicit handling in the job flow.",
        ],
        code: {
          label: "Statistics you should be able to write from memory",
          content: `RUNSTATS ON TABLE APP.CASES
  WITH DISTRIBUTION ON ALL COLUMNS
  AND COLUMNS ((REGION, STATUS))
  AND SAMPLED DETAILED INDEXES ALL;

-- Register a profile so LOAD / batch jobs collect the same thing
RUNSTATS ON TABLE APP.CASES WITH DISTRIBUTION AND INDEXES ALL SET PROFILE;

-- Statistical view for cross-table correlation
CREATE VIEW SV_FACT_DIM AS SELECT ... FROM F JOIN D ON ...;
ALTER VIEW SV_FACT_DIM ENABLE QUERY OPTIMIZATION;
RUNSTATS ON TABLE SV_FACT_DIM WITH DISTRIBUTION;`,
        },
      },
      {
        heading: "Controlling the optimizer",
        bullets: [
          "Optimization class (DFT_QUERYOPT, default 5): higher classes consider more transformations at higher compile cost. Rarely the answer.",
          "REOPT (ONCE/ALWAYS): compile with real host-variable values — the fix for skew behind parameter markers.",
          "Statement concentrator (STMT_CONC LITERALS): share sections across literal-only variants; the trade-off mirrors parameter markers.",
          "Optimization profiles: XML guidelines pinning an index or join method for a specific statement. A documented, temporary control with an owner — not a default tool. Embedded guidelines need DB2_OPTPROFILE=YES.",
        ],
      },
    ],
    mustKnow: [
      "Timerons are relative, not seconds, and not comparable across systems.",
      "Correlated columns need column group statistics; cross-table correlation needs statistical views.",
      "REOPT solves the skew-plus-parameter-marker problem.",
      "Optimization profiles are a controlled exception with an expiry date.",
    ],
    interviewAngle:
      "'The optimizer picked a bad plan — what do you do?' The strong answer starts with 'I check what it believed, and compare it with what actually happened', not with hints.",
    relatedQuizIds: ["t-skew-markers", "t-stat-views", "t-optguideline", "t-load-stats", "t-stmt-conc"],
    relatedScenarioIds: ["sc-upgrade-regression"],
  },
  {
    id: "tun-explain",
    area: "tuning",
    title: "Reading EXPLAIN output",
    summary:
      "The central skill named in the vacancy. Getting the plan is mechanical; reading it in the right order is the expertise.",
    blocks: [
      {
        heading: "Getting the plan",
        bullets: [
          "EXPLAIN PLAN FOR <stmt> + db2exfmt: the compile-time plan for a statement you can run.",
          "EXPLAIN_FROM_SECTION: the plan actually in use, taken from the package cache by executable ID — use this in production.",
          "EXPLAIN_FROM_ACTIVITY: the plan plus section actuals captured by an activity event monitor.",
          "db2caem: captures activity event monitor data for a single statement, actuals included, without hand-building the monitor.",
          "db2expln / db2advis: quick text plan; index advisor (treat its output as a proposal, never a patch).",
        ],
        code: {
          label: "Production-safe route to the real plan",
          content: `-- Explain tables once per schema
db2 -tvf $HOME/sqllib/misc/EXPLAIN.DDL

SELECT EXECUTABLE_ID, SUBSTR(STMT_TEXT,1,60), TOTAL_CPU_TIME, NUM_EXECUTIONS
  FROM TABLE(MON_GET_PKG_CACHE_STMT(NULL,NULL,NULL,-2))
 ORDER BY TOTAL_CPU_TIME DESC FETCH FIRST 5 ROWS ONLY;

CALL EXPLAIN_FROM_SECTION(x'01000000...', 'M', NULL, 0, NULL, ?, ?, ?, ?, ?);
db2exfmt -d PRODDB -1 -o plan.txt`,
        },
      },
      {
        heading: "Reading order that finds problems fastest",
        body:
          "Rows appear above each operator, cost below, and the inner input of a join is on the right. Work bottom-up and compare, at each operator, what the optimizer estimated against what actually happened (section actuals). The first large divergence is your root cause; everything above it is a consequence.",
        diagram: "explain-tree",
      },
      {
        heading: "What each operator tells you",
        bullets: [
          "TBSCAN on a large table with a selective predicate → missing or unusable index.",
          "IXSCAN + FETCH → index found rows but columns are missing; consider covering the query.",
          "NLJOIN with an expensive inner → fine for a tiny outer, catastrophic when the outer estimate is wrong.",
          "HSJOIN → the inner (right) builds the hash table; overflows mean the build estimate was too small.",
          "MSJOIN → both inputs sorted; check whether the sorts are necessary.",
          "SORT / TEMP → spill risk; correlate with SORT_OVERFLOWS.",
          "TQ (DTQ/BTQ) → data movement in DPF.",
          "CTQ → column-to-row transition in BLU; you want it as high in the plan as possible.",
          "Predicate placement: start/stop keys (best), index sargable, data sargable, residual (worst).",
        ],
      },
    ],
    mustKnow: [
      "EXPLAIN_FROM_SECTION gives the plan really being used; plain EXPLAIN may compile differently.",
      "Section actuals need SECTION_ACTUALS enabled and an activity event monitor.",
      "Estimate vs actual divergence, bottom-up, is the reading order.",
      "Know the predicate hierarchy: start/stop key → index sargable → data sargable → residual.",
    ],
    interviewAngle:
      "They may hand you a printed plan. Narrate your reading order out loud — panels score the method as much as the conclusion.",
    relatedQuizIds: ["t-nljoin-actuals", "t-sections-actuals", "t-hsjoin-build", "t-ctq", "t-jumpscan"],
    relatedScenarioIds: ["sc-upgrade-regression"],
  },
  {
    id: "tun-indexes",
    area: "tuning",
    title: "Index design and access paths",
    summary:
      "Choosing indexes is a trade between read benefit and write cost. Senior candidates are expected to reason about both, and about what Db2 can do without another index.",
    blocks: [
      {
        heading: "Design principles",
        bullets: [
          "Column order: equality predicates first, then range, then columns needed for ordering.",
          "INCLUDE columns are only allowed on UNIQUE indexes; for non-unique keys, extend the key itself.",
          "Index-only access (no FETCH) is the strongest win for hot queries.",
          "CLUSTER + PCTFREE keep physical order aligned with an index; only one clustering index per table.",
          "Expression-based indexes (10.5+) handle predicates on functions; collect statistics on them.",
          "Jump scan lets Db2 use later index columns when there is a gap in the leading ones — often removing the need for another index.",
          "Every index costs on INSERT/UPDATE/DELETE, on LOAD, on REORG and in backup size. On a 900M-row table, quantify before you propose.",
        ],
      },
      {
        heading: "Join methods and when each fits",
        body:
          "NLJOIN suits a small outer with an indexed inner. MSJOIN suits inputs already sorted on the join key. HSJOIN suits large unsorted inputs with enough sort memory. Zigzag join (ZZJOIN) exploits star-schema structures by probing a fact index from multiple dimensions.\n\nYou rarely force a method. You fix the estimate and let the optimizer choose — and you say exactly that in the interview.",
      },
    ],
    mustKnow: [
      "INCLUDE requires UNIQUE in Db2 LUW.",
      "Index-only access is the goal for hot statements.",
      "Indexes have a write and maintenance cost that must be quantified.",
      "Jump scan can save you an index when the leading column has low cardinality.",
    ],
    interviewAngle:
      "A good probe is 'when would you NOT add an index?'. Talk about write-heavy tables, existing overlapping indexes, and fixing statistics or SQL instead.",
    relatedQuizIds: ["t-include-unique", "t-jumpscan", "t-nonsargable"],
  },
  {
    id: "tun-sql-rewrite",
    area: "tuning",
    title: "Rewriting problematic SQL",
    summary:
      "The patterns that cause most production pain, and the rewrites that fix them — without silently changing results.",
    blocks: [
      {
        heading: "The pattern catalogue",
        bullets: [
          "Function on a column (YEAR(ts) = 2025, SUBSTR(ref,1,3) = 'BZW') → rewrite as a range or LIKE 'prefix%', or use an expression-based index.",
          "Implicit data type conversion on a join or predicate → align types; mismatches can disable index use.",
          "Correlated scalar subqueries repeated per row → aggregate once in a derived table and join.",
          "NOT IN against a nullable column → semantically dangerous (a single NULL empties the result) and rarely an anti-join; use NOT EXISTS after confirming intent.",
          "SELECT * in reports → prevents index-only access and inflates transport.",
          "OR across different columns → consider UNION ALL of selective branches, or rely on index ORing, but verify.",
          "Pagination with large OFFSET → use key-set pagination (WHERE key > last_key FETCH FIRST n).",
          "FETCH FIRST n ROWS ONLY communicates intent and lets the optimizer favour early rows.",
        ],
      },
      {
        heading: "Rewrite discipline",
        body:
          "A rewrite is a code change. Prove equivalence: run both versions on a test copy and compare with EXCEPT in both directions, check NULL and empty-set edge cases, and confirm row counts. In benefits or tax systems a silently different result set is far worse than a slow query, and saying so demonstrates the judgement a public-sector employer is buying.",
        code: {
          label: "Validation habit",
          content: `(SELECT * FROM old_version EXCEPT SELECT * FROM new_version)
UNION ALL
(SELECT * FROM new_version EXCEPT SELECT * FROM old_version);
-- must return zero rows`,
        },
      },
    ],
    mustKnow: [
      "Sargability: keep columns bare on the left-hand side of predicates.",
      "NOT IN + NULL is a correctness bug, not just a performance one.",
      "Collapse repeated correlated subqueries into one aggregation.",
      "Always validate old vs new result sets.",
    ],
    interviewAngle:
      "Often a live exercise: they hand you a query and ask you to think out loud. Name the problems in order of impact, state your assumptions, and ask the business question when semantics are ambiguous.",
    relatedQuizIds: ["t-nonsargable", "t-not-in-null", "t-optimize-for"],
    relatedScenarioIds: ["sc-rewrite"],
  },
  {
    id: "tun-workload",
    area: "tuning",
    title: "Finding the right statement to tune",
    summary:
      "Before tuning anything, find where time actually goes. Aggregate cost beats individual slowness more often than people expect.",
    blocks: [
      {
        heading: "Time-spent analysis",
        body:
          "Db2's monitor model breaks request time into processing and waiting (lock wait, I/O, log disk wait, FCM, client wait). Start at MON_GET_WORKLOAD or MON_GET_DATABASE to see which component dominates, then drill into statements.\n\nWatch the units: TOTAL_CPU_TIME is in microseconds, while the time-spent elements are in milliseconds. Mixing them up produces confidently wrong conclusions, which is why panels test it.",
        code: {
          label: "Top statements, several ways",
          content: `-- Aggregate CPU burners
SELECT SUBSTR(STMT_TEXT,1,70) AS STMT, NUM_EXECUTIONS,
       TOTAL_CPU_TIME/1000 AS CPU_MS, STMT_EXEC_TIME AS ELAPSED_MS,
       ROWS_READ/NULLIF(ROWS_RETURNED,0) AS READ_PER_ROW, LOCK_WAIT_TIME
  FROM TABLE(MON_GET_PKG_CACHE_STMT(NULL,NULL,NULL,-2))
 ORDER BY TOTAL_CPU_TIME DESC FETCH FIRST 15 ROWS ONLY;

-- Compile pressure (the "no single slow query" case)
SELECT TOTAL_COMPILE_TIME*100.0/NULLIF(TOTAL_RQST_TIME,0) AS PCT_COMPILE,
       PKG_CACHE_INSERTS*100.0/NULLIF(PKG_CACHE_LOOKUPS,0) AS PCT_INSERT
  FROM TABLE(MON_GET_DATABASE(-2));`,
        },
      },
      {
        heading: "Useful ratios",
        bullets: [
          "ROWS_READ / ROWS_RETURNED — high means scanning far more than needed (missing index or wrong join).",
          "Lock wait share of request time — if it dominates, tuning the plan is the wrong track.",
          "Compile time share and package cache insert ratio — reveals literal-SQL applications.",
          "Sort overflows and hash join overflows — memory versus plan quality.",
          "db2mon (in sqllib/samples/perf) collects MON_GET deltas over an interval and is an excellent first sweep.",
        ],
      },
    ],
    mustKnow: [
      "CPU time is microseconds; wait times are milliseconds.",
      "Rows read per row returned is the fastest 'bad access path' signal.",
      "A workload can be slow with no individually slow statement (compile storms).",
      "Measure before and after with the same metric — that is your evidence.",
    ],
    interviewAngle:
      "'The system is slow' with no further detail is a deliberately vague prompt. Your first move should be to decide where time goes, not to guess a cause.",
    relatedQuizIds: ["t-time-units", "t-stmt-conc"],
    relatedScenarioIds: ["sc-compile-storm", "sc-oltp-lockwaits"],
  },

  /* ═══════════════════ DIAGNOSTICS ═══════════════════ */
  {
    id: "diag-toolbox",
    area: "diagnostics",
    title: "The diagnostic toolbox",
    summary:
      "Four instrument families, each answering a different question. Choosing the right one quickly is what makes incident work calm.",
    blocks: [
      {
        heading: "Which tool for which question",
        body:
          "db2pd reads shared memory directly: it is fast, needs no SQL connection and takes no latches, which makes it the tool for a hanging or unresponsive system. MON_GET table functions give structured, aggregated metrics through SQL. Event monitors record history for after-the-fact analysis. db2diag.log carries engine messages and errors.",
        diagram: "monitoring-map",
      },
      {
        heading: "db2diag.log discipline",
        bullets: [
          "DIAGLEVEL 3 is the normal production level; 4 is verbose and for targeted troubleshooting only.",
          "DIAGSIZE turns the log into bounded rotating files — set it before a runaway message fills the filesystem.",
          "db2diag -level Severe,Error -H 2h narrows fast; -g/-gi filter on fields; -merge combines files across members.",
          "Put DIAGPATH on its own filesystem and monitor it.",
        ],
        code: {
          label: "Filters worth memorising",
          content: `db2diag -level Severe,Error -H 2h
db2diag -g db=PRODDB -H 1d | more
db2diag -merge -sdir /db2/diag -level Severe          # DPF, across members
db2pd -db PRODDB -edus interval=5 top=5               # hottest threads
db2pd -db PRODDB -apinfo <apphdl> -wlocks -latches`,
        },
      },
      {
        heading: "When to escalate to IBM",
        body:
          "For hangs, traps and suspected defects, collect first: db2fodc -hang full (or repeated db2pd -stack all/-edus/-latches snapshots), then db2support with the relevant time window, and open a case with a clear business impact statement. Restarting without collecting anything guarantees a repeat performance.",
      },
    ],
    mustKnow: [
      "db2pd works when SQL does not — that is its whole purpose.",
      "MON_GET is the modern interface; snapshot monitors are legacy.",
      "Event monitors must exist before the incident to give you history.",
      "Collect diagnostics before restarting a hung instance, within an agreed time box.",
    ],
    interviewAngle:
      "Expect 'what would you run first?' repeatedly, with the scenario shifting. Keep answering with the question you are trying to answer, not just a command name.",
    relatedQuizIds: ["x-edus", "x-db2diag-filter", "x-diagsize", "x-latch", "x-fodc", "x-activity-vs-cache"],
  },
  {
    id: "diag-playbooks",
    area: "diagnostics",
    title: "Incident playbooks",
    summary:
      "Four situations you will be asked about, each with a defensible first ten minutes.",
    blocks: [
      {
        heading: "High CPU with no obvious query",
        bullets: [
          "db2pd -edus interval=5 top=5 → which EDU, and is it an agent or a background thread?",
          "Agent → map to application handle (db2pd -agents/-apinfo) → MON_GET_ACTIVITY for the statement.",
          "Background (page cleaner, logger) → look at I/O and logging metrics instead.",
          "No single hot EDU but high aggregate → suspect compile storms or sheer concurrency; check TOTAL_COMPILE_TIME and package cache inserts.",
        ],
      },
      {
        heading: "Application hangs / lock chain",
        bullets: [
          "db2pd -wlocks to see holder and waiters; MON_GET_APPL_LOCKWAIT for the same in SQL.",
          "Identify the holder's statement, isolation and how long its unit of work has been open.",
          "Decide: wait, escalate to the application owner, or force the application (a business decision with consequences).",
          "Afterwards: locking event monitor data, commit-frequency fix, isolation review.",
        ],
      },
      {
        heading: "Transaction log full (SQL0964C)",
        bullets: [
          "db2pd -db X -logs and MON_GET_TRANSACTION_LOG to see usage and the oldest transaction.",
          "Find the application holding the oldest uncommitted unit of work — that is almost always the cause.",
          "Immediate: commit/roll back that work, or add log space temporarily (LOGSECOND) as a bridge.",
          "Structural: bounded commits in batch, monitoring on log utilisation.",
        ],
      },
      {
        heading: "Instance hang",
        bullets: [
          "Agree a time box with the incident manager, then collect: db2fodc -hang full.",
          "Consider HADR takeover as the fastest route to service restoration.",
          "Restart per procedure, open the IBM case with data, drive root cause in problem management.",
        ],
      },
    ],
    mustKnow: [
      "Always state the first question, then the command that answers it.",
      "Service restoration and root-cause data collection are both owed — time-box them.",
      "FORCE APPLICATION has consequences; it is a decision, not a reflex.",
      "Every incident should end with a structural follow-up.",
    ],
    interviewAngle:
      "This is where they test temperament. Calm sequencing, explicit communication and knowing who decides what is worth more than exotic command flags.",
    relatedQuizIds: ["x-wlocks", "x-fodc"],
    relatedScenarioIds: ["sc-oltp-lockwaits", "sc-ocp-crashloop"],
  },

  /* ═══════════════════ AUTOMATION ═══════════════════ */
  {
    id: "auto-linux",
    area: "automation",
    title: "Linux administration for a Db2 DBA",
    summary:
      "The host-level knowledge the role assumes: kernel settings, limits, filesystems and the OS tools you use during an incident.",
    blocks: [
      {
        heading: "Host prerequisites",
        bullets: [
          "IPC kernel parameters (kernel.shmmax/shmall, kernel.sem, kernel.msgmni) — Db2 sets many automatically on modern Linux; verify rather than assume.",
          "ulimits for the instance owner: nofile, nproc, stack, core; wrong limits surface as odd connection failures.",
          "Filesystems: ext4/xfs for containers, separate mounts for data, active logs, archive logs and DIAGPATH.",
          "Db2 uses direct/concurrent I/O for its own caching; do not fight it with aggressive OS caching assumptions.",
          "Swap should be effectively unused by Db2; if you are swapping, memory configuration is wrong.",
          "Time synchronisation (chrony) matters for HADR, logs and forensic correlation.",
        ],
        code: {
          label: "OS-side incident kit",
          content: `top -H -p $(pgrep -f db2sysc | head -1)    # threads
vmstat 2 5 ; iostat -xz 2 5 ; free -g
ss -tanp | grep 50000                      # connections to the instance port
ulimit -a                                  # as the instance owner
df -h /db2/log /db2/data /db2/diag
journalctl -u <unit> --since "1 hour ago"`,
        },
      },
      {
        heading: "Operational hygiene",
        body:
          "Instance owner accounts, sudo rules, SSH key distribution for db2_all in DPF, cron or systemd timers for maintenance, log rotation for your own scripts, and monitoring agents that do not themselves consume the memory you budgeted. In a public-sector estate, all of this is subject to hardening baselines, so expect to justify every deviation.",
      },
    ],
    mustKnow: [
      "Where active logs, data, archive and diag live, and why they are separated.",
      "ulimits and IPC parameters for the instance owner.",
      "How to read CPU, memory and I/O pressure at OS level during an incident.",
      "db2_all / SSH keys for multi-member operations.",
    ],
    interviewAngle:
      "Usually woven into another question ('storage was migrated…', 'the pod was OOMKilled…'). Showing you can move between Db2 metrics and OS evidence is the point.",
    relatedScenarioIds: ["sc-io-migration", "sc-memory-oom"],
  },
  {
    id: "auto-scripting",
    area: "automation",
    title: "Shell and Python for database automation",
    summary:
      "Writing automation that is safe to run unattended on production: correct return codes, no hidden state, no secrets in code.",
    blocks: [
      {
        heading: "CLP scripting essentials",
        bullets: [
          "Source db2profile — a non-login shell (cron, Ansible become) does not do it for you.",
          "Return codes: 0 success, 1 no rows (SQL0100W), 2 warning, 4 error, 8 system error. Treating 1 as failure is a classic bug.",
          "db2 -tvsf script.sql: terminator, verbose echo, stop on error, from file. Use -x for unadorned values.",
          "db2 +c disables autocommit when you need explicit transaction control.",
          "Know the utilities: db2look (DDL), db2move, EXPORT/IMPORT/LOAD, db2batch (timing harness).",
        ],
        code: {
          label: "A defensible shell wrapper",
          content: `#!/usr/bin/env bash
set -uo pipefail
. ~db2inst1/sqllib/db2profile

run_sql() {
  db2 -v "$1"; rc=$?
  if [ "$rc" -ge 4 ]; then
    echo "FAILED (rc=$rc): $1" >&2
    return "$rc"
  fi
  return 0        # rc 0/1/2 are acceptable (1 = no rows found)
}

run_sql "CONNECT TO PRODDB" || exit 1
run_sql "DELETE FROM STAGE.LOAD_LOG WHERE LOAD_ID = \${LOAD_ID}" || exit 1
run_sql "COMMIT"
db2 terminate`,
        },
      },
      {
        heading: "Python with ibm_db",
        body:
          "ibm_db is the low-level driver; ibm_db_dbi gives a DB-API interface that works with pandas. Always use parameter markers: they prevent SQL injection and improve package cache reuse. Credentials come from a vault or a Kubernetes secret, never from the source.\n\nPython earns its place for anything with logic: parsing monitor output, generating reports, comparing configurations across an estate, or driving REST APIs. Keep it in version control with the same review as any other production code.",
        code: {
          label: "Parameterised and safe",
          content: `import ibm_db

conn = ibm_db.connect(os.environ["DB2_DSN"], "", "")   # DSN from the vault
stmt = ibm_db.prepare(conn, """
    SELECT TABSCHEMA, TABNAME, CARD
      FROM SYSCAT.TABLES
     WHERE TABSCHEMA = ? AND CARD > ?
""")
ibm_db.execute(stmt, (schema, threshold))
while (row := ibm_db.fetch_assoc(stmt)):
    print(row)`,
        },
      },
    ],
    mustKnow: [
      "CLP rc 1 means 'no rows', not failure.",
      "db2profile must be sourced explicitly in non-login shells.",
      "Parameter markers always, in every language.",
      "Secrets from a vault; scripts in Git; runs logged.",
    ],
    interviewAngle:
      "'What have you automated?' Answer with concrete artefacts and then the safety mechanisms — that second half is what a demanding employer listens for.",
    relatedQuizIds: ["a-clp-rc", "a-python-inject"],
  },
  {
    id: "auto-ansible",
    area: "automation",
    title: "Ansible for the database lifecycle",
    summary:
      "Fleet-scale, repeatable, auditable change: the reason this is in the vacancy. Correctness here is mostly about ordering and gates, not YAML.",
    blocks: [
      {
        heading: "Structure",
        bullets: [
          "Inventory by environment and HADR pair; host_vars carry instance, databases and target level.",
          "Roles: precheck → install → postcheck → report. Each role independently runnable and idempotent.",
          "Idempotency: query current state (db2level, db cfg) and skip when it already matches; set changed_when from real output, never let shell tasks always report 'changed'.",
          "failed_when based on CLP return codes (rc ≥ 4), not on any non-zero.",
          "become_user with db2profile sourced explicitly; secrets in Ansible Vault or AWX credentials.",
          "For production: serial 1, any_errors_fatal, and health gates between steps.",
        ],
      },
      {
        heading: "The HADR rolling fix pack",
        body:
          "The canonical exercise. Roles are discovered at runtime and each transition is gated on a health check — never hard-code which host is primary.",
        diagram: "hadr-rolling-fixpack",
        code: {
          label: "Runtime role discovery",
          content: `- name: Discover HADR role
  shell: ". ~/sqllib/db2profile && db2pd -db {{ db }} -hadr | awk '/HADR_ROLE/ {print $3}'"
  become: true
  become_user: "{{ instance }}"
  register: hadr_role
  changed_when: false

- name: Fail fast if the pair is not in PEER state
  assert:
    that: "'PEER' in hadr_state.stdout"
    fail_msg: "Pair not in PEER — aborting before touching {{ inventory_hostname }}"`,
        },
      },
      {
        heading: "Governance",
        body:
          "In a public-sector estate, automation lives inside change management, not outside it. A mandatory RFC variable, runs executed from AWX with RBAC, central log retention, and the same playbook promoted through DTAP with acceptance evidence attached to the production RFC. Saying this unprompted signals that you have worked in a regulated environment.",
      },
    ],
    mustKnow: [
      "Never hard-code HADR roles; discover them.",
      "Gate every transition on PEER state and log gap.",
      "Idempotency and honest changed/failed reporting.",
      "Automation goes through change control like any other change.",
    ],
    interviewAngle:
      "'How would you roll out a fix pack to 60 instances?' — they want ordering, gates, rollback and audit, in that order of emphasis.",
    relatedQuizIds: ["a-ansible-profile", "a-rolling-fp"],
    relatedScenarioIds: ["sc-ansible-fleet"],
  },
];

export function conceptsByArea(area: ConceptArea): TechConcept[] {
  return TECH_CONCEPTS.filter(c => c.area === area);
}
