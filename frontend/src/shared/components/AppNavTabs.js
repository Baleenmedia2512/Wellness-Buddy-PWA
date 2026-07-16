// Eight-tab app navigation — responsive from iPhone SE (320px) to Pro Max.
// The container uses overflow-x-auto so extra tabs scroll naturally on small screens.
import React from 'react';
import {
  Home,
  LayoutDashboard,
  BarChart2,
  GraduationCap,
  Heart,
  Map,
  Trophy,
  FileBarChart,
} from 'lucide-react';
import NavTabButton from './NavTabButton';

export default function AppNavTabs({
  activePage,
  onShowHome,
  onShowBackgroundHistory,
  onShowActivityReport,
  onShowWellnessEnrollment,
  onShowWellnessCounselling,
  onShowNutritionCentersMap,
  onShowTestimonials,
  onShowReports,
  reportsEnabled = false,
}) {
  return (
    <div
      className="max-w-lg mx-auto px-0.5 xxs:px-1 xs:px-2 flex items-center justify-around overflow-x-auto scrollbar-hide w-full"
      style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
    >
      <NavTabButton
        onClick={onShowHome ?? (() => {})}
        active={activePage === 'home'}
        icon={Home}
        label="Home"
      />
      <NavTabButton
        onClick={() => (onShowBackgroundHistory ?? (() => {}))()}
        active={activePage === 'dashboard'}
        icon={LayoutDashboard}
        label="Diary"
      />
      <NavTabButton
        onClick={onShowActivityReport ?? (() => {})}
        active={activePage === 'activity-report'}
        activeBg="bg-violet-100"
        hoverBg="hover:bg-violet-50"
        icon={BarChart2}
        iconActiveClass="text-teal-700"
        iconClass="text-teal-600"
        labelActiveClass="text-teal-900"
        labelClass="text-teal-800"
        label="Activity"
        ariaLabel="Activity Report"
      />
      <NavTabButton
        onClick={onShowWellnessEnrollment ?? (() => {})}
        active={activePage === 'enrollment'}
        activeBg="bg-emerald-100"
        hoverBg="hover:bg-emerald-50"
        icon={GraduationCap}
        iconActiveClass="text-emerald-800"
        iconClass="text-emerald-700"
        labelActiveClass="text-emerald-900"
        labelClass="text-emerald-800"
        label="Enroll"
        ariaLabel="Enrollment"
      />
      <NavTabButton
        onClick={onShowWellnessCounselling ?? (() => {})}
        active={activePage === 'counselling'}
        activeBg="bg-pink-100"
        hoverBg="hover:bg-pink-50"
        icon={Heart}
        iconActiveClass="text-teal-700"
        iconClass="text-teal-600"
        labelActiveClass="text-teal-900"
        labelClass="text-teal-800"
        label="Counsel"
        ariaLabel="Counselling"
      />
      <NavTabButton
        onClick={onShowNutritionCentersMap ?? (() => {})}
        active={activePage === 'physical-club'}
        activeBg="bg-teal-100"
        hoverBg="hover:bg-teal-50"
        icon={Map}
        iconActiveClass="text-teal-700"
        iconClass="text-teal-600"
        labelActiveClass="text-teal-900"
        labelClass="text-teal-800"
        label="Club"
        ariaLabel="Physical Club"
      />
      <NavTabButton
        onClick={onShowTestimonials ?? (() => {})}
        active={activePage === 'testimonials'}
        activeBg="bg-yellow-100"
        hoverBg="hover:bg-yellow-50"
        icon={Trophy}
        iconActiveClass="text-yellow-700"
        iconClass="text-yellow-600"
        labelActiveClass="text-yellow-900"
        labelClass="text-yellow-800"
        label="Results"
        ariaLabel="Testimonials"
      />
      {reportsEnabled && (
        <NavTabButton
          onClick={onShowReports ?? (() => {})}
          active={activePage === 'reports'}
          activeBg="bg-indigo-100"
          hoverBg="hover:bg-indigo-50"
          icon={FileBarChart}
          iconActiveClass="text-indigo-700"
          iconClass="text-indigo-600"
          labelActiveClass="text-indigo-900"
          labelClass="text-indigo-800"
          label="Reports"
          ariaLabel="Reports"
        />
      )}
    </div>
  );
}
