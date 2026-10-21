
import React, { useEffect, useState } from 'react';

import { getCenters } from '../../../nutrition-centers/services/centers.api.js';


const WorkingPhysicalCentreField = ({
  value = '',
  onChange,
  userId,
}) => {
  
  const [centres, setCentres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadCentres() {
      setLoading(true);
      setError('');

      try {
        const response = await getCenters({
          userId: String(userId ?? ''),
          scope: 'all',
          metrics: 'false',
          paginate: 'false',
        });

        if (cancelled) return;

        if (!response?.success || !Array.isArray(response.data)) {
          throw new Error(
            response?.error?.message ||
              response?.message ||
              'Unable to load physical centres.',
          );
        }

        const validCentres = response.data
          .filter((centre) => centre?.id != null && centre?.center_name)
          .map((centre) => ({
            id: String(centre.id),
            name: centre.center_name,
          }));

        setCentres(validCentres);

        if (validCentres.length === 0) {
          setError('No physical centres were returned by the API.');
        }
      } catch (err) {
        if (!cancelled) {
          setCentres([]);
          setError(err.message || 'Unable to load physical centres.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCentres();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return (
    <div>
        <p style={{ color: 'red', fontWeight: 'bold' }}>
        
        </p>

        <label className="block text-sm font-medium text-gray-700 mb-1">
        Working Physical Centre
        </label>

      <select
        value={String(value ?? '')}
        onChange={(event) => onChange?.(event.target.value)}
        disabled={loading}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none disabled:bg-gray-100"
        style={{ fontSize: '16px' }}
      >
        <option value="">
          {loading ? 'Loading centres...' : 'Select physical centre'}
        </option>

        {centres.map((centre) => (
      <option key={centre.id} value={String(centre.id)}>
        {centre.center_name || centre.name}
      </option>
    ))}
      </select>

      {error && (
        <p className="text-xs text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
};

export default WorkingPhysicalCentreField;
