/**
 * Search Coaches
 * GET /api/users/search?q={query}
 *
 * Search for sponsors by name, email, phone, or Community ID (Herbalife ID).
 * Only users with both a verified account email and a Community ID are
 * returned. Email alone is not enough to appear as a sponsor.
 * Used in upline / sponsor selection during onboarding.
 * Returns the full email so the member can confirm they picked the right coach.
 */

import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import { filterPublicAggregateUsers } from '../../../features/user/domain/aggregate-eligibility.rules.js';
import {
  rankSponsorSearchUsers,
  restoreDeveloperBotInSponsorSearch,
} from '../../../features/user/domain/developerBot.rules.js';
import { isEligibleSponsor } from '../../../features/user/domain/sponsorVisibility.rules.js';

export default async function handler(req, res) {
  // Prevent browser/service worker caching of dynamic data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, authorization, cache-control, pragma');
    res.status(200).end();
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, authorization, cache-control, pragma');

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
    return;
  }

  try {
    // Get search query and current user email from URL params
    const { q, email: currentUserEmail } = req.query;

    if (!q || q.trim().length < 2) {
      res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
      return;
    }

    // Keep `.` and `@` so email / Community ID queries still match.
    // Strip chars that break PostgREST `.or()` filters or act as LIKE wildcards.
    const searchQuery = String(q || '')
      .trim()
      .replace(/[,%()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const searchDigits = searchQuery.replace(/\D/g, '');
    if (searchQuery.length < 2 && searchDigits.length < 2) {
      res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
      return;
    }

    // Connect to Supabase
    const supabase = getSupabaseClient();

    // Search by name, email, phone, or Community ID (Herbalife ID), excluding current user.
    // Email and Community ID are both required on the sponsor row.
    const orParts = [
      `UserName.ilike.%${searchQuery}%`,
      `Email.ilike.%${searchQuery}%`,
      `CommunityId.ilike.%${searchQuery}%`,
    ];
    if (searchDigits.length >= 2) {
      orParts.push(`PhoneNumber.ilike.%${searchDigits}%`);
    }

    const { data: coaches, error } = await supabase
      .from('team_table')
      .select('UserId, UserName, Email, TeamId, Role, PhoneNumber, CommunityId')
      .eq('Status', 'Active')
      .not('Email', 'is', null)
      .neq('Email', '')
      .not('CommunityId', 'is', null)
      .neq('CommunityId', '')
      .neq('Email', currentUserEmail || '')
      .or(orParts.join(','))
      .order('UserName', { ascending: true })
      .limit(20);

    if (error) throw error;

    const eligibleSponsors = (coaches || []).filter(isEligibleSponsor);

    const eligibleCoaches = rankSponsorSearchUsers(
      restoreDeveloperBotInSponsorSearch(
        eligibleSponsors,
        filterPublicAggregateUsers(eligibleSponsors),
      ),
    );

    // Full email for confirmation; dedupe by email (case-insensitive)
    const seenEmails = new Set();
    const results = (eligibleCoaches || []).reduce((acc, coach) => {
      const emailKey = (coach.Email || '').toLowerCase();
      if (!emailKey || seenEmails.has(emailKey)) return acc;
      seenEmails.add(emailKey);
      acc.push({
        userId: coach.UserId,
        userName: coach.UserName,
        email: coach.Email,
        displayName: coach.UserName,
        teamId: coach.TeamId,
        hasTeamId: !!coach.TeamId
      });
      return acc;
    }, []);

    res.status(200).json({
      success: true,
      query: searchQuery,
      count: results.length,
      coaches: results,
      message: results.length === 0 ? 'No coaches found matching your search' : undefined
    });
    return;

  } catch (error) {
    console.error('Error searching coaches:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to search coaches',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
    return;
  }
}
