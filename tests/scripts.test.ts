import { describe, expect, it } from "vitest";
import {
  PACK_META,
  SCRIPTS,
  getScript,
  practicePrompt,
  scriptsForPack,
  yourLines,
} from "@/lib/scripts/packs";

describe("script packs", () => {
  it("keeps slugs unique", () => {
    const slugs = SCRIPTS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has every pack represented with meta", () => {
    for (const pack of ["debate", "sitcom", "roleplay"] as const) {
      expect(PACK_META[pack]).toBeTruthy();
      expect(scriptsForPack(pack).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("looks up scripts by slug and misses cleanly", () => {
    const first = SCRIPTS[0];
    expect(getScript(first.slug)?.title).toBe(first.title);
    expect(getScript("no-such-scene")).toBeNull();
  });
});

describe("individual scripts", () => {
  for (const script of SCRIPTS) {
    describe(script.slug, () => {
      it("has a usable dialogue", () => {
        expect(script.lines.length).toBeGreaterThanOrEqual(4);
        for (const line of script.lines) {
          expect(line.who.trim().length).toBeGreaterThan(0);
          expect(line.text.trim().length).toBeGreaterThan(0);
        }
        expect(new Set(script.lines.map((l) => l.who)).size).toBeGreaterThanOrEqual(2);
      });

      it("gives the player at least two lines", () => {
        const mine = yourLines(script);
        expect(mine.length).toBeGreaterThanOrEqual(2);
        for (const line of mine) {
          expect(line.who.toLowerCase()).toBe(script.role.toLowerCase());
        }
      });

      it("builds a practice prompt from the player's lines", () => {
        const prompt = practicePrompt(script);
        expect(prompt).toContain(script.role);
        expect(prompt).toContain(script.opponent);
        for (const line of yourLines(script)) {
          expect(prompt).toContain(line.text);
        }
        // Other characters' lines are not the player's assignment.
        for (const line of script.lines) {
          if (line.who.toLowerCase() === script.role.toLowerCase()) continue;
          expect(prompt).not.toContain(line.text);
        }
      });
    });
  }
});
