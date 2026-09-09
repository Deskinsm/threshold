/** Dynamic-import failures are network/HMR, not a poisoned save. Reload recovers them. */
export function isTransientShellError(error: { message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return /Failed to fetch dynamically imported module|Loading chunk [\w.-]+ failed|Importing a module script failed/i.test(
    message,
  );
}
