"use client";

/* ─────────────────────────────────────────────────────────
   Concept diagrams — inline SVG, themed with the app palette.
   Each diagram shows a mechanism, not decoration.
   ───────────────────────────────────────────────────────── */

const C = {
  panel: "var(--color-surface-panel)",
  elevated: "var(--color-surface-elevated)",
  border: "var(--color-border-default)",
  borderStrong: "var(--color-border-strong)",
  text: "var(--color-text-primary)",
  dim: "var(--color-text-secondary)",
  muted: "var(--color-text-muted)",
  blue: "var(--diag-blue)",
  teal: "var(--diag-teal)",
  amber: "var(--diag-amber)",
  red: "var(--diag-red)",
  green: "var(--diag-green)",
  purple: "var(--diag-purple)",
};

export type DiagramKey =
  | "memory-model"
  | "process-model"
  | "dpf-topology"
  | "join-strategies"
  | "partitioning-levels"
  | "wlm-hierarchy"
  | "db2u-openshift"
  | "explain-tree"
  | "hadr-modes"
  | "monitoring-map"
  | "hadr-rolling-fixpack";

export function Diagram({ id }: { id: DiagramKey }) {
  const D = DIAGRAMS[id];
  if (!D) return null;
  return (
    <figure className="my-4 bg-[var(--color-surface-panel)] border border-[var(--color-border-subtle)] rounded-xl p-4 overflow-x-auto">
      <D.render />
      <figcaption className="text-[11px] text-[var(--color-text-muted)] mt-3 leading-relaxed">{D.caption}</figcaption>
    </figure>
  );
}

/* ─── Shared primitives ───────────────────────────────── */

function Box({ x, y, w, h, label, sub, stroke = C.border, fill = C.elevated, textAnchor = "middle" }: {
  x: number; y: number; w: number; h: number; label: string; sub?: string; stroke?: string; fill?: string; textAnchor?: "middle" | "start";
}) {
  const tx = textAnchor === "middle" ? x + w / 2 : x + 10;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill={fill} stroke={stroke} strokeWidth={1.2} />
      <text x={tx} y={sub ? y + h / 2 - 3 : y + h / 2 + 4} textAnchor={textAnchor} fill={C.text} fontSize={12} fontWeight={500}>{label}</text>
      {sub && <text x={tx} y={y + h / 2 + 13} textAnchor={textAnchor} fill={C.muted} fontSize={10} fontFamily="monospace">{sub}</text>}
    </g>
  );
}

function Arrow({ x1, y1, x2, y2, color = C.borderStrong, dashed }: { x1: number; y1: number; x2: number; y2: number; color?: string; dashed?: boolean }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.4} markerEnd="url(#arrowhead)" strokeDasharray={dashed ? "4 3" : undefined} />;
}

function Defs() {
  return (
    <defs>
      <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
        <path d="M0,0 L0,6 L7,3 z" fill={C.borderStrong} />
      </marker>
    </defs>
  );
}

function Label({ x, y, text, color = C.muted, size = 10, anchor = "middle", mono }: { x: number; y: number; text: string; color?: string; size?: number; anchor?: "start" | "middle" | "end"; mono?: boolean }) {
  return <text x={x} y={y} textAnchor={anchor} fill={color} fontSize={size} fontFamily={mono ? "monospace" : undefined}>{text}</text>;
}

const svgProps = (h: number) => ({ viewBox: `0 0 720 ${h}`, width: "100%", style: { maxWidth: 720, height: "auto" as const }, role: "img" as const });

/* ─── Diagrams ────────────────────────────────────────── */

const DIAGRAMS: Record<DiagramKey, { caption: string; render: () => React.JSX.Element }> = {
  "memory-model": {
    caption:
      "Db2 memory is a hierarchy of bounded sets. INSTANCE_MEMORY caps everything; database shared memory holds the consumers STMM trades between. In a container the cgroup limit sits above all of it — which is why INSTANCE_MEMORY must be set below the pod limit.",
    render: () => (
      <svg {...svgProps(300)} aria-label="Db2 memory hierarchy">
        <Defs />
        <rect x={10} y={10} width={700} height={280} rx={8} fill="none" stroke={C.red} strokeWidth={1.2} strokeDasharray="5 4" />
        <Label x={20} y={28} text="Container / host RAM — cgroup limit (OOM killer acts here)" color={C.red} anchor="start" size={11} />

        <rect x={26} y={40} width={668} height={240} rx={7} fill={C.panel} stroke={C.blue} />
        <Label x={38} y={60} text="INSTANCE_MEMORY (dbm cfg) — AUTOMATIC assumes the whole host is yours" color={C.blue} anchor="start" size={11} />

        <Box x={42} y={72} w={200} h={56} label="Database manager shared" sub="monitor heap, FCM, audit" />
        <Box x={42} y={140} w={200} h={56} label="Application / agent private" sub="applheapsz, private sort" />

        <rect x={262} y={72} width={418} height={190} rx={7} fill={C.panel} stroke={C.teal} />
        <Label x={274} y={90} text="DATABASE_MEMORY — database shared memory" color={C.teal} anchor="start" size={11} />
        <Box x={276} y={100} w={190} h={48} label="Buffer pools" sub="ALTER BUFFERPOOL ... AUTOMATIC" />
        <Box x={476} y={100} w={190} h={48} label="Shared sort" sub="SHEAPTHRES_SHR / SORTHEAP" />
        <Box x={276} y={158} w={190} h={48} label="Lock list" sub="LOCKLIST / MAXLOCKS" />
        <Box x={476} y={158} w={190} h={48} label="Package + catalog cache" sub="PCKCACHESZ / CATALOGCACHE_SZ" />
        <Label x={471} y={232} text="STMM trades memory between these consumers (needs ≥ 2 AUTOMATIC)" color={C.muted} size={10} />
        <Label x={471} y={248} text="sort tuning also requires dbm SHEAPTHRES = 0" color={C.muted} size={10} />
      </svg>
    ),
  },

  "process-model": {
    caption:
      "One multi-threaded db2sysc process per member. Every unit of work maps to an agent EDU; prefetchers, page cleaners and the logger do I/O asynchronously. This is the map you walk when db2pd -edus shows one EDU burning a core.",
    render: () => (
      <svg {...svgProps(290)} aria-label="Db2 process and EDU model">
        <Defs />
        <Box x={16} y={24} w={130} h={46} label="Client app" sub="JDBC / CLI" stroke={C.blue} />
        <Arrow x1={148} y1={47} x2={196} y2={47} />
        <Label x={172} y={38} text="TCP" size={9} />

        <rect x={200} y={10} width={504} height={270} rx={8} fill={C.panel} stroke={C.border} />
        <Label x={212} y={28} text="db2sysc (one per member)" color={C.dim} anchor="start" size={11} />

        <Box x={212} y={38} w={140} h={46} label="Coordinator agent" sub="db2agent" stroke={C.blue} />
        <Arrow x1={282} y1={86} x2={282} y2={112} />
        <Box x={212} y={114} w={140} h={46} label="Subagents" sub="db2agntp (INTRA_PARALLEL)" />

        <Box x={378} y={38} w={150} h={40} label="Buffer pools" stroke={C.teal} />
        <Arrow x1={354} y1={58} x2={374} y2={58} />

        <Box x={548} y={38} w={140} h={40} label="Prefetchers" sub="db2pfchr" />
        <Box x={548} y={88} w={140} h={40} label="Page cleaners" sub="db2pclnr" />
        <Box x={548} y={138} w={140} h={40} label="Logger" sub="db2loggw / db2loggr" stroke={C.amber} />
        <Arrow x1={528} y1={58} x2={544} y2={58} />
        <Arrow x1={528} y1={70} x2={544} y2={104} />

        <Box x={378} y={196} w={150} h={44} label="Table spaces" sub="containers" />
        <Box x={548} y={196} w={140} h={44} label="Active log" sub="LOGPRIMARY / LOGARCHMETH1" stroke={C.amber} />
        <Arrow x1={618} y1={180} x2={618} y2={192} />
        <Arrow x1={453} y1={82} x2={453} y2={192} dashed />
        <Label x={212} y={196} text="db2pd -edus  → hot EDU" color={C.muted} anchor="start" size={10} />
        <Label x={212} y={212} text="db2pd -agents → app handle" color={C.muted} anchor="start" size={10} />
        <Label x={212} y={228} text="MON_GET_ACTIVITY → the SQL" color={C.muted} anchor="start" size={10} />
      </svg>
    ),
  },

  "dpf-topology": {
    caption:
      "DPF/MPP: one logical database over many members. The coordinator receives the statement, members work on their own slice in parallel, and FCM carries rows between them. The slowest member sets the elapsed time, which is why skew matters more than raw hardware.",
    render: () => (
      <svg {...svgProps(300)} aria-label="DPF multi-partition topology">
        <Defs />
        <Box x={276} y={14} w={168} h={44} label="Application" sub="connects to a coordinator" stroke={C.blue} />
        <Arrow x1={360} y1={60} x2={360} y2={80} />
        <Box x={256} y={82} w={208} h={48} label="Partition 0 — catalog / coordinator" sub="no large fact data" stroke={C.blue} />

        {[0, 1, 2, 3].map(i => {
          const x = 30 + i * 170;
          const heights = [70, 70, 110, 70];
          return (
            <g key={i}>
              <Arrow x1={360} y1={132} x2={x + 75} y2={168} dashed />
              <rect x={x} y={170} width={150} height={60} rx={6} fill={C.elevated} stroke={i === 2 ? C.red : C.border} strokeWidth={1.2} />
              <text x={x + 75} y={190} textAnchor="middle" fill={C.text} fontSize={11} fontWeight={500}>Member {i + 1}</text>
              <text x={x + 75} y={205} textAnchor="middle" fill={C.muted} fontSize={9} fontFamily="monospace">own CPU · memory · disk</text>
              <rect x={x + 20} y={240 - heights[i] * 0.3} width={110} height={heights[i] * 0.3} rx={3} fill={i === 2 ? C.red : C.teal} opacity={0.55} />
              <text x={x + 75} y={256} textAnchor="middle" fill={i === 2 ? "var(--color-danger-ink)" : C.muted} fontSize={9}>
                {i === 2 ? "skew: 3.5× rows" : "even share"}
              </text>
            </g>
          );
        })}
        <Label x={360} y={150} text="FCM — table queues between members (fcm_num_buffers)" color={C.muted} size={10} />
        <Label x={360} y={284} text="Query elapsed time = slowest member" color={C.red} size={11} />
      </svg>
    ),
  },

  "join-strategies": {
    caption:
      "The three ways a join gets its rows in DPF. Collocated is free; directed re-hashes one side; broadcast sends every row to every member. Seeing a BTQ over a large table in db2exfmt is the signal that the distribution key or the estimate is wrong.",
    render: () => (
      <svg {...svgProps(250)} aria-label="Collocated, directed and broadcast joins">
        <Defs />
        {[
          { x: 10, title: "Collocated", sub: "no table queue", color: C.green, note: "same key, same members" },
          { x: 250, title: "Directed (DTQ)", sub: "re-hash one side", color: C.amber, note: "rows sent to one target member" },
          { x: 490, title: "Broadcast (BTQ)", sub: "every row to every member", color: C.red, note: "only for small tables" },
        ].map(p => (
          <g key={p.title}>
            <rect x={p.x} y={10} width={220} height={230} rx={8} fill={C.panel} stroke={p.color} strokeWidth={1.2} />
            <text x={p.x + 110} y={32} textAnchor="middle" fill={p.color} fontSize={12} fontWeight={600}>{p.title}</text>
            <text x={p.x + 110} y={48} textAnchor="middle" fill={C.muted} fontSize={10} fontFamily="monospace">{p.sub}</text>
            {[0, 1, 2].map(m => (
              <g key={m}>
                <rect x={p.x + 20 + m * 62} y={70} width={52} height={34} rx={4} fill={C.elevated} stroke={C.border} />
                <text x={p.x + 46 + m * 62} y={91} textAnchor="middle" fill={C.dim} fontSize={9}>M{m + 1}</text>
                <rect x={p.x + 20 + m * 62} y={160} width={52} height={34} rx={4} fill={C.elevated} stroke={C.border} />
                <text x={p.x + 46 + m * 62} y={181} textAnchor="middle" fill={C.dim} fontSize={9}>M{m + 1}</text>
              </g>
            ))}
            {p.title === "Collocated" &&
              [0, 1, 2].map(m => <Arrow key={m} x1={p.x + 46 + m * 62} y1={110} x2={p.x + 46 + m * 62} y2={154} color={C.green} />)}
            {p.title === "Directed (DTQ)" && (
              <>
                <Arrow x1={p.x + 46} y1={110} x2={p.x + 100} y2={154} color={C.amber} />
                <Arrow x1={p.x + 108} y1={110} x2={p.x + 108} y2={154} color={C.amber} />
                <Arrow x1={p.x + 170} y1={110} x2={p.x + 116} y2={154} color={C.amber} />
              </>
            )}
            {p.title === "Broadcast (BTQ)" &&
              [0, 1, 2].flatMap(a => [0, 1, 2].map(b => (
                <Arrow key={`${a}-${b}`} x1={p.x + 46 + a * 62} y1={110} x2={p.x + 46 + b * 62} y2={154} color={C.red} />
              )))}
            <text x={p.x + 110} y={222} textAnchor="middle" fill={C.muted} fontSize={9}>{p.note}</text>
          </g>
        ))}
      </svg>
    ),
  },

  "partitioning-levels": {
    caption:
      "Three independent, composable levels. DISTRIBUTE BY HASH picks the member, PARTITION BY RANGE picks the data partition (the roll-in/roll-out and elimination unit), ORGANIZE BY DIMENSIONS clusters rows into blocks. Being able to say which does what is a standard DPF interview check.",
    render: () => (
      <svg {...svgProps(300)} aria-label="Distribution, range partitioning and MDC">
        <Defs />
        <Box x={14} y={14} w={692} h={38} label="CREATE TABLE F_EVENT ... DISTRIBUTE BY HASH (PERSON_ID) PARTITION BY RANGE (EVENT_DATE) ORGANIZE BY DIMENSIONS (REGION)" stroke={C.blue} fill={C.panel} />
        <Label x={20} y={78} text="1 · DISTRIBUTE BY HASH → which member stores the row (parallelism)" color={C.blue} anchor="start" size={11} />
        {[0, 1, 2].map(i => (
          <rect key={i} x={20 + i * 150} y={86} width={140} height={26} rx={4} fill={C.elevated} stroke={C.blue} opacity={0.9} />
        ))}
        {[0, 1, 2].map(i => <Label key={i} x={90 + i * 150} y={103} text={`member ${i + 1}`} size={10} />)}

        <Label x={20} y={140} text="2 · PARTITION BY RANGE → data partitions inside each member (attach / detach / elimination)" color={C.teal} anchor="start" size={11} />
        {["2026-07", "2026-08", "2026-09", "2026-10"].map((m, i) => (
          <g key={m}>
            <rect x={20 + i * 112} y={148} width={104} height={26} rx={4} fill={C.elevated} stroke={C.teal} />
            <Label x={72 + i * 112} y={165} text={m} size={10} mono />
          </g>
        ))}
        <Label x={500} y={165} text="← ATTACH new month / DETACH old" color={C.muted} anchor="start" size={10} />

        <Label x={20} y={202} text="3 · ORGANIZE BY DIMENSIONS → blocks (extents) clustered by dimension, block indexes" color={C.purple} anchor="start" size={11} />
        {[0, 1, 2, 3, 4, 5].map(i => (
          <g key={i}>
            <rect x={20 + i * 76} y={210} width={68} height={24} rx={3} fill={C.elevated} stroke={C.purple} />
            <Label x={54 + i * 76} y={226} text={`REGION ${String.fromCharCode(65 + (i % 3))}`} size={9} />
          </g>
        ))}
        <Label x={20} y={266} text="Partition elimination shows in db2exfmt as DP Elim Predicates; block elimination uses block indexes." color={C.muted} anchor="start" size={10} />
        <Label x={20} y={282} text="A unique index can only be partitioned if it contains the range-partitioning key." color={C.muted} anchor="start" size={10} />
      </svg>
    ),
  },

  "wlm-hierarchy": {
    caption:
      "WLM in one picture: identify the work (workload), place it (service class), classify it by cost (work class / action set), and bound it (thresholds). Monitoring closes the loop and is what lets you prove an SLA.",
    render: () => (
      <svg {...svgProps(320)} aria-label="WLM object hierarchy">
        <Defs />
        <Box x={14} y={14} w={200} h={46} label="Connection attributes" sub="SESSION_USER / APPLNAME" stroke={C.blue} />
        <Arrow x1={216} y1={37} x2={252} y2={37} />
        <Box x={254} y={14} w={190} h={46} label="WORKLOAD" sub="WL_OLTP / WL_BI / WL_ETL" stroke={C.blue} />
        <Arrow x1={446} y1={37} x2={482} y2={37} />
        <Box x={484} y={14} w={222} h={46} label="SERVICE SUPERCLASS" sub="SC_OLTP / SC_REPORTING" stroke={C.teal} />

        <Arrow x1={595} y1={62} x2={595} y2={86} />
        <rect x={360} y={88} width={346} height={112} rx={7} fill={C.panel} stroke={C.teal} />
        <Label x={372} y={106} text="Subclasses + work action set (by TIMERONCOST)" color={C.teal} anchor="start" size={11} />
        <Box x={372} y={116} w={150} h={36} label="RPT_SHORT" sub="< 1M timerons" />
        <Box x={540} y={116} w={150} h={36} label="RPT_LONG" sub="≥ 1M timerons" />
        <Label x={533} y={178} text="REMAP ACTIVITY on CPUTIMEINSC = priority aging" color={C.muted} size={10} />

        <rect x={14} y={88} width={330} height={112} rx={7} fill={C.panel} stroke={C.amber} />
        <Label x={26} y={106} text="Thresholds" color={C.amber} anchor="start" size={11} />
        <Box x={26} y={116} w={140} h={36} label="Predictive" sub="ESTIMATEDSQLCOST" stroke={C.amber} />
        <Box x={186} y={116} w={140} h={36} label="Reactive" sub="SQLTEMPSPACE, CPUTIME" stroke={C.amber} />
        <Label x={175} y={178} text="actions: COLLECT · STOP · REMAP · queue" color={C.muted} size={10} />

        <rect x={14} y={214} width={692} height={44} rx={7} fill={C.panel} stroke={C.purple} />
        <Label x={26} y={232} text="CPU control (WLM_DISPATCHER = YES)" color={C.purple} anchor="start" size={11} />
        <Label x={26} y={249} text="SOFT CPU SHARES = may borrow idle CPU   ·   HARD SHARES = bounded under contention   ·   CPU LIMIT = absolute cap" color={C.muted} anchor="start" size={10} />

        <rect x={14} y={266} width={692} height={42} rx={7} fill={C.panel} stroke={C.border} />
        <Label x={26} y={284} text="Monitoring closes the loop" color={C.dim} anchor="start" size={11} />
        <Label x={26} y={300} text="MON_GET_SERVICE_SUBCLASS_STATS · MON_GET_WORKLOAD · MON_GET_QUEUE_STATS · STATISTICS event monitor" color={C.muted} anchor="start" size={10} />
      </svg>
    ),
  },

  "db2u-openshift": {
    caption:
      "The operator pattern: you declare intent in a custom resource and a controller reconciles reality toward it. That is why an imperative change inside a pod can vanish — and why the CR (in Git) is the auditable source of truth.",
    render: () => (
      <svg {...svgProps(330)} aria-label="Db2 on OpenShift with the Db2U operator">
        <Defs />
        <Box x={14} y={14} w={180} h={44} label="Git (GitOps)" sub="CR manifests, reviewed" stroke={C.blue} />
        <Arrow x1={196} y1={36} x2={236} y2={36} />
        <Box x={238} y={14} w={200} h={44} label="Custom Resource" sub="Db2uInstance / Db2uCluster" stroke={C.blue} />
        <Arrow x1={440} y1={36} x2={480} y2={36} />
        <Box x={482} y={14} w={224} h={44} label="Db2U Operator (controller)" sub="watch → diff → reconcile" stroke={C.purple} />
        <Arrow x1={594} y1={60} x2={594} y2={84} />
        <Label x={664} y={78} text="drift is corrected" color={C.purple} size={9} />

        <rect x={14} y={86} width={692} height={150} rx={8} fill={C.panel} stroke={C.border} />
        <Label x={26} y={104} text="StatefulSet — Db2 pods" color={C.dim} anchor="start" size={11} />

        <Box x={26} y={114} w={200} h={58} label="db2u-0 (primary)" sub="engine + instance" stroke={C.teal} />
        <Box x={246} y={114} w={200} h={58} label="db2u-1 … (MPP members)" sub="one pod per member" stroke={C.teal} />
        <Box x={466} y={114} w={220} h={58} label="tools / etcd / ldap sidecars" sub="operator-managed" />

        <Box x={26} y={182} w={130} h={44} label="PVC: meta" sub="RWX (shared sqllib)" stroke={C.amber} />
        <Box x={166} y={182} w={130} h={44} label="PVC: data" sub="RWO block" stroke={C.amber} />
        <Box x={306} y={182} w={130} h={44} label="PVC: logs" sub="RWO low latency" stroke={C.amber} />
        <Box x={446} y={182} w={240} h={44} label="Object storage" sub="DB2REMOTE:// backups" stroke={C.amber} />

        <Box x={14} y={248} w={210} h={44} label="Service (stable DNS)" sub="HADR_REMOTE_HOST target" stroke={C.green} />
        <Arrow x1={226} y1={270} x2={262} y2={270} />
        <Box x={264} y={248} w={210} h={44} label="HADR standby cluster" sub="anti-affinity, separate nodes" stroke={C.green} />
        <Box x={490} y={248} w={216} h={44} label="KubeletConfig" sub="allowedUnsafeSysctls: kernel.*" stroke={C.red} />
        <Label x={20} y={312} text="Probes must allow for crash recovery (startup probe) · requests = limits → Guaranteed QoS · INSTANCE_MEMORY below the pod limit" color={C.muted} anchor="start" size={10} />
      </svg>
    ),
  },

  "explain-tree": {
    caption:
      "How to read a db2exfmt tree: rows above the operator, cost below, inner input on the right. You compare the estimate with the section actual at each operator and work upward from the first big divergence.",
    render: () => (
      <svg {...svgProps(320)} aria-label="Reading a db2exfmt access plan tree">
        <Defs />
        <g fontFamily="monospace">
          <Box x={280} y={14} w={160} h={40} label="RETURN" sub="(1)" />
          <Arrow x1={360} y1={56} x2={360} y2={78} />
          <Box x={280} y={80} w={160} h={44} label="HSJOIN" sub="cost 41 200 timerons" stroke={C.teal} />

          <line x1={330} y1={126} x2={170} y2={158} stroke={C.borderStrong} strokeWidth={1.4} />
          <line x1={390} y1={126} x2={550} y2={158} stroke={C.borderStrong} strokeWidth={1.4} />
          <Label x={230} y={146} text="outer (probe)" size={9} />
          <Label x={500} y={146} text="inner (build)" size={9} />

          <Box x={90} y={160} w={160} h={44} label="IXSCAN" sub="est 1.2 rows" stroke={C.red} />
          <Box x={470} y={160} w={160} h={44} label="TBSCAN" sub="est 4.8e+07 rows" />
          <Arrow x1={170} y1={206} x2={170} y2={228} />
          <Arrow x1={550} y1={206} x2={550} y2={228} />
          <Box x={90} y={230} w={160} h={40} label="INDEX: IX_REG_STATUS" sub="" />
          <Box x={470} y={230} w={160} h={40} label="TABLE: ORDERS" sub="" />
        </g>
        <rect x={20} y={278} width={680} height={34} rx={6} fill={C.panel} stroke={C.red} />
        <Label x={32} y={299} text="Section actual at IXSCAN = 52 114 rows vs estimate 1.2 → correlation error → wrong join method above it. Fix the estimate, not just the operator." color="var(--color-danger-ink)" anchor="start" size={10} />
      </svg>
    ),
  },

  "hadr-modes": {
    caption:
      "Where the commit acknowledgement comes from in each sync mode. Everything to the left of the dashed line is paid on every commit, so mode choice is a latency-versus-RPO decision that belongs to the business, not the DBA.",
    render: () => (
      <svg {...svgProps(300)} aria-label="HADR synchronisation modes and commit points">
        <Defs />
        <Box x={14} y={14} w={150} h={44} label="Primary" sub="log write" stroke={C.blue} />
        <Box x={560} y={14} w={146} h={44} label="Standby" sub="receive → write → replay" stroke={C.green} />
        <Arrow x1={166} y1={36} x2={556} y2={36} />
        <Label x={360} y={28} text="log records over the network (RTT)" size={10} />

        {[
          { y: 80, name: "SYNC", where: "standby log written to disk", risk: "Zero loss even on double failure", cost: "RTT + standby disk write", color: C.green, x: 520 },
          { y: 132, name: "NEARSYNC", where: "standby memory", risk: "Loss only if both sites fail together", cost: "≈ RTT", color: C.teal, x: 430 },
          { y: 184, name: "ASYNC", where: "handed to the network layer", risk: "Loss possible on primary failure", cost: "≈ 0", color: C.amber, x: 300 },
          { y: 236, name: "SUPERASYNC", where: "never waits (no peer state)", risk: "Largest exposure; never blocks", cost: "0", color: C.red, x: 190 },
        ].map(m => (
          <g key={m.name}>
            <rect x={14} y={m.y} width={692} height={44} rx={6} fill={C.panel} stroke={m.color} />
            <text x={26} y={m.y + 19} fill={m.color} fontSize={12} fontWeight={600}>{m.name}</text>
            <text x={26} y={m.y + 34} fill={C.muted} fontSize={10}>commit returns when: {m.where}</text>
            <text x={330} y={m.y + 19} fill={C.dim} fontSize={10}>{m.risk}</text>
            <text x={330} y={m.y + 34} fill={C.muted} fontSize={10} fontFamily="monospace">added commit latency: {m.cost}</text>
            <circle cx={m.x} cy={m.y + 22} r={5} fill={m.color} />
          </g>
        ))}
      </svg>
    ),
  },

  "monitoring-map": {
    caption:
      "Pick the instrument by the question you are asking. Live state and internals come from db2pd, aggregated metrics from MON_GET table functions, history from event monitors, and engine messages from db2diag.log.",
    render: () => (
      <svg {...svgProps(280)} aria-label="Db2 diagnostic tooling landscape">
        <Defs />
        {[
          { x: 14, color: C.blue, title: "db2pd", sub: "live, no SQL, no latches", items: ["-edus  hot threads", "-wlocks  waiter → holder", "-apinfo  current SQL", "-hadr  role, gap, state", "-dbptnmem  memory sets", "-latches  contention"] },
          { x: 190, color: C.teal, title: "MON_GET_*", sub: "SQL, aggregated metrics", items: ["_PKG_CACHE_STMT  top SQL", "_ACTIVITY  in-flight", "_WORKLOAD  time spent", "_BUFFERPOOL  I/O", "_TRANSACTION_LOG  commit", "_TABLE / _INDEX  access"] },
          { x: 366, color: C.purple, title: "Event monitors", sub: "history, after the fact", items: ["ACTIVITIES + section", "LOCKING (waits, deadlock)", "STATISTICS (WLM)", "UNIT OF WORK", "→ EXPLAIN_FROM_ACTIVITY"] },
          { x: 542, color: C.amber, title: "db2diag.log & FODC", sub: "engine messages, dumps", items: ["db2diag -level Severe -H 2h", "DIAGLEVEL / DIAGSIZE", "db2fodc -hang full", "db2support for IBM", "stmmlog (STMM decisions)"] },
        ].map(col => (
          <g key={col.title}>
            <rect x={col.x} y={14} width={164} height={250} rx={8} fill={C.panel} stroke={col.color} />
            <text x={col.x + 82} y={36} textAnchor="middle" fill={col.color} fontSize={12} fontWeight={600}>{col.title}</text>
            <text x={col.x + 82} y={52} textAnchor="middle" fill={C.muted} fontSize={9}>{col.sub}</text>
            {col.items.map((it, i) => (
              <text key={it} x={col.x + 12} y={78 + i * 26} fill={C.dim} fontSize={9.5} fontFamily="monospace">{it}</text>
            ))}
          </g>
        ))}
      </svg>
    ),
  },

  "hadr-rolling-fixpack": {
    caption:
      "The rolling fix pack sequence an Ansible playbook must encode. Roles are discovered at runtime, never hard-coded, and each arrow is gated on a health check (PEER state, log gap ≈ 0).",
    render: () => (
      <svg {...svgProps(220)} aria-label="Rolling fix pack order for an HADR pair">
        <Defs />
        {[
          { x: 14, t: "1 · Pre-checks", s: "level, space, backup, PEER" },
          { x: 158, t: "2 · Patch standby", s: "stop → installFixPack → db2iupdt" },
          { x: 302, t: "3 · Wait PEER", s: "db2pd -hadr, gap ≈ 0" },
          { x: 446, t: "4 · TAKEOVER", s: "graceful role switch" },
          { x: 590, t: "5 · Patch old primary", s: "now the standby" },
        ].map((s, i) => (
          <g key={s.t}>
            <rect x={s.x} y={50} width={116} height={70} rx={6} fill={C.elevated} stroke={i === 3 ? C.amber : C.border} />
            <text x={s.x + 58} y={78} textAnchor="middle" fill={C.text} fontSize={10.5} fontWeight={500}>{s.t.split(" · ")[1]}</text>
            <text x={s.x + 58} y={96} textAnchor="middle" fill={C.muted} fontSize={8.5}>{s.s.length > 26 ? s.s.slice(0, 26) + "…" : s.s}</text>
            <text x={s.x + 58} y={42} textAnchor="middle" fill={C.muted} fontSize={9} fontFamily="monospace">step {i + 1}</text>
            {i < 4 && <Arrow x1={s.x + 118} y1={85} x2={s.x + 140} y2={85} />}
          </g>
        ))}
        <rect x={14} y={140} width={692} height={60} rx={7} fill={C.panel} stroke={C.green} />
        <Label x={26} y={160} text="6 · Verify PEER again, optionally fail back, then db2updv<ver> on the primary once every member is at the target level." color={C.dim} anchor="start" size={10} />
        <Label x={26} y={178} text="Ansible: serial 1 · any_errors_fatal · role discovered at runtime · idempotent (skip when db2level already = target) · CLP rc ≥ 4 = failure" color={C.muted} anchor="start" size={10} />
        <Label x={26} y={194} text="A rolling update works for fix packs within a release — a major version upgrade needs an outage." color={C.muted} anchor="start" size={10} />
      </svg>
    ),
  },
};
