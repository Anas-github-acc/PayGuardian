export const apiVersion = "v1" as const;

export type HealthResponse = {
  status: "ok";
  service: string;
  phase: string;
};
