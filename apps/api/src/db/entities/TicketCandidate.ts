import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { ConversationIntake } from './ConversationIntake';
import { BatonPublishAttempt } from './BatonPublishAttempt';
import { dateColumnType } from '../column-types';

export type TicketCandidateStatus = 'pending' | 'accepted' | 'rejected' | 'published';
export type TicketCandidateConfidence = 'high' | 'medium';
export type BatonPublishStatus = 'not_requested' | 'pending' | 'failed' | 'succeeded';

export interface TicketEvidenceSpan {
  messageId: string;
  position: number;
  senderName: string;
  sentAt: string;
}

@Entity({ name: 'ticket_candidates' })
@Index('UQ_ticket_candidates_intake_fingerprint', ['intakeId', 'fingerprint'], { unique: true })
@Index('IDX_ticket_candidates_user_intake', ['userId', 'intakeId'])
export class TicketCandidate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  intakeId!: string;

  @ManyToOne(() => ConversationIntake, { onDelete: 'CASCADE' })
  intake!: Relation<ConversationIntake>;

  @Column({ type: 'varchar', length: 255 })
  userId!: string;

  @Column({ type: 'varchar', length: 64 })
  fingerprint!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'varchar', length: 20 })
  confidence!: TicketCandidateConfidence;

  @Column({ type: 'simple-json' })
  evidence!: TicketEvidenceSpan[];

  @Column({ type: 'varchar', length: 36, nullable: true })
  projectId?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: TicketCandidateStatus;

  @Column({ type: 'integer', default: 1 })
  revision!: number;

  @Column({ type: 'varchar', length: 20, default: 'not_requested' })
  publishStatus!: BatonPublishStatus;

  @Column({ type: 'varchar', length: 100 })
  idempotencyKey!: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  batonTaskId?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  batonTaskUrl?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastPublishErrorCode?: string | null;

  @Column({ type: dateColumnType, nullable: true })
  decidedAt?: Date | null;

  @Column({ type: dateColumnType, nullable: true })
  publishedAt?: Date | null;

  @OneToMany(() => BatonPublishAttempt, (attempt) => attempt.candidate)
  publishAttempts!: Relation<BatonPublishAttempt[]>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
