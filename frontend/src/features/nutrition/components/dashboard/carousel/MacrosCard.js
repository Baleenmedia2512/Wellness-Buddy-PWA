import React from 'react';
import { Beef, Droplet, Wheat } from 'lucide-react';
import CircularProgress from './CircularProgress';
import CarouselPeriodHeader from './CarouselPeriodHeader';

/**
 * MacrosCard — Card 2 of the Nutrition Carousel.
 * layout="grid" (default): 3 macros side by side for the Home carousel.
 * layout="stack": Carbs, Fat, Protein stacked vertically for Reports Nutrition.
 */
const MacrosCard = ({
  consumedProtein,
  consumedFat,
  consumedCarbs,
  proteinTarget,
  fatTarget,
  carbsTarget,
  periodContext,
  onOpenModal,
  layout = 'grid',
}) => {
  const hasTargets = proteinTarget != null;
  const isStack = layout === 'stack';

  const proteinPct = hasTargets && proteinTarget > 0 ? Math.round((consumedProtein / proteinTarget) * 100) : null;
  const fatPct = hasTargets && fatTarget > 0 ? Math.round((consumedFat / fatTarget) * 100) : null;
  const carbsPct = hasTargets && carbsTarget > 0 ? Math.round((consumedCarbs / carbsTarget) * 100) : null;

  const items = [
    {
      key: 'carbs',
      label: 'Carbs',
      Icon: Wheat,
      iconClass: 'text-orange-500',
      color: 'from-orange-400 to-amber-400',
      consumed: consumedCarbs,
      target: carbsTarget,
      pct: carbsPct,
    },
    {
      key: 'fat',
      label: 'Fat',
      Icon: Droplet,
      iconClass: 'text-yellow-500',
      color: 'from-yellow-400 to-amber-500',
      consumed: consumedFat,
      target: fatTarget,
      pct: fatPct,
    },
    {
      key: 'protein',
      label: 'Protein',
      Icon: Beef,
      iconClass: 'text-blue-500',
      color: 'from-blue-400 to-indigo-500',
      consumed: consumedProtein,
      target: proteinTarget,
      pct: proteinPct,
    },
  ];

  return (
    <div className="h-full flex items-center justify-center py-2">
      <div className="bg-white rounded-xl shadow-lg p-3 w-full">
        <CarouselPeriodHeader periodContext={periodContext} />
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-md">
              <Beef className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-base font-bold text-gray-900">Macros</span>
          </div>
          {!hasTargets && (
            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              Log weight
            </span>
          )}
        </div>

        <div className={isStack ? 'flex flex-col' : 'grid grid-cols-3 gap-3'}>
          {items.map((item) => (
            <MacroItem
              key={item.key}
              item={item}
              hasTargets={hasTargets}
              isStack={isStack}
              onOpenModal={onOpenModal}
            />
          ))}
        </div>

        {/* Footer */}
        {hasTargets && (
          <p className="text-[9px] text-gray-400 text-center mt-1.5 pt-1.5 border-t border-gray-100">
            {periodContext?.isMultiDay
              ? 'Total macros achieved vs period macro goals'
              : 'Targets based on your weight'}
          </p>
        )}
      </div>
    </div>
  );
};

function MacroItem({ item, hasTargets, isStack, onOpenModal }) {
  const { key, label, Icon, iconClass, color, consumed, target, pct } = item;
  const consumedLabel = `${Math.round(consumed || 0)}g`;

  const circle = pct != null ? (
    <CircularProgress
      percentage={pct}
      color={color}
      size={60}
      strokeWidth={5}
      targetLabel={target != null ? `${target}g` : undefined}
      onClick={isStack ? undefined : () => onOpenModal && onOpenModal(key)}
    />
  ) : (
    <div className={`w-[60px] h-[60px] rounded-full bg-gray-100 flex items-center justify-center ${isStack ? '' : 'mx-auto'}`}>
      <span className="text-xs text-gray-400 font-medium">?</span>
    </div>
  );

  if (isStack) {
    return (
      <div
        className={`flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-b-0 ${
          onOpenModal ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''
        }`}
        onClick={() => onOpenModal && onOpenModal(key)}
        role={onOpenModal ? 'button' : undefined}
        tabIndex={onOpenModal ? 0 : undefined}
        onKeyPress={onOpenModal ? (e) => { if (e.key === 'Enter' || e.key === ' ') onOpenModal(key); } : undefined}
      >
        <div className="shrink-0 pointer-events-none">{circle}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 mb-0.5">
            <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
            <p className="text-sm font-semibold text-gray-700">{label}</p>
          </div>
          {hasTargets ? (
            <p className="text-sm font-bold text-gray-900">
              {consumedLabel}
              <span className="text-xs font-normal text-gray-500"> / {target}g</span>
            </p>
          ) : (
            <>
              <p className="text-sm font-bold text-gray-900">{consumedLabel}</p>
              <p className="text-[8px] text-amber-600">No target</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      {circle}
      <div className="mt-1">
        <div className="flex items-center justify-center gap-0.5 mb-0.5">
          <Icon className={`w-3 h-3 ${iconClass}`} />
          <p className="text-[10px] font-semibold text-gray-700">{label}</p>
        </div>
        <p className="text-xs font-bold text-gray-900">{consumedLabel}</p>
        {hasTargets && <p className="text-[9px] text-gray-500">/ {target}g</p>}
        {!hasTargets && <p className="text-[8px] text-amber-600">No target</p>}
      </div>
    </div>
  );
}

export default MacrosCard;
