import { describe, it, expect } from "vitest";
import { signal } from "@elurjs/core";
import { interpolate, readValue, collectParams } from "../core/interpolate";

describe("interpolate", () => {
  it("replaces placeholders with values", () => {
    expect(interpolate("Hello {name}", { name: "Deiver" })).toBe("Hello Deiver");
  });

  it("supports multiple placeholders", () => {
    expect(
      interpolate("{greeting} {name}, you have {count} messages", {
        greeting: "Hi",
        name: "Deiver",
        count: 5,
      }),
    ).toBe("Hi Deiver, you have 5 messages");
  });

  it("reads signal values", () => {
    const name = signal("Ana");
    expect(interpolate("Hello {name}", { name })).toBe("Hello Ana");
  });

  it("reads function values", () => {
    expect(interpolate("Hello {name}", { name: () => "Dynamic" })).toBe("Hello Dynamic");
  });

  it("keeps unknown placeholders", () => {
    expect(interpolate("Hello {name}", {})).toBe("Hello {name}");
  });

  it("collects parameter keys", () => {
    expect(collectParams("Hello {name}, you have {count} messages")).toEqual([
      "name",
      "count",
    ]);
  });
});

describe("readValue", () => {
  it("handles null and undefined", () => {
    expect(readValue(null)).toBe("");
    expect(readValue(undefined)).toBe("");
  });

  it("converts numbers and booleans", () => {
    expect(readValue(42)).toBe("42");
    expect(readValue(false)).toBe("false");
  });
});
