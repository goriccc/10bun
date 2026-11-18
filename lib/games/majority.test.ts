import { describe, expect, it } from 'vitest';
import { majorityOrder } from './majority';

describe('majority order', () => {
  it('shuffles each question into the same four options', () => {
    const order = majorityOrder('2026-11-15', 1);
    expect(order).toHaveLength(4);
    expect([...order].sort()).toEqual([0, 1, 2, 3]);
    expect(majorityOrder('2026-11-15', 1)).toEqual(order);
  });
});
