/**
 * textSelectionFix.js
 *
 * On focus / tap of text, search, and numeric inputs: select the full value
 * so the user can type over it immediately (same UX as Workout kcal field).
 *
 * Opt-outs / variants via data attributes:
 *   data-no-select-all="true"         — leave caret alone
 *   data-select-after-decimal="true"  — select only digits after "." (weight)
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

/**
 * Weight-style fields: keep the whole-kg digits, select only the fractional part
 * after the decimal so the user can tweak 72.50 → 72.xx without retyping 72.
 * @param {HTMLInputElement | HTMLTextAreaElement} el
 */
export function selectAfterDecimalInField(el) {
  const value = String(el.value ?? '');
  const dot = value.indexOf('.');
  requestAnimationFrame(() => {
    try {
      if (typeof el.setSelectionRange !== 'function') return;
      if (dot >= 0 && dot < value.length - 1) {
        el.setSelectionRange(dot + 1, value.length);
      } else if (dot >= 0) {
        el.setSelectionRange(dot + 1, dot + 1);
      } else {
        // No decimal yet — place caret at end (do not select the whole number).
        el.setSelectionRange(value.length, value.length);
      }
    } catch {
      // Some WebViews throw if the field is not focusable mid-transition.
    }
  });
}

/** Select entire value; rAF so it wins over browser caret placement on mobile. */
export function selectAllTextInField(el) {
  if (!(el instanceof HTMLElement)) return;
  if (el.dataset?.selectAfterDecimal === 'true') {
    if (el.readOnly || el.disabled) return;
    selectAfterDecimalInField(/** @type {HTMLInputElement} */ (el));
    return;
  }
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
let selectionGuardInstalled = false;

/**
 * App-wide: any text/search/numeric field selects its full value on focus/tap.
 * Opt out with data-no-select-all="true" on the element.
 * Weight fields: data-select-after-decimal="true".
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

/** Form fields where copy / paste / Select all must still work. */
export const EDITABLE_SELECTION_SELECTOR =
  'input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]';

/**
 * True when the event target is (or is inside) a real text field.
 * Dashboard labels, names, and scores are not editable — those must not
 * open Android's Copy / Select all toolbar.
 * @param {EventTarget | Node | null | undefined} target
 */
export function isEditableSelectionTarget(target) {
  if (!target) return false;
  let el = target;
  if (el.nodeType === 3) {
    el = el.parentElement;
  }
  if (!el || typeof el.closest !== 'function') return false;
  if (el.isContentEditable) return true;
  return Boolean(el.closest(EDITABLE_SELECTION_SELECTOR));
}

/**
 * Block Android WebView Copy / Select all on non-input UI.
 * Paste still works inside OTP, email, food name, and other fields.
 */
export function installDisableNonEditableSelection() {
  if (selectionGuardInstalled || typeof document === 'undefined') return;
  selectionGuardInstalled = true;

  const blockIfNonEditable = (e) => {
    if (isEditableSelectionTarget(e.target)) return;
    e.preventDefault();
  };

  document.addEventListener('selectstart', blockIfNonEditable, true);
  document.addEventListener('contextmenu', blockIfNonEditable, true);
  document.addEventListener('copy', blockIfNonEditable, true);
  document.addEventListener('cut', blockIfNonEditable, true);

  document.addEventListener('selectionchange', () => {
    if (isEditableSelectionTarget(document.activeElement)) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    if (isEditableSelectionTarget(sel.anchorNode)) return;
    sel.removeAllRanges();
  });
}
