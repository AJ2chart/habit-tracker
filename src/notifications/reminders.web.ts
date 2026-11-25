import type { Data, MorningSettings, ReminderSettings } from '@/logic';

// Version web (aperçu et contrôle visuel) : pas de rappels. expo-notifications n'est pas chargé du tout,
// ce qui évite ses avertissements « not yet fully supported on web ».

export async function requestReminderPermission(): Promise<boolean> {
  return false;
}

export async function hasReminderPermission(): Promise<boolean> {
  return false;
}

export function syncReminders(_data: Data, _settings: ReminderSettings, _morning: MorningSettings): Promise<void> {
  return Promise.resolve();
}
