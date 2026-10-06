// The page owns its state; reusable children may still own independent local state.
export function pageReducer(state, action) {
  const next =
    typeof action.value === 'function'
      ? action.value(state[action.field])
      : action.value;
  if (Object.is(next, state[action.field])) return state;
  return { ...state, [action.field]: next };
}
