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

import { dateColumnType } from '../column-types';

import { ConversationMessage } from './ConversationMessage';

export type ConversationSourceKind = 'extension' | 'upload';
export type ConversationStatus = 'received' | 'failed';
export type RawArtifactStatus = 'pending' | 'stored' | 'failed' | 'not-recorded' | 'deleting';

export interface ConversationProvenance {
  connectorVersion?: string;
  originalFileName?: string;
  captureInitiatedBy: 'user';
  consentBasis: 'user-selected-conversation';
}

export interface ConversationParticipantEvidence {
  ref: string;
  rawDisplayName?: string;
  rawUsername?: string;
  normalizedPhone?: string;
  platformUserId?: string;
  preferredDisplayName?: string;
  rawLabels?: string[];
  isSelf: boolean;
  extractionMethod: string;
  confidence: string;
}

@Entity({ name: 'conversation_intakes' })
@Index('IDX_conversation_intakes_user_received', ['userId', 'receivedAt'])
@Index('IDX_conversation_intakes_compatibility_scope', [
  'userId',
  'sourcePlatform',
  'compatibilityHash',
  'sourceConversationId',
])
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

  @Column({ type: 'boolean', default: false })
  sourceConversationIdentityStable!: boolean;

  @Column({ type: 'varchar', length: 255 })
  displayName!: string;

  @Column({ type: 'boolean', default: false })
  isGroup!: boolean;

  @Column({ type: 'simple-json', nullable: true })
  participants?: string[];

  @Column({ type: 'simple-json', nullable: true })
  participantEvidence?: ConversationParticipantEvidence[];

  @Column({ type: 'varchar', length: 64 })
  contentHash!: string;

  @Column({ type: 'integer', default: 1 })
  contentHashVersion!: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  compatibilityHash?: string;

  @Column({ type: 'varchar', length: 50, default: 'none' })
  reconciliationStatus!: 'none' | 'required';

  @Column({ type: 'simple-json', nullable: true })
  reconciliationCandidateIds?: string[];

  @Column({ type: 'varchar', length: 50, default: 'received' })
  status!: ConversationStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  errorCode?: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  rawArtifactKey?: string;

  @Column({ type: 'simple-json', nullable: true })
  rawArtifactCleanupKeys?: string[] | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  rawArtifactSha256?: string;

  @Column({ type: 'integer', nullable: true })
  rawArtifactSize?: number;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  rawArtifactStatus!: RawArtifactStatus;

  @Column({ type: 'varchar', length: 36, nullable: true })
  rawArtifactClaimId?: string | null;

  @Column({ type: dateColumnType, nullable: true })
  rawArtifactClaimedAt?: Date | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  batonPublishClaimId?: string | null;

  @Column({ type: dateColumnType, nullable: true })
  batonPublishClaimedAt?: Date | null;

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
