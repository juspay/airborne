/** A 4xx is a refusal; a missing answer or 5xx may follow a committed write. */
export function isUnconfirmedWrite(error: unknown): boolean {
  const status = (error as { status?: number } | undefined)?.status;
  return status === undefined || status >= 500;
}
