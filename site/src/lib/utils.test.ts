import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("keeps a custom font size next to a colour", () => {
    expect(cn("text-small text-muted-foreground")).toBe("text-small text-muted-foreground");
    expect(cn("text-muted-foreground text-label")).toBe("text-muted-foreground text-label");
  });

  it("still resolves a real conflict between custom sizes", () => {
    expect(cn("text-small text-h3")).toBe("text-h3");
  });

  it("still resolves colour conflicts", () => {
    expect(cn("text-foreground text-muted-foreground")).toBe("text-muted-foreground");
  });
});
