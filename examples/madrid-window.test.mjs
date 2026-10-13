import test from 'node:test';
import assert from 'node:assert/strict';
import { madridWindow } from './madrid-window.mjs';

const cases = [
  ['winter', '2026-01-15T12:00:00Z', '2026-01-15', '2026-01-14T23:00:00.000Z', '2026-01-15T23:00:00.000Z', 24],
  ['summer', '2026-07-15T12:00:00Z', '2026-07-15', '2026-07-14T22:00:00.000Z', '2026-07-15T22:00:00.000Z', 24],
  ['spring DST change', '2026-03-29T12:00:00Z', '2026-03-29', '2026-03-28T23:00:00.000Z', '2026-03-29T22:00:00.000Z', 23],
  ['autumn DST change', '2026-10-25T12:00:00Z', '2026-10-25', '2026-10-24T22:00:00.000Z', '2026-10-25T23:00:00.000Z', 25],
  ['year boundary', '2026-12-31T23:30:00Z', '2027-01-01', '2026-12-31T23:00:00.000Z', '2027-01-01T23:00:00.000Z', 24],
];
for (const [name, at, day, start, end, hours] of cases) {
  test(name, () => {
    const result = madridWindow(new Date(at));
    assert.deepEqual(result, { day, start, end });
    assert.equal((Date.parse(end) - Date.parse(start)) / 3600000, hours);
  });
}

test('local midnight belongs to the next half-open budget interval', () => {
  const before = madridWindow(new Date('2026-07-15T21:59:59.999Z'));
  const after = madridWindow(new Date('2026-07-15T22:00:00.000Z'));
  assert.equal(before.day, '2026-07-15');
  assert.equal(after.day, '2026-07-16');
  assert.equal(before.end, after.start);
});

test('both occurrences of the repeated autumn hour use the same daily budget', () => {
  assert.deepEqual(
    madridWindow(new Date('2026-10-25T00:30:00Z')),
    madridWindow(new Date('2026-10-25T01:30:00Z')),
  );
});
