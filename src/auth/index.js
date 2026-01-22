// Authorization module - Public API
// Validates user permissions before command execution

// Re-export all public functions from validator and errors modules
export { hasWriteAccess, getAuthContext, checkAuthorization } from "./validator.js";
export { AuthorizationError, formatAuthorizationError } from "./errors.js";
