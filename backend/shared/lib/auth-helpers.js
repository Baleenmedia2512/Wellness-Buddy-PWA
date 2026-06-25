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
  // Method 1: Check query param (for development/testing - temporary)
  // This allows the tasks API to work without full auth implementation
  if (req.query && req.query.userId) {
    return String(req.query.userId);
  }
  
  // Method 2: Check body for userId (for POST requests - temporary)
  if (req.body && req.body.userId) {
    return String(req.body.userId);
  }
  
  // Method 3: Check Authorization header (JWT)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      // TODO: Decode JWT and extract user ID when proper auth is implemented
      // const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // return decoded.userId;
      
      // Placeholder - implement based on your JWT strategy
      return null;
    } catch (error) {
      return null;
    }
  }
  
  // Method 4: Check session cookie
  if (req.cookies && req.cookies.userId) {
    return req.cookies.userId;
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

export {
  getUserIdFromSession,
  canAccessUserResource
};
