import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";

describe("auth and family policy mutations", () => {
  beforeEach(() => {
    const state = useAuthAndFamilyStore.getState();
    useAuthAndFamilyStore.setState({ ...state, currentUserId: null, currentFamilyId: null, isAuthenticated: false });
  });

  it("updates an existing child membership policy", () => {
    const state = useAuthAndFamilyStore.getState();
    state.setMembershipEditPolicy("sarah", "fam-1", "no_edit");
    const membership = useAuthAndFamilyStore
      .getState()
      .memberships.find(
        (item) => item.userId === "sarah" && item.familyId === "fam-1",
      );
    expect(membership?.editPolicy).toBe("no_edit");
  });

  it("adds a policy entry when membership did not exist", () => {
    const state = useAuthAndFamilyStore.getState();
    state.setMembershipEditPolicy("new-child", "fam-1", "approval_required");
    const membership = useAuthAndFamilyStore
      .getState()
      .memberships.find(
        (item) => item.userId === "new-child" && item.familyId === "fam-1",
      );
    expect(membership).toBeDefined();
    expect(membership?.editPolicy).toBe("approval_required");
  });
});
