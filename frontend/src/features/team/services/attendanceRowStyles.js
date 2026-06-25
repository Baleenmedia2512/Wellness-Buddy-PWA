/**
 * attendanceRowStyles.js — status-driven Tailwind class bundles.
 *
 * Pure presentation helper consumed by `HierarchicalNode` to colour
 * each row based on attendance state and current-user highlighting.
 */
export function getStatusStyle(node, level, isCurrentUser) {
  const attended = node.metrics?.attended === true;
  if (isCurrentUser && attended) {
    return {
      containerClass: 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300 shadow-md',
      avatarClass: 'bg-yellow-400 border-yellow-500 text-white',
      nameClass: 'text-yellow-900',
      statsBorderClass: 'border-yellow-200 divide-yellow-200',
    };
  }
  if (attended) {
    return {
      containerClass: 'bg-white border-green-200 shadow-sm',
      avatarClass: 'bg-green-100 border-green-400 text-green-700',
      nameClass: 'text-gray-900',
      statsBorderClass: 'border-green-100 divide-green-100',
    };
  }
  return {
    containerClass: 'bg-gray-50 border-gray-200',
    avatarClass: 'bg-gray-200 border-gray-300 text-gray-500',
    nameClass: 'text-gray-500',
    statsBorderClass: 'border-gray-100 divide-gray-100',
  };
}
