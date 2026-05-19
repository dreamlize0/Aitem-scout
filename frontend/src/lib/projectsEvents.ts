// Lightweight pub/sub for project mutations so unrelated parts of the UI (like
// the Sidebar folder list) can revalidate without lifting state to a global
// store. Mutation functions in lib/api.ts call notifyProjectsChanged() on
// success; listeners subscribe via the constant event name.

export const PROJECTS_CHANGED_EVENT = "aitem-scout:projects-changed";

export function notifyProjectsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PROJECTS_CHANGED_EVENT));
}
