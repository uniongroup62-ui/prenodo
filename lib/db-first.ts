export type SourceMode = "database" | "demo";

export async function dbFirstValue<T>(database: () => Promise<T>, demo: () => T): Promise<{ value: T; sourceMode: SourceMode }> {
  try {
    return { value: await database(), sourceMode: "database" };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[dbFirst] DB path failed, falling back to demo:", error instanceof Error ? error.stack ?? error.message : error);
    }
    return { value: demo(), sourceMode: "demo" };
  }
}
