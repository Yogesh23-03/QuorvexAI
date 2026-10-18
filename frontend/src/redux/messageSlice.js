import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  messages: [],
  artifacts: [],
  sandboxOpen: false,
  sandboxArtifact: null,
  isLoading: false,
  pendingAgent: null,
  error: null,
};

const messageSlice = createSlice({
  name: "message",
  initialState,
  reducers: {
    setMessages: (state, action) => {
      state.messages = Array.isArray(action.payload) ? action.payload : [];
    },
    addMessage: (state, action) => {
      if (!action.payload) return;
      state.messages.push(action.payload);
    },
    /** Clears everything chat-scoped so a new conversation never shows stale data. */
    resetConversationState: (state) => {
      state.messages = [];
      state.artifacts = [];
      state.sandboxOpen = false;
      state.sandboxArtifact = null;
      state.error = null;
      state.isLoading = false;
      state.pendingAgent = null;
    },
    setArtifacts: (state, action) => {
      state.artifacts = Array.isArray(action.payload) ? action.payload : [];
    },
    /** The sandbox only ever opens from an explicit card click. */
    openSandbox: (state, action) => {
      if (!action.payload) return;
      state.sandboxArtifact = action.payload;
      state.sandboxOpen = true;
    },
    closeSandbox: (state) => {
      state.sandboxOpen = false;
    },
    setIsLoading: (state, action) => {
      state.isLoading = Boolean(action.payload);
      if (!action.payload) state.pendingAgent = null;
    },
    setPendingAgent: (state, action) => {
      state.pendingAgent = action.payload;
    },
    setMessageError: (state, action) => {
      state.error = action.payload;
      state.isLoading = false;
      state.pendingAgent = null;
    },
    clearMessageError: (state) => {
      state.error = null;
    },
  },
});

export const {
  setMessages,
  addMessage,
  setArtifacts,
  openSandbox,
  closeSandbox,
  setIsLoading,
  setPendingAgent,
  setMessageError,
  clearMessageError,
  resetConversationState,
} = messageSlice.actions;

export default messageSlice.reducer;
