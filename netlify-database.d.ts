declare module "@netlify/database" {
  export function getDatabase(): { sql: any; pool: any };
}
