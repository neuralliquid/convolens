import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { ConversationIntake } from './ConversationIntake';
import { dateColumnType } from '../column-types';

export interface SummaryEvidenceItem {
  text: string;
  evidence: number[];
}

export interface SummaryActionItem extends SummaryEvidenceItem {
  owner?: string;
  due?: string;
}

export interface SummaryLink {
  url: string;
  label?: string;
  evidence: number[];
}

export interface ConversationSummaryContent {
  version: 1;
  overview: string;
  overviewEvidence: number[];
  keyTopics: SummaryEvidenceItem[];
  decisions: SummaryEvidenceItem[];
  actionItems: SummaryActionItem[];
  openQuestions: SummaryEvidenceItem[];
  importantLinks: SummaryLink[];
}

@Entity({ name: 'conversation_summaries' })
@Index('UQ_conversation_summaries_intake', ['intakeId'], { unique: true })
@Index('IDX_conversation_summaries_user_generated', ['userId', 'generatedAt'])
export class ConversationSummary {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  intakeId!: string;

  @OneToOne(() => ConversationIntake, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'intakeId' })
  intake!: Relation<ConversationIntake>;

  @Column({ type: 'varchar', length: 255 })
  userId!: string;

  @Column({ type: 'simple-json' })
  content!: ConversationSummaryContent;

  @Column({ type: 'varchar', length: 50 })
  provider!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model?: string;

  @Column({ type: 'integer' })
  sourceMessageCount!: number;

  @Column({ type: 'varchar', length: 64 })
  sourceContentHash!: string;

  @Column({ type: dateColumnType })
  periodStart!: Date;

  @Column({ type: dateColumnType })
  periodEnd!: Date;

  @Column({ type: dateColumnType })
  generatedAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
