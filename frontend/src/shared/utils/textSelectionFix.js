/**
 * textSelectionFix.js
 *
 * On focus / tap of text, search, and numeric inputs: select the full value
 * so the user can type over it immediately (same UX as Workout kcal field).
 */

const SELECTABLE_TYPES = new Set([
  'text',
  'search',
  'tel',
  'email',
  'url',
  'number',
  'password',
  '', // missing type → text
]);

/**
 * @param {EventTarget | null} target
 * @returns {target is HTMLInputElement | HTMLTextAreaElement}
 */
export function isSelectAllTextField(target) {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'TEXTAREA') {
    if (target.dataset.noSelectAll === 'true' || target.readOnly || target.disabled) {
      return false;
    }
    return true;
  }
  if (tag !== 'INPUT') return false;
  /** @type {HTMLInputElement} */
  const input = /** @type {HTMLInputElement} */ (target);
  if (input.dataset.noSelectAll === 'true' || input.readOnly || input.disabled) {
    return false;
  }
  const type = (input.type || 'text').toLowerCase();
  return SELECTABLE_TYPES.has(type);
}

/** Select entire value; rAF so it wins over browser caret placement on mobile. */
export function selectAllTextInField(el) {
  if (!isSelectAllTextField(el)) return;
  requestAnimationFrame(() => {
    try {
      if (typeof el.select === 'function') {
        el.select();
      }
    } catch {
      // Some WebViews throw if the field is not focusable mid-transition.
    }
  });
}

/** Props for React inputs: onFocus / onClick → select all. */
export const selectAllTextFieldProps = Object.freeze({
  onFocus: (e) => selectAllTextInField(e.currentTarget),
  onClick: (e) => selectAllTextInField(e.currentTarget),
});

let installed = false;

/**
 * App-wide: any text/search/numeric field selects its full value on focus/tap.
 * Opt out with data-no-select-all="true" on the element.
 */
export function installSelectAllOnTextFocus() {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  const onActivate = (e) => {
    selectAllTextInField(e.target);
  };

  document.addEventListener('focusin', onActivate, true);
  document.addEventListener('click', onActivate, true);
}
