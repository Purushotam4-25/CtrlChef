// Shared by the seed script and the stock-decrement Cloud Function so both
// compute `available` the same way.
function computeAvailable(requiredIngredients, ingredientsById) {
  return requiredIngredients.every(({ ingredientId, qtyRequired }) => {
    const ingredient = ingredientsById[ingredientId];
    return !!ingredient && ingredient.currentStock >= qtyRequired;
  });
}

// Same idea as computeAvailable, but per-ingredient: has stock dropped to
// (or below) the manager-set threshold.
function computeLowStock(ingredient) {
  return ingredient.currentStock <= ingredient.lowStockThreshold;
}

module.exports = { computeAvailable, computeLowStock };
