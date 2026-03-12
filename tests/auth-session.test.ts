import {
  hydrateSessionFromStorage,
  signInUser,
  signOutUser,
} from "@/lib/auth/session";
import { SESSION_STORAGE_KEY } from "@/lib/auth/authGateway";
import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";

describe("auth session gateway", () => {
  beforeEach(() => {
    localStorage.clear();
    const state = useAuthAndFamilyStore.getState();
    useAuthAndFamilyStore.setState({
      ...state,
      currentUserId: null,
      currentFamilyId: null,
      isAuthenticated: false,
    });
  });

  it("signs in a valid user", async () => {
    await signInUser("sarah");
    const state = useAuthAndFamilyStore.getState();

    expect(state.currentUserId).toBe("sarah");
    expect(state.currentFamilyId).toBe("fam-1");
    expect(state.isAuthenticated).toBe(true);
  });

  it("restores session from persisted storage", async () => {
    await signInUser("elijah");
    const withSignIn = useAuthAndFamilyStore.getState();
    expect(withSignIn.currentUserId).toBe("elijah");

    const persistedUser = localStorage.getItem(SESSION_STORAGE_KEY);
    expect(persistedUser).not.toBeNull();

    useAuthAndFamilyStore.setState({
      ...withSignIn,
      currentUserId: null,
      currentFamilyId: null,
      isAuthenticated: false,
    });

    await hydrateSessionFromStorage();
    const restored = useAuthAndFamilyStore.getState();
    expect(restored.currentUserId).toBe("elijah");
    expect(restored.currentFamilyId).toBe("fam-1");
    expect(restored.isAuthenticated).toBe(true);
  });

  it("signs out the current session", async () => {
    await signInUser("sarah");
    await signOutUser();

    const state = useAuthAndFamilyStore.getState();
    expect(state.currentUserId).toBeNull();
    expect(state.currentFamilyId).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it("rehydrates to a guest session when no persisted actor exists", async () => {
    useAuthAndFamilyStore.setState({
      ...useAuthAndFamilyStore.getState(),
      currentUserId: "mom",
      currentFamilyId: "fam-1",
      isAuthenticated: true,
    });

    await hydrateSessionFromStorage();

    const state = useAuthAndFamilyStore.getState();
    expect(state.currentUserId).toBeNull();
    expect(state.currentFamilyId).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });
});
