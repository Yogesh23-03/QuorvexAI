import { createSlice } from "@reduxjs/toolkit";

let nextToastId = 1;

const initialState = {
  toasts: [],
  billingOpen: false,
  sidebarOpen: false,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    pushToast: {
      reducer: (state, action) => {
        state.toasts.push(action.payload);
        if (state.toasts.length > 4) state.toasts.shift();
      },
      prepare: (toast) => ({
        payload: {
          id: nextToastId++,
          tone: "info",
          ...(typeof toast === "string" ? { message: toast } : toast),
        },
      }),
    },
    dismissToast: (state, action) => {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload);
    },
    setBillingOpen: (state, action) => {
      state.billingOpen = Boolean(action.payload);
    },
    setSidebarOpen: (state, action) => {
      state.sidebarOpen = Boolean(action.payload);
    },
  },
});

export const { pushToast, dismissToast, setBillingOpen, setSidebarOpen } = uiSlice.actions;
export default uiSlice.reducer;
