import { describe, it, expect } from 'vitest';
import { buildPledgeAlertHtml } from './mail';

describe('buildPledgeAlertHtml', () => {
  it('danger 等級會標示「緊急」與平台名稱、比率', () => {
    const html = buildPledgeAlertHtml({
      isDanger: true,
      platformName: '元大',
      ratio: 150.5,
      pledgeData: [{ platform: '元大', ratio: 150.5, borrowValue: 1000000, collateralValue: 1505000 }],
    });
    expect(html).toContain('緊急');
    expect(html).toContain('元大');
    expect(html).toContain('150.5%');
  });

  it('warning 等級不含「緊急」字樣,含「注意」', () => {
    const html = buildPledgeAlertHtml({
      isDanger: false,
      platformName: '國泰',
      ratio: 190,
      pledgeData: [{ platform: '國泰', ratio: 190, borrowValue: 500000, collateralValue: 950000 }],
    });
    expect(html).toContain('注意');
    expect(html).not.toContain('緊急');
  });
});
