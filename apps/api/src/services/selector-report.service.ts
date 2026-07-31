import { type DataSource } from 'typeorm';
import { AppDataSource } from '../config/database';
import { SelectorReport } from '../db/entities/SelectorReport';

export interface SelectorReportInput {
  discovered: Record<string, string>;
  userAgent: string;
  timestamp: string;
  extensionVersion?: string;
}

export class SelectorReportService {
  constructor(
    private readonly dataSource: DataSource = AppDataSource,
    private readonly maximumReports = 100
  ) {}

  async save(input: SelectorReportInput): Promise<void> {
    const repository = this.dataSource.getRepository(SelectorReport);
    await repository.save(
      repository.create({
        discovered: input.discovered,
        userAgent: input.userAgent,
        extensionVersion: input.extensionVersion?.slice(0, 50),
        observedAt: new Date(input.timestamp),
      })
    );
    const expired = await repository.find({
      select: { id: true },
      order: { observedAt: 'DESC', id: 'DESC' },
      skip: this.maximumReports,
    });
    if (expired.length > 0) await repository.delete(expired.map(({ id }) => id));
  }

  async list(): Promise<SelectorReportInput[]> {
    const reports = await this.dataSource.getRepository(SelectorReport).find({
      order: { observedAt: 'DESC', id: 'DESC' },
      take: this.maximumReports,
    });
    return reports.map((report) => ({
      discovered: report.discovered,
      userAgent: report.userAgent,
      timestamp: report.observedAt.toISOString(),
      extensionVersion: report.extensionVersion,
    }));
  }
}

export const selectorReportService = new SelectorReportService();
