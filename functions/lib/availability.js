// Shared by the seed script and the stock-decrement Cloud Function so both
function computeAvailable(requiredIngredients, ingredientsById) {
  return requiredIngredients.every(({ ingredientId, qtyRequired }) => {
    const ingredient = ingredientsById[ingredientId];
    return !!ingredient && ingredient.currentStock >= qtyRequired;
  });
}

// Same idea as computeAvailable, but for each ingredient, checks if its under a threshold
function computeLowStock(ingredient) {
  return ingredient.currentStock <= ingredient.lowStockThreshold;
}

module.exports = { computeAvailable, computeLowStock };
