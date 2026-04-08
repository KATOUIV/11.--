const DEPTH_MAX_STYLE = 6;

function depthIndentPx(depth: number): number | undefined {
  if (depth <= 0) return undefined;
  return Math.min(depth, DEPTH_MAX_STYLE) * 11;
}

function KVRow({ label, value, depth = 0 }: { label: string; value: string; depth?: number }) {
  const indent = depthIndentPx(depth);
  return (
    <div
      className="vault-stat-kv vault-stat-leaf-row flex justify-between gap-2 text-[11px] py-1.5 border-b border-vault-border/15 last:border-0 rounded-sm"
      data-depth={depth}
      style={indent != null ? { marginLeft: indent } : undefined}
    >
      <span className="opacity-80 shrink-0 min-w-0 font-medium">{label}</span>
      <span className="text-right wrap-break-word opacity-95 min-w-0">{value}</span>
    </div>
  );
}

function StatNode({
  label,
  value,
  depth,
  path,
}: {
  label: string;
  value: unknown;
  depth: number;
  path: string;
}) {
  if (value === null || value === undefined) {
    return <KVRow label={label} value="—" depth={depth} />;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <KVRow label={label} value="（空）" depth={depth} />;
    }
    const d = Math.min(depth, DEPTH_MAX_STYLE);
    const indent = depthIndentPx(depth);
    return (
      <details
        className={[
          'vault-stat-details group rounded-md border open:shadow-[inset_0_0_0_1px_rgba(0,255,65,0.08)]',
          'vault-stat-depth-surface',
        ].join(' ')}
        data-depth={d}
        open={depth < 2}
        style={indent != null ? { marginLeft: indent } : undefined}
      >
        <summary className="vault-stat-summary cursor-pointer list-none px-2.5 py-2 outline-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-2 rounded-t-md">
          <span className="tracking-wide">{label}</span>
          <span className="text-[10px] opacity-55 font-normal tabular-nums shrink-0">{entries.length} 项</span>
        </summary>
        <div className="vault-stat-nested px-2 pb-2.5 pt-1 space-y-1.5 border-t border-vault-border/25">
          {entries.map(([k, v]) => (
            <StatNode key={`${path}.${k}`} label={k} value={v} depth={depth + 1} path={`${path}.${k}`} />
          ))}
        </div>
      </details>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <KVRow label={label} value="（空列表）" depth={depth} />;
    }
    const indent = depthIndentPx(depth);
    return (
      <div className="vault-stat-array-block space-y-1.5" data-depth={depth} style={indent != null ? { marginLeft: indent } : undefined}>
        <div className="text-[10px] opacity-65 tracking-[0.12em] font-semibold uppercase vault-stat-array-label">{label}</div>
        <ul className="space-y-1.5 pl-0 m-0 list-none">
          {value.map((item, i) => (
            <li
              key={`${path}[${i}]`}
              className="vault-stat-array-item rounded-md border px-2 py-1.5"
              data-depth={Math.min(depth + 1, DEPTH_MAX_STYLE)}
            >
              {typeof item === 'object' && item !== null ? (
                <StatNode label={`条目 ${i + 1}`} value={item} depth={depth + 1} path={`${path}[${i}]`} />
              ) : (
                <span className="text-[11px] opacity-90">{String(item)}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (typeof value === 'number') {
    const showBar = Number.isFinite(value) && value >= 0 && value <= 100;
    const indent = depthIndentPx(depth);
    return (
      <div
        className="vault-stat-num-block space-y-1 rounded-sm py-0.5 vault-stat-leaf-row"
        data-depth={Math.min(depth, DEPTH_MAX_STYLE)}
        style={indent != null ? { marginLeft: indent } : undefined}
      >
        <div className="flex justify-between gap-2 text-[11px]">
          <span className="opacity-80 font-medium">{label}</span>
          <span className="font-mono tabular-nums text-vault-green/95">{value}</span>
        </div>
        {showBar && (
          <div className="h-1.5 rounded-full bg-black/50 overflow-hidden ring-1 ring-vault-border/30">
            <div
              className="h-full rounded-full bg-linear-to-r from-emerald-600/90 to-vault-green/85 transition-[width] duration-500 vault-stat-meter-fill"
              style={{ width: `${value}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  if (typeof value === 'boolean') {
    return <KVRow label={label} value={value ? '是' : '否'} depth={depth} />;
  }

  return <KVRow label={label} value={String(value)} depth={depth} />;
}

export function StatDataTree({ data }: { data: Record<string, unknown> | null }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <p className="text-[11px] leading-relaxed opacity-65">
        暂无 <code className="opacity-80">stat_data</code>
        。请确认已在角色卡中启用 MVU，且最新 assistant 楼层已写入变量。
      </p>
    );
  }

  return (
    <div className="vault-stat-root space-y-2 min-h-0">
      {Object.entries(data).map(([k, v]) => (
        <StatNode key={k} label={k} value={v} depth={0} path={k} />
      ))}
    </div>
  );
}
