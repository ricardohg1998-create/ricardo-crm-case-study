# Calendar days are not always 24 hours

The CRM's daily email budgets use Europe/Madrid calendar days. A naive UTC date resets at the wrong local time. Adding 24 hours to a local midnight also fails across daylight-saving changes.

This is a small JavaScript adaptation of the calendar helper from my CRM's `mail-limits.ts`. It preserves the algorithm and exposes no contact, configuration or mailbox data. It returns an ISO calendar label and a half-open UTC interval: `start <= timestamp < end`.

```js
import { madridWindow } from './madrid-window.mjs';

madridWindow(new Date('2026-03-29T12:00:00Z'));
// {
//   day: '2026-03-29',
//   start: '2026-03-28T23:00:00.000Z',
//   end: '2026-03-29T22:00:00.000Z'
// }
```

The spring day contains 23 hours; the autumn change contains 25. Each midnight is resolved independently with `Intl`, without relying on the host's local timezone.

Run from the repository root with Node.js 24:

```sh
npm test
```

There are no dependencies to install. The tests cover winter/summer offsets, both DST changes, a year boundary, exact midnight and the repeated autumn hour. Invalid input dates are outside this helper's contract; callers supply a valid `Date`.

This example calculates the budget window only. Atomic database reservation, permissions and transport handling remain in the private application. The example code is under the MIT licence in this directory; it does not license the application or the case-study assets.
