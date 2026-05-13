/**
 * TrendTab.js — per-member activity breakdown panel.
 *
 * Renders the 7-activity grid (weight / education / breakfast / lunch
 * / dinner / water / calories) shown when a hierarchy row is expanded,
 * plus the on-time post summary. Exported as `renderExpandedDetails`
 * for `HierarchicalNode` consumption.
 */
import React from 'react';
import { BookOpen, Coffee, Utensils, Moon, Droplets, Flame } from 'lucide-react';
import BathroomScaleIcon from '../../../shared/components/icons/BathroomScaleIcon';

const scoreColor = (p) => (p >= 80 ? 'text-green-600' : p >= 50 ? 'text-yellow-600' : 'text-red-600');
const boxStyle = (p) => (p > 0 ? 'bg-green-50 border-green-300' : 'bg-white border-gray-100');
const iconColor = (p) => (p > 0 ? 'text-green-600' : 'text-gray-400');

const ActivityCell = ({ icon, val, label }) => (
  <div className={`flex flex-col items-center p-1.5 sm:p-2 rounded-lg border ${boxStyle(val)}`}>
    {icon}
    <span className={`text-xs sm:text-sm font-bold ${scoreColor(val)}`}>{val}%</span>
    <span className="text-[8px] sm:text-[9px] text-gray-400 capitalize">{label}</span>
  </div>
);

const buildCells = (a) => {
  const cls = 'h-3.5 w-3.5 sm:h-4 sm:w-4 mb-0.5 sm:mb-1';
  return [
    { val: a.weight, label: 'WEI',
      icon: <BathroomScaleIcon className={cls} variant={a.weight > 0 ? 'green' : 'red'} /> },
    { val: a.education, label: 'EDU', icon: <BookOpen className={`${cls} ${iconColor(a.education)}`} /> },
    { val: a.breakfast, label: 'BRE', icon: <Coffee className={`${cls} ${iconColor(a.breakfast)}`} /> },
    { val: a.lunch, label: 'LUN', icon: <Utensils className={`${cls} ${iconColor(a.lunch)}`} /> },
    { val: a.dinner, label: 'DIN', icon: <Moon className={`${cls} ${iconColor(a.dinner)}`} /> },
    { val: a.water, label: 'WAT', icon: <Droplets className={`${cls} ${iconColor(a.water)}`} /> },
    { val: a.caloriesBurned, label: 'CAL', icon: <Flame className={`${cls} ${iconColor(a.caloriesBurned)}`} /> },
  ];
};

const TrendTab = ({ node }) => {
  const a = node.periodDiscipline?.activities || {};
  const acts = {
    weight: a.weight || 0, education: a.education || 0,
    breakfast: a.breakfast || 0, lunch: a.lunch || 0, dinner: a.dinner || 0,
    water: a.water || 0, caloriesBurned: a.caloriesBurned || 0,
  };
  const onTime = node.periodDiscipline?.onTimePosts || a.onTimePosts || 0;
  const expected = node.periodDiscipline?.expectedPosts || a.expectedPosts || 0;
  return (
    <div className="border-t border-gray-100 bg-gray-50/50">
      <div className="p-2 sm:p-4">
        <h4 className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 sm:mb-3">
          Activity Breakdown
        </h4>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {buildCells(acts).map((c) => <ActivityCell key={c.label} {...c} />)}
        </div>
      </div>
      <div className="px-4 pb-4 pt-0 text-center">
        <p className="text-xs text-gray-400 font-medium">
          {onTime} on-time posts out of {expected} expected
        </p>
      </div>
    </div>
  );
};

export const renderExpandedDetails = (node) => <TrendTab node={node} />;
export default TrendTab;
