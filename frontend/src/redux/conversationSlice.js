import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  conversations: [],
  selectedConversation: null,
};

const conversationSlice = createSlice({
  name: "conversation",
  initialState,
  reducers: {
    setConversations: (state, action) => {
      const list = Array.isArray(action.payload) ? action.payload : [];
      state.conversations = list;
      if (
        state.selectedConversation &&
        !list.some((c) => c._id === state.selectedConversation._id)
      ) {
        state.selectedConversation = null;
      }
    },
    addConversation: (state, action) => {
      if (!action.payload?._id) return;
      const exists = state.conversations.some((c) => c._id === action.payload._id);
      if (!exists) state.conversations.unshift(action.payload);
    },
    setSelectedConversation: (state, action) => {
      state.selectedConversation = action.payload ?? null;
    },
    setConvTitle: (state, action) => {
      const { title, conversationId } = action.payload || {};
      state.conversations = state.conversations.map((conversation) =>
        conversation._id === conversationId ? { ...conversation, title } : conversation,
      );
      if (state.selectedConversation?._id === conversationId) {
        state.selectedConversation = { ...state.selectedConversation, title };
      }
    },
    removeConversation: (state, action) => {
      state.conversations = state.conversations.filter((c) => c._id !== action.payload);
      if (state.selectedConversation?._id === action.payload) state.selectedConversation = null;
    },
    resetConversations: () => initialState,
  },
});

export const {
  setConversations,
  addConversation,
  setSelectedConversation,
  setConvTitle,
  removeConversation,
  resetConversations,
} = conversationSlice.actions;

export default conversationSlice.reducer;
