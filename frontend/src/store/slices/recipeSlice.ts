import { createSlice } from '@reduxjs/toolkit'

interface RecipeState {
  recipes: any[]
  currentRecipe: any | null
  isLoading: boolean
}

const initialState: RecipeState = {
  recipes: [],
  currentRecipe: null,
  isLoading: false,
}

const recipeSlice = createSlice({
  name: 'recipes',
  initialState,
  reducers: {
    setRecipes: (state, action) => { state.recipes = action.payload },
    setCurrentRecipe: (state, action) => { state.currentRecipe = action.payload },
    setLoading: (state, action) => { state.isLoading = action.payload },
  },
})

export const { setRecipes, setCurrentRecipe, setLoading } = recipeSlice.actions
export default recipeSlice.reducer
