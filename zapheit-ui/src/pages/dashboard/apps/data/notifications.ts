const NOTIFY_KEY = 'zapheit_notify_apps';

export function getNotifiedApps(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(NOTIFY_KEY) ?? '[]')); }
  catch { return new Set(); }
}

export function toggleNotifyApp(appId: string): boolean {
  const set = getNotifiedApps();
  if (set.has(appId)) { set.delete(appId); } else { set.add(appId); }
  localStorage.setItem(NOTIFY_KEY, JSON.stringify([...set]));
  return set.has(appId);
}
