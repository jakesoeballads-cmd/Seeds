import type { T } from './i18n';

/** Kunci terjemahan untuk "hint" dari fungsi SQL (donate_benih, request_withdrawal, pay_participant, admin_*, activities_guard). */
const HINTS: Record<string, string> = {
  auth: 'err.login',
  amount: 'err.amount',
  balance: 'err.balance',
  bank: 'err.bank',
  self: 'err.self',
  message: 'err.msgLong',
  notFound: 'err.notFound',
  notOwner: 'err.notOwner',
  notAgreed: 'err.notAgreed',
  admin: 'err.notAdmin',
  processed: 'err.processed',
  editLocked: 'edit.locked',
  editDate: 'edit.dateErr',
};

export function rpcErrorText(t: T, error: { hint?: string | null; message: string }) {
  const key = error.hint ? HINTS[error.hint] : undefined;
  return key ? t(key) : t('err.generic', { msg: error.message });
}
