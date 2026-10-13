// Calendar-window helper adapted from my CRM's daily email budget module.
// This example performs no I/O and sends no messages.
const dateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
});
const dateParts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function midnight(day) {
  const target = Date.parse(`${day}T00:00:00Z`);
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(dateParts.formatToParts(guess).map(p => [p.type, p.value]));
    const represented = Date.UTC(+parts.year, +parts.month - 1, +parts.day,
      +parts.hour, +parts.minute, +parts.second);
    guess += target - represented;
  }
  return new Date(guess).toISOString();
}

export function madridWindow(at = new Date()) {
  const day = dateFormat.format(at);
  // Advance the calendar label, then resolve each local midnight separately.
  const next = new Date(Date.parse(`${day}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  return { day, start: midnight(day), end: midnight(next) };
}
