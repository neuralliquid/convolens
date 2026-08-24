import { CreateConversationIntake1753400000000 } from '../db/migrations/1753400000000-CreateConversationIntake';
import { AddConversationFidelity1753660000000 } from '../db/migrations/1753660000000-AddConversationFidelity';
import { AddIntakeArtifactsAndSelectorReports1754000000000 } from '../db/migrations/1754000000000-AddIntakeArtifactsAndSelectorReports';
import { AddRawArtifactCleanupKeys1754100000000 } from '../db/migrations/1754100000000-AddRawArtifactCleanupKeys';
import { AddTicketCandidatesAndBatonAttempts1754200000000 } from '../db/migrations/1754200000000-AddTicketCandidatesAndBatonAttempts';
import { AddConversationSummaries1754300000000 } from '../db/migrations/1754300000000-AddConversationSummaries';
import { AddMessageTranscripts1754400000000 } from '../db/migrations/1754400000000-AddMessageTranscripts';
import { AddAccountDeletionLocks1754500000000 } from '../db/migrations/1754500000000-AddAccountDeletionLocks';

export const CONVERSATION_MIGRATIONS = [
  CreateConversationIntake1753400000000,
  AddConversationFidelity1753660000000,
  AddIntakeArtifactsAndSelectorReports1754000000000,
  AddRawArtifactCleanupKeys1754100000000,
  AddTicketCandidatesAndBatonAttempts1754200000000,
  AddConversationSummaries1754300000000,
  AddMessageTranscripts1754400000000,
  AddAccountDeletionLocks1754500000000,
];
