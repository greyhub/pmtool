import { BadRequestException } from '@nestjs/common';
import { assertRetypeFits, placeChild } from './wbs-rules';

describe('placeChild', () => {
  it('defaults a root task to ACTIVITY', () => {
    expect(placeChild(null, undefined)).toEqual({ nodeType: 'ACTIVITY' });
  });

  it('defaults to ACTIVITY under any container level', () => {
    for (const parent of ['PHASE', 'DELIVERABLE', 'WORK_PACKAGE'] as const) {
      expect(placeChild(parent, undefined).nodeType).toBe('ACTIVITY');
    }
  });

  it('promotes an ACTIVITY parent to a work package', () => {
    expect(placeChild('ACTIVITY', undefined)).toEqual({
      nodeType: 'ACTIVITY',
      promoteParentTo: 'WORK_PACKAGE',
    });
  });

  it('rejects a child that outranks its parent', () => {
    expect(() => placeChild('WORK_PACKAGE', 'PHASE')).toThrow(
      BadRequestException,
    );
    expect(() => placeChild('DELIVERABLE', 'DELIVERABLE')).toThrow(
      BadRequestException,
    );
  });

  it('accepts an explicit lower level', () => {
    expect(placeChild('PHASE', 'ACTIVITY').nodeType).toBe('ACTIVITY');
  });
});

describe('assertRetypeFits', () => {
  it('rejects a type that no longer fits under the parent', () => {
    expect(() => assertRetypeFits('PHASE', 'DELIVERABLE', [])).toThrow(
      BadRequestException,
    );
  });

  it('rejects a type that cannot contain existing children', () => {
    expect(() => assertRetypeFits('ACTIVITY', null, ['ACTIVITY'])).toThrow(
      BadRequestException,
    );
  });

  it('accepts a consistent change', () => {
    expect(() =>
      assertRetypeFits('WORK_PACKAGE', 'DELIVERABLE', ['ACTIVITY']),
    ).not.toThrow();
  });
});
