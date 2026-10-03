// App top navigation — responsive from iPhone SE (320px) to Pro Max.
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
import { canAccessNavPage } from '../../features/nav-page-access/domain/navAccess.rules.js';

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
  /** null = fail-open (all tabs); object = role page map from DB */
  allowedPages = null,
}) {
  const allow = (pageKey) => canAccessNavPage(allowedPages, pageKey);

  return (
    <div
      className="max-w-lg mx-auto px-0.5 xxs:px-1 xs:px-2 flex items-center justify-around overflow-x-auto scrollbar-hide w-full"
      style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
    >
      {allow('home') && (
        <NavTabButton
          onClick={onShowHome ?? (() => {})}
          active={activePage === 'home'}
          icon={Home}
          label="Home"
        />
      )}
      {allow('dashboard') && (
        <NavTabButton
          onClick={() => (onShowBackgroundHistory ?? (() => {}))()}
          active={activePage === 'dashboard'}
          icon={LayoutDashboard}
          label="Diary"
        />
      )}
      {allow('activity-report') && (
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
      )}
      {allow('enrollment') && (
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
          label="Programmes"
          ariaLabel="Enrollment"
        />
      )}
      {allow('counselling') && (
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
          label="BCM"
          ariaLabel="Counselling"
        />
      )}
      {allow('physical-club') && (
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
      )}
      {allow('testimonials') && (
        <NavTabButton
          onClick={onShowTestimonials ?? (() => {})}
          active={activePage === 'testimonials'}
          activeBg="bg-teal-100"
          hoverBg="hover:bg-teal-50"
          icon={Trophy}
          iconActiveClass="text-teal-700"
          iconClass="text-teal-600"
          labelActiveClass="text-teal-900"
          labelClass="text-teal-700"
          label="Transformation"
          ariaLabel="Testimonials"
        />
      )}
      {reportsEnabled && allow('reports') && (
        <NavTabButton
          onClick={onShowReports ?? (() => {})}
          active={activePage === 'reports'}
          activeBg="bg-teal-100"
          hoverBg="hover:bg-teal-50"
          icon={FileBarChart}
          iconActiveClass="text-teal-700"
          iconClass="text-teal-600"
          labelActiveClass="text-teal-900"
          labelClass="text-teal-700"
          label="Reports"
          ariaLabel="Reports Dashboard"
        />
      )}
    </div>
  );
}
