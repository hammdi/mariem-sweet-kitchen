import { createSlice } from '@reduxjs/toolkit';

const cartSlice = createSlice({
  name: 'cart',
  initialState: { items: [] as any[], totalItems: 0 },
  reducers: {
    clearCart: (state) => {
      state.items = [];
      state.totalItems = 0;
    },
  },
});

export const { clearCart } = cartSlice.actions;
export default cartSlice.reducer;
