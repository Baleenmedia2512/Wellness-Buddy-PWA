/**
 * auth-helpers.js — Authentication helper utilities
 * 
 * Provides user ID extraction from session/token
 * Reuses existing auth patterns from the codebase
 */

/**
 * Get user ID from request session/headers
 * Adapt this based on your existing auth implementation
 * 
 * @param {Object} req - Express/Next.js request object
 * @returns {string|null} - User ID or null if not authenticated
 */
function getUserIdFromSession(req) {
  // Method 1: Check Authorization header (JWT)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      // Decode JWT and extract user ID
      // const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // return decoded.userId;
      
      // Placeholder - implement based on your JWT strategy
      return null;
    } catch (error) {
      return null;
    }
  }
  
  // Method 2: Check session cookie
  if (req.cookies && req.cookies.userId) {
    return req.cookies.userId;
  }
  
  // Method 3: Check query param (for development only)
  if (process.env.NODE_ENV === 'development' && req.query.userId) {
    return req.query.userId;
  }
  
  // Method 4: Check body for userId (temporary - for testing)
  if (req.body && req.body.userId) {
    return req.body.userId;
  }
  
  return null;
}

/**
 * Verify user has permission to access a resource
 * 
 * @param {string} userId - Requesting user ID
 * @param {string} resourceUserId - Resource owner user ID
 * @returns {boolean} - True if allowed
 */
function canAccessUserResource(userId, resourceUserId) {
  // Users can only access their own resources
  return userId === resourceUserId;
}

module.exports = {
  getUserIdFromSession,
  canAccessUserResource
};
