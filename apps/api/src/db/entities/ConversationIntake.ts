import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { ConversationMessage } from './ConversationMessage';
import { dateColumnType } from '../column-types';

export type ConversationSourceKind = 'extension' | 'upload';
export type ConversationStatus = 'received';

export interface ConversationProvenance {
  connectorVersion?: string;
  originalFileName?: string;
  captureInitiatedBy: 'user';
  consentBasis: 'user-selected-conversation';
}

@Entity({ name: 'conversation_intakes' })
@Index('IDX_conversation_intakes_user_received', ['userId', 'receivedAt'])
@Index('UQ_conversation_intakes_user_content_hash', ['userId', 'contentHash'], {
  unique: true,
})
@Index('IDX_conversation_intakes_status', ['status'])
export class ConversationIntake {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  userId!: string;

  @Column({ type: 'varchar', length: 50 })
  sourcePlatform!: string;

  @Column({ type: 'varchar', length: 50 })
  sourceKind!: ConversationSourceKind;

  @Column({ type: 'varchar', length: 500, nullable: true })
  sourceConversationId?: string;

  @Column({ type: 'varchar', length: 255 })
  displayName!: string;

  @Column({ type: 'boolean', default: false })
  isGroup!: boolean;

  @Column({ type: 'simple-json', nullable: true })
  participants?: string[];

  @Column({ type: 'varchar', length: 64 })
  contentHash!: string;

  @Column({ type: 'varchar', length: 50, default: 'received' })
  status!: ConversationStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  errorCode?: string;

  @Column({ type: dateColumnType, nullable: true })
  sourceExtractedAt?: Date;

  @Column({ type: 'simple-json', nullable: true })
  provenance?: ConversationProvenance;

  @OneToMany(() => ConversationMessage, (message) => message.intake, {
    cascade: ['insert'],
  })
  messages!: Relation<ConversationMessage[]>;

  @CreateDateColumn()
  receivedAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
