import { httpsCallable } from "firebase/functions";
import { functions, RESTAURANT_ID } from "../firebase";

// Thin wrappers around the callable functions in functions/ — every one
// takes restaurantId, so bake it in here instead of repeating it everywhere.
function callable(name) {
  const fn = httpsCallable(functions, name);
  return (data) => fn({ restaurantId: RESTAURANT_ID, ...data }).then((res) => res.data);
}

export const addOrderItem = callable("addOrderItem");
export const cancelOrderItem = callable("cancelOrderItem");
export const advanceOrderItemStatus = callable("advanceOrderItemStatus");
export const seatTable = callable("seatTable");
export const closeOrder = callable("closeOrder");
export const markTableClean = callable("markTableClean");
export const forceResetTable = callable("forceResetTable");
export const restockIngredient = callable("restockIngredient");
export const upsertIngredient = callable("upsertIngredient");
export const deleteIngredient = callable("deleteIngredient");
export const getStockForecast = callable("getStockForecast");
export const getSalesAnalytics = callable("getSalesAnalytics");
export const getTableTurnoverStats = callable("getTableTurnoverStats");
export const estimateQueueWait = callable("estimateQueueWait");
export const seatFromQueue = callable("seatFromQueue");
export const getTableOrderStatus = callable("getTableOrderStatus");
export const upsertDish = callable("upsertDish");
export const createStaffMember = callable("createStaffMember");
export const askAssistant = callable("askAssistant");
