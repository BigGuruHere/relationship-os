// Classify only; never return raw error messages, SQL metadata or submitted fields.
export function captureFailureMetadata(failure: unknown) {
  const e = failure as { code?: unknown; message?: unknown } | null;
  const code = typeof e?.code === 'string' && /^P[0-9]{4}$/.test(e.code) ? e.code : 'unclassified';
  const message = typeof e?.message === 'string' ? e.message : '';
  const category = code === 'P2028' ? 'transaction_timeout_or_closed'
    : ['P1001','P1002','P1017','P2024'].includes(code) ? 'database_connection'
    : code === 'P2002' ? 'unique_constraint'
    : ['P2003','P2004','P2010'].includes(code) ? 'database_constraint_or_query'
    : /custody|ContextSpace does not match|does not permit/.test(message) ? 'custody_guard'
    : code !== 'unclassified' ? 'database_error' : 'unknown';
  return { code, category };
}
