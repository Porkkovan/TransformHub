/**
 * Tests for RBAC helper functions.
 * These do not require a DB connection.
 */
import { hasRole, canAccess, ROLE_HIERARCHY } from "@/lib/rbac";

describe("hasRole", () => {
  it("SUPER_ADMIN has all roles", () => {
    expect(hasRole("SUPER_ADMIN", "VIEWER")).toBe(true);
    expect(hasRole("SUPER_ADMIN", "ANALYST")).toBe(true);
    expect(hasRole("SUPER_ADMIN", "ADMIN")).toBe(true);
    expect(hasRole("SUPER_ADMIN", "SUPER_ADMIN")).toBe(true);
  });

  it("ADMIN has ANALYST and VIEWER but not SUPER_ADMIN", () => {
    expect(hasRole("ADMIN", "VIEWER")).toBe(true);
    expect(hasRole("ADMIN", "ANALYST")).toBe(true);
    expect(hasRole("ADMIN", "ADMIN")).toBe(true);
    expect(hasRole("ADMIN", "SUPER_ADMIN")).toBe(false);
  });

  it("ANALYST does not have ADMIN", () => {
    expect(hasRole("ANALYST", "ANALYST")).toBe(true);
    expect(hasRole("ANALYST", "ADMIN")).toBe(false);
  });

  it("VIEWER is lowest", () => {
    expect(hasRole("VIEWER", "VIEWER")).toBe(true);
    expect(hasRole("VIEWER", "ANALYST")).toBe(false);
  });

  it("legacy MEMBER maps to ANALYST level", () => {
    expect(hasRole("MEMBER", "VIEWER")).toBe(true);
    expect(hasRole("MEMBER", "ANALYST")).toBe(true);
    expect(hasRole("MEMBER", "ADMIN")).toBe(false);
  });

  it("undefined role returns false", () => {
    expect(hasRole(undefined, "VIEWER")).toBe(false);
  });
});

describe("canAccess", () => {
  it("ADMIN can manage org", () => {
    expect(canAccess("ADMIN", "organizations:manage")).toBe(true);
  });

  it("VIEWER cannot execute agents", () => {
    expect(canAccess("VIEWER", "agents:execute")).toBe(false);
  });

  it("ANALYST can execute agents", () => {
    expect(canAccess("ANALYST", "agents:execute")).toBe(true);
  });

  it("SUPER_ADMIN has platform:super_admin", () => {
    expect(canAccess("SUPER_ADMIN", "platform:super_admin")).toBe(true);
  });

  it("ADMIN does not have platform:super_admin", () => {
    expect(canAccess("ADMIN", "platform:super_admin")).toBe(false);
  });
});

describe("ROLE_HIERARCHY", () => {
  it("has all 4 roles", () => {
    expect(ROLE_HIERARCHY["VIEWER"]).toBe(0);
    expect(ROLE_HIERARCHY["ANALYST"]).toBe(1);
    expect(ROLE_HIERARCHY["ADMIN"]).toBe(2);
    expect(ROLE_HIERARCHY["SUPER_ADMIN"]).toBe(3);
  });
});
