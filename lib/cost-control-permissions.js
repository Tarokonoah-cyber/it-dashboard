import "server-only";
import { requireDashboardAuth } from "./auth";

// The current project has one dashboard account and no role/department model.
// Keep this boundary explicit so a future role provider can replace it without
// changing the import routes or trusting a client-supplied role.
export function requireCostControlImportAuth(request) {
  return requireDashboardAuth(request);
}

export function costControlPermissionSummary() {
  return {
    canView: true,
    canImport: true,
    fixedDepartment: null,
    roleSystem: false,
    basis: "dashboard-auth"
  };
}
