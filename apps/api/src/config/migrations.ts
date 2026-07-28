import { CreateConversationIntake1753400000000 } from '../db/migrations/1753400000000-CreateConversationIntake';
import { AddConversationFidelity1753660000000 } from '../db/migrations/1753660000000-AddConversationFidelity';

export const CONVERSATION_MIGRATIONS = [
  CreateConversationIntake1753400000000,
  AddConversationFidelity1753660000000,
];
