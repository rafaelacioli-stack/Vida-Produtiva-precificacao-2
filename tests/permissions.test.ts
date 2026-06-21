import { describe, expect, it } from "vitest";
import { canReplaceBusinesses } from "../lib/permissions";

describe("permissões dos negócios compartilhados", () => {
  const existing = [{ id: "a" }, { id: "b" }];

  it("permite que voluntários editem e acrescentem negócios", () => {
    expect(canReplaceBusinesses("volunteer", existing, [{ id: "a", name: "Editado" }, { id: "b" }, { id: "c" }])).toBe(true);
  });

  it("impede que voluntários removam negócios", () => {
    expect(canReplaceBusinesses("volunteer", existing, [{ id: "a" }])).toBe(false);
  });

  it("permite que o administrador remova negócios", () => {
    expect(canReplaceBusinesses("admin", existing, [{ id: "a" }])).toBe(true);
  });
});
