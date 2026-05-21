import type { Incident } from "@/types/db2";

export const DB2_INCIDENTS: Incident[] = [
  {
    id: "hadr-remote-catchup",
    title: "HADR Stuck in REMOTE_CATCHUP — Growing Log Gap",
    category: "hadr",
    severity: "high",
    affectedSystem: "PRODDB (Primary) / STBYDB (Standby)",
    timestamp: "2024-03-14 02:17:43 UTC",
    synopsis: "HADR standby transitioned from PEER to REMOTE_CATCHUP at 02:17 UTC. Log gap growing at ~200MB/min. Standby now 8GB behind primary.",
    symptoms: [
      "HADR state shows REMOTE_CATCHUP on both primary and standby",
      "LOG_GAP_RUNNING_TOTAL increasing: 4GB → 6GB → 8GB over 30 minutes",
      "No application errors on primary — commits are succeeding (ASYNC mode)",
      "Standby is connected (HADR_CONNECT_STATUS = CONNECTED)",
      "db2diag.log on standby shows log apply delays",
      "Network throughput between sites appears normal (no alerts from network team)",
    ],
    initialDiag: [
      { timestamp: "2024-03-14 02:17:43.842123", level: "WARNING", pid: "db2hadrp.0", message: "ADM5502W  HADR is operating in the REMOTE_CATCHUP state. Local role: STANDBY." },
      { timestamp: "2024-03-14 02:18:02.113456", level: "WARNING", pid: "db2hadrp.0", message: "ADM5003W  The HADR log replay delay is 47 seconds." },
      { timestamp: "2024-03-14 02:19:15.334789", level: "WARNING", pid: "db2hadrp.0", message: "ADM5502W  Log replay is slower than log receive rate. Gap: 5.2 GB" },
      { timestamp: "2024-03-14 02:21:33.901234", level: "WARNING", pid: "db2sysc.0", message: "ADM5003W  HADR Log Replay Delay: PRIMARY_LOG_TIME: 2024-03-14-02.17.32 STANDBY_LOG_TIME: 2024-03-14-02.16.11" },
    ],
    investigationSteps: [
      {
        id: "step-1",
        prompt: "What is your first diagnostic command and what are you looking for?",
        command: "db2pd -db PRODDB -hadr",
        outputSummary: "PRIMARY: HADR_STATE=REMOTE_CATCHUP, HADR_SYNCMODE=ASYNC, LOG_GAP_RUNNING_TOTAL=8589934592 (8GB), HADR_CONNECT_STATUS=CONNECTED, PEER_WAIT_LIMIT=0. STANDBY log position: S0003421.LOG (primary is at S0003489.LOG — 68 log files behind).",
        interpretation: "REMOTE_CATCHUP with ASYNC mode means primary is not waiting. Network is up (CONNECTED). Gap is 68 log files. The standby is receiving logs but not replaying fast enough.",
        isKeyStep: true,
      },
      {
        id: "step-2",
        prompt: "What would you check on the standby host specifically?",
        command: "db2pd -db STBYDB -hadr && db2pd -db STBYDB -edu | grep -i hadr",
        outputSummary: "Standby HADR state: REMOTE_CATCHUP. HADR_REPLAY_DELAY=0. HADR log apply EDU CPU: 98.7% (single thread). Log receive EDU: 2.1% CPU. Log file receipt rate: 220MB/min. Log replay rate: 15MB/min.",
        interpretation: "Log apply (replay) EDU is CPU-saturated. Receive rate (220MB/min) far exceeds replay rate (15MB/min). This is a replay CPU bottleneck, not a network issue.",
        isKeyStep: true,
      },
      {
        id: "step-3",
        prompt: "What type of workload on the primary would cause high log generation rate that replay cannot keep up with?",
        command: "SELECT LOG_WRITE_TIME, NUM_LOG_WRITE_IO FROM TABLE(MON_GET_DATABASE(-2)) AS T",
        outputSummary: "LOG_WRITE_TIME very high. Checking primary workload: a nightly batch LOAD job started at 02:00 UTC, generating 3.2GB of log per minute due to non-logged inserts being re-logged for HADR.",
        interpretation: "LOAD operations in HADR environments must log all changes for the standby. The batch LOAD generating massive log volume is overwhelming the single-threaded log replay on the standby.",
        isKeyStep: false,
      },
      {
        id: "step-4",
        prompt: "Is failover safe in the current state? What do you tell the on-call manager?",
        command: "db2pd -db PRODDB -hadr | grep -E 'LOG_GAP|STANDBY_LOG|PRIMARY_LOG|CONNECT'",
        outputSummary: "LOG_GAP_RUNNING_TOTAL=8GB. HADR_CONNECT_STATUS=CONNECTED. Standby is alive and catching up (slowly). Gap is growing but not at risk of HADR_TIMEOUT.",
        interpretation: "Failover is NOT advisable while in REMOTE_CATCHUP with an 8GB gap. A forced takeover would lose 8GB of committed transactions. Wait for PEER state before planned failover. Emergency failover only if primary fails.",
        isKeyStep: true,
      },
    ],
    rootCause: `The nightly batch LOAD job started at 02:00 UTC generating 200MB/min of log records. The HADR standby's log replay EDU is single-threaded and CPU-bound, capable of only ~15MB/min replay rate on the standby host (which is undersized relative to the primary). The log receive rate (220MB/min) vastly outpaces replay, causing the gap to grow continuously into REMOTE_CATCHUP state.

HADR_SYNCMODE=ASYNC means the primary does not wait for standby acknowledgment — primary continues normally while standby falls further behind.`,
    resolution: `**Immediate**:
1. Monitor gap trajectory — if gap stops growing after LOAD completes, standby will catch up naturally. REMOTE_CATCHUP → PEER is automatic once replay catches receive rate.
2. Do NOT take any action on primary during catchup — additional workload extends recovery time.
3. Inform on-call manager: no failover risk currently; RPO is ~8GB of transactions if primary fails NOW.

**After LOAD completes** (expected ~04:30 UTC):
- Log generation rate drops back to normal OLTP levels (~5MB/min)
- Standby replay will slowly close the gap over ~6 hours
- Monitor db2pd -hadr on standby: when LOG_GAP_RUNNING_TOTAL reaches 0, state returns to PEER

**Longer-term fixes**:
1. Schedule LOAD jobs for off-peak hours with lower log generation rate.
2. Upgrade standby CPU resources to match primary — replay throughput scales with CPU.
3. Consider LOAD with NONRECOVERABLE option for tables that can be reloaded from source (eliminates log generation, but tablespace enters BACKUP_PENDING on standby — requires tablespace backup before failover).
4. Implement HADR log gap monitoring alert at 1GB threshold.`,
    preventionNotes: [
      "Set LOG_GAP alert at 1GB to detect growing gaps before they become unmanageable.",
      "Size the standby server CPU to at least match the primary — replay is CPU-intensive.",
      "Consider LOAD NONRECOVERABLE for bulk loads from a re-runnable source — eliminates log generation but requires tablespace backup after.",
      "Monitor LOG_GAP_RUNNING_TOTAL in a monitoring dashboard; REMOTE_CATCHUP should be a transient state, not persistent.",
    ],
    relatedConceptIds: ["hadr", "transaction-logging", "archive-logging", "edu-model"],
  },

  {
    id: "transaction-log-full",
    title: "SQL0964C — Transaction Log Full During Business Hours",
    category: "logging",
    severity: "critical",
    affectedSystem: "FINDB (Production OLTP)",
    timestamp: "2024-09-03 09:42:17 UTC",
    synopsis: "Applications receiving SQL0964C (transaction log full) at 09:42 UTC during peak trading hours. All inserts and updates failing. Reads still working.",
    symptoms: [
      "SQL0964C returned to all write applications",
      "Application error logs: 'The transaction log for the database is full'",
      "Database is still accessible for read-only queries",
      "DB2 instance is running normally",
      "No disk space alerts fired (filesystem monitoring shows 45% used)",
      "Incident started abruptly — no gradual degradation",
    ],
    initialDiag: [
      { timestamp: "2024-09-03 09:42:17.113221", level: "SEVERE", pid: "db2sysc.0", message: "SQL0964C  The transaction log for the database is full. SQLSTATE=57011" },
      { timestamp: "2024-09-03 09:42:17.115334", level: "ERROR", pid: "db2loggr.0", message: "ADM1823E  The active log is full and is held by application with ID 0-34892, sequence number 00001." },
      { timestamp: "2024-09-03 09:42:18.334455", level: "ERROR", pid: "db2sysc.0", message: "ADM1823E  The active log is full and is held by application handle 0-34892 (CONNNAME: BATCHJOB, CORR-TOKEN: db2jcc_...)." },
    ],
    investigationSteps: [
      {
        id: "step-1",
        prompt: "SQL0964C is transaction log full. Filesystem is not full. Where is the log space going? What is your first command?",
        command: "db2pd -db FINDB -logs",
        outputSummary: "Log space: PRIMARY logs full (13/13). Secondary logs allocated: 12/12. LOGSECOND=12 (not -1). Total log space consumed: ~100%. Current log file: S0000025.LOG.",
        interpretation: "All primary AND secondary logs are in use. The database has exhausted all configured log space. LOGSECOND is finite — the limit is (LOGPRIMARY+LOGSECOND) × LOGFILSIZ.",
        isKeyStep: true,
      },
      {
        id: "step-2",
        prompt: "Which application is holding the log space? How do you identify it?",
        command: "db2pd -db FINDB -transactions",
        outputSummary: "Application 0-34892 (BATCHJOB) has FirstLSN=0x000000001A3B and CurrentLSN=0x000000002F1C. Transaction open for 47 minutes. Log held: 82GB worth of log records (it's the oldest log consumer keeping S0000025.LOG pinned). 847 other applications have normal short transactions.",
        interpretation: "Application 0-34892 has an open transaction for 47 minutes and is holding the log space. This prevents log files from being archived and reused. All other applications are blocked waiting for log space.",
        isKeyStep: true,
      },
      {
        id: "step-3",
        prompt: "What are the resolution options? Walk through them in priority order.",
        command: "db2 \"FORCE APPLICATION (34892)\"",
        outputSummary: "Application 34892 (BATCHJOB) forced. DB2 begins rolling back its transaction. Log space begins to free as rollback progresses. After 3 minutes, secondary logs start being released.",
        interpretation: "Forcing the long-running transaction causes DB2 to roll back its work, releasing the log space it was holding. This allows other applications to resume writes immediately once rollback advances past the log space constraint.",
        isKeyStep: true,
      },
    ],
    rootCause: `A batch job (BATCHJOB, AppHandle 0-34892) opened a transaction at 08:55 UTC and began a large batch UPDATE without COMMITs. After 47 minutes of continuous updates, the transaction had consumed all available primary and secondary log space (LOGPRIMARY=13, LOGSECOND=12, LOGFILSIZ=8192 = ~13GB total).

Archive logging was running normally — the issue was not archival failure. The open transaction prevented the log manager from reusing old log files (they cannot be archived/recycled until all transactions referencing them commit or rollback).

Root: no COMMIT batching in the batch job design. Entire batch in a single transaction.`,
    resolution: `**Immediate** (restore service within 5 minutes):
1. Identify holding application: \`db2pd -db FINDB -transactions\`
2. Confirm it is a batch job (not critical OLTP): check CONNNAME, CORR-TOKEN
3. Force the application: \`db2 "FORCE APPLICATION (34892)"\`
4. Monitor rollback progress: \`db2pd -db FINDB -transactions -logs\` — log utilization should decrease as rollback proceeds
5. Verify applications resume normal operation after log space frees

**Preventive configuration** (apply during next maintenance window):
\`\`\`
UPDATE DB CFG FOR FINDB USING LOGSECOND -1  -- infinite secondary logs as safety net
UPDATE DB CFG FOR FINDB USING LOCKTIMEOUT 30  -- force apps to fail vs hang indefinitely
\`\`\`

**Application fix** (coordinate with development team):
- Batch updates must COMMIT every N rows (N = 1000-10000 depending on row size)
- Re-runnable batch design with restart checkpointing
- WLM threshold: UOWTOTALTIME threshold on batch service class to kill transactions exceeding 15 minutes

**Monitoring**: Alert when LOG_UTILIZATION_PERCENT > 80% via scheduled MON_GET_DATABASE query.`,
    preventionNotes: [
      "Set LOGSECOND=-1 as a safety net — infinite secondary logs prevent SQL0964C at the cost of filesystem growth.",
      "Alert at LOG_UTILIZATION_PERCENT > 80% to catch growing transactions before they fill log space.",
      "WLM UOWTOTALTIME threshold on batch service class: kill batch transactions exceeding expected runtime.",
      "Application design: COMMIT every 1000-10000 rows in batch processing.",
    ],
    relatedConceptIds: ["transaction-logging", "locking", "wlm", "edu-model"],
  },

  {
    id: "deadlock-spike",
    title: "Deadlock Spike — 400 Deadlocks in 10 Minutes",
    category: "locking",
    severity: "high",
    affectedSystem: "ORDERDB (E-commerce OLTP)",
    timestamp: "2024-11-28 14:03:00 UTC",
    synopsis: "Application logging surge in SQLCODE -911 (SQLERRMC=2) starting 14:03 UTC. Deadlock rate: ~40/minute. Customer order completion rate dropped 35%.",
    symptoms: [
      "Application error rate: SQLCODE -911 SQLERRMC=2 at ~40/minute",
      "Order completion rate dropped 35% (not 100% — deadlock victim retries succeed on 2nd attempt)",
      "Response time p99 increased from 45ms to 340ms",
      "DB2 deadlock detector running at DLCHKTIME=10000ms",
      "No lock timeout errors (SQLERRMC=68) — specifically deadlocks",
      "Issue started after a code deployment at 13:58 UTC",
    ],
    initialDiag: [
      { timestamp: "2024-11-28 14:03:12.445123", level: "EVENT", pid: "db2dlock.0", message: "Deadlock detected. Victim: AppHandle=0-22341 (APPNAME=OrderService, TxnID=0x8A3F21). Participants: 0-22341, 0-22108." },
      { timestamp: "2024-11-28 14:03:22.667234", level: "EVENT", pid: "db2dlock.0", message: "Deadlock detected. Victim: AppHandle=0-22289 (APPNAME=OrderService, TxnID=0x8A4002). Participants: 0-22289, 0-22156." },
      { timestamp: "2024-11-28 14:03:32.889345", level: "EVENT", pid: "db2dlock.0", message: "Deadlock detected. Victim: AppHandle=0-22301 (APPNAME=OrderService). Participants: 0-22301, 0-22178." },
    ],
    investigationSteps: [
      {
        id: "step-1",
        prompt: "Deadlocks started after a deployment at 13:58. Where do you look first?",
        command: "db2evmonfmt -db ORDERDB -evm LOCKMON -fmtopt 'deadlock'",
        outputSummary: "Deadlock detail: T1 holds X lock on ORDERS row (ORDERID=12345), waits for X lock on INVENTORY row (ITEMID=789). T2 holds X lock on INVENTORY row (ITEMID=789), waits for X lock on ORDERS row (ORDERID=12345). Classic AB-BA deadlock.",
        interpretation: "T1 acquires ORDERS lock first then INVENTORY. T2 acquires INVENTORY lock first then ORDERS. The new code deployment changed the lock acquisition order, introducing the classic AB-BA deadlock pattern.",
        isKeyStep: true,
      },
      {
        id: "step-2",
        prompt: "The lock event monitor shows an AB-BA pattern on ORDERS and INVENTORY tables. What changed in the deployment?",
        command: "SELECT STMT_TEXT FROM TABLE(MON_GET_PKG_CACHE_STMT(NULL,NULL,NULL,-2)) AS T WHERE STMT_TEXT LIKE '%INVENTORY%' OR STMT_TEXT LIKE '%ORDERS%' ORDER BY NUM_EXEC_WITH_METRICS DESC FETCH FIRST 20 ROWS ONLY",
        outputSummary: "New stored procedure PROCESS_ORDER now updates INVENTORY before ORDERS (previously ORDERS then INVENTORY). The reversal caused the AB-BA deadlock pattern with concurrent order processing threads.",
        interpretation: "The deployment reordered the UPDATE sequence inside PROCESS_ORDER stored procedure. Combined with concurrent order processing, this creates guaranteed deadlocks when two orders share inventory items.",
        isKeyStep: true,
      },
      {
        id: "step-3",
        prompt: "What is the immediate fix, and what is the proper architectural solution?",
        command: "-- Immediate: rollback the deployment to restore original lock order\n-- db2 \"CALL SYSPROC.REBIND_PACKAGE('ORDERDB', 'APPSCHEMA', 'ORDERSP', NULL)\"",
        outputSummary: "Rollback of deployment at 14:15 UTC. Deadlock rate drops to 0 within 60 seconds as new code is replaced with previous version.",
        interpretation: "Lock order reversal was the cause. Restoring previous lock order eliminates the deadlock condition. The architectural fix is to enforce consistent lock ordering across all code paths that touch multiple tables.",
        isKeyStep: false,
      },
    ],
    rootCause: `The 13:58 UTC deployment changed the UPDATE sequence in the PROCESS_ORDER stored procedure: inventory was decremented BEFORE the order record was inserted (previously: insert order THEN decrement inventory). This reversal created a classic AB-BA deadlock when two concurrent order threads processed orders sharing inventory items.

Thread 1: INSERT ORDERS (X lock on ORDERS row) → UPDATE INVENTORY (waiting for X on INVENTORY row held by Thread 2)
Thread 2: UPDATE INVENTORY (X lock on INVENTORY row) → INSERT ORDERS (waiting for X on ORDERS row held by Thread 1)`,
    resolution: `**Immediate**: Rollback the deployment. Deadlocks cease within one DLCHKTIME cycle.

**Architectural fix**: Enforce consistent lock ordering across all application code paths:
1. Always update ORDERS before INVENTORY (or vice versa — consistency matters, not which comes first)
2. Add code review checklist: all multi-table transactions must document lock acquisition order
3. Consider SELECT ... FOR UPDATE at transaction start to establish lock order before any modifications

**Detection improvement**: Enable lock event monitor in pre-production environments to catch deadlock patterns before deployment.`,
    preventionNotes: [
      "Establish and document lock ordering conventions for tables frequently updated together.",
      "Enable lock event monitor in staging/QA environments — catch deadlocks before they reach production.",
      "Code review checklist: multi-table UPDATE sequences must maintain consistent order.",
      "DLCHKTIME=5000ms reduces detection latency from 10s to 5s — faster recovery per deadlock incident.",
    ],
    relatedConceptIds: ["deadlocks", "locking", "isolation-levels"],
  },

  {
    id: "package-cache-overflow",
    title: "Package Cache Overflow — SQL Compilation Storm",
    category: "performance",
    severity: "high",
    affectedSystem: "ANALYTICSDB",
    timestamp: "2024-07-15 08:00:12 UTC",
    synopsis: "CPU on DB2 server spikes to 100% at 08:00 UTC when analytics reports begin. Response times: 2s → 45s. Package cache hit ratio degraded to 23%.",
    symptoms: [
      "CPU 100% on DB2 server (32 cores)",
      "Package cache hit ratio: 23% (normally 97%)",
      "NUM_COMPILATIONS in MON_GET_DATABASE: 8,400/minute",
      "Response times increased 20×",
      "Issue starts exactly at 08:00 UTC (analytics report schedule)",
      "No lock waits, no sort overflows — purely CPU-bound",
    ],
    initialDiag: [
      { timestamp: "2024-07-15 08:00:12.334122", level: "WARNING", pid: "db2sysc.0", message: "ADM6044W  SQL statement cache (package cache) is 95% full. Sections may be evicted." },
      { timestamp: "2024-07-15 08:00:45.667234", level: "WARNING", pid: "db2sysc.0", message: "ADM6044W  SQL statement cache overflow. Sections being evicted under memory pressure." },
    ],
    investigationSteps: [
      {
        id: "step-1",
        prompt: "Hit ratio is 23%. What query do you run to find what is flooding the package cache?",
        command: "SELECT NUM_COMPILATIONS, LEFT(STMT_TEXT,120) AS SQL FROM TABLE(MON_GET_PKG_CACHE_STMT(NULL,NULL,NULL,-2)) AS T ORDER BY NUM_COMPILATIONS DESC FETCH FIRST 10 ROWS ONLY",
        outputSummary: "Top entries all have NUM_COMPILATIONS in thousands. STMT_TEXT shows analytics queries with literal values embedded: WHERE REPORT_DATE = '2024-07-15' AND REGION = 'APAC' AND PRODUCT_ID = 12345. Each unique combination generates a separate cache entry.",
        interpretation: "Analytics queries are embedding literal values instead of parameter markers. Each unique date/region/product combination creates a new cache entry. With 500+ report variants running at 08:00, 500+ compilations per minute immediately fill the cache.",
        isKeyStep: true,
      },
      {
        id: "step-2",
        prompt: "What is the immediate relief, and what is the proper fix?",
        command: "UPDATE DB CFG FOR ANALYTICSDB USING PCKCACHESZ 100000\n-- Then flush and monitor\nFLUSH PACKAGE CACHE DYNAMIC",
        outputSummary: "Increasing PCKCACHESZ to 100000 pages (400MB) gives temporary relief but does not fix the root cause. Hit ratio improves to 61% but drops again as new literal variants fill the enlarged cache.",
        interpretation: "Increasing cache size buys time but is not the fix. The real fix requires the application to use parameter markers (?) instead of literal values so that different parameter values share a single cached plan.",
        isKeyStep: false,
      },
    ],
    rootCause: `Analytics report framework generates SQL with embedded literal values (date ranges, region codes, product IDs) rather than parameter markers. Each unique combination of literal values produces a distinct SQL text hash, requiring separate compilation and a separate package cache entry. At 08:00 when 50+ scheduled reports run simultaneously with hundreds of parameter combinations, the cache fills in minutes, driving hit ratio to 23% and CPU to 100% on compilation overhead.`,
    resolution: `**Immediate**: Increase PCKCACHESZ to 100000+ pages to delay overflow. Also consider staggering report schedules (not all at 08:00).

**Proper fix**: Parameterise analytics queries using ? markers or BI framework parameter binding. A single query plan can serve all date/region/product combinations, requiring one cache entry vs thousands.

**DB2-side mitigation**: Enable REOPT(ONCE) at the package level — plan is compiled once with actual values on first execution, then cached and reused. Suitable if parameter skew is low.`,
    preventionNotes: [
      "Require parameter markers in all application SQL — enforce via code review.",
      "Stagger scheduled report runs to avoid simultaneous compilation storms.",
      "Monitor PKG_CACHE_INSERTS/PKG_CACHE_LOOKUPS ratio — alert when hit ratio < 90%.",
    ],
    relatedConceptIds: ["package-cache", "memory-architecture", "performance-explain", "statistics"],
  },

  {
    id: "hadr-split-brain-risk",
    title: "HADR Split Brain Risk After Network Partition",
    category: "hadr",
    severity: "critical",
    affectedSystem: "BANKDB (Primary) / BANKDB-DR (Standby)",
    timestamp: "2024-05-21 03:24:00 UTC",
    synopsis: "Network partition between primary DC and DR DC for 8 minutes (03:16-03:24 UTC). HADR went to DISCONNECTED. Network restored. DR team considering TAKEOVER HADR BY FORCE. Primary still running.",
    symptoms: [
      "Network partition lasted 8 minutes (confirmed by network team)",
      "Primary HADR state: DISCONNECTED (standby unreachable for 8 min)",
      "Standby HADR state: DISCONNECTED (primary unreachable for 8 min)",
      "Primary continued accepting transactions during partition (ASYNC mode)",
      "Standby is alive but not current — it stopped at the point of partition",
      "DR team has access to standby site and is asking whether to TAKEOVER BY FORCE",
    ],
    initialDiag: [
      { timestamp: "2024-05-21 03:16:02.334122", level: "WARNING", pid: "db2hadrp.0", message: "ADM5503W  HADR partner DB is not reachable. HADR state will become DISCONNECTED." },
      { timestamp: "2024-05-21 03:16:32.667345", level: "SEVERE", pid: "db2hadrp.0", message: "ADM5500E  HADR is operating in DISCONNECTED state. Primary is NOT protected." },
      { timestamp: "2024-05-21 03:24:15.889456", level: "INFO", pid: "db2hadrp.0", message: "HADR standby reconnected. Initiating log resynchronisation. Gap: 4,847 MB." },
    ],
    investigationSteps: [
      {
        id: "step-1",
        prompt: "The DR team wants to TAKEOVER BY FORCE. What is your first response?",
        command: "-- Before ANY takeover: confirm primary status\ndb2pd -db BANKDB -hadr  -- on PRIMARY site",
        outputSummary: "Primary is RUNNING, HADR_CONNECT_STATUS=CONNECTED (network restored at 03:24). Primary state: DISCONNECTED transitioning back to REMOTE_CATCHUP. Primary has 4.8GB of log records the standby has not received.",
        interpretation: "CRITICAL: Primary is alive and network has been restored. TAKEOVER BY FORCE with a live primary = split brain. Both sites would independently believe they are primary and accept transactions. Never force takeover without confirming primary is truly dead.",
        isKeyStep: true,
      },
      {
        id: "step-2",
        prompt: "Network is restored, both sites are communicating. What happens next — do you need to do anything?",
        command: "db2pd -db BANKDB-DR -hadr  -- on STANDBY site",
        outputSummary: "Standby: HADR_STATE=REMOTE_CATCHUP, HADR_CONNECT_STATUS=CONNECTED, LOG_GAP_RUNNING_TOTAL=4847MB. Standby is receiving and replaying the 8-minute gap. No action required from DBA.",
        interpretation: "HADR self-heals on network restoration. Standby automatically fetches and replays the missed log records. No manual intervention needed. Let the gap close naturally.",
        isKeyStep: true,
      },
      {
        id: "step-3",
        prompt: "What is the RPO exposure during the 8-minute partition window?",
        command: "-- Calculate uncommitted data at risk:\nSELECT LOG_GAP_RUNNING_TOTAL, STANDBY_LOG_TIME, PRIMARY_LOG_TIME FROM TABLE(MON_GET_HADR(-2)) AS T",
        outputSummary: "4.8GB of log records represent all transactions committed on the primary between 03:16 and 03:24. If the primary had crashed during the partition, those transactions would have been permanently lost (ASYNC mode RPO = committed transactions not yet received by standby).",
        interpretation: "For 8 minutes in ASYNC HADR with no connection, RPO exposure was ~4.8GB of committed data. This is the known trade-off of ASYNC mode. If the business requires zero data loss, SYNC mode is required.",
        isKeyStep: false,
      },
    ],
    rootCause: `Network partition between datacentres for 8 minutes caused HADR to enter DISCONNECTED state. In ASYNC mode, primary continued committing transactions without waiting for standby acknowledgment — creating an 8-minute RPO exposure window. Network restoration triggered automatic HADR reconnection and gap closure. No data loss occurred because the primary survived the partition.

The incident exposed: (1) inadequate runbook — DR team nearly force-took-over a live primary, and (2) ASYNC mode's RPO implications were not communicated to business stakeholders.`,
    resolution: `**During incident**:
1. NEVER TAKEOVER BY FORCE without 100% confirmation primary is dead and unrecoverable.
2. On network restoration, HADR self-heals — observe LOG_GAP_RUNNING_TOTAL closing toward 0.
3. Communicate RPO exposure to business: transactions committed during partition are at risk only if primary fails BEFORE standby catches up.

**Post-incident**:
1. Document runbook: split-brain prevention procedure (confirm primary status before ANY force takeover).
2. Consider HADR_PEER_WINDOW setting: primary can wait up to N seconds in PEER state after losing standby contact before switching to unprotected mode.
3. Evaluate NEARSYNC vs ASYNC for this workload — NEARSYNC reduces RPO at modest latency cost.`,
    preventionNotes: [
      "Runbook must require: 'confirm primary is dead by attempting SSH/DB2 connection' before TAKEOVER BY FORCE.",
      "HADR_PEER_WINDOW provides brief protection after network loss — set to 60-120s for short partition tolerance.",
      "Business stakeholders must understand ASYNC mode RPO implications — document and get sign-off.",
      "Dual network path between DC and DR site reduces partition probability.",
    ],
    relatedConceptIds: ["hadr", "transaction-logging", "archive-logging"],
  },

  {
    id: "log-archive-gap",
    title: "HADR Archive Log Gap — Standby Cannot Replay",
    category: "hadr",
    severity: "critical",
    affectedSystem: "FINDB / FINDB-DR",
    timestamp: "2024-02-08 22:15:00 UTC",
    synopsis: "HADR standby in DISCONNECTED state for 72 hours (planned maintenance). On reconnect, standby cannot replay from archive — log gap spans an unarchived log file that was overwritten on primary.",
    symptoms: [
      "Standby HADR state: DISCONNECTED for 72 hours during primary maintenance",
      "On reconnect: HADR fails to synchronize",
      "db2diag on standby: 'Log file not found in archive or active log path'",
      "Primary has recycled log files that standby needs for catchup",
      "LOGARCHMETH2 (secondary archive) had been failing silently for 2 weeks",
      "Primary LOGARCHMETH1 (disk) was cleaned up manually by a junior DBA 48 hours ago",
    ],
    initialDiag: [
      { timestamp: "2024-02-08 22:15:02.445123", level: "SEVERE", pid: "db2hadrp.0", message: "ADM5508E  HADR log file S0001423.LOG is missing from archive and active log path on standby. HADR cannot continue log replay." },
      { timestamp: "2024-02-08 22:15:02.667234", level: "SEVERE", pid: "db2hadrp.0", message: "ADM5500E  HADR operating in DISCONNECTED state. Manual intervention required to resynchronize standby." },
    ],
    investigationSteps: [
      {
        id: "step-1",
        prompt: "The standby reports a missing log file. What are your options to recover?",
        command: "-- Check TSM (secondary archive) for missing log:\ndsmc query backup \"/db2archive/FINDB/S0001423.LOG\" -inactive\n-- Check primary active logs:\ndb2pd -db FINDB -logs | grep S0001423",
        outputSummary: "TSM query: S0001423.LOG not found in TSM (LOGARCHMETH2 has been failing for 14 days — TSM node authentication expired). Primary active log path: S0001423.LOG was recycled 48 hours ago and is not in the active log path.",
        interpretation: "The log file is irretrievably lost: not in TSM (failures), not on disk (manually purged). The HADR standby cannot catch up from where it is — it needs a fresh seed from a backup.",
        isKeyStep: true,
      },
      {
        id: "step-2",
        prompt: "Log is unrecoverable. What is the procedure to re-establish HADR?",
        command: "-- On primary:\nBACKUP DATABASE FINDB ONLINE TO /db2backup COMPRESS INCLUDE LOGS WITHOUT PROMPTING\n-- Transfer backup to standby site\n-- On standby:\nRESTORE DATABASE FINDB FROM /db2backup TAKEN AT <timestamp>\nROLLFORWARD DATABASE FINDB TO END OF LOGS AND STOP\n-- Re-initialize HADR\nSTOP HADR ON DATABASE FINDB\nSTART HADR ON DATABASE FINDB AS STANDBY",
        outputSummary: "Full backup taken on primary (~800GB, 2h 15min). Transferred to DR site. Restored and rolled forward. HADR restarted on standby. HADR state returned to REMOTE_CATCHUP then PEER within 4 hours of standby restart.",
        interpretation: "When log chain is broken, the only path forward is re-seeding the standby from a fresh backup. This is a multi-hour procedure for large databases.",
        isKeyStep: true,
      },
    ],
    rootCause: `Three compounding failures:
1. Standby was in DISCONNECTED for 72 hours (planned maintenance) — primary generated logs the standby had not received.
2. LOGARCHMETH2 (TSM) had been failing for 14 days due to expired TSM node authentication — monitoring did not catch this.
3. A junior DBA manually deleted old archive logs from LOGARCHMETH1 (disk) following a 'disk space cleanup' ticket without checking HADR standby position.

The combination meant that when standby tried to reconnect, the required log files existed nowhere.`,
    resolution: `**Immediate**: Re-seed standby from fresh primary backup (2-4 hour procedure depending on database size).

**Process fixes**:
1. Archive log deletion must NEVER be performed manually — only via PRUNE HISTORY or policy-based retention that checks HADR standby log position.
2. LOGARCHMETH2 failures must trigger alerts — secondary archive is not optional.
3. Before any planned standby disconnect > 1 hour, document the standby's current log position and verify archive retention will cover the gap.

**Technical controls**:
- HADR_LOGARCHIVE_DELAY: prevents primary from archiving logs the standby may still need.
- Automated monitoring: alert if LOGARCHMETH2 fails even once.
- Archive log retention policy: retain archives until standby has consumed them.`,
    preventionNotes: [
      "NEVER manually delete archive logs — always use PRUNE HISTORY which respects recovery requirements.",
      "Monitor LOGARCHMETH2 health independently — secondary archive failures are silent by default.",
      "Document HADR standby log position before any planned maintenance disconnect > 1 hour.",
      "Set retention policy: archive logs must be retained until the standby's replayed LSN passes them.",
    ],
    relatedConceptIds: ["hadr", "archive-logging", "transaction-logging", "restore-rollforward"],
  },

  {
    id: "sortheap-exhaustion",
    title: "Sort Overflow Storm — Analytics Query Performance Collapse",
    category: "performance",
    severity: "medium",
    affectedSystem: "DWDB (Data Warehouse)",
    timestamp: "2024-10-22 06:00:00 UTC",
    synopsis: "Scheduled analytics report suite started at 06:00 UTC. All reports running 15-40× slower than baseline. TEMP tablespace at 97% capacity. DBA notices SORT_OVERFLOWS counter climbing rapidly.",
    symptoms: [
      "Report suite runtime: 45 minutes (baseline: 3 minutes)",
      "TEMP tablespace utilization: 97%",
      "SORT_OVERFLOWS: 48,000 in 10 minutes",
      "CPU: 45% (not a CPU bottleneck)",
      "I/O: very high on TEMP tablespace storage path",
      "Reports use complex GROUP BY and ORDER BY with multiple joins",
    ],
    initialDiag: [
      { timestamp: "2024-10-22 06:00:45.334122", level: "WARNING", pid: "db2sysc.0", message: "ADM5501W  Sort overflow occurred. Sort heap exhausted; spilling to disk. STMT_TEXT hash: 0x3A2B1F." },
    ],
    investigationSteps: [
      {
        id: "step-1",
        prompt: "SORT_OVERFLOWS is climbing. What do you check to understand the scope?",
        command: "SELECT SORTHEAP, SHEAPTHRES_SHR FROM TABLE(MON_GET_DATABASE(-2)) AS T\nSELECT SORT_OVERFLOWS, TOTAL_SORT_TIME FROM TABLE(MON_GET_CONNECTION(NULL,-2)) AS T ORDER BY SORT_OVERFLOWS DESC FETCH FIRST 10 ROWS ONLY",
        outputSummary: "SORTHEAP=256 pages (1MB). SHEAPTHRES_SHR=4096 pages (16MB). With 50 concurrent analytics queries each needing 50-200MB sort space, every single sort is overflowing to TEMP.",
        interpretation: "SORTHEAP at 1MB is far too small for analytics queries with multi-million row sorts. The analytics workload was migrated from a separate DW server with SORTHEAP=16384 (64MB). The DW team forgot to update the SORTHEAP parameter on the new host.",
        isKeyStep: true,
      },
      {
        id: "step-2",
        prompt: "What is the fix, and can you apply it without a database restart?",
        command: "UPDATE DB CFG FOR DWDB USING SORTHEAP 16384 SHEAPTHRES_SHR 524288",
        outputSummary: "SORTHEAP updated to 16384 pages (64MB). SHEAPTHRES_SHR updated to 524288 pages (2GB). Changes take effect immediately for new connections. Existing connections maintain old SORTHEAP value until reconnect.",
        interpretation: "DB CFG changes for SORTHEAP and SHEAPTHRES_SHR take effect immediately for new connections. Reports that reconnect get the new values. Restarting the report framework forces all connections to reconnect with new SORTHEAP.",
        isKeyStep: true,
      },
    ],
    rootCause: `SORTHEAP parameter was left at default (256 pages = 1MB) when the analytics workload was migrated to a new server. The previous server had SORTHEAP=16384 (64MB). With complex analytics queries requiring 50-200MB of sort space per query and 50 concurrent queries, every sort operation overflowed to TEMP tablespace, causing the collapse.`,
    resolution: `**Immediate**: UPDATE DB CFG USING SORTHEAP 16384. Cycle report connections to pick up new value. TEMP tablespace pressure resolves as sorts complete in memory.

**Review**: Check SORTHEAP on all environments when migrating workloads. Use REORGCHK and EXPLAIN to validate sort operators will have adequate memory.

**Monitoring**: Alert when SORT_OVERFLOWS > 100/minute on analytics systems.`,
    preventionNotes: [
      "Include SORTHEAP in server migration checklist — it is frequently overlooked.",
      "Run EXPLAIN with SET CURRENT EXPLAIN MODE EXPLAIN on representative queries to identify sort operator sizes before go-live.",
      "Alert on SORT_OVERFLOWS rate exceeding baseline.",
    ],
    relatedConceptIds: ["sort-heap", "memory-architecture", "performance-explain", "tablespace"],
  },
];

export const INCIDENT_MAP = new Map(DB2_INCIDENTS.map(i => [i.id, i]));
