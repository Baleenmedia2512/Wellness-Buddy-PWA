import React from 'react';
import { useActivityReportHideLongPress } from './ActivityReportHideUserMenu';

/** Returns '—' for null, undefined, empty string, or the literal string "N/A" */
const display = (val) => (!val || val === 'N/A') ? '—' : val;

/**
 * Sticky member-name cell with optional long-press to open Hide User menu.
 */
export default function ActivityReportMemberNameCell({
  record,
  canHide,
  onOpenHideMenu,
}) {
  const pressHandlers = useActivityReportHideLongPress({
    enabled: canHide,
    onOpen: (anchor) => {
      onOpenHideMenu({
        ...anchor,
        userId: record.userId,
        memberName: record.memberName,
      });
    },
  });

  return (
    <td
      className={`sticky left-0 z-10 bg-white px-4 py-3 text-sm font-medium text-gray-900 min-w-[130px] shadow-[2px_0_5px_-1px_rgba(0,0,0,0.08)] ${canHide ? 'select-none touch-manipulation' : ''}`}
      title={canHide ? 'Press and hold name to hide' : undefined}
      {...pressHandlers}
    >
      {display(record.memberName)}
    </td>
  );
}
