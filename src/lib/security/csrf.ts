export function shouldApplyCsrfProtection(context: { handlerType: string }): boolean {
  return context.handlerType === "serverFn";
}
