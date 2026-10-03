export type GoogleErrorKind = "timeout" | "http" | "network" | "config" | "auth";

export class GoogleError extends Error {
  constructor(
    public kind: GoogleErrorKind,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "GoogleError";
  }
}
