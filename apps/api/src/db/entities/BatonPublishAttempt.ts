import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';

import { dateColumnType } from '../column-types';

import { TicketCandidate } from './TicketCandidate';

@Entity({ name: 'baton_publish_attempts' })
export class BatonPublishAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  candidateId!: string;

  @ManyToOne(() => TicketCandidate, (candidate) => candidate.publishAttempts, {
    onDelete: 'CASCADE',
  })
  candidate!: Relation<TicketCandidate>;

  @Column({ type: 'varchar', length: 255 })
  userId!: string;

  @Column({ type: 'integer' })
  attemptNumber!: number;

  @Column({ type: 'varchar', length: 20 })
  status!: 'pending' | 'failed' | 'succeeded' | 'duplicate';

  @Column({ type: 'integer', nullable: true })
  responseStatus?: number | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  batonTaskId?: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  errorCode?: string | null;

  @Column({ type: dateColumnType, nullable: true })
  completedAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
