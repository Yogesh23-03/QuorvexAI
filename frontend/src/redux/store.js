import { configureStore } from "@reduxjs/toolkit";
import conversationReducer from "./conversationSlice";
import messageReducer from "./messageSlice";
import uiReducer from "./uiSlice";
import userReducer from "./userSlice";

export const store = configureStore({
  reducer: {
    user: userReducer,
    conversation: conversationReducer,
    message: messageReducer,
    ui: uiReducer,
  },
});
