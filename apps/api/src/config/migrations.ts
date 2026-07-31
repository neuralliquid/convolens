import { CreateConversationIntake1753400000000 } from '../db/migrations/1753400000000-CreateConversationIntake';
import { AddConversationFidelity1753660000000 } from '../db/migrations/1753660000000-AddConversationFidelity';
import { AddIntakeArtifactsAndSelectorReports1754000000000 } from '../db/migrations/1754000000000-AddIntakeArtifactsAndSelectorReports';

export const CONVERSATION_MIGRATIONS = [
  CreateConversationIntake1753400000000,
  AddConversationFidelity1753660000000,
  AddIntakeArtifactsAndSelectorReports1754000000000,
];
