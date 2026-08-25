import { getSettings, updateSettings } from './storage.js';

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

/**
 * Loads the shipped variables/templates JSON, then layers on any local
 * user customizations (edited template text, user-created templates/groups).
 * Returns the merged data plus a flag if stored overrides predate the
 * currently shipped data version (see context/decisions.md, "Data & non-functional").
 */
export async function loadData() {
  const [variablesData, templatesData] = await Promise.all([
    fetchJson('public/data/variables.json'),
    fetchJson('public/data/templates.json')
  ]);

  const settings = getSettings();
  const stale =
    (settings.dataVersions.variables !== null && settings.dataVersions.variables !== variablesData.version) ||
    (settings.dataVersions.templates !== null && settings.dataVersions.templates !== templatesData.version);

  if (settings.dataVersions.variables === null || settings.dataVersions.templates === null) {
    updateSettings({ dataVersions: { variables: variablesData.version, templates: templatesData.version } });
  }

  const groups = templatesData.groups.map((group) => ({
    ...group,
    templates: group.templates.map((tpl) => applyOverride(tpl, settings.templateOverrides[tpl.id]))
  }));

  for (const customGroup of settings.customGroups || []) {
    groups.push({
      ...customGroup,
      custom: true,
      templates: (customGroup.templates || []).map((tpl) => ({ ...tpl, subject: { static: tpl.subject }, custom: true }))
    });
  }

  const sharedSubjects = Object.fromEntries(
    templatesData.groups
      .filter((g) => g.sharedSubject)
      .map((g) => [g.id, settings.sharedSubjectOverrides[g.id] || g.sharedSubject])
  );

  return {
    variables: variablesData.variables,
    checkboxes: templatesData.checkboxes,
    sharedSubjects,
    defaults: { groups: templatesData.groups },
    groups,
    stale,
    versions: { variables: variablesData.version, templates: templatesData.version }
  };
}

function applyOverride(tpl, override) {
  if (!override) return tpl;
  return {
    ...tpl,
    body: override.body ?? tpl.body,
    subject: override.subject ? { static: override.subject } : tpl.subject
  };
}

export function acknowledgeStaleData(variablesVersion, templatesVersion) {
  updateSettings({ dataVersions: { variables: variablesVersion, templates: templatesVersion } });
}
