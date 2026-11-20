// Lab notes (build plan 4.8, F-65 step 1): OpenLabel renders nothing in the caregiver build and the
// whole note in the lab build, with a register link for register IDs only.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

async function render(labView: boolean, id: string, text = "A first guess.") {
  vi.resetModules();
  vi.doMock("../src/study/settings", () => ({ study: { labView } }));
  const { OpenLabel } = await import("../src/ui/OpenLabel");
  return renderToStaticMarkup(createElement(OpenLabel, { id, children: text }));
}

afterEach(() => vi.doUnmock("../src/study/settings"));

describe("OpenLabel", () => {
  it("renders nothing at all in the caregiver build", async () => {
    for (const id of ["R4", "D-17", "F-12", "P-3", "V-1"]) expect(await render(false, id)).toBe("");
  });

  it("shows the ID and the note's own words in the lab build", async () => {
    const html = await render(true, "D-18", "Abedi 2025, Bankole 2020.");
    expect(html).toContain("Open:");
    expect(html).toContain("D-18");
    expect(html).toContain("Abedi 2025, Bankole 2020.");
  });

  it("links every kind of register ID to the register, saying where the link goes", async () => {
    for (const id of ["D-17", "F-12", "P-3", "V-1"]) {
      const html = await render(true, id);
      expect(html).toContain(
        'href="https://github.com/ferrelldevin/cmai-caregiver-app/blob/main/docs/review-register.md"',
      );
      expect(html).toContain(`aria-label="${id} in the review register (opens in a new tab)"`);
    }
  });

  it("leaves an ID that is not a register row as plain text", async () => {
    for (const id of ["R4", "R40", "D-", "X-1"]) expect(await render(true, id)).not.toContain("<a ");
  });
});
