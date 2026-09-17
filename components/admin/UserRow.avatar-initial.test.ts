import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// The router is an environment dependency of the component, not the behaviour
// under test, so it is the only thing stubbed here.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

import { AdminUserRow } from "@/components/admin/UserRow";
import type { User } from "@/lib/db/schema";

const BASE = {
  id: "user_1",
  email: "ada@example.com",
  role: "reader" as const,
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  verifiedAdmit: false,
};

function renderRow(user: unknown): string {
  // <tr> must live inside a table for valid DOM nesting.
  return renderToStaticMarkup(
    createElement(
      "table",
      null,
      createElement(
        "tbody",
        null,
        createElement(AdminUserRow, { user: user as User })
      )
    )
  );
}

/** Pulls the text content out of the avatar bubble (the div carrying bg-[#e8f1fa]). */
function avatarInitial(html: string): string {
  const match = html.match(/bg-\[#e8f1fa\][^>]*>([\s\S]*?)</);
  if (!match) {
    throw new Error("avatar element not found in rendered markup:\n" + html);
  }
  return match[1];
}

describe("AdminUserRow avatar initial", () => {
  it("renders a placeholder instead of throwing when the user has no name (null)", () => {
    // Buggy code evaluates user.name[0] -> TypeError during render.
    const html = renderRow({ ...BASE, name: null });
    expect(avatarInitial(html)).toBe("?");
  });

  it("renders a placeholder instead of throwing when the name is undefined", () => {
    const html = renderRow({ ...BASE, name: undefined });
    expect(avatarInitial(html)).toBe("?");
  });

  it("still shows the first letter of a real name", () => {
    // Must keep holding: the fix must not degrade the normal case to "?".
    const html = renderRow({ ...BASE, name: "Ada Lovelace" });
    expect(avatarInitial(html)).toBe("A");
    expect(html).toContain("Ada Lovelace");
  });
});