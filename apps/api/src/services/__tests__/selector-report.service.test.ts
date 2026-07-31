import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
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

  it('persists reports across service instances and bounds retained evidence', async () => {
    const writer = new SelectorReportService(dataSource, 2);
    for (let index = 0; index < 3; index += 1) {
      await writer.save({
        discovered: { messageList: `[data-fixture="${index}"]` },
        userAgent: 'Synthetic fixture browser',
        timestamp: new Date(Date.UTC(2026, 6, 31, 8, index)).toISOString(),
        extensionVersion: '1.0.20',
      });
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
});
