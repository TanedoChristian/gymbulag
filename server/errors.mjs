// An error with an HTTP status, shown to the user as-is (status 500s are logged and hidden instead).
// Lives in its own module so any server module can use it without import cycles.
export class AuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
