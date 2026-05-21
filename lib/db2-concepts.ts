import type { Db2Concept } from "@/types/db2";

export const DB2_CONCEPTS: Db2Concept[] = [
  {
    id: "buffer-pool",
    slug: "buffer-pool",
    title: "Buffer Pool",
    category: "memory",
    version: ["11.5", "12"],
    shortDescription: "Shared memory cache for data and index pages, the primary I/O avoidance mechanism.",
    overview: `Buffer pools are the central caching layer in DB2's memory architecture. Every read from disk goes through a buffer pool page; every write is first made in-memory with deferred async flush by page cleaners.

Each buffer pool has a dedicated set of page slots sized in DB CFG pages (NPAGES) or via automatic storage (NPAGES=-1 means DATABASE_MEMORY-controlled). Buffer pools are assigned to tablespaces — a tablespace with no explicit assignment inherits IBMDEFAULTBP.

**Page replacement** uses a variant of LRU. Victim page selection is managed by the buffer pool page cleaner EDUs (NUM_IOCLEANERS). Dirty pages are written by cleaners; prefetchers bring sequential pages in ahead of scans.

**Hit ratio** is the single most important buffer pool metric: (1 - physical_reads / logical_reads) × 100. In OLTP environments, target >98%. A drop of even 2-3 points warrants investigation — check for new table scans, stale statistics driving bad plans, or recent data growth.

**Multiple buffer pools** allow fine-grained control: separate pools for OLTP tables, large fact tables, system catalog, and temp tablespace. This prevents a large batch scan from evicting hot OLTP pages.

**db2 11.5 / 12 specifics**: AUTOMATIC self-tuning memory (STMM) can resize buffer pools dynamically when DATABASE_MEMORY is AUTO. The memory tuner reallocates between buffer pools, sort heap, package cache, and lock list based on observed activity. In practice, STMM works well for mixed workloads but should be monitored in high-frequency OLTP — check db2diag.log for STMM rebalance events.`,
    keyParameters: [
      { name: "NPAGES", scope: "database", unit: "pages", defaultValue: "250", description: "Number of pages in this buffer pool. -1 = self-tuning under STMM.", tuningNote: "Set explicitly for critical tablespaces; let STMM handle the rest." },
      { name: "PAGESIZE", scope: "database", unit: "bytes", defaultValue: "4096", description: "Page size of this buffer pool (4K/8K/16K/32K). Must match assigned tablespace." },
      { name: "NUM_IOCLEANERS", scope: "database", defaultValue: "AUTOMATIC", description: "Number of async page cleaner EDUs. Each cleaner flushes dirty pages to disk.", tuningNote: "AUTOMATIC usually adequate; increase if checkpoint intervals are long." },
      { name: "NUM_IOSERVERS", scope: "database", defaultValue: "AUTOMATIC", description: "Number of prefetch I/O server EDUs. Drives sequential prefetch throughput.", tuningNote: "Match to available I/O paths; excess servers waste CPU polling." },
      { name: "CHNGPGS_THRESH", scope: "database", unit: "percent", defaultValue: "80", description: "Trigger async page cleaning when this % of buffer pool pages are dirty." },
    ],
    commands: [
      { syntax: "db2pd -db <DBNAME> -bufferpools", description: "Real-time buffer pool stats from shared memory — no catalog lock required.", example: "db2pd -db PRODDB -bufferpools" },
      { syntax: "SELECT * FROM TABLE(MON_GET_BUFFERPOOL('',-2)) AS T", description: "Aggregate buffer pool metrics across all members.", example: "SELECT BP_NAME, POOL_DATA_L_READS, POOL_DATA_P_READS, DECIMAL((1-FLOAT(POOL_DATA_P_READS)/NULLIF(FLOAT(POOL_DATA_L_READS),0))*100,5,2) AS HIT_RATIO FROM TABLE(MON_GET_BUFFERPOOL('',-2)) AS T" },
      { syntax: "CREATE BUFFERPOOL <name> SIZE <n> PAGESIZE <size>", description: "Create a new buffer pool at the specified page size." },
      { syntax: "ALTER BUFFERPOOL <name> SIZE <n>", description: "Resize an existing buffer pool. Takes effect immediately (online)." },
    ],
    expertNotes: [
      "A hit ratio that looks healthy on average can mask hotspot pages. Check POOL_ASYNC_DATA_READS vs POOL_DATA_P_READS to see prefetch effectiveness.",
      "XDA (XML storage) pages use separate hit ratio counters: POOL_XDA_L_READS/P_READS. Commonly overlooked.",
      "GBP (Group Buffer Pool) in pureScale is the global equivalent — local buffer pool hit, GBP hit, then disk. Two-level hierarchy.",
      "SOFTMAX controls the percentage of dirty pages that trigger a checkpoint, indirectly affecting buffer pool recoverability on crash.",
      "Buffer pool memory is db-shared, not instance-shared. Each database has its own pools. Switching active database changes which pools are resident.",
    ],
    connections: [
      { targetId: "memory-architecture", type: "component-of", label: "lives within" },
      { targetId: "tablespace", type: "feeds-into", label: "serves page cache for" },
      { targetId: "transaction-logging", type: "feeds-into", label: "dirty pages trigger log flush" },
      { targetId: "performance-explain", type: "impacts", label: "prefetch strategy visible in" },
      { targetId: "db2pd", type: "monitors", label: "inspected with" },
      { targetId: "mon-get", type: "monitors", label: "measured via" },
    ],
    recallPrompt: "When a buffer pool hit ratio drops from 98% to 94% overnight, what are your first three investigative steps?",
    recallHint: "Think: what changed (new queries, data growth, plan change), and which MON_GET / db2pd counters distinguish scan vs random read pressure.",
    difficulty: 3,
    position: { x: 580, y: 340 },
  },

  {
    id: "transaction-logging",
    slug: "transaction-logging",
    title: "Transaction Logging",
    category: "logging",
    version: ["11.5", "12"],
    shortDescription: "Write-ahead logging ensuring durability, HADR replication, and crash recovery.",
    overview: `DB2 uses write-ahead logging (WAL): every data page modification is first written to the log buffer (in shared memory), then flushed to the primary log files on disk before the COMMIT acknowledgment is returned to the application.

**Log anatomy**: Log records are written sequentially to the active primary log files (LOGPRIMARY count, each LOGFILSIZ × 4KB pages). When a primary log fills, DB2 moves to a secondary log (up to LOGSECOND; in DB2 10.5+ LOGSECOND=-1 means infinite secondary logs). Archive logging (LOGARCHMETH1/2) copies filled logs to archive storage.

**Log buffer (LOGBUFSZ)**: Shared memory ring buffer. Transactions accumulate log records here before flush. Larger LOGBUFSZ reduces I/O frequency but increases potential data loss window (for ASYNC HADR) and recovery time. Group commits happen naturally — multiple transactions share a single log write I/O.

**Log LSN (Log Sequence Number)**: Monotonically increasing 6-byte address. Every log record has an LSN. Buffer pool pages track the LSN of the last modification (PageLSN). Crash recovery uses this to determine which pages need redo.

**Circular vs archive logging**: Circular logging (LOGARCHMETH1=OFF) supports crash recovery only — no online backup, no rollforward, no HADR. Archive logging enables the full recovery model.

**DB2 12 enhancements**: Improved log space management, better log compression ratios, enhanced archive log gap detection.`,
    keyParameters: [
      { name: "LOGBUFSZ", scope: "database", unit: "4KB pages", defaultValue: "256", description: "Size of the log buffer in shared memory. Increasing reduces log write frequency.", tuningNote: "On high-throughput OLTP, 1024-4096 pages. Monitor LOG_WRITE_TIME in MON_GET_DATABASE." },
      { name: "LOGPRIMARY", scope: "database", defaultValue: "13", description: "Number of primary log files. These are pre-allocated on database activation.", tuningNote: "Size so active transaction span fits: LOGPRIMARY × LOGFILSIZ × 4KB." },
      { name: "LOGSECOND", scope: "database", defaultValue: "12", description: "Secondary log files allocated on demand. -1 = infinite (DB2 10.5+).", tuningNote: "Never use -1 in production without monitoring — log space can grow unbounded." },
      { name: "LOGFILSIZ", scope: "database", unit: "4KB pages", defaultValue: "1024", description: "Size of each log file. Total log space = (LOGPRIMARY+LOGSECOND) × LOGFILSIZ × 4KB." },
      { name: "NEWLOGPATH", scope: "database", description: "Path for active log files. Separate spindle from data greatly reduces contention." },
      { name: "MIRRORLOGPATH", scope: "database", description: "Mirror copy of active logs. Protects against log file corruption/device failure." },
      { name: "LOGARCHMETH1", scope: "database", description: "Primary archive method: LOGRETAIN, USEREXIT, DISK:/path, TSM, VENDOR:lib.", tuningNote: "DISK is simplest; TSM for enterprise. Always set LOGARCHMETH2 as failsafe." },
    ],
    commands: [
      { syntax: "db2pd -db <DBNAME> -logs", description: "Real-time log utilization: current LSN, log head, secondary log usage.", example: "db2pd -db PRODDB -logs" },
      { syntax: "SELECT LOG_UTILIZATION_PERCENT, TOTAL_LOG_USED_KB, TOTAL_LOG_AVAILABLE_KB FROM TABLE(MON_GET_DATABASE(-2)) AS T", description: "Current log space utilization." },
      { syntax: "GET DB CFG FOR <DBNAME> SHOW DETAIL", description: "Show all DB CFG parameters including current vs pending log settings." },
      { syntax: "db2 \"UPDATE DB CFG FOR <DBNAME> USING LOGBUFSZ 2048\"", description: "Increase log buffer size (takes effect on next db activation)." },
    ],
    expertNotes: [
      "SQL0964C (transaction log full) is almost never about LOGBUFSZ — it means primary + secondary logs are all full. Long-running open transactions are the usual culprit.",
      "LOGSECOND=-1 sounds like a safety net but it can cause the filesystem to fill. Always set log space alerts.",
      "Log archive failures (LOGARCHMETH1 destination full/unreachable) cause SQL0968C eventually — DB2 cannot overwrite unarchived logs.",
      "In HADR, the standby log position (db2pd -hadr: STANDBY_LOG_FILE) tells you replay progress, not the primary's current LSN.",
      "MIRRORLOGPATH is underused in many shops. A single log device failure without a mirror means point-in-time recovery may be impossible.",
      "DB2 12 introduced log-based CDC (change data capture) enhancements via the log read API.",
    ],
    connections: [
      { targetId: "buffer-pool", type: "feeds-into", label: "page LSN tracked via" },
      { targetId: "hadr", type: "feeds-into", label: "log records shipped via" },
      { targetId: "crash-recovery", type: "feeds-into", label: "redo/undo log replay" },
      { targetId: "archive-logging", type: "feeds-into", label: "active logs archived to" },
      { targetId: "backup", type: "depends-on", label: "online backup requires" },
      { targetId: "db2pd", type: "monitors", label: "live log state via" },
    ],
    recallPrompt: "An application reports SQL0964C. The DBA on call says log space is set to 50GB. What is the actual root cause, and what is the fastest diagnostic command?",
    recallHint: "SQL0964C is log full — but why? Open long-running transactions hold log space. Check: db2pd -transactions or MON_GET_TRANSACTION.",
    difficulty: 3,
    position: { x: 740, y: 520 },
  },

  {
    id: "hadr",
    slug: "hadr",
    title: "HADR",
    category: "hadr",
    version: ["11.5", "12"],
    shortDescription: "Log-shipping HA/DR solution: primary ships log records to standby in near real-time.",
    overview: `HADR (High Availability Disaster Recovery) is DB2's built-in replication mechanism based on shipping transaction log records from a primary to one or more standbys. The standby continuously replays received logs, maintaining a warm copy of the database.

**Synchronization modes** control the trade-off between durability and performance:
- **SYNC**: Primary waits until standby writes log to disk AND sends acknowledgment. Zero data loss. ~2× commit latency.
- **NEARSYNC**: Primary waits until standby receives log in its log buffer (not disk). Near-zero data loss. Lower latency than SYNC.
- **ASYNC**: Primary does not wait for standby acknowledgment. Minimal latency impact. Potential for data loss equal to unsent log records.
- **SUPERASYNC** (DB2 11.1+): Like ASYNC but standby can lag significantly — used for geographically distant DR sites.

**HADR states**: PRIMARY, STANDBY, DISCONNECTED, REMOTE_CATCHUP, REMOTE_CATCHUP_PENDING, PEER.
- PEER is the healthy operating state — standby is caught up within HADR_PEER_WINDOW.
- REMOTE_CATCHUP means standby is behind but connected and catching up.
- DISCONNECTED means standby is unreachable — primary continues but now unprotected.

**Multiple standbys (DB2 10.5+)**: Up to 3 standbys. One principal standby (receives commits), up to 2 auxiliary standbys. Auxiliary standbys can be SUPERASYNC for DR.

**Takeover**: \`TAKEOVER HADR ON DATABASE <name>\` promotes standby to primary. With \`BY FORCE\`, override peer state check — dangerous if primary is still running (split brain risk).

**Replay delay (HADR_REPLAY_DELAY)**: Intentional delay in applying log records on standby. Protects against logical corruption — provides a time window to catch data errors before they replicate.`,
    keyParameters: [
      { name: "HADR_SYNCMODE", scope: "database", defaultValue: "NEARSYNC", description: "Synchronization mode: SYNC/NEARSYNC/ASYNC/SUPERASYNC." },
      { name: "HADR_TIMEOUT", scope: "database", unit: "seconds", defaultValue: "120", description: "Time before HADR treats standby as failed and switches to DISCONNECTED." },
      { name: "HADR_PEER_WINDOW", scope: "database", unit: "seconds", defaultValue: "0", description: "Window in which primary considers standby in PEER state despite missed heartbeats." },
      { name: "HADR_REPLAY_DELAY", scope: "database", unit: "seconds", defaultValue: "0", description: "Delay log replay on standby for logical error protection window." },
      { name: "HADR_LOGARCHIVE_DELAY", scope: "database", unit: "seconds", defaultValue: "0", description: "Delay before standby archives logs — prevents premature archival of still-needed logs." },
      { name: "HADR_LOCAL_HOST", scope: "database", description: "IP/hostname of the local HADR node." },
      { name: "HADR_REMOTE_HOST", scope: "database", description: "IP/hostname of the remote HADR partner." },
    ],
    commands: [
      { syntax: "db2pd -db <DBNAME> -hadr", description: "Most important HADR diagnostic. Shows sync mode, state, log positions, lag.", example: "db2pd -db PRODDB -hadr" },
      { syntax: "START HADR ON DATABASE <name> AS PRIMARY", description: "Start HADR role on primary side." },
      { syntax: "START HADR ON DATABASE <name> AS STANDBY", description: "Start HADR role on standby side." },
      { syntax: "TAKEOVER HADR ON DATABASE <name>", description: "Planned takeover — waits for PEER state." },
      { syntax: "TAKEOVER HADR ON DATABASE <name> BY FORCE", description: "Emergency takeover — does not wait. Use only when primary is confirmed dead." },
      { syntax: "SELECT * FROM TABLE(MON_GET_HADR(-2)) AS T", description: "SQL-based HADR monitoring, joinable with other MON_GET results." },
    ],
    expertNotes: [
      "db2pd -hadr output: check LOG_GAP_RUNNING_TOTAL (bytes behind). A growing gap in PEER state means replay is slower than replication rate.",
      "HADR_PEER_WINDOW: if set to 120s, primary stays in PEER state for 120s after losing contact — primary can commit without standby acknowledgment during this window. Zero means immediate fallback to ASYNC behavior.",
      "On NEARSYNC: if standby crashes mid-transmission, primary rolls forward. Potential window of data loss = log records in transit + standby log buffer.",
      "TAKEOVER BY FORCE with primary still running: both nodes become primary. This is split brain. DB2 cannot self-heal — manual intervention required to determine which site has latest data.",
      "HADR does not replicate: LOAD operations (unless NONRECOVERABLE), DDL structural changes may need manual re-sync. Always check after schema changes.",
      "Auxiliary standby monitoring: check each standby's lag independently. MON_GET_HADR returns one row per standby in 11.5+.",
    ],
    connections: [
      { targetId: "transaction-logging", type: "depends-on", label: "ships log records from" },
      { targetId: "archive-logging", type: "depends-on", label: "requires archive logging" },
      { targetId: "crash-recovery", type: "feeds-into", label: "standby uses recovery engine" },
      { targetId: "backup", type: "depends-on", label: "initial standby built from backup" },
      { targetId: "db2pd", type: "monitors", label: "monitored with -hadr flag" },
      { targetId: "mon-get", type: "monitors", label: "MON_GET_HADR() view" },
    ],
    recallPrompt: "HADR state shows REMOTE_CATCHUP and LOG_GAP_RUNNING_TOTAL is growing. The primary is in NEARSYNC mode. What does this mean, and how do you determine if failover is safe?",
    recallHint: "REMOTE_CATCHUP = standby is connected but behind. Growing gap = replay slower than replication rate. Check: is primary generating logs faster than standby can replay? db2pd -hadr on standby shows replay lag.",
    difficulty: 4,
    position: { x: 1080, y: 440 },
  },

  {
    id: "memory-architecture",
    slug: "memory-architecture",
    title: "Memory Architecture",
    category: "memory",
    version: ["11.5", "12"],
    shortDescription: "Hierarchical shared/private memory model: instance → database → agent private.",
    overview: `DB2's memory is organised into three tiers with distinct purposes and configuration parameters.

**Instance shared memory** (controlled by INSTANCE_MEMORY): FCM (Fast Communication Manager) buffers for inter-partition communication, monitor heap, audit buffer, db2sysc overhead. Allocated when the instance starts.

**Database shared memory** (controlled by DATABASE_MEMORY): Buffer pools, lock list, package cache, database heap, utility heap, shared sort heap (SHEAPTHRES_SHR), catalog cache. Allocated on first database activation. This is where most tuning effort is concentrated.

**Agent private memory**: Each agent/connection gets private memory for statement sort heap (SORTHEAP), stack, query compilation workspace. This memory is NOT part of DATABASE_MEMORY — it scales with active connections and can unexpectedly consume system memory.

**Self-Tuning Memory Manager (STMM)**: When DATABASE_MEMORY=AUTO, the memory tuner dynamically reallocates between buffer pools, sort heap, package cache, and lock list. STMM logs rebalance decisions to db2diag.log. Useful baseline: start with STMM enabled, monitor for 2-4 weeks, then pin values if workload is predictable.

**Memory sizing pitfall**: Many DBAs size only DATABASE_MEMORY and forget: instance memory + (MAXAGENTS × per-agent private memory) + OS overhead. On a system with 1000 connections and 2MB per-agent overhead, agent private alone = 2GB before any database memory.`,
    keyParameters: [
      { name: "INSTANCE_MEMORY", scope: "instance", unit: "4KB pages", defaultValue: "AUTOMATIC", description: "Instance shared memory. Covers FCM, monitor, audit." },
      { name: "DATABASE_MEMORY", scope: "database", unit: "4KB pages", defaultValue: "AUTOMATIC", description: "Database shared memory: buffer pools, lock list, package cache, shared sort." },
      { name: "SHEAPTHRES_SHR", scope: "database", unit: "4KB pages", defaultValue: "AUTOMATIC", description: "Maximum shared sort memory across all connections." },
      { name: "SHEAPTHRES", scope: "instance", unit: "4KB pages", defaultValue: "0", description: "Legacy instance-level sort threshold. Set to 0 when using SHEAPTHRES_SHR." },
      { name: "SORTHEAP", scope: "database", unit: "4KB pages", defaultValue: "AUTOMATIC", description: "Per-sort operation memory allocation. Overflows spill to TEMP tablespace." },
    ],
    commands: [
      { syntax: "db2pd -memsets -db <DBNAME>", description: "Show memory set allocations: sizes, usage, peak.", example: "db2pd -memsets -db PRODDB" },
      { syntax: "db2pd -mempools", description: "Instance-level memory pool breakdown." },
      { syntax: "SELECT POOL_ID, POOL_NAME, POOL_CUR_SIZE, POOL_WATERMARK FROM TABLE(MON_GET_MEMORY_POOL('DATABASE',NULL,-2)) AS T", description: "Database memory pool usage via SQL." },
      { syntax: "GET DBM CFG SHOW DETAIL", description: "Show instance config including INSTANCE_MEMORY." },
    ],
    expertNotes: [
      "STMM cannot steal memory from buffer pools below a configured minimum. Set STMM_NUM_QUANTUMS and monitor starvation events.",
      "On NUMA systems, DB2 memory allocation topology matters — db2 uses NUMA-aware allocation when available. Check /proc/buddyinfo after DB2 starts.",
      "Private sort memory is a common surprise. A busy system with 500 concurrent sorts at SORTHEAP=1024 pages = 2GB of unaccounted memory.",
      "DATABASE_MEMORY=AUTOMATIC can lead to DB2 holding memory longer than expected after workload drops — it does not release immediately.",
    ],
    connections: [
      { targetId: "buffer-pool", type: "controls", label: "allocates from" },
      { targetId: "sort-heap", type: "controls", label: "governs sort memory" },
      { targetId: "package-cache", type: "controls", label: "allocates for" },
      { targetId: "locking", type: "controls", label: "allocates LOCKLIST from" },
      { targetId: "edu-model", type: "feeds-into", label: "each EDU draws private memory" },
      { targetId: "db2pd", type: "monitors", label: "inspected with -memsets" },
    ],
    recallPrompt: "A production DB2 server with 64GB RAM has DATABASE_MEMORY=AUTO and MAXAGENTS=1000. Memory pressure alerts fire at 2am. What component is most likely the culprit that the DBA forgot to account for?",
    recallHint: "Agent private memory: 1000 connections × per-agent overhead (sort heap allocation + stack + query workspace). Not part of DATABASE_MEMORY.",
    difficulty: 3,
    position: { x: 860, y: 260 },
  },

  {
    id: "locking",
    slug: "locking",
    title: "Locking",
    category: "locking",
    version: ["11.5", "12"],
    shortDescription: "Multi-granularity row/table lock protocol with intent locking and concurrency control.",
    overview: `DB2 implements a multi-granularity locking protocol with both row-level and table-level locks, coordinated through intent locks on tables and tablespace.

**Lock modes** (from least to most restrictive): NL (No Lock), IN (Intent None), IS (Intent Share), S (Share), IX (Intent Exclusive), SIX (Share with Intent Exclusive), U (Update), X (Exclusive), Z (Super Exclusive).

Intent locks (IN, IS, IX) at table level signal intent to lock rows beneath. This allows other transactions to quickly determine whether a table-level lock is compatible without checking each row.

**Lock compatibility**: S locks are mutually compatible (multiple readers). X locks are not compatible with anything. U locks prevent other U locks (update intent) but allow S locks — critical for preventing "update deadlock" patterns.

**Currently Committed (CC)**: Introduced in DB2 9.7. At CS isolation, SELECT statements see the currently committed version of a row (not a lock-blocked version), similar to Oracle's read consistency. Eliminates many read-write lock conflicts. Enabled by default in DB2 10.5+. Controlled by CUR_COMMIT=ON in DB CFG.

**Lock granularity escalation**: When a connection's lock count approaches MAXLOCKS % of LOCKLIST, DB2 escalates that connection's row locks to a table lock. This is automatic and not configurable per-statement — prevent it by sizing LOCKLIST and MAXLOCKS appropriately.

**Lock timeout vs deadlock**: LOCKTIMEOUT (seconds, default -1 = wait forever) is per-connection wait for a single lock. DLCHKTIME is the interval for the deadlock detector background EDU to scan for circular wait chains.`,
    keyParameters: [
      { name: "LOCKLIST", scope: "database", unit: "4KB pages", defaultValue: "AUTOMATIC", description: "Shared lock list memory. Stores all lock records for the database.", tuningNote: "Monitor with db2pd -locks, aim for <75% utilization." },
      { name: "MAXLOCKS", scope: "database", unit: "percent", defaultValue: "AUTOMATIC", description: "% of LOCKLIST one connection can use before row locks escalate to table lock." },
      { name: "LOCKTIMEOUT", scope: "database", unit: "seconds", defaultValue: "-1", description: "-1=infinite wait. Set to a positive value in production to prevent lock storms.", tuningNote: "30-60s is a common production setting. Prevents connection pile-ups." },
      { name: "DLCHKTIME", scope: "database", unit: "milliseconds", defaultValue: "10000", description: "Deadlock detection interval. Lower = faster detection, more overhead.", tuningNote: "5000-10000ms typical. Reducing below 1000ms rarely helps." },
      { name: "CUR_COMMIT", scope: "database", defaultValue: "ON", description: "Currently Committed semantic for CS isolation. Dramatically reduces read-write lock contention." },
    ],
    commands: [
      { syntax: "db2pd -db <DBNAME> -locks showlocks", description: "Full lock detail: lock mode, holder AppHandle, waiter AppHandle, object name.", example: "db2pd -db PRODDB -locks showlocks" },
      { syntax: "db2pd -db <DBNAME> -applications -locks", description: "Correlate lock holders with application connection info." },
      { syntax: "SELECT * FROM TABLE(MON_GET_LOCKS(NULL,-2)) AS T WHERE LOCK_STATUS='W'", description: "All current lock waits." },
      { syntax: "SELECT * FROM TABLE(MON_GET_APPL_LOCKWAIT(NULL,-2)) AS T", description: "Detailed lock wait info per application." },
    ],
    expertNotes: [
      "Lock escalation to table level is not logged in db2diag by default — enable DB2_CAPTURE_LOCKTIMEOUT_EVENTS or event monitor to capture it.",
      "U lock mode is often misunderstood: only one U lock per row at a time, but S locks are compatible with U. This prevents 'two updaters' scenarios.",
      "In financial environments, long-running uncommitted transactions (batch inserts) combined with CS isolation are the most common source of lock escalation events.",
      "DB2 does not use intention locks in SUPER ASYNC HADR situations — locking is purely on the primary.",
      "With CUR_COMMIT=ON, SELECT sees committed data even when the row is currently locked. This eliminates many 'reader blocked by writer' scenarios common in pre-9.7 applications.",
    ],
    connections: [
      { targetId: "memory-architecture", type: "component-of", label: "LOCKLIST in db shared memory" },
      { targetId: "deadlocks", type: "triggers", label: "circular waits cause" },
      { targetId: "lock-escalation", type: "triggers", label: "LOCKLIST exhaustion triggers" },
      { targetId: "isolation-levels", type: "configures", label: "isolation determines lock mode" },
      { targetId: "db2pd", type: "monitors", label: "lock state via -locks flag" },
      { targetId: "mon-get", type: "monitors", label: "MON_GET_LOCKS() function" },
    ],
    recallPrompt: "A batch job acquires 50,000 row locks on a large table. What DB2 parameter controls when those row locks get promoted to a table lock, and what is the production impact?",
    recallHint: "LOCKLIST + MAXLOCKS. When connection's locks > (MAXLOCKS% of LOCKLIST total pages), row locks escalate to table. Impact: all other row-level operations on that table block.",
    difficulty: 3,
    position: { x: 310, y: 430 },
  },

  {
    id: "package-cache",
    slug: "package-cache",
    title: "Package Cache",
    category: "memory",
    version: ["11.5", "12"],
    shortDescription: "Shared memory holding compiled SQL access plans — the plan cache equivalent.",
    overview: `The package cache (plan cache) stores compiled SQL/XQuery access plans (called sections or packages) in database shared memory. Avoiding recompilation is critical for OLTP performance — compilation of a complex SQL statement can take 10-100ms or more.

**Static vs dynamic SQL**: Static SQL (pre-compiled via BIND) has packages stored in the system catalog. Dynamic SQL (JDBC PreparedStatements, embedded dynamic) caches sections in the package cache with a threshold-based eviction policy.

**Cache hit mechanics**: When a dynamic statement is executed, DB2 hashes the SQL text (after stripping literal values in some configurations) and looks up the package cache. A hit reuses the cached section. A miss triggers full compilation, statistics lookup, and access path determination.

**Memory pressure and eviction**: Under memory pressure, aged-out or unreferenced sections are evicted. Watch PCKCACHE_OVERFLOW_THRESHOLD. Excessive eviction shows as high NUM_COMPILATIONS in MON_GET_PKG_CACHE_STMT relative to NUM_EXEC_WITH_METRICS.

**Invalidation**: DDL operations (ALTER TABLE, RUNSTATS, REBIND) can invalidate cached sections. On next execution, DB2 recompiles — the package cache temporarily has a "zombie" section. In busy systems, a RUNSTATS on a heavily-used table causes a compilation storm.

**REOPT options**: BIND REOPT(ONCE) compiles on first execution with actual parameter values, caches result. REOPT(ALWAYS) recompiles every execution — useful for highly skewed parameter distributions but CPU-intensive.`,
    keyParameters: [
      { name: "PCKCACHESZ", scope: "database", unit: "4KB pages", defaultValue: "AUTOMATIC", description: "Size of the package cache. Under STMM, adjusted dynamically.", tuningNote: "On OLTP: monitor PKG_CACHE_INSERTS vs PKG_CACHE_LOOKUPS ratio. Below 95% hit rate investigate eviction." },
    ],
    commands: [
      { syntax: "db2pd -db <DBNAME> -pkgcache", description: "Package cache contents: sections, hit counts, invalidation reason.", example: "db2pd -db PRODDB -pkgcache detail" },
      { syntax: "SELECT NUM_COMPILATIONS, TOTAL_EXEC_TIME, STMT_TEXT FROM TABLE(MON_GET_PKG_CACHE_STMT(NULL,NULL,NULL,-2)) AS T ORDER BY NUM_COMPILATIONS DESC FETCH FIRST 20 ROWS ONLY", description: "Find most-compiled statements — high NUM_COMPILATIONS indicates eviction or plan invalidation." },
      { syntax: "SELECT PKG_CACHE_LOOKUPS, PKG_CACHE_INSERTS FROM TABLE(MON_GET_DATABASE(-2)) AS T", description: "Database-level package cache hit ratio." },
      { syntax: "FLUSH PACKAGE CACHE DYNAMIC", description: "Flush all dynamic sections. Use during tuning — causes compilation storm on next execution." },
    ],
    expertNotes: [
      "Parameter markers (?) enable section reuse across different parameter values. Literal embedding (WHERE col = 123) prevents reuse — generates a new hash per value.",
      "RUNSTATS invalidates all cached sections for affected tables. In production, schedule RUNSTATS during low-traffic windows and consider INCREMENTAL STATISTICS.",
      "Pinned packages (BIND with KEEPDYNAMIC=YES) remain in cache even under memory pressure — useful for critical paths.",
      "In pureScale, the package cache is per-member — each CF member has its own cache. No global cache sharing (unlike the GBP for data pages).",
    ],
    connections: [
      { targetId: "memory-architecture", type: "component-of", label: "resides in db shared memory" },
      { targetId: "statistics", type: "depends-on", label: "access plans based on statistics" },
      { targetId: "performance-explain", type: "feeds-into", label: "cached plan visible via EXPLAIN" },
      { targetId: "db2pd", type: "monitors", label: "inspected with -pkgcache" },
      { targetId: "mon-get", type: "monitors", label: "MON_GET_PKG_CACHE_STMT()" },
    ],
    recallPrompt: "After a DBA runs RUNSTATS on a major production table at 9am, CPU spikes and response time degrades for 2 minutes then recovers. Explain the mechanism.",
    recallHint: "RUNSTATS invalidates all cached sections for that table. First execution of every statement touching that table triggers full recompilation — a compilation storm. Recovery = cache repopulation.",
    difficulty: 3,
    position: { x: 920, y: 360 },
  },

  {
    id: "tablespace",
    slug: "tablespace",
    title: "Tablespace",
    category: "architecture",
    version: ["11.5", "12"],
    shortDescription: "Logical storage layer mapping objects to containers — DMS, SMS, or Automatic Storage.",
    overview: `Tablespaces are the logical storage abstraction between database objects (tables, indexes) and physical containers (files, devices, or OS directories). Every table, index, and LOB is assigned to a tablespace.

**Types by management model**:
- **SMS (System Managed Space)**: OS manages container growth. Directory containers. Limited control, deprecated for most uses. Still valid for TEMP tablespaces in some configurations.
- **DMS (Database Managed Space)**: DB2 manages space within fixed-size containers. File or raw device containers. Predictable allocation, extent-based management.
- **Automatic Storage**: DB2 allocates and extends containers automatically within a storage group. Recommended for new databases. Containers live in paths defined by STOGROUP.

**Page sizes**: 4K, 8K, 16K, 32K. Tablespace page size must match its buffer pool page size. Larger page sizes improve sequential scan efficiency but waste space for small rows (padding to page boundary). Maximum row size ≈ page size - overhead.

**Extent and prefetch tuning**: EXTENTSIZE (pages per extent — default 32) affects striping across containers. PREFETCHSIZE drives sequential prefetch read-ahead. For dedicated spindle arrays, PREFETCHSIZE = number_of_containers × EXTENTSIZE is the classic formula.

**Tablespace states**: NORMAL, BACKUP_PENDING, ROLLFORWARD_IN_PROGRESS, RESTORE_PENDING, etc. The BACKUP_PENDING state appears after adding a new tablespace — must take backup before DML is allowed.`,
    keyParameters: [
      { name: "PAGESIZE", scope: "database", unit: "bytes", description: "4096/8192/16384/32768. Set at creation time — cannot change without recreate." },
      { name: "EXTENTSIZE", scope: "database", unit: "pages", defaultValue: "32", description: "Number of pages per extent. Controls striping granularity across containers." },
      { name: "PREFETCHSIZE", scope: "database", unit: "pages", defaultValue: "AUTOMATIC", description: "Pages prefetched ahead of sequential scan. AUTOMATIC = system-determined." },
      { name: "BUFFERPOOLID", scope: "database", description: "Buffer pool assignment. Must match page size." },
      { name: "OVERHEAD", scope: "database", unit: "ms", defaultValue: "7.5", description: "Estimated I/O seek overhead for optimizer cost calculation." },
      { name: "TRANSFERRATE", scope: "database", unit: "ms/page", defaultValue: "0.06", description: "Estimated I/O transfer rate for optimizer cost calculation." },
    ],
    commands: [
      { syntax: "LIST TABLESPACES SHOW DETAIL", description: "All tablespace states, sizes, utilization, container counts." },
      { syntax: "SELECT * FROM TABLE(MON_GET_TABLESPACE('',-2)) AS T", description: "Monitoring data: reads, writes, hit ratio per tablespace." },
      { syntax: "db2pd -db <DBNAME> -tablespaces", description: "Real-time tablespace state from shared memory." },
      { syntax: "ALTER TABLESPACE <name> ADD (FILE '<path>' <size>)", description: "Add a new container to a DMS tablespace (online)." },
    ],
    expertNotes: [
      "BACKUP_PENDING state is commonly encountered after adding a tablespace or container to a database in ARCHIVE LOG mode. A tablespace-level backup clears it.",
      "Automatic storage rebalancing runs in the background — check db2pd -rebalance or ADMIN_GET_TAB_INFO() for progress.",
      "SMS TEMP tablespace: DB2 creates the temp directory per DB activation. If temp path is on a nearly full filesystem, sort overflows and REORG operations fail with disk full errors.",
      "Tablespace page size determines maximum varchar length. 4K page = max ~32KB row. For very wide rows (many columns + LOB), consider 32K page tablespace.",
    ],
    connections: [
      { targetId: "buffer-pool", type: "depends-on", label: "buffered by matching pool" },
      { targetId: "storage-group", type: "component-of", label: "containers in storage group" },
      { targetId: "reorg", type: "impacts", label: "REORG rewrites within" },
      { targetId: "backup", type: "depends-on", label: "tablespace-level backup" },
    ],
    recallPrompt: "A DBA adds a new tablespace on a HADR environment and immediately tries to insert data. The insert fails. What state is the tablespace in and why?",
    recallHint: "BACKUP_PENDING. New tablespace in archive-log mode requires at least one backup before DML. DB2 cannot roll forward a tablespace it has no backup image for.",
    difficulty: 2,
    position: { x: 460, y: 480 },
  },

  {
    id: "storage-group",
    slug: "storage-group",
    title: "Storage Groups",
    category: "architecture",
    version: ["11.5", "12"],
    shortDescription: "Named set of storage paths for automatic storage tablespace container management.",
    overview: `Storage groups (STOGROUPs) define the physical storage paths from which DB2 automatically allocates and extends containers for automatic storage tablespaces.

**IBMSTOGROUP** is the default storage group created when a database is created with AUTOMATIC STORAGE YES. It uses the database path unless overridden.

Multiple storage groups allow tiered storage: fast NVMe SSDs for hot tablespaces (IBMOLTP), slower spindles for archival (IBMARCHIVE). Tablespaces are assigned to a storage group at creation time.

**Rebalancing**: When storage paths are added or removed, DB2 can rebalance container extents across the new storage layout. This runs in the background and can be monitored. Use ALTER STOGROUP to add paths, then ALTER TABLESPACE REBALANCE to redistribute.

**DB2 12 enhancement**: Storage group compression settings, improved rebalance monitoring, integration with tiered flash storage configurations.`,
    keyParameters: [
      { name: "OVERHEAD", scope: "database", description: "Storage group-level I/O overhead for optimizer." },
      { name: "TRANSFERRATE", scope: "database", description: "Storage group-level transfer rate for optimizer." },
    ],
    commands: [
      { syntax: "CREATE STOGROUP <name> ON '<path1>','<path2>'", description: "Create a storage group pointing to one or more filesystem paths." },
      { syntax: "ALTER STOGROUP <name> ADD '<newpath>'", description: "Add a storage path — triggers rebalance eligibility." },
      { syntax: "ALTER TABLESPACE <name> REBALANCE", description: "Redistribute extents across new/changed storage group paths." },
      { syntax: "SELECT * FROM SYSCAT.STOGROUPS", description: "Storage group catalog information." },
    ],
    expertNotes: [
      "Storage group paths must exist on all members in a partitioned or pureScale environment — DB2 does not create directories.",
      "After a storage path failure, tablespaces in that storage group enter STORAGE_MUST_DEFINE state — containers on failed path are unavailable.",
    ],
    connections: [
      { targetId: "tablespace", type: "controls", label: "provides containers for" },
    ],
    recallPrompt: "A DBA adds a new high-speed SSD mount to a storage group with ALTER STOGROUP. What must they do next to actually use the new capacity?",
    recallHint: "ALTER TABLESPACE ... REBALANCE. Without the explicit rebalance command, existing extents stay on old paths. New extents may use the new path but existing data does not move.",
    difficulty: 2,
    position: { x: 290, y: 560 },
  },

  {
    id: "crash-recovery",
    slug: "crash-recovery",
    title: "Crash Recovery",
    category: "logging",
    version: ["11.5", "12"],
    shortDescription: "Automatic database consistency restoration after abnormal termination using log replay.",
    overview: `Crash recovery restores database consistency after an abnormal DB2 termination (system crash, kill -9, power failure). DB2 uses ARIES (Algorithm for Recovery and Isolation Exploiting Semantics).

**Recovery phases**:
1. **Analysis pass**: Scan log forward from last checkpoint to end. Identify all transactions in-flight at crash time and all dirty pages (those modified but possibly not written to disk).
2. **Redo (forward) pass**: Replay all logged changes from the oldest dirty page LSN forward, re-applying committed and uncommitted changes. Restores the database to crash state.
3. **Undo (backward) pass**: Roll back all uncommitted transactions using the CLR (Compensation Log Record) chain. Undo is also logged, making undo restartable.

**Checkpoint**: DB2 periodically writes checkpoint records. SOFTMAX controls how far back from the current log position the oldest dirty page can be (limits redo scan). Checkpoints are triggered by: SOFTMAX threshold, explicit ARCHIVE LOG command, normal shutdown.

**Recovery time factors**: LOGPRIMARY × LOGFILSIZ determines max redo scan distance. NUM_IOCLEANERS affects how dirty the buffer pool gets between checkpoints. SOFTMAX default=100% means the redo scan can extend up to one full primary log space.

**RESTART DATABASE**: Manually initiate crash recovery on a database that is in CONSISTENT state pending restart. Normally automatic on ACTIVATE/CONNECT.`,
    keyParameters: [
      { name: "SOFTMAX", scope: "database", unit: "percent", defaultValue: "100", description: "Maximum redo log scan distance as % of primary log space.", tuningNote: "Lower value = more frequent checkpoints = faster crash recovery but more I/O." },
      { name: "NUM_IOCLEANERS", scope: "database", description: "Page cleaner count — affects checkpoint frequency and buffer pool dirt level." },
    ],
    commands: [
      { syntax: "RESTART DATABASE <name>", description: "Initiate crash recovery on a database pending restart." },
      { syntax: "db2pd -db <DBNAME> -recovery", description: "Show recovery progress: redo and undo phases, log positions." },
    ],
    expertNotes: [
      "Crash recovery time is dominated by the redo scan distance. Reduce SOFTMAX to 50-60% on systems where fast restart is an SLA requirement.",
      "If crash recovery fails mid-way (another crash), it restarts from the beginning — it is idempotent by design (ARIES guarantees).",
      "In HADR, crash recovery runs on the standby side during normal operation — it is the replay engine. Same ARIES algorithm.",
    ],
    connections: [
      { targetId: "transaction-logging", type: "depends-on", label: "reads log for redo/undo" },
      { targetId: "buffer-pool", type: "feeds-into", label: "dirty pages identified via" },
      { targetId: "archive-logging", type: "depends-on", label: "may need archived logs for full redo" },
      { targetId: "hadr", type: "feeds-into", label: "standby uses same recovery engine" },
    ],
    recallPrompt: "A DB2 instance crashes mid-transaction. On restart, DB2 performs three distinct recovery passes. Name them in order and describe what each achieves.",
    recallHint: "ARIES: Analysis (identify in-flight txns and dirty pages from last checkpoint) → Redo (replay all changes to crash state) → Undo (rollback uncommitted txns).",
    difficulty: 4,
    position: { x: 640, y: 680 },
  },

  {
    id: "archive-logging",
    slug: "archive-logging",
    title: "Archive Logging",
    category: "logging",
    version: ["11.5", "12"],
    shortDescription: "Preservation of filled log files enabling online backup, HADR, and point-in-time recovery.",
    overview: `Archive logging changes DB2 from circular logging (crash recovery only) to a full recovery model. When LOGARCHMETH1 is set, DB2 copies filled primary log files to the archive destination before reusing them.

**Archive methods (LOGARCHMETH1/2)**:
- **LOGRETAIN**: Retain logs on active log path — user manages movement. Simplest.
- **USEREXIT**: User-provided exit program copies logs. Custom integration.
- **DISK:/path**: Copy logs to specified path. Most common for local DR.
- **TSM**: IBM Tivoli Storage Manager. Enterprise tape/vault integration.
- **VENDOR:lib**: Any third-party archive library implementing the archive API.

**Dual archival (LOGARCHMETH2)**: Mirror copy of archived logs to a second destination. Critical for disaster scenarios where primary archive is unreachable. Always set in production.

**Log archive gap**: If archive fails and DB2 runs out of log space, SQL0968C (log archive failure). DB2 retries but cannot proceed until archival succeeds or logs are manually moved.

**HADR interaction**: Standby reads from archive when primary log shipping fails or on initial sync. HADR_LOGARCHIVE_DELAY prevents premature archival of logs still in flight on the primary.

**Archive log pruning**: After a successful backup, older archive logs can be pruned using PRUNE HISTORY or via TSM retention policies. Required logs = all logs since last backup required for recovery.`,
    keyParameters: [
      { name: "LOGARCHMETH1", scope: "database", description: "Primary archive method. DISK/TSM/VENDOR/LOGRETAIN/USEREXIT." },
      { name: "LOGARCHMETH2", scope: "database", description: "Secondary archive for redundancy — strongly recommended." },
      { name: "LOGARCHOPT1", scope: "database", description: "Options string passed to LOGARCHMETH1 (e.g., TSM management class)." },
      { name: "LOGARCHCOMPR1", scope: "database", defaultValue: "OFF", description: "Compress archived log files. Reduces storage but adds CPU overhead." },
    ],
    commands: [
      { syntax: "ARCHIVE LOG FOR DATABASE <name>", description: "Force archive of current active log file. Useful before backup or manual gap closure." },
      { syntax: "db2 \"LIST HISTORY BACKUP ALL FOR <name>\"", description: "Recovery history: backup images, archive events, recovery operations." },
      { syntax: "db2ckrst -d <DBNAME> -t <timestamp>", description: "Check which backup image and archived logs are needed for PIT recovery to given timestamp." },
    ],
    expertNotes: [
      "LOGARCHMETH1=LOGRETAIN requires the DBA to manually manage log files — not truly automated. Use DISK or TSM for production.",
      "After switching from circular to archive logging, a full database backup is required before HADR can be set up.",
      "Archive log compression (LOGARCHCOMPR1=ON) can reduce archive storage 60-70% for typical workloads but adds 5-15% CPU to log archival.",
      "db2ckrst is the pre-flight check before restore — use it to enumerate exactly which archives are needed. Missing one archive breaks the rollforward chain.",
    ],
    connections: [
      { targetId: "transaction-logging", type: "feeds-into", label: "archives filled log files" },
      { targetId: "hadr", type: "feeds-into", label: "standby reads from archive" },
      { targetId: "backup", type: "depends-on", label: "online backup requires archive mode" },
      { targetId: "restore-rollforward", type: "feeds-into", label: "ROLLFORWARD reads archived logs" },
    ],
    recallPrompt: "You configure LOGARCHMETH1=DISK:/db2archive and LOGARCHMETH2=TSM. The disk archive fills up. What happens to the DB2 database?",
    recallHint: "DB2 retries primary archive. If disk is full, LOGARCHMETH2 (TSM) takes over as fallback. If BOTH fail, DB2 cannot reuse log files → SQL0968C → database unavailable until archive succeeds.",
    difficulty: 3,
    position: { x: 880, y: 640 },
  },

  {
    id: "backup",
    slug: "backup",
    title: "Backup",
    category: "admin",
    version: ["11.5", "12"],
    shortDescription: "Online/offline database and tablespace backups — foundation of all recovery strategies.",
    overview: `DB2 backup captures a consistent snapshot of data pages (and optionally log files) for use in restore operations. Backup types:

**Full vs tablespace**: Full backup captures all tablespaces. Tablespace backup captures a subset — useful for large databases where full backup is too time-consuming.

**Online vs offline**: Online backup runs while the database is active. Requires archive logging. The backup image captures data pages as modified during the backup window; the embedded or separately archived logs bridge the gap for consistency. Offline backup requires exclusive database access — rarely practical in 24/7 environments.

**INCLUDE LOGS**: Embeds required log files in the backup image. Makes the image self-contained for rollforward to minimum recovery time. Increases image size but simplifies restore (no separate log archive retrieval).

**Compression**: COMPRESS reduces image size typically 50-70%. Small CPU overhead during backup. Almost always worth it for large databases.

**Incremental backup** (DB2 11.5+): INCREMENTAL DELTA captures only pages changed since last backup. Reduces backup time and storage. Restore sequence: full → delta1 → delta2 → ... Incremental cumulative captures changes since last full.

**Recovery history file**: db2 maintains a recovery history file tracking all backup, restore, and load operations. VIEW RECOVERY HISTORY / LIST HISTORY commands reference it.`,
    keyParameters: [
      { name: "LOGRETAIN", scope: "database", description: "Legacy parameter — superseded by LOGARCHMETH1. Must be archive logging for online backup." },
      { name: "NUM_IOSERVERS", scope: "database", description: "Parallel I/O servers for backup I/O throughput — more servers = faster backup on striped storage." },
    ],
    commands: [
      { syntax: "BACKUP DATABASE <name> ONLINE TO <path> COMPRESS INCLUDE LOGS", description: "Standard online compressed backup with embedded logs.", example: "BACKUP DATABASE PRODDB ONLINE TO /db2backup COMPRESS INCLUDE LOGS WITHOUT PROMPTING" },
      { syntax: "BACKUP DATABASE <name> ONLINE INCREMENTAL DELTA TO <path>", description: "Delta incremental backup — changed pages since last backup." },
      { syntax: "LIST HISTORY BACKUP ALL FOR <name>", description: "Show all backup images in recovery history." },
      { syntax: "db2ckbkp <image_path>", description: "Verify backup image integrity without restoring." },
    ],
    expertNotes: [
      "Always run db2ckbkp after backup completion in production — verifies image is not corrupted before relying on it for recovery.",
      "INCLUDE LOGS embeds the minimum logs needed. For HADR standby initialization, use the image without INCLUDE LOGS and transfer archive logs separately.",
      "Backup to TSM: requires DB2 TSM API library (libtsm.so) and environment variables pointing to dsm.opt. Test TSM retrieval before an actual disaster.",
      "After a LOAD NONRECOVERABLE operation, the affected tablespace enters BACKUP_PENDING — the backup is logically invalid for those pages. Backup immediately after such LOADs.",
    ],
    connections: [
      { targetId: "archive-logging", type: "depends-on", label: "online backup requires archive log" },
      { targetId: "restore-rollforward", type: "feeds-into", label: "backup image used in restore" },
      { targetId: "hadr", type: "feeds-into", label: "standby seeded from backup" },
      { targetId: "tablespace", type: "feeds-into", label: "tablespace-level backup" },
    ],
    recallPrompt: "A backup completes successfully but a DBA is not sure the image is usable. What command verifies backup integrity, and what does it NOT check?",
    recallHint: "db2ckbkp verifies image header and block checksums. It does NOT test whether the embedded log files are complete enough for rollforward, and does NOT connect to DB2.",
    difficulty: 2,
    position: { x: 1020, y: 630 },
  },

  {
    id: "restore-rollforward",
    slug: "restore-rollforward",
    title: "Restore & Rollforward",
    category: "admin",
    version: ["11.5", "12"],
    shortDescription: "Two-phase recovery: RESTORE recovers data pages; ROLLFORWARD replays logs for consistency.",
    overview: `Recovery after a media failure or PIT (point-in-time) request involves two distinct DB2 operations:

**RESTORE DATABASE**: Reads the backup image and writes data pages to their tablespace containers. At the end, the database is in ROLLFORWARD_PENDING state — it is not yet consistent.

**ROLLFORWARD DATABASE**: Replays archived and active log records from the backup LSN forward to either the END OF LOGS (full recovery) or a specified STOP AT timestamp (point-in-time). After ROLLFORWARD STOP, the database is brought online.

**Redirected restore**: Allows changing container paths during restore. Critical when restoring to different hardware or when original path is unavailable. Use SET TABLESPACE CONTAINERS FOR before completing the restore.

**Tablespace PIT recovery**: Can rollforward individual tablespaces to a specific point in time while other tablespaces continue normal operation. The recovered tablespace must be taken offline during the process.

**Recovery from HADR standby**: Can restore from a backup taken on the standby, as HADR backup images are interchangeable. This offloads backup I/O from the primary.

**Recovery history**: DB2 tracks all recovery operations. PRUNE HISTORY removes old entries. Do not prune history until you are confident you do not need older recovery points.`,
    keyParameters: [],
    commands: [
      { syntax: "RESTORE DATABASE <name> FROM <path> TAKEN AT <timestamp> INTO <name>", description: "Restore a full backup image." },
      { syntax: "RESTORE DATABASE <name> FROM <path> TAKEN AT <timestamp> REDIRECT", description: "Begin a redirected restore — allows container path changes." },
      { syntax: "SET TABLESPACE CONTAINERS FOR <id> USING (FILE '<path>' <size>)", description: "Specify new container paths during redirected restore." },
      { syntax: "RESTORE DATABASE <name> CONTINUE", description: "Complete a redirected restore after setting containers." },
      { syntax: "ROLLFORWARD DATABASE <name> TO END OF LOGS AND STOP", description: "Full log replay to latest recoverable state, bring online." },
      { syntax: "ROLLFORWARD DATABASE <name> TO <timestamp> AND STOP", description: "Point-in-time recovery to a specific timestamp." },
      { syntax: "ROLLFORWARD DATABASE <name> QUERY STATUS", description: "Check rollforward progress: current log, minimum recovery time." },
    ],
    expertNotes: [
      "ROLLFORWARD TO END OF LOGS is not the same as END OF BACKUP — you need all archive logs from backup LSN to present. Missing one log breaks the chain.",
      "Redirected restore: after RESTORE ... REDIRECT, the restore is NOT yet applied to disk. You must issue SET TABLESPACE CONTAINERS then RESTORE ... CONTINUE.",
      "PIT recovery to 09:00:00 will include all transactions that committed BEFORE 09:00:00 UTC. Timezone matters — DB2 timestamps in recovery are UTC.",
      "After ROLLFORWARD AND STOP, the database is online but the tablespace state should show NORMAL. If still ROLLFORWARD_IN_PROGRESS, a log chain gap occurred.",
    ],
    connections: [
      { targetId: "backup", type: "depends-on", label: "restore reads backup image" },
      { targetId: "archive-logging", type: "depends-on", label: "rollforward reads archived logs" },
      { targetId: "crash-recovery", type: "feeds-into", label: "restore triggers crash recovery phase" },
      { targetId: "tablespace", type: "feeds-into", label: "tablespace-level restore/rollforward" },
    ],
    recallPrompt: "A ROLLFORWARD completes with status 'ROLLFORWARD_IN_PROGRESS' instead of bringing the database online. What is the most likely cause?",
    recallHint: "A gap in the archived log chain. DB2 cannot advance past the missing log file. Check ROLLFORWARD QUERY STATUS for current log position, then locate the missing archive log.",
    difficulty: 4,
    position: { x: 860, y: 780 },
  },

  {
    id: "performance-explain",
    slug: "performance-explain",
    title: "Performance EXPLAIN",
    category: "performance",
    version: ["11.5", "12"],
    shortDescription: "Optimizer access plan capture — the authoritative source of DB2 query execution decisions.",
    overview: `DB2's EXPLAIN facility captures the access plan chosen by the query optimizer into EXPLAIN tables (EXPLAIN_INSTANCE, EXPLAIN_STATEMENT, EXPLAIN_OPERATOR, EXPLAIN_STREAM, etc.). The db2exfmt tool formats these into a human-readable plan tree.

**Key EXPLAIN metrics**:
- **TOTAL_COST**: Optimizer's estimated cost in timerons (not wall-clock seconds). Useful for comparing plans, not absolute performance.
- **IO_COST / CPU_COST**: Component breakdown of TOTAL_COST.
- **NCARD**: Estimated cardinality (row count) of each intermediate result. Cardinality errors are the most common source of bad plans.
- **NLEAF / NLEVELS**: Index statistics — number of leaf pages and tree height.
- **PREFETCH type**: NONE / SEQUENTIAL / LIST / DYNAMIC — indicates the scan strategy chosen.

**db2exfmt usage**: Run against the current EXPLAIN schema (set with SET CURRENT EXPLAIN SCHEMA). The -1 flag formats the latest captured plan.

**Plan instability**: When statistics change (RUNSTATS, data growth), plans can change unexpectedly. Use EXPLAIN SNAPSHOT to capture the plan alongside execution context. In DB2 11.5+, QUERY_OPTIMIZER_FEEDBACK provides optimization hints and plan stability features.

**Common bad plan indicators**: NCARD estimate wildly off actual row count; Table scan (TBSCAN) on large tables with selective predicates; Sort operator (SORT) on columns not in index; Nested loop on large outer tables.`,
    keyParameters: [
      { name: "DFT_QUERYOPT", scope: "database", defaultValue: "5", description: "Default query optimization class (0-9). Higher = more optimization time. 5 is production default." },
      { name: "CURRENT QUERY OPTIMIZATION", scope: "session", description: "Session-level override of optimization class." },
    ],
    commands: [
      { syntax: "SET CURRENT EXPLAIN MODE EXPLAIN", description: "Capture explain for next statement without executing.", example: "SET CURRENT EXPLAIN MODE EXPLAIN; SELECT * FROM T1 JOIN T2 ON T1.ID=T2.ID; SET CURRENT EXPLAIN MODE NO;" },
      { syntax: "db2exfmt -d <DBNAME> -e <schema> -1 -o output.txt", description: "Format the most recent explain into readable plan tree." },
      { syntax: "EXPLAIN PLAN FOR <sql>", description: "Capture explain for a specific SQL statement." },
      { syntax: "SELECT * FROM EXPLAIN_STATEMENT WHERE EXPLAIN_LEVEL='O' ORDER BY EXPLAIN_TIME DESC FETCH FIRST 10 ROWS ONLY", description: "Most recently explained statements." },
    ],
    expertNotes: [
      "Timerons are not milliseconds. A cost of 10,000 vs 100,000 timerons means the optimizer thinks one plan is 10× cheaper — but actual elapsed time depends on data characteristics.",
      "NCARD = 1 on a table with 10M rows is a red flag: statistics are missing or wildly stale. RUNSTATS immediately.",
      "Nested loop join (NLjoin) with a large outer table is usually bad — check if the inner table has an index on the join column.",
      "DB2 11.5 introduced QUERY_OPTIMIZER_FEEDBACK: the optimizer can recommend hints after execution if the estimated cardinality was significantly wrong.",
      "EXPLAIN tables must be created in the target schema. If missing, run db2exfmt -l to see if they exist, or run EXPLAIN.DDL from the sqllib/misc directory.",
    ],
    connections: [
      { targetId: "statistics", type: "depends-on", label: "optimizer uses statistics for cost" },
      { targetId: "index-strategy", type: "impacts", label: "index usage visible in plan" },
      { targetId: "package-cache", type: "feeds-into", label: "plan stored in package cache" },
      { targetId: "sort-heap", type: "impacts", label: "sort operators consume sortheap" },
      { targetId: "wlm", type: "configures", label: "WLM can intercept expensive queries" },
    ],
    recallPrompt: "An explain plan shows NCARD=1 for a table you know has 8 million rows. What is the immediate action, and what is the systemic fix?",
    recallHint: "Immediate: RUNSTATS ON TABLE schema.table WITH DISTRIBUTION AND INDEXES ALL to refresh statistics. Systemic: schedule regular RUNSTATS as part of maintenance window or use AUTOMATIC STATISTICS COLLECTION.",
    difficulty: 3,
    position: { x: 480, y: 160 },
  },

  {
    id: "wlm",
    slug: "wlm",
    title: "WLM — Workload Management",
    category: "performance",
    version: ["11.5", "12"],
    shortDescription: "Service class hierarchy and threshold enforcement for workload prioritisation and resource governance.",
    overview: `DB2 Workload Management (WLM) provides a multi-tier framework for workload classification, resource allocation, and threshold enforcement.

**Object hierarchy**:
- **Workloads**: Connection classification rules (application name, user, role, client IP). Match incoming connections to service classes.
- **Service Classes**: Resource allocation groups. Superclasses contain subclasses. The SYSDEFAULTSUBCLASS under SYSDEFAULTUSERCLASS captures unclassified connections.
- **Thresholds**: Rules enforced on activity within a service class: ESTIMATEDSQLCOSTLIMIT, SQLTEMPSPACE, UOWTOTALTIME, CONCURRENTDBCOORDACTIVITIES, CONNECTIONIDLETIME.
- **Work Action Sets**: Route specific SQL types (DML/DDL/LOAD) to sub-classes for finer control.
- **Histograms**: WLM collects distribution histograms on activity metrics — invaluable for understanding workload shape over time.

**Threshold actions on breach**: STOP EXECUTION (hard stop), COLLECT ACTIVITY DATA (capture diagnostics), FORCE APPLICATION (terminate connection), REMAP ACTIVITY (move to different service class — throttle, not kill).

**WLM queuing**: CONCURRENTDBCOORDACTIVITIES threshold with QUEUEDACTIVITIES allows query queuing — when concurrency limit is reached, new activities queue rather than fail. Useful for controlling connection storms.

**Monitoring integration**: MON_GET_SERVICE_SUBCLASS(), MON_GET_WORKLOAD(), MON_GET_ACTIVITY() provide real-time WLM metrics. WLM event monitors capture threshold breach details.`,
    keyParameters: [],
    commands: [
      { syntax: "CREATE SERVICE CLASS <name> UNDER <superclass>", description: "Create a service subclass for workload partitioning." },
      { syntax: "CREATE THRESHOLD <name> FOR SERVICE CLASS <name> ACTIVITIES ENFORCE DATABASE PARTITION WHEN ESTIMATEDSQLCOSTLIMIT > 1000000 STOP EXECUTION", description: "Kill queries estimated above cost threshold." },
      { syntax: "db2pd -db <DBNAME> -wlm", description: "WLM state: active workloads, service class populations, queued activities." },
      { syntax: "SELECT * FROM TABLE(MON_GET_SERVICE_SUBCLASS(NULL,NULL,-2)) AS T", description: "Activity metrics per service class." },
    ],
    expertNotes: [
      "ESTIMATEDSQLCOSTLIMIT uses optimizer cost estimates — not actual runtime. A query with NCARD=1 (bad statistics) may slip through even if it runs for hours.",
      "WLM histograms are reset on db deactivation. Export histogram data periodically for trending.",
      "In financial environments, CONCURRENTDBCOORDACTIVITIES queuing is often the first line of defence against connection storms during market events.",
      "WLM service classes can map to OS resource groups (cgroups on Linux) for CPU isolation — rarely configured but powerful for mixed OLTP/batch workloads.",
    ],
    connections: [
      { targetId: "performance-explain", type: "configures", label: "cost thresholds use explain metrics" },
      { targetId: "mon-get", type: "monitors", label: "MON_GET_SERVICE_SUBCLASS()" },
      { targetId: "db2pd", type: "monitors", label: "WLM state via -wlm flag" },
    ],
    recallPrompt: "A business-critical OLTP application is competing with an ad-hoc analytics workload during market hours. Using WLM, describe the mechanism to guarantee OLTP response time without killing analytics queries.",
    recallHint: "Service classes with CONCURRENTDBCOORDACTIVITIES threshold + QUEUEDACTIVITIES. Analytics goes into a subclass with concurrency cap — excess queries queue. OLTP class gets no concurrency limit or higher OS priority.",
    difficulty: 4,
    position: { x: 750, y: 140 },
  },

  {
    id: "edu-model",
    slug: "edu-model",
    title: "EDU Model",
    category: "architecture",
    version: ["11.5", "12"],
    shortDescription: "Engine Dispatchable Units — DB2's internal thread model for all database activities.",
    overview: `Every database activity in DB2 executes within an Engine Dispatchable Unit (EDU). An EDU is roughly equivalent to a thread (on Linux/AIX, DB2 uses a thread-based model; on older platforms, processes).

**Key EDU types**:
- **Coordinator agent**: Handles one client connection. Parses SQL, invokes optimizer, coordinates execution.
- **Subagents**: Execute parallel query work. A DOP (degree of parallelism) of 4 spawns 4 subagents from the coordinator.
- **Prefetch agents (IOSERVERS)**: Anticipate sequential scans and issue async reads. Controlled by NUM_IOSERVERS.
- **Page cleaners (IOCLEANERS)**: Flush dirty buffer pool pages to disk asynchronously. Controlled by NUM_IOCLEANERS.
- **Log writer (LOGGR)**: Dedicated EDU for writing log records from log buffer to disk. Critical path for COMMIT latency.
- **Deadlock detector (DLOCK)**: Periodic scan for circular lock waits (interval = DLCHKTIME).
- **FCM sender/receiver**: Fast Communication Manager EDUs for inter-partition or intra-pureScale communication.
- **HADR sender/receiver**: Dedicated EDUs for log shipping and replay on primary/standby.

**db2pd -edu** shows all active EDUs with their IDs, states, and CPU time. Essential for identifying runaway threads, hung EDUs, or unexpected resource consumption.`,
    keyParameters: [
      { name: "MAX_COORDAGENTS", scope: "instance", description: "Maximum number of coordinator agent EDUs across all databases." },
      { name: "NUM_IOCLEANERS", scope: "database", defaultValue: "AUTOMATIC", description: "Page cleaner EDU count per database." },
      { name: "NUM_IOSERVERS", scope: "database", defaultValue: "AUTOMATIC", description: "Prefetch I/O server EDU count per database." },
    ],
    commands: [
      { syntax: "db2pd -edu", description: "List all active EDUs with CPU time, state, and TID.", example: "db2pd -edu | grep -i loggr" },
      { syntax: "db2pd -applications", description: "Coordinator agents, connection details, current SQL." },
    ],
    expertNotes: [
      "On Linux, db2pd -edu shows the EDU as a thread within the db2sysc process. You can correlate with 'ps -L' or 'top -H' using the thread ID.",
      "A hung LOGGR EDU causes all committing transactions to stall — manifests as application timeouts with no lock waits. Check db2pd -edu for LOGGR state.",
      "HADR sender EDU exists only on the primary; receiver and log apply EDUs exist on the standby. Their CPU usage indicates HADR throughput.",
    ],
    connections: [
      { targetId: "memory-architecture", type: "component-of", label: "each EDU has private memory" },
      { targetId: "transaction-logging", type: "feeds-into", label: "LOGGR EDU writes logs" },
      { targetId: "buffer-pool", type: "feeds-into", label: "IOCLEANERS flush dirty pages" },
      { targetId: "hadr", type: "feeds-into", label: "HADR sender/receiver EDUs" },
      { targetId: "db2pd", type: "monitors", label: "all EDUs visible via -edu" },
    ],
    recallPrompt: "All application connections are stalling at COMMIT with no visible lock waits. What EDU should you check first, and with what command?",
    recallHint: "LOGGR (log writer) EDU. If hung, all commits stall waiting for log flush acknowledgment. Check: db2pd -edu | grep -i loggr — is it WAIT or running?",
    difficulty: 4,
    position: { x: 650, y: 480 },
  },

  {
    id: "db2pd",
    slug: "db2pd",
    title: "db2pd",
    category: "monitoring",
    version: ["11.5", "12"],
    shortDescription: "Non-locking real-time diagnostic tool reading directly from DB2 shared memory.",
    overview: `db2pd is the most powerful DB2 diagnostic tool for production troubleshooting. It reads directly from DB2's shared memory — no catalog queries, no locks, minimal overhead. Works even when the database is in a degraded state where SQL is unavailable.

**Core principle**: Unlike SQL monitoring views, db2pd does not acquire any database locks. It reads a snapshot of shared memory structures. Data may be slightly inconsistent (pages read at different instants) but this is acceptable for diagnostics.

**Essential flags**:
- **-db DBNAME**: Scope to a specific database (required for most db-level flags).
- **-locks [showlocks]**: Lock list contents. showlocks shows details per lock.
- **-applications**: Coordinator agents, AppHandles, connection details, SQL hash.
- **-agents**: All agents including subagents, coordinator relationships.
- **-bufferpools**: Buffer pool utilization and hit ratios.
- **-hadr**: HADR state, log positions, sync mode, connect status.
- **-logs**: Log space utilization, current log file.
- **-transactions**: Active transactions, log space usage, first log record.
- **-tablespaces**: Tablespace states and metadata.
- **-pkgcache [detail]**: Package cache contents.
- **-memsets**: Memory set sizes and utilization.
- **-edu**: All EDUs with CPU time and state.
- **-wlm**: WLM service class populations.
- **-recovery**: Recovery progress (crash recovery or rollforward).
- **-tcbstats**: Table control block statistics.

**db2pd output looping**: Use \`-interval <secs> -count <n>\` to take repeated snapshots — essential for watching metrics change over time.`,
    keyParameters: [],
    commands: [
      { syntax: "db2pd -db <DBNAME> -locks showlocks -applications", description: "Combined lock + application view — identify holder and waiter with one command.", example: "db2pd -db PRODDB -locks showlocks -applications 2>&1 | tee /tmp/lockdiag.txt" },
      { syntax: "db2pd -db <DBNAME> -hadr", description: "HADR status, log gap, connect state." },
      { syntax: "db2pd -db <DBNAME> -transactions", description: "Active transactions, first log record (age), log space held." },
      { syntax: "db2pd -interval 5 -count 12 -db <DBNAME> -bufferpools", description: "Sample buffer pool metrics every 5 seconds for 1 minute." },
      { syntax: "db2pd -db <DBNAME> -logs", description: "Log utilization: primary vs secondary log usage." },
    ],
    expertNotes: [
      "AppHandle format is <member>-<agent_pid>. On a single-member system, always starts with 0-. In a DPF or pureScale environment, member number differentiates members.",
      "db2pd -transactions: the 'FirstLSN' column shows the oldest log record held by an open transaction. Large FirstLSN-to-CurrentLSN gap = long-running transaction consuming log space.",
      "db2pd output timestamps are system time in UTC. When correlating with db2diag.log, ensure timezone alignment.",
      "Running db2pd on standby (HADR): -db works but many flags return limited data since standby is not active. -hadr always works on standby.",
      "The -file flag redirects output to a file — useful for automated monitoring scripts that collect periodic snapshots.",
    ],
    connections: [
      { targetId: "locking", type: "monitors", label: "-locks flag" },
      { targetId: "hadr", type: "monitors", label: "-hadr flag" },
      { targetId: "transaction-logging", type: "monitors", label: "-logs -transactions flags" },
      { targetId: "buffer-pool", type: "monitors", label: "-bufferpools flag" },
      { targetId: "memory-architecture", type: "monitors", label: "-memsets flag" },
      { targetId: "edu-model", type: "monitors", label: "-edu flag" },
      { targetId: "package-cache", type: "monitors", label: "-pkgcache flag" },
    ],
    recallPrompt: "You need to identify which application is holding a lock that is blocking 15 other connections. You have 30 seconds. What is the single db2pd command that gives you the holder AppHandle and the blocked AppHandles?",
    recallHint: "db2pd -db DBNAME -locks showlocks -applications — the -locks showlocks output shows HoldCount and WaitCount; -applications correlates AppHandle to connection identity.",
    difficulty: 2,
    position: { x: 120, y: 330 },
  },

  {
    id: "mon-get",
    slug: "mon-get",
    title: "MON_GET Functions",
    category: "monitoring",
    version: ["11.5", "12"],
    shortDescription: "SQL table functions replacing SNAPSHOT commands — joinable, aggregatable, production-safe.",
    overview: `The MON_GET_* family of SQL table functions (introduced in DB2 10.1, significantly expanded in 10.5 and 11.5) replaces the old GET SNAPSHOT and SNAPSHOT_* table functions. They are the standard monitoring interface in modern DB2.

**Key functions**:
- **MON_GET_DATABASE(-2)**: Database-level aggregate metrics: log utilization, sorts, connections, buffer pool totals.
- **MON_GET_BUFFERPOOL('',-2)**: Per-buffer pool metrics: reads, writes, hit ratio, async prefetch.
- **MON_GET_TABLESPACE('',-2)**: Per-tablespace I/O and space metrics.
- **MON_GET_CONNECTION(NULL,-2)**: Per-connection metrics: CPU, rows read, sorts, lock waits.
- **MON_GET_ACTIVITY(NULL,-2)**: Currently executing SQL with statement text, cost, elapsed time.
- **MON_GET_PKG_CACHE_STMT(NULL,NULL,NULL,-2)**: Package cache entries with execution statistics.
- **MON_GET_LOCKS(NULL,-2)**: Current lock list with holder/waiter relationships.
- **MON_GET_HADR(-2)**: HADR state per standby.
- **MON_GET_SERVICE_SUBCLASS(NULL,NULL,-2)**: WLM service class populations and metrics.
- **MON_GET_TRANSACTION_LOG(-2)**: Log space metrics, archive status.

**The -2 member parameter**: Pass -2 for aggregate across all members in DPF/pureScale. Pass a specific member number (0, 1, 2...) for member-specific data.

**Composability**: MON_GET functions return tables — join them with SYSCAT views, aggregate with window functions, filter with WHERE. This composability is a significant advantage over SNAPSHOT commands.`,
    keyParameters: [],
    commands: [
      { syntax: "SELECT MEMBER, BP_NAME, DECIMAL((1-FLOAT(POOL_DATA_P_READS)/NULLIF(FLOAT(POOL_DATA_L_READS),0))*100,5,2) AS HIT_RATIO FROM TABLE(MON_GET_BUFFERPOOL('',-2)) AS T WHERE POOL_DATA_L_READS > 0", description: "Buffer pool hit ratio per pool per member." },
      { syntax: "SELECT APPLICATION_HANDLE, ELAPSED_TIME_SEC, STMT_TEXT FROM TABLE(MON_GET_ACTIVITY(NULL,-2)) AS T ORDER BY ELAPSED_TIME_SEC DESC FETCH FIRST 10 ROWS ONLY", description: "Top 10 longest-running current SQL statements." },
      { syntax: "SELECT LOG_UTILIZATION_PERCENT, TOTAL_LOG_USED_KB FROM TABLE(MON_GET_DATABASE(-2)) AS T", description: "Log space utilization." },
      { syntax: "SELECT L.APPLICATION_HANDLE AS HOLDER, W.APPLICATION_HANDLE AS WAITER, L.LOCK_OBJECT_NAME, L.LOCK_MODE FROM TABLE(MON_GET_LOCKS(NULL,-2)) L JOIN TABLE(MON_GET_LOCKS(NULL,-2)) W ON L.LOCK_OBJECT_NAME=W.LOCK_OBJECT_NAME WHERE L.LOCK_STATUS='G' AND W.LOCK_STATUS='W'", description: "Lock holder-waiter pairs via SQL." },
    ],
    expertNotes: [
      "MON_GET functions require EXECUTE privilege. Grant to monitoring users rather than DBADM.",
      "The -2 member argument aggregates across all members — but aggregation behavior varies per metric. Some metrics are summed, others show per-member rows.",
      "MON_GET_ACTIVITY is expensive — it's a point-in-time snapshot of active statements. On busy systems, call sparingly (not in a tight loop).",
      "Counters in MON_GET are cumulative since database activation (not reset per query). For rates, diff two samples over time.",
      "COLLECT STATEMENT EVENTS must be enabled in WLM to populate some MON_GET_ACTIVITY columns (STMT_TEXT on non-active statements).",
    ],
    connections: [
      { targetId: "buffer-pool", type: "monitors", label: "MON_GET_BUFFERPOOL()" },
      { targetId: "locking", type: "monitors", label: "MON_GET_LOCKS()" },
      { targetId: "wlm", type: "monitors", label: "MON_GET_SERVICE_SUBCLASS()" },
      { targetId: "hadr", type: "monitors", label: "MON_GET_HADR()" },
      { targetId: "package-cache", type: "monitors", label: "MON_GET_PKG_CACHE_STMT()" },
      { targetId: "transaction-logging", type: "monitors", label: "MON_GET_TRANSACTION_LOG()" },
    ],
    recallPrompt: "Write a SQL query using MON_GET functions to find the top 5 currently active SQL statements by elapsed time, showing the application handle and first 100 characters of SQL text.",
    recallHint: "SELECT APPLICATION_HANDLE, ELAPSED_TIME_SEC, LEFT(STMT_TEXT,100) FROM TABLE(MON_GET_ACTIVITY(NULL,-2)) ORDER BY ELAPSED_TIME_SEC DESC FETCH FIRST 5 ROWS ONLY",
    difficulty: 3,
    position: { x: 120, y: 480 },
  },

  {
    id: "deadlocks",
    slug: "deadlocks",
    title: "Deadlocks",
    category: "locking",
    version: ["11.5", "12"],
    shortDescription: "Circular lock dependency detected by background DLOCK EDU — one victim rolled back.",
    overview: `A deadlock occurs when two or more transactions form a circular dependency of lock waits: T1 holds lock A and waits for lock B; T2 holds lock B and waits for lock A. Neither can proceed.

**Detection**: The deadlock detector EDU (DLOCK) runs periodically (DLCHKTIME interval, default 10000ms). It builds a wait-for graph and detects cycles. When found, it selects a victim (usually the transaction that has done the least work or holds the fewest locks) and rolls it back with SQLCODE -911, SQLSTATE 40001.

**Identification tools**:
- **DB2 11.5 lock event monitor**: Captures full deadlock detail including SQL text, lock modes, application IDs. Best approach.
- **db2pd -db DBNAME -transactions -locks showlocks**: Real-time view (may miss deadlocks since they resolve quickly).
- **db2diag.log**: Records deadlock events at SEVERE level.
- **DEADLOCKS_WITH_DETAILS event monitor**: Legacy approach, still valid.

**Common causes in financial environments**:
1. Batch UPDATE accessing rows in different order than concurrent OLTP.
2. Application bugs: multiple cursors on same connection updating intersecting row sets.
3. Missing index: table scan acquires many S locks, conflicts with another transaction's X locks.

**Prevention**: Consistent lock ordering across transactions. Shorter transactions. Type-2 indexes (eliminate next-key locking). Currently Committed semantic (CUR_COMMIT=ON) for readers.`,
    keyParameters: [
      { name: "DLCHKTIME", scope: "database", unit: "ms", defaultValue: "10000", description: "Interval between deadlock detection scans. Lower reduces detection latency but increases CPU." },
    ],
    commands: [
      { syntax: "CREATE EVENT MONITOR DLMON FOR LOCKING WRITE TO UNFORMATTED EVENT TABLE", description: "Create persistent lock event monitor capturing deadlock details." },
      { syntax: "db2evmonfmt -db <DBNAME> -evm DLMON -fmtopt 'deadlock'", description: "Format captured lock events (deadlocks, lock timeouts, lock waits)." },
      { syntax: "db2pd -db <DBNAME> -transactions -locks showlocks", description: "Attempt to catch in-progress deadlock (timing-dependent)." },
    ],
    expertNotes: [
      "Deadlock victim selection: DB2 typically picks the transaction with fewest log records written (least work done). Not always the shorter-running transaction.",
      "SQLCODE -911 can mean either deadlock (SQLERRMC=2) or lock timeout (SQLERRMC=68). Always check SQLERRMC to distinguish.",
      "The lock event monitor in DB2 11.5 is far superior to the old deadlock event monitor. It captures the full lock chain, not just the victim.",
      "In application code, always handle -911 with retry logic. A deadlock is not a persistent error — the statement can be retried safely.",
    ],
    connections: [
      { targetId: "locking", type: "component-of", label: "circular lock wait cycle" },
      { targetId: "lock-escalation", type: "feeds-into", label: "escalation can prevent deadlocks (table lock)" },
      { targetId: "isolation-levels", type: "configures", label: "RR isolation increases deadlock probability" },
    ],
    recallPrompt: "An application receives SQLCODE -911. How do you definitively distinguish between a deadlock and a lock timeout at the application layer?",
    recallHint: "Check SQLERRMC field: value 2 = deadlock, value 68 = lock timeout. Also check SQLSTATE: 40001 for deadlock, 57033 for lock timeout.",
    difficulty: 3,
    position: { x: 150, y: 580 },
  },

  {
    id: "lock-escalation",
    slug: "lock-escalation",
    title: "Lock Escalation",
    category: "locking",
    version: ["11.5", "12"],
    shortDescription: "Automatic promotion from row locks to table lock when LOCKLIST or MAXLOCKS threshold is breached.",
    overview: `Lock escalation is DB2's safety valve when lock memory (LOCKLIST) runs low. Rather than failing transactions, DB2 automatically promotes a connection's row-level locks on a table to a single table-level lock.

**Trigger conditions** (either):
1. A connection's lock count exceeds MAXLOCKS% of total LOCKLIST pages.
2. The total LOCKLIST is full and a new lock cannot be allocated.

**Escalation process**: DB2 selects the connection with the most locks on a specific table and attempts to acquire a table-level lock (S or X depending on existing lock modes). If the table lock is granted, all row locks for that table are released (freeing LOCKLIST space).

**Impact**: A table-level X lock blocks all other readers and writers on that table. In high-concurrency OLTP, this causes a cascade of lock waits as threads pile up waiting for the escalated table lock.

**Monitoring**: Lock escalation is not logged in db2diag by default. Enable the lock event monitor to capture escalation events. db2pd -locks will show "TABLE" in the LOCK_OBJECT_TYPE column as the escalated lock.

**Prevention**: Size LOCKLIST appropriately for peak concurrent connections × average locks per transaction. Review applications with long transactions acquiring many row locks. Consider LOCKLIST=AUTOMATIC with STMM.`,
    keyParameters: [
      { name: "LOCKLIST", scope: "database", unit: "4KB pages", description: "Total lock list memory." },
      { name: "MAXLOCKS", scope: "database", unit: "percent", description: "Per-connection lock list percentage before escalation." },
    ],
    commands: [
      { syntax: "SELECT LOCK_ESCALS FROM TABLE(MON_GET_DATABASE(-2)) AS T", description: "Total lock escalation count since db activation." },
      { syntax: "SELECT APPLICATION_HANDLE, LOCK_ESCALS FROM TABLE(MON_GET_CONNECTION(NULL,-2)) AS T WHERE LOCK_ESCALS > 0 ORDER BY LOCK_ESCALS DESC", description: "Connections with most lock escalations." },
      { syntax: "db2pd -db <DBNAME> -locks showlocks | grep TABLE", description: "Identify currently escalated table-level locks." },
    ],
    expertNotes: [
      "LOCK_ESCALS is cumulative — a value of 0 now doesn't mean escalation never occurred. Diff between two time points.",
      "Escalation to S (share) table lock still blocks writers. Escalation to X (exclusive) blocks everyone. Which mode depends on original row lock modes.",
      "Adding indexes can reduce lock escalation: fewer rows scanned = fewer row locks acquired = less LOCKLIST pressure.",
      "In DPF environments, lock escalation is per-member — each member has its own LOCKLIST. A partition with skewed data may escalate while others are fine.",
    ],
    connections: [
      { targetId: "locking", type: "component-of", label: "escalation from row to table level" },
      { targetId: "deadlocks", type: "feeds-into", label: "table lock can resolve circular waits" },
      { targetId: "memory-architecture", type: "depends-on", label: "LOCKLIST in db shared memory" },
    ],
    recallPrompt: "A LOCKLIST of 20,000 pages and MAXLOCKS of 22 means a connection can hold how many lock pages before escalation? If each lock record is 72 bytes, roughly how many row locks is that?",
    recallHint: "20000 × 22% = 4400 pages. 4400 × 4096 bytes / 72 bytes per lock ≈ 250,000 row locks per connection before escalation.",
    difficulty: 4,
    position: { x: 300, y: 670 },
  },

  {
    id: "sort-heap",
    slug: "sort-heap",
    title: "Sort Heap",
    category: "memory",
    version: ["11.5", "12"],
    shortDescription: "Per-sort private memory; overflow to TEMP tablespace is the primary sort performance risk.",
    overview: `Sort heap memory is allocated per sort operation (not per connection). When a SQL statement requires sorting (ORDER BY, GROUP BY, DISTINCT, hash join, merge join), DB2 allocates a sort heap from agent private memory.

**Sort overflow**: When a sort operation requires more memory than SORTHEAP allows, it spills to the TEMP tablespace. Sort overflow I/O is usually 10-100× slower than in-memory sort. SORT_OVERFLOWS in MON_GET_DATABASE is a key metric — any non-zero value in OLTP warrants investigation.

**Shared vs private sort**: SHEAPTHRES_SHR controls total shared sort (used by hash joins and certain sort algorithms). SORTHEAP controls the per-sort allocation ceiling. When SHEAPTHRES_SHR is reached, subsequent sorts must either wait or use private memory.

**STMM interaction**: When DATABASE_MEMORY=AUTO, STMM monitors sort overflow frequency and adjusts SORTHEAP dynamically. It also balances between SORTHEAP and other memory consumers.

**Sort avoiding techniques**: Proper index design can eliminate sorts: an index on the ORDER BY columns allows DB2 to return rows in sorted order without a SORT operator (IXSCAN replaces SORT+TBSCAN in the explain plan). This is one of the highest-value index design outcomes.`,
    keyParameters: [
      { name: "SORTHEAP", scope: "database", unit: "4KB pages", defaultValue: "AUTOMATIC", description: "Maximum memory per sort operation. Private memory (not from DATABASE_MEMORY)." },
      { name: "SHEAPTHRES_SHR", scope: "database", unit: "4KB pages", defaultValue: "AUTOMATIC", description: "Total shared sort memory cap across all concurrent sorts." },
      { name: "SHEAPTHRES", scope: "instance", unit: "4KB pages", defaultValue: "0", description: "Legacy instance-level threshold. Set to 0 when using SHEAPTHRES_SHR (DB2 10.5+)." },
    ],
    commands: [
      { syntax: "SELECT SORT_OVERFLOWS, TOTAL_SORT_TIME FROM TABLE(MON_GET_DATABASE(-2)) AS T", description: "Total sort overflows and cumulative sort time." },
      { syntax: "SELECT APPLICATION_HANDLE, SORT_OVERFLOWS, TOTAL_SORT_TIME FROM TABLE(MON_GET_CONNECTION(NULL,-2)) AS T WHERE SORT_OVERFLOWS > 0 ORDER BY SORT_OVERFLOWS DESC", description: "Connections generating sort overflows." },
    ],
    expertNotes: [
      "Sort overflow to TEMP is on SMS or DMS TEMP tablespace. If TEMP tablespace fills, sorts fail with SQL0902C (not an out-of-memory error — a disk full error).",
      "Each sort is independent: a query with 3 sort operators may allocate 3 × SORTHEAP simultaneously. Factor this into memory sizing.",
      "In analytics workloads, sort overflow is sometimes acceptable if TEMP is on fast storage. In OLTP, any overflow is a problem.",
    ],
    connections: [
      { targetId: "memory-architecture", type: "component-of", label: "private memory per agent" },
      { targetId: "performance-explain", type: "impacts", label: "sort operators visible in explain plan" },
      { targetId: "tablespace", type: "feeds-into", label: "overflows to TEMP tablespace" },
      { targetId: "index-strategy", type: "impacts", label: "proper index eliminates sort operators" },
    ],
    recallPrompt: "MON_GET_DATABASE shows SORT_OVERFLOWS increasing rapidly on an OLTP system. What are the two most likely root causes, and how does each manifest in the explain plan?",
    recallHint: "1) SORTHEAP too small: sorts that could fit in memory are spilling. Explain shows SORT operator with large NCARD. 2) Missing index on ORDER BY/GROUP BY column: full table scan + sort instead of index scan with no sort.",
    difficulty: 3,
    position: { x: 920, y: 200 },
  },

  {
    id: "statistics",
    slug: "statistics",
    title: "Statistics & RUNSTATS",
    category: "performance",
    version: ["11.5", "12"],
    shortDescription: "Catalog statistics driving optimizer cost estimates — stale statistics are the #1 cause of bad plans.",
    overview: `DB2's cost-based optimizer (CBO) relies entirely on statistics stored in SYSSTAT catalog views to estimate cardinality and selectivity of operations. Accurate statistics = good plans. Stale or missing statistics = bad plans, unexpected table scans, suboptimal join orders.

**Statistics collected by RUNSTATS**:
- **Table statistics**: CARD (table row count), NPAGES (data pages), FPAGES (format pages), OVERFLOW (overflow row count).
- **Column statistics**: COLCARD (distinct values), HIGH2KEY/LOW2KEY (value range), NUMNULLS.
- **Distribution statistics** (WITH DISTRIBUTION): Frequency and quantile histograms per column. Critical for skewed data distributions — without distributions, optimizer assumes uniform distribution.
- **Index statistics**: NLEAF (leaf pages), NLEVELS (tree height), CLUSTERRATIO (index clustering with table data), DENSITY.

**RUNSTATS variants**:
- Basic: RUNSTATS ON TABLE schema.table — table-level only, fast.
- Full: RUNSTATS ON TABLE schema.table WITH DISTRIBUTION AND INDEXES ALL — complete.
- Incremental: RUNSTATS ON TABLE ... INCREMENTAL — only updated pages (requires change tracking).
- Sampled: TABLESAMPLE SYSTEM(n) — percentage-based sampling for very large tables.

**Automatic statistics** (DB2 10.5+): AUTOMATIC RUNSTATS can trigger collection when statistics become significantly stale. Monitor via SYSIBM.SYSAUTORUNSTATS_QUEUE.

**DB2 12**: Enhanced statistics profiles, better incremental tracking, improved distribution histogram granularity.`,
    keyParameters: [
      { name: "AUTO_RUNSTATS", scope: "database", defaultValue: "ON", description: "Enable automatic RUNSTATS triggering based on stale detection." },
      { name: "AUTO_STATS_PROF", scope: "database", description: "Statistics profile for automatic collection settings." },
    ],
    commands: [
      { syntax: "RUNSTATS ON TABLE <schema>.<table> WITH DISTRIBUTION AND INDEXES ALL", description: "Full statistics collection including distributions.", example: "RUNSTATS ON TABLE TRADING.ORDERS WITH DISTRIBUTION AND INDEXES ALL SHRLEVEL CHANGE" },
      { syntax: "RUNSTATS ON TABLE <schema>.<table> ON COLUMNS (<col1>, <col2>) WITH DISTRIBUTION AND INDEXES ALL", description: "Target specific columns for distribution statistics." },
      { syntax: "REORGCHK CURRENT STATISTICS ON TABLE <schema>.<table>", description: "Analyze whether REORG and RUNSTATS are needed." },
      { syntax: "SELECT TABNAME, CARD, STATS_TIME FROM SYSCAT.TABLES WHERE TABSCHEMA='SCHEMA' ORDER BY STATS_TIME ASC", description: "Find tables with oldest statistics." },
    ],
    expertNotes: [
      "SHRLEVEL CHANGE allows RUNSTATS to run while the table is online for DML. Default SHRLEVEL REFERENCE requires only read access.",
      "Distribution statistics (WITH DISTRIBUTION) are critical for columns with data skew. Without them, optimizer assumes all values are equally distributed — disastrous for skewed foreign keys or date columns.",
      "Column group statistics (COLUMN GROUP) help the optimizer understand correlations between columns — important for multi-column predicates.",
      "RUNSTATS does not update statistics if the table has not changed (with incremental mode). Force a full collection periodically to avoid stale baseline.",
    ],
    connections: [
      { targetId: "performance-explain", type: "feeds-into", label: "statistics drive optimizer cost" },
      { targetId: "package-cache", type: "feeds-into", label: "RUNSTATS invalidates cached plans" },
      { targetId: "index-strategy", type: "feeds-into", label: "index stats drive index selection" },
      { targetId: "reorg", type: "feeds-into", label: "REORG often followed by RUNSTATS" },
    ],
    recallPrompt: "After a large data load doubling a table's row count, explain plans are suboptimal with full table scans. CARD in SYSCAT.TABLES still shows the pre-load count. Walk through the fix.",
    recallHint: "RUNSTATS ON TABLE schema.table WITH DISTRIBUTION AND INDEXES ALL. Then FLUSH PACKAGE CACHE DYNAMIC (or wait for cached plan expiry) so optimizer uses new statistics on next execution.",
    difficulty: 2,
    position: { x: 620, y: 100 },
  },

  {
    id: "reorg",
    slug: "reorg",
    title: "REORG",
    category: "admin",
    version: ["11.5", "12"],
    shortDescription: "Defragments table and index pages, reclusters rows by index order to restore scan efficiency.",
    overview: `Over time, heavy DML (especially DELETEs and UPDATEs) causes table fragmentation: pages become partially empty, overflow rows are created for rows that grew, and index leaf pages have many empty slots. REORG remedies this.

**Table REORG**: Rewrites the entire table by scanning an index and writing rows in index key order. Also eliminates overflow rows (from row updates that expanded beyond original page allocation). After table REORG, row access via that index is sequential (high CLUSTERRATIO).

**Index REORG**: Rebuilds index leaf pages without touching the table. Eliminates pseudo-deleted index entries from updates/deletes. Faster than table REORG. Does not change table row order.

**REORG modes**:
- **CLASSIC (offline)**: Requires exclusive table lock. Fastest but requires downtime.
- **INPLACE (online)**: Table remains accessible for DML. Uses a shadow copy approach. Slower, generates more log. Only for DMS tablespaces.

**When to REORG**: Use REORGCHK to evaluate need. Key indicators: CLUSTERRATIO below 80%, high OVERFLOW count, FREESPACE exceeds threshold. REORGCHK returns *, **, or *** flags.

**REORG + RUNSTATS sequence**: Always run RUNSTATS after REORG — reorganisation changes physical characteristics (CLUSTERRATIO, NLEAF) that statistics must reflect.`,
    keyParameters: [],
    commands: [
      { syntax: "REORG TABLE <schema>.<table> INDEX <schema>.<index> ALLOW WRITE ACCESS LONGLOBDATA", description: "Inplace REORG allowing writes during reorganization." },
      { syntax: "REORG INDEXES ALL FOR TABLE <schema>.<table> ALLOW WRITE ACCESS", description: "Online index REORG — rebuild index leaf pages." },
      { syntax: "REORGCHK CURRENT STATISTICS ON TABLE <schema>.<table>", description: "Evaluate reorg need without running it. Returns *, **, *** flags." },
      { syntax: "db2pd -db <DBNAME> -reorgs", description: "Monitor in-progress REORG operations." },
    ],
    expertNotes: [
      "INPLACE REORG is not truly online for index accesses: the table can be queried but index range scans may see inconsistent results during the reorg shadow-copy phase.",
      "REORG on a HADR primary ships the reorg log records to the standby — the standby applies the reorg replay. Large REORGs generate significant log volume.",
      "Overflow rows are created when an UPDATE increases row size beyond the available space in the current page. REORG eliminates overflows by rewriting rows on fresh pages.",
      "After LOAD REPLACE, always run REORG + RUNSTATS — LOAD does not maintain clustering or update statistics.",
    ],
    connections: [
      { targetId: "statistics", type: "feeds-into", label: "RUNSTATS should follow REORG" },
      { targetId: "tablespace", type: "feeds-into", label: "REORG rewrites within tablespace" },
      { targetId: "index-strategy", type: "impacts", label: "index REORG rebuilds leaf pages" },
      { targetId: "performance-explain", type: "impacts", label: "CLUSTERRATIO affects explain plan" },
    ],
    recallPrompt: "REORGCHK returns *** flags for a busy production table. You cannot take downtime. What REORG option do you use, and what is the key restriction on the target tablespace?",
    recallHint: "REORG TABLE ... INPLACE (ALLOW WRITE ACCESS). Restriction: table must be in a DMS or automatic storage tablespace (not SMS). SMS tablespaces do not support inplace REORG.",
    difficulty: 3,
    position: { x: 600, y: 820 },
  },

  {
    id: "index-strategy",
    slug: "index-strategy",
    title: "Index Strategy",
    category: "performance",
    version: ["11.5", "12"],
    shortDescription: "B-tree, type-2, and MDC index types — key column ordering determines plan quality.",
    overview: `DB2's default index type is B-tree (balanced tree), but several specialised index types exist for specific use cases.

**Index types**:
- **Type-1 (legacy)**: Row-level next-key locking for RR/RS isolation. Avoids phantom reads by locking the next key in range. High concurrency cost.
- **Type-2**: Default in modern DB2. Pseudo-deleted entries instead of next-key locking. Much better concurrency. Always use Type-2 (ALLOW REVERSE SCANS).
- **MDC (Multidimensional Clustering)**: Physical table clustering on multiple dimensions using block indexes. Excellent for OLAP; not suitable for OLTP key lookups.
- **Partitioned index**: Aligned or non-aligned with table partitioning. Aligned partition indexes are co-located with table partitions — preferred for partition pruning.
- **XML index**: Over XML column values using XPath expressions.

**Composite index key ordering**: Columns used in equality predicates first, range predicate column last. This maximises index range scan efficiency.

**Index selectivity**: The optimizer estimates how many rows an index scan will return. Highly selective indexes (few matching rows) are preferred for OLTP. Low selectivity (many matching rows) may cause the optimizer to prefer a table scan.

**Index merging (multi-index access)**: DB2 can use multiple indexes via IXAND (index AND) operator — merges RIDs from two indexes. Visible in explain plan. Useful when no composite index covers both predicates.`,
    keyParameters: [],
    commands: [
      { syntax: "CREATE UNIQUE INDEX <name> ON <table> (<col1> ASC, <col2> ASC) ALLOW REVERSE SCANS", description: "Standard type-2 index with reverse scan support (required for REORG)." },
      { syntax: "SELECT INDNAME, COLNAMES, CLUSTERRATIO, NLEAF, NLEVELS FROM SYSCAT.INDEXES WHERE TABNAME='TABLE1'", description: "Index metadata: clustering ratio, size, statistics." },
      { syntax: "db2look -d <DBNAME> -t <table> -e -o ddl.sql", description: "Extract DDL for table including all indexes." },
    ],
    expertNotes: [
      "ALLOW REVERSE SCANS is required for range queries using both ASC and DESC orders. Always include it — negligible overhead.",
      "Covering index: include non-key columns (INCLUDE clause) to satisfy queries without table access. The optimizer can satisfy the entire query from the index alone.",
      "In OLTP, fewer, well-chosen indexes outperform many narrow indexes. Each additional index increases INSERT/UPDATE/DELETE overhead.",
      "CLUSTER option on CREATE INDEX defines physical table clustering order — only one clustering index per table. Affects CLUSTERRATIO statistic.",
    ],
    connections: [
      { targetId: "statistics", type: "depends-on", label: "index selection driven by statistics" },
      { targetId: "performance-explain", type: "feeds-into", label: "index usage visible in explain" },
      { targetId: "sort-heap", type: "impacts", label: "proper index eliminates sort" },
      { targetId: "locking", type: "impacts", label: "type-2 reduces next-key locking" },
      { targetId: "reorg", type: "feeds-into", label: "index REORG needed after heavy DML" },
    ],
    recallPrompt: "A query SELECT * FROM ORDERS WHERE STATUS='OPEN' AND ORDER_DATE > '2024-01-01' ORDER BY ORDER_DATE has a full table scan. Describe the optimal index, including column order and why.",
    recallHint: "CREATE INDEX ON ORDERS(STATUS, ORDER_DATE) — equality predicate (STATUS) first, range predicate (ORDER_DATE) last. This also satisfies ORDER BY without a SORT operator (index already ordered by ORDER_DATE within STATUS).",
    difficulty: 3,
    position: { x: 340, y: 270 },
  },

  {
    id: "isolation-levels",
    slug: "isolation-levels",
    title: "Isolation Levels",
    category: "locking",
    version: ["11.5", "12"],
    shortDescription: "UR/CS/RS/RR isolation levels and Currently Committed semantic — the concurrency control dial.",
    overview: `DB2's four isolation levels control the trade-off between data consistency and concurrency:

**Uncommitted Read (UR)**: Reads uncommitted data (dirty reads). No read locks acquired. Suitable only for reporting where approximate data is acceptable (e.g., COUNT(*) on a large table). Bound with ISOLATION(UR) or WITH UR.

**Cursor Stability (CS)**: Default. Holds lock on current row only while cursor is positioned on it. Released when cursor moves to next row. With **Currently Committed (CC)** semantic (default in DB2 10.5+): readers see the latest committed version even if the row is currently locked by a writer. Eliminates most read-write lock conflicts.

**Read Stability (RS)**: Holds locks on all rows read by cursor for the duration of the transaction. Prevents non-repeatable reads. Re-executing the same query in the same transaction returns the same rows (ignoring new inserts — phantoms not prevented).

**Repeatable Read (RR)**: Strictest. Locks all rows scanned (not just those returned). Prevents phantom reads by next-key locking on type-1 indexes. Severe concurrency impact. Use only when absolutely required by business logic.

**Currently Committed (CC)**: The key DB2 innovation for CS isolation. Instead of blocking on a locked row, the SELECT sees the pre-modification committed version immediately. Only applies to CS isolation. Does not work if the change is a DELETE or if the row was never committed (newly inserted row).`,
    keyParameters: [
      { name: "CUR_COMMIT", scope: "database", defaultValue: "ON", description: "Enable Currently Committed semantic for CS isolation reads. ON in DB2 10.5+." },
      { name: "DFT_ISOLATION", scope: "database", defaultValue: "CS", description: "Default isolation level for connections that do not specify one." },
    ],
    commands: [
      { syntax: "SELECT * FROM TABLE WITH UR", description: "Uncommitted read for this query only." },
      { syntax: "BIND <pkg> ISOLATION(RS)", description: "Bind a package with Read Stability isolation." },
      { syntax: "SET CURRENT ISOLATION = RS", description: "Session-level isolation override." },
    ],
    expertNotes: [
      "CC semantic only works for UPDATE and DELETE locking scenarios. If a row is being inserted (never been committed), the reader blocks because there is no prior committed version to return.",
      "RR with type-1 indexes causes next-key locking — the index entry after the last matching row is also locked to prevent phantom inserts. This can cause unexpected lock waits in high-insert workloads.",
      "In financial systems, business rules often mandate RS or even RR for account balance reads to prevent dirty computation — understand the actual business requirement before assuming CS is sufficient.",
    ],
    connections: [
      { targetId: "locking", type: "configures", label: "isolation determines lock mode and duration" },
      { targetId: "deadlocks", type: "impacts", label: "higher isolation = more deadlock probability" },
      { targetId: "index-strategy", type: "impacts", label: "RR with type-1 triggers next-key locking" },
    ],
    recallPrompt: "With CUR_COMMIT=ON (default), a SELECT in CS isolation hits a row that is currently being updated. What does DB2 return to the reader, and what lock is NOT acquired?",
    recallHint: "DB2 returns the currently committed version (before the update). The reader acquires NO lock — CUR_COMMIT means the reader is never blocked by a writer, and acquires no share lock on the row.",
    difficulty: 3,
    position: { x: 450, y: 640 },
  },

  {
    id: "purescale",
    slug: "purescale",
    title: "pureScale",
    category: "architecture",
    version: ["11.5", "12"],
    shortDescription: "Active-active cluster with CF-managed global buffer pool and global lock manager.",
    overview: `DB2 pureScale is DB2's active-active cluster solution providing continuous availability and elastic scalability. Unlike HADR (active-passive), all pureScale members can accept read and write transactions simultaneously.

**Architecture components**:
- **Members**: Database engine instances, each with local buffer pool and coordinator agents. Typically 2-128 members.
- **Cluster Caching Facility (CF)**: Specialised server running the Group Buffer Pool (GBP) and Global Lock Manager (GLM). The CF is the authoritative source for which pages are in any member's local buffer pool and the global lock table.

**Data coherency**: When a member needs a page that another member has modified, it requests the page via the CF (GBP). This is called an "inter-member page transfer." High inter-member traffic indicates poor workload partitioning.

**Global lock management**: CF manages all locks globally. A member acquiring a lock registers with the CF's GLM. Lock contention is global — a row locked by member 0 blocks member 1 immediately.

**Contrast with HADR**: HADR = one active primary + passive standby(s). pureScale = all members active. HADR provides DR; pureScale provides HA + scale-out. They can be combined (pureScale cluster with HADR to a remote standby).

**Failure handling**: Member failure: other members continue. CF failure: standby CF takes over (CF HA is critical). Member recalibration on restart.`,
    keyParameters: [
      { name: "CF_GBP_SZ", scope: "instance", description: "Group Buffer Pool size on the CF. Must be sized for all members' working set." },
      { name: "CF_DB_MEM_SZ", scope: "instance", description: "Total CF database memory including GBP and GLM." },
    ],
    commands: [
      { syntax: "db2instance -list", description: "List all members and CFs with their status." },
      { syntax: "db2pd -member <n> -db <DBNAME> -gbp", description: "Group Buffer Pool statistics for member n." },
      { syntax: "db2pd -cf -db <DBNAME>", description: "CF status: GBP utilization, GLM state, member connectivity." },
    ],
    expertNotes: [
      "pureScale is not a horizontal scale-out for pure OLTP — inter-member locking overhead increases with concurrency on shared data. Best suited for workloads with natural data partitioning.",
      "The CF is a single point of failure if HA for CF is not configured. Always configure CF primary + CF standby in production.",
      "Page demotion: when a local buffer pool page is needed by another member, the CF may demote (evict) it from the local BP. High demotion rates indicate memory pressure or poor workload affinity.",
    ],
    connections: [
      { targetId: "memory-architecture", type: "feeds-into", label: "GBP extends shared memory globally" },
      { targetId: "locking", type: "feeds-into", label: "GLM manages locks globally" },
      { targetId: "hadr", type: "feeds-into", label: "pureScale can replicate to HADR standby" },
      { targetId: "buffer-pool", type: "feeds-into", label: "GBP is global extension of local BPs" },
    ],
    recallPrompt: "In pureScale, member 0 updates a row that member 1 then tries to read. Describe the data flow through the CF.",
    recallHint: "Member 0 modifies the page in its local BP and registers a GBP cross-invalidation with the CF. Member 1's read request sees the page is cross-invalidated, fetches the current version from member 0's BP via the CF/GBP pathway.",
    difficulty: 5,
    position: { x: 1160, y: 280 },
  },
];

export const CONCEPT_MAP = new Map(DB2_CONCEPTS.map(c => [c.id, c]));

export function getConceptById(id: string): Db2Concept | undefined {
  return CONCEPT_MAP.get(id);
}

export function getConceptsByCategory(category: string): Db2Concept[] {
  return DB2_CONCEPTS.filter(c => c.category === category);
}

export const CATEGORY_LABELS: Record<string, string> = {
  architecture: "Architecture",
  memory: "Memory",
  logging: "Logging & Recovery",
  hadr: "HADR",
  performance: "Performance",
  monitoring: "Monitoring",
  locking: "Locking",
  admin: "Administration",
};
