import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';

import { dateColumnType } from '../column-types';

import { ConversationIntake } from './ConversationIntake';
import { ConversationMessage } from './ConversationMessage';

@Entity({ name: 'message_transcripts' })
@Index('UQ_message_transcripts_message', ['messageId'], { unique: true })
@Index('IDX_message_transcripts_user_intake', ['userId', 'intakeId'])
export class MessageTranscript {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  messageId!: string;

  @OneToOne(() => ConversationMessage, (message) => message.transcript, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message!: Relation<ConversationMessage>;

  @Column({ type: 'uuid' })
  intakeId!: string;

  @ManyToOne(() => ConversationIntake, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'intakeId' })
  intake!: Relation<ConversationIntake>;

  @Column({ type: 'varchar', length: 255 })
  userId!: string;

  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'varchar', length: 50, default: 'xtox' })
  provider!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerTranscriptId?: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  language?: string | null;

  @Column({ type: 'integer', nullable: true })
  durationMs?: number | null;

  @Column({ type: dateColumnType })
  modelProcessingConsentAt!: Date;

  @Column({ type: dateColumnType })
  generatedAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
