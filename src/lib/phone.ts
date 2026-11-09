const digitsOf = (s: string) => s.replace(/\D/g, '');

/**
 * What the sign-in field holds after a change: the 10 digits after «+7».
 * The field already shows «+7», so its 7 is dropped once; then a leading 8 (8 747 …) or a typed country code (7 747 …)
 * is dropped too — otherwise «8 747 655 70 40» became +7 874 765 57 04, a different card with the client's plan going nowhere.
 */
export function signInDigits(typed: string) {
  let d = digitsOf(typed);
  if (/^\s*\+7/.test(typed)) d = d.slice(1); // the field's own +7
  else if (d.length >= 11 && /^[78]/.test(d)) d = d.slice(1); // a whole number pasted over the field: 8 747… or 7 747…
  if (d.startsWith('8')) d = d.slice(1); // Kazakh numbers after +7 begin with 7, never 8: an 8 is the trunk prefix
  if (d.length > 10 && d.startsWith('7')) d = d.slice(1); // the country code typed or pasted once more
  return d.slice(0, 10);
}

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
