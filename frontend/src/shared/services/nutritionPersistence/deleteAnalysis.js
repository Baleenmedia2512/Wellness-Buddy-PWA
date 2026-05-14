// DELETE /api/background-analysis — removes a saved nutrition record by ID.
export async function deleteNutritionAnalysis({ id, userId }) {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
  try {
    const res = await fetch(`${apiBaseUrl}/api/background-analysis`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, userId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete analysis');
    return data;
  } catch (err) {
    console.error('[deleteNutritionAnalysis] Error:', err);
    throw err;
  }
}
