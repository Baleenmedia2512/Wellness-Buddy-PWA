// App top navigation — responsive from iPhone SE (320px) to Pro Max.
// The container uses overflow-x-auto so extra tabs scroll naturally on small screens.
// Page switches remount Header, so scroll is restored + active tab is scrolled into view.
import React, { useEffect, useRef } from 'react';
import {
  Home,
  LayoutDashboard,
  BarChart2,
  GraduationCap,
  Heart,
  Map,
  Trophy,
  FileBarChart,
  Megaphone,
  CalendarPlus,
  Sparkles,
  MapPinned,
  CalendarDays,
  ScanLine,
} from 'lucide-react';
import NavTabButton from './NavTabButton';
import { isFlagEnabled } from '../../config/featureFlags';
import { canAccessNavPage } from '../../features/nav-page-access/domain/navAccess.rules.js';

/** Survives Header remount when switching pages (Home → Reports, etc.). */
let savedNavScrollLeft = 0;

export default function AppNavTabs({
  activePage,
  onShowHome,
  onShowEvents,
  onShowBackgroundHistory,
  onShowActivityReport,
  onShowWellnessEnrollment,
  onShowWellnessCounselling,
  onShowNutritionCentersMap,
  onShowTestimonials,
  onShowBroadcast,
  onShowCreateEvent,
  onShowPaidFeatures,
  onShowMapBusiness,
  onShowEventCheckIn,
  onShowReports,
  reportsEnabled = false,
  /** null = fail-open (all tabs); object = role page map from DB */
  allowedPages = null,
}) {
  const allow = (pageKey) => canAccessNavPage(allowedPages, pageKey);
  const broadcastEnabled = isFlagEnabled('ff.broadcast');
  const createEventEnabled = isFlagEnabled('ff.create-event');
  const paidFeaturesEnabled = isFlagEnabled('ff.coach-portfolio');
  const mapBusinessEnabled = isFlagEnabled('ff.gbp-listing');
  const upcomingEventsEnabled = isFlagEnabled('ff.events');
  const scrollerRef = useRef(null);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return undefined;
    const onScroll = () => {
      savedNavScrollLeft = root.scrollLeft;
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return undefined;

    // Restore last scroll first so remount doesn't flash at Home.
    root.scrollLeft = savedNavScrollLeft;

    const activeEl = root.querySelector('[aria-current="page"]');
    if (activeEl && typeof activeEl.scrollIntoView === 'function') {
      // Keep Reports / late tabs visible after page remount.
      requestAnimationFrame(() => {
        activeEl.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'auto' });
        savedNavScrollLeft = root.scrollLeft;
      });
    }
    return undefined;
  }, [activePage]);

  return (
    <div
      ref={scrollerRef}
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
      {upcomingEventsEnabled && allow('events') && (
        <NavTabButton
          onClick={onShowEvents ?? (() => {})}
          active={activePage === 'events' || activePage === 'create-event'}
          icon={CalendarDays}
          label="Events"
          ariaLabel="Events"
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
      {broadcastEnabled && allow('broadcast') && (
        <NavTabButton
          onClick={onShowBroadcast ?? (() => {})}
          active={activePage === 'broadcast'}
          activeBg="bg-emerald-100"
          hoverBg="hover:bg-emerald-50"
          icon={Megaphone}
          iconActiveClass="text-emerald-800"
          iconClass="text-emerald-700"
          labelActiveClass="text-emerald-900"
          labelClass="text-emerald-800"
          label="BroadCast"
          ariaLabel="BroadCast"
        />
      )}

      {paidFeaturesEnabled && allow('paid-features') && (
        <NavTabButton
          onClick={onShowPaidFeatures ?? (() => {})}
          active={activePage === 'paid-features'}
          activeBg="bg-emerald-100"
          hoverBg="hover:bg-emerald-50"
          icon={Sparkles}
          iconActiveClass="text-emerald-800"
          iconClass="text-emerald-700"
          labelActiveClass="text-emerald-900"
          labelClass="text-emerald-800"
          label="Digital Portfolio"
          ariaLabel="Digital Portfolio"
        />
      )}
      {mapBusinessEnabled && allow('map-business') && (
        <NavTabButton
          onClick={onShowMapBusiness ?? (() => {})}
          active={activePage === 'map-business'}
          activeBg="bg-emerald-100"
          hoverBg="hover:bg-emerald-50"
          icon={MapPinned}
          iconActiveClass="text-emerald-800"
          iconClass="text-emerald-700"
          labelActiveClass="text-emerald-900"
          labelClass="text-emerald-800"
          label="Google Map Business"
          ariaLabel="Google Map Business"
        />
      )}
      {createEventEnabled && allow('event-check-in') && (
        <NavTabButton
          onClick={onShowEventCheckIn ?? onShowCreateEvent ?? (() => {})}
          active={activePage === 'event-check-in'}
          activeBg="bg-emerald-100"
          hoverBg="hover:bg-emerald-50"
          icon={ScanLine}
          iconActiveClass="text-emerald-800"
          iconClass="text-emerald-700"
          labelActiveClass="text-emerald-900"
          labelClass="text-emerald-800"
          label="Check-in"
          ariaLabel="Event Check-in"
        />
      )}
    </div>
  );
}
