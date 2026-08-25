import { Column, Entity, PrimaryColumn } from 'typeorm';

import { dateColumnType } from '../column-types';

/**
 * A durable, per-user lease that blocks new conversation ingestion while an
 * account deletion is in flight. There is no local User row for the live,
 * Mystira-federated auth path (see auth.service.ts), so this can't hang off
 * that table — userId is the primary key instead.
 *
 * ConversationIntakeService.deleteAllForUser holds this for its whole run
 * and heartbeats it on a timer independent of its deletion loop's
 * iterations — a single row's cleanup can legitimately run well past a
 * short lease while it waits out an upload-claim grace window or retries a
 * slow blob-storage delete. ConversationIntakeService.save checks it both
 * before and after building its insert, inside the same transaction. See
 * the docstring on deleteAllForUser for how the two-sided check closes the
 * race rather than merely narrowing it.
 */
@Entity({ name: 'account_deletion_locks' })
export class AccountDeletionLock {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  userId!: string;

  @Column({ type: dateColumnType })
  startedAt!: Date;

  @Column({ type: dateColumnType })
  heartbeatAt!: Date;
}
