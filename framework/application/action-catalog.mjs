export const ACTION_KINDS = Object.freeze({
  PRESENTATION: 'presentation',
  AGENT: 'agent',
});

export const ACTION_SURFACES = Object.freeze({
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  MENU: 'menu',
});

const ACTION_CATALOG = Object.freeze([
  {
    id: 'build_presentation',
    label: 'Build presentation',
    surface: ACTION_SURFACES.PRIMARY,
    kind: ACTION_KINDS.PRESENTATION,
  },
  {
    id: 'export_presentation',
    label: 'Export',
    surface: ACTION_SURFACES.SECONDARY,
    kind: ACTION_KINDS.PRESENTATION,
  },
  {
    id: 'check_presentation',
    label: 'Check presentation',
    surface: ACTION_SURFACES.MENU,
    kind: ACTION_KINDS.PRESENTATION,
  },
  {
    id: 'capture_screenshots',
    label: 'Capture screenshots',
    surface: ACTION_SURFACES.MENU,
    kind: ACTION_KINDS.PRESENTATION,
  },
  {
    id: 'review_presentation',
    label: 'Review presentation',
    surface: ACTION_SURFACES.MENU,
    kind: ACTION_KINDS.AGENT,
  },
  {
    id: 'revise_presentation',
    label: 'Revise presentation',
    surface: ACTION_SURFACES.MENU,
    kind: ACTION_KINDS.AGENT,
  },
  {
    id: 'fix_warnings',
    label: 'Fix warnings',
    surface: ACTION_SURFACES.MENU,
    kind: ACTION_KINDS.AGENT,
  },
]);

export function listActionDefinitions() {
  return ACTION_CATALOG.map((action) => ({ ...action }));
}

export function getActionDefinition(actionId) {
  return ACTION_CATALOG.find((action) => action.id === actionId) || null;
}
