import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { ConversationIntake } from './ConversationIntake';
import { dateColumnType } from '../column-types';

@Entity({ name: 'conversation_messages' })
@Index('UQ_conversation_messages_intake_position', ['intakeId', 'position'], {
  unique: true,
})
@Index('IDX_conversation_messages_intake_sent', ['intakeId', 'sentAt'])
export class ConversationMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  intakeId!: string;

  @ManyToOne(() => ConversationIntake, (intake) => intake.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'intakeId' })
  intake!: Relation<ConversationIntake>;

  @Column({ type: 'integer' })
  position!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  sourceMessageId?: string;

  @Column({ type: 'varchar', length: 255 })
  senderName!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  senderRef?: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: dateColumnType })
  sentAt!: Date;

  @Column({ type: 'boolean', default: false })
  isOutgoing!: boolean;

  @Column({ type: 'boolean', default: false })
  isMedia!: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  mediaType?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  replyToSourceMessageId?: string;
}
