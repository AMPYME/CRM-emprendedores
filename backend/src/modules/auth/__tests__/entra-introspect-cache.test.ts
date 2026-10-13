import {
  clearIntrospectCache,
  getPositiveIntrospect,
  invalidateIntrospect,
  setPositiveIntrospect,
} from '../entra-introspect-cache';

describe('entra-introspect-cache', () => {
  beforeEach(() => clearIntrospectCache());

  it('solo cachea positivo y respeta TTL', () => {
    setPositiveIntrospect('ref-1', 50);
    expect(getPositiveIntrospect('ref-1')).toBe(true);
    invalidateIntrospect('ref-1');
    expect(getPositiveIntrospect('ref-1')).toBe(false);
  });

  it('expira tras TTL', async () => {
    setPositiveIntrospect('ref-2', 20);
    expect(getPositiveIntrospect('ref-2')).toBe(true);
    await new Promise((r) => setTimeout(r, 35));
    expect(getPositiveIntrospect('ref-2')).toBe(false);
  });
});
