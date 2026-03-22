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
    id: 'export_presentation',
    label: 'Export presentation',
    surface: ACTION_SURFACES.PRIMARY,
    kind: ACTION_KINDS.PRESENTATION,
  },
  {
    id: 'validate_presentation',
    label: 'Validate presentation',
    surface: ACTION_SURFACES.SECONDARY,
    kind: ACTION_KINDS.PRESENTATION,
  },
  {
    id: 'capture_screenshots',
    label: 'Capture screenshots',
    surface: ACTION_SURFACES.MENU,
    kind: ACTION_KINDS.PRESENTATION,
  },
  {
    id: 'fix_validation_issues',
    label: 'Fix validation issues',
    surface: ACTION_SURFACES.MENU,
    kind: ACTION_KINDS.AGENT,
  },
  {
    id: 'review_narrative_presentation',
    label: 'Review narrative',
    surface: ACTION_SURFACES.MENU,
    kind: ACTION_KINDS.AGENT,
  },
  {
    id: 'apply_narrative_review_changes',
    label: 'Apply narrative fixes',
    surface: ACTION_SURFACES.MENU,
    kind: ACTION_KINDS.AGENT,
  },
  {
    id: 'review_visual_presentation',
    label: 'Review visuals',
    surface: ACTION_SURFACES.MENU,
    kind: ACTION_KINDS.AGENT,
  },
  {
    id: 'apply_visual_review_changes',
    label: 'Apply visual fixes',
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
