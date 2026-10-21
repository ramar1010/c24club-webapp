import { describe, expect, it } from "vitest";
import { appendDiscoverMembers, orderDiscoverMembers } from "./discover-order";

describe("Discover pagination order", () => {
  it("appends newly loaded profiles without moving existing profiles", () => {
    const existing = [{ id: "first", vip: false }, { id: "second", vip: false }];
    const incoming = [{ id: "new-vip", vip: true }, { id: "new-regular", vip: false }];
    expect(appendDiscoverMembers(existing, incoming).map(member => member.id))
      .toEqual(["first", "second", "new-vip", "new-regular"]);
  });

  it("does not repeat profiles already shown or duplicated within a new page", () => {
    expect(appendDiscoverMembers([{ id: "first" }], [{ id: "first" }, { id: "next" }, { id: "next" }]))
      .toEqual([{ id: "first" }, { id: "next" }]);
  });

  it("keeps a shuffled feed stable when the next page loads", () => {
    const members = [{ id: "first" }, { id: "second" }, { id: "third" }];
    expect(orderDiscoverMembers(members, ["second", "first"]).map(member => member.id))
      .toEqual(["second", "first", "third"]);
  });
});