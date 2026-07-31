import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { dateColumnType } from '../column-types';

@Entity({ name: 'extension_selector_reports' })
@Index('IDX_extension_selector_reports_observed', ['observedAt'])
export class SelectorReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'simple-json' })
  discovered!: Record<string, string>;

  @Column({ type: 'varchar', length: 500, default: '' })
  userAgent!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  extensionVersion?: string;

  @Column({ type: dateColumnType })
  observedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
