import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  userData: null,
  status: "loading", // loading | ready
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUserdata: (state, action) => {
      state.userData = action.payload ?? null;
      state.status = "ready";
    },
    setAuthStatus: (state, action) => {
      state.status = action.payload;
    },
    updateCredits: (state, action) => {
      if (!state.userData) return;
      const { credits, totalCredits } = action.payload || {};
      if (typeof credits === "number") state.userData.credits = credits;
      if (typeof totalCredits === "number") state.userData.totalCredits = totalCredits;
    },
  },
});

export const { setUserdata, setAuthStatus, updateCredits } = userSlice.actions;
export default userSlice.reducer;
