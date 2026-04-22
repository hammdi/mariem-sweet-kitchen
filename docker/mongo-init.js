// Initialisation MongoDB — creer la base et les collections
db = db.getSiblingDB('mariem_kitchen');

db.createCollection('users');
db.createCollection('recipes');
db.createCollection('ingredients');
db.createCollection('orders');
db.createCollection('appliances');
db.createCollection('settings');
db.createCollection('stockhistories');

// Index
db.users.createIndex({ email: 1 }, { unique: true });
db.recipes.createIndex({ name: 'text', description: 'text' });
db.recipes.createIndex({ categories: 1 });
db.recipes.createIndex({ isActive: 1 });
db.ingredients.createIndex({ name: 1 });
db.ingredients.createIndex({ category: 1 });
db.orders.createIndex({ status: 1 });
db.orders.createIndex({ createdAt: -1 });
db.orders.createIndex({ clientPhone: 1 });
db.settings.createIndex({ key: 1 }, { unique: true });
db.stockhistories.createIndex({ createdAt: -1 });

print('Collections et index crees');
