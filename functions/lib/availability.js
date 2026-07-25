// Shared by the seed script and the stock-decrement Cloud Function so both
// compute `available` the same way.
function computeAvailable(requiredIngredients, ingredientsById) {
  return requiredIngredients.every(({ ingredientId, qtyRequired }) => {
    const ingredient = ingredientsById[ingredientId];
    return !!ingredient && ingredient.currentStock >= qtyRequired;
  });
}

module.exports = { computeAvailable };
