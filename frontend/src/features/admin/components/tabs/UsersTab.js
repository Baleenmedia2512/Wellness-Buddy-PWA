/**
 * UsersTab.js — searchable, sortable, paginated user spending list.
 */
import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import SearchSortBar from '../shared/SearchSortBar';
import UserCard from '../shared/UserCard';
import PaginationBar from '../shared/PaginationBar';
import EmptyState from '../shared/EmptyState';
import AdminSkeleton from '../shared/AdminSkeleton';
import ErrorBanner from '../shared/ErrorBanner';
import usePagination from '../../hooks/usePagination';

export default function UsersTab({ loading, apiError, filteredAndSortedUsers, searchQuery, setSearchQuery, sortField, sortDirection, onToggleSort }) {
  const [expandedUserId, setExpandedUserId] = useState(null);
  const pagination = usePagination(filteredAndSortedUsers, 10);

  if (loading) return <AdminSkeleton showStats={false} rows={5} />;

  return (
    <div className="space-y-4">
      <ErrorBanner apiError={apiError} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-50 bg-gray-50/50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider">User Spending</h2>
            <span className="text-xs text-gray-400">{filteredAndSortedUsers.length} users</span>
          </div>
          <SearchSortBar
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            sortField={sortField} sortDirection={sortDirection} onToggleSort={onToggleSort}
          />
        </div>

        <div className="space-y-3 p-4">
          {filteredAndSortedUsers.length > 0 ? (
            <AnimatePresence>
              {pagination.paginatedItems.map((user, index) => (
                <UserCard key={user.userId || index} user={user}
                  expanded={expandedUserId === user.userId}
                  onToggle={() => setExpandedUserId(expandedUserId === user.userId ? null : user.userId)} />
              ))}
            </AnimatePresence>
          ) : (
            <EmptyState apiError={apiError} searchQuery={searchQuery} />
          )}
        </div>

        {filteredAndSortedUsers.length > 0 && (
          <PaginationBar
            currentPage={pagination.currentPage} totalPages={pagination.totalPages}
            itemsPerPage={pagination.itemsPerPage}
            startIndex={pagination.startIndex} endIndex={pagination.endIndex}
            totalItems={filteredAndSortedUsers.length}
            goPrev={pagination.goPrev} goNext={pagination.goNext}
            goPage={pagination.goPage} changePageSize={pagination.changePageSize}
          />
        )}
      </motion.div>
    </div>
  );
}
