const digitsOf = (s: string) => s.replace(/\D/g, '');

/**
 * The phone part of a search: "8 707 123 45 67", "+7 (707) 123-45-67" and "7071234567" are the same number,
 * and a piece of it (3 digits or more) finds it too.
 */
export function phoneMatches(phone: string, query: string) {
  let q = digitsOf(query);
  if (q.length < 3) return false;
  const p = digitsOf(phone);
  if (!p) return false;
  if (q.length === 11 && q[0] === '8') q = '7' + q.slice(1);
  return p.includes(q) || (q.length >= 10 && p.endsWith(q.slice(-10)));
}

/** A client found by name (any case, ё = е), by phone in any spelling, or by the card id. */
export function personMatches(m: { name: string; phone: string; id?: string }, query: string) {
  const q = query.trim().toLowerCase().replace(/ё/g, 'е');
  if (!q) return true;
  return (
    m.name.toLowerCase().replace(/ё/g, 'е').includes(q) ||
    phoneMatches(m.phone, q) ||
    // the card of a client with a phone is u_<digits>: found by the number even if the phone field is empty
    (!!m.id && q.length >= 3 && (m.id.toLowerCase().includes(q) || (m.id.startsWith('u_') && phoneMatches(m.id, q))))
  );
}
