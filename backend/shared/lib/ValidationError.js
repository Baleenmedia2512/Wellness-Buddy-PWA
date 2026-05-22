/**
 * Shared ValidationError used across all feature validators.
 * Carries an HTTP status code so route handlers can respond correctly.
 */
export class ValidationError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'ValidationError';
  }
}
