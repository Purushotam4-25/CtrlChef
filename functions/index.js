const { setGlobalOptions } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");

setGlobalOptions({ maxInstances: 10 });

// Must run before orders/tickets/tables are required below — they each
// call getFirestore(), which needs the app already initialized.
initializeApp();

const orders = require("./orders");
const tickets = require("./tickets");
const tables = require("./tables");
const forecast = require("./forecast");
const analytics = require("./analytics");
const inventory = require("./inventory");

exports.addOrderItem = orders.addOrderItem;
exports.cancelOrderItem = orders.cancelOrderItem;
exports.advanceOrderItemStatus = tickets.advanceOrderItemStatus;
exports.seatTable = tables.seatTable;
exports.closeOrder = tables.closeOrder;
exports.markTableClean = tables.markTableClean;
exports.getStockForecast = forecast.getStockForecast;
exports.getSalesAnalytics = analytics.getSalesAnalytics;
exports.getTableTurnoverStats = analytics.getTableTurnoverStats;
exports.restockIngredient = inventory.restockIngredient;
