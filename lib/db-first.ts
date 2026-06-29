export type SourceMode = "database" | "demo";

export async function dbFirstValue<T>(database: () => Promise<T>, demo: () => T): Promise<{ value: T; sourceMode: SourceMode }> {
  try {
    return { value: await database(), sourceMode: "database" };
  } catch {
    return { value: demo(), sourceMode: "demo" };
  }
}
