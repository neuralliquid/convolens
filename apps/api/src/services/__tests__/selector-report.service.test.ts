import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { DataSource } from 'typeorm';

import { SelectorReport } from '../../db/entities/SelectorReport';
import { SelectorReportService } from '../selector-report.service';

describe('SelectorReportService', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [SelectorReport],
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.getRepository(SelectorReport).clear();
  });

  it('persists reports across service instances and bounds retained evidence', async () => {
    const writer = new SelectorReportService(dataSource, 2);
    for (let index = 0; index < 3; index += 1) {
      await writer.save({
        discovered: { messageList: `[data-fixture="${index}"]` },
        userAgent: 'Synthetic fixture browser',
        timestamp: new Date(Date.UTC(2026, 6, 31, 8, index)).toISOString(),
        extensionVersion: '1.0.20',
      });
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
    }

    const readerAfterRestart = new SelectorReportService(dataSource, 2);
    const reports = await readerAfterRestart.list();
    expect(reports).toHaveLength(2);
    expect(reports.map((report) => report.discovered.messageList)).toEqual([
      '[data-fixture="2"]',
      '[data-fixture="1"]',
    ]);
    expect(await dataSource.getRepository(SelectorReport).count()).toBe(2);
  });

  it('bounds retention by server receipt rather than the client observation clock', async () => {
    const writer = new SelectorReportService(dataSource, 2);
    for (const [label, timestamp] of [
      ['future-first', '2126-07-31T08:00:00.000Z'],
      ['current-second', '2026-07-31T08:00:00.000Z'],
      ['past-last', '1926-07-31T08:00:00.000Z'],
    ] as const) {
      await writer.save({
        discovered: { messageList: label },
        userAgent: 'Synthetic skew fixture',
        timestamp,
      });
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
    }

    const retained = await dataSource.getRepository(SelectorReport).find({
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    expect(retained.map((report) => report.discovered.messageList)).toEqual([
      'past-last',
      'current-second',
    ]);
  });
});
