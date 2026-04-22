import dotenv from 'dotenv';
import { connectDatabase } from '../config/database';
import { User } from '../models/User';
import { Ingredient } from '../models/Ingredient';
import { Appliance } from '../models/Appliance';
import { Recipe } from '../models/Recipe';
import { Settings } from '../models/Settings';
import { logger } from '../utils/logger';

dotenv.config();

if (process.env.NODE_ENV === 'production') {
  console.error('Seed interdit en production');
  process.exit(1);
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@mariemkitchen.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const seedData = async () => {
  try {
    await connectDatabase();
    logger.info('Connexion etablie');

    // Nettoyer
    await Promise.all([
      User.deleteMany({}),
      Ingredient.deleteMany({}),
      Appliance.deleteMany({}),
      Recipe.deleteMany({}),
      Settings.deleteMany({}),
    ]);

    // Admin
    await new User({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      firstName: 'Mariem',
      lastName: 'Admin',
      phone: '+21612345678',
      role: 'admin',
    }).save();
    logger.info(`Admin cree: ${ADMIN_EMAIL}`);

    // Settings
    const defaultSettings = [
      { key: 'stegTariff', value: 0.235, label: 'Tarif STEG (DT/kWh)' },
      { key: 'waterForfaitSmall', value: 0.3, label: 'Forfait eau petit (DT)' },
      { key: 'waterForfaitLarge', value: 0.5, label: 'Forfait eau grand (DT)' },
      { key: 'marginPercent', value: 15, label: 'Marge effort (%)' },
      { key: 'orderMinLeadHours', value: 24, label: 'Delai minimum de commande (heures)' },
    ];
    for (const s of defaultSettings) {
      await Settings.findOneAndUpdate({ key: s.key }, s, { upsert: true });
    }

    // Ingredients
    const ings = await Ingredient.insertMany([
      { name: 'Farine', pricePerUnit: 0.8, unit: 'kg', category: 'base', stockQuantity: 2.0 },
      {
        name: 'Sucre blanc',
        pricePerUnit: 1.2,
        unit: 'kg',
        category: 'sweetener',
        stockQuantity: 1.5,
      },
      { name: 'Oeufs', pricePerUnit: 0.17, unit: 'piece', category: 'dairy', stockQuantity: 12 },
      { name: 'Beurre', pricePerUnit: 12.0, unit: 'kg', category: 'dairy', stockQuantity: 0.5 },
      { name: 'Lait', pricePerUnit: 1.4, unit: 'l', category: 'dairy', stockQuantity: 1.0 },
      {
        name: 'Cacao en poudre',
        pricePerUnit: 8.0,
        unit: 'kg',
        category: 'flavoring',
        stockQuantity: 0.2,
      },
      {
        name: 'Chocolat noir',
        pricePerUnit: 20.0,
        unit: 'kg',
        category: 'flavoring',
        stockQuantity: 0.3,
      },
      {
        name: 'Vanille',
        pricePerUnit: 0.5,
        unit: 'cuillere',
        category: 'flavoring',
        stockQuantity: 5,
      },
      {
        name: 'Levure chimique',
        pricePerUnit: 5.0,
        unit: 'kg',
        category: 'leavening',
        stockQuantity: 0.1,
      },
      { name: 'Sel', pricePerUnit: 0.5, unit: 'kg', category: 'other', stockQuantity: 0.5 },
      { name: 'Amandes', pricePerUnit: 25.0, unit: 'kg', category: 'flavoring', stockQuantity: 0 },
      { name: 'Miel', pricePerUnit: 15.0, unit: 'kg', category: 'sweetener', stockQuantity: 0.3 },
      { name: 'Creme fraiche', pricePerUnit: 3.5, unit: 'l', category: 'dairy', stockQuantity: 0 },
      { name: 'Pistache', pricePerUnit: 45.0, unit: 'kg', category: 'flavoring', stockQuantity: 0 },
      {
        name: "Eau de fleur d'oranger",
        pricePerUnit: 8.0,
        unit: 'l',
        category: 'flavoring',
        stockQuantity: 0.1,
      },
      {
        name: 'Huile vegetale',
        pricePerUnit: 2.8,
        unit: 'l',
        category: 'other',
        stockQuantity: 0.5,
      },
      { name: 'Pate filo', pricePerUnit: 3.5, unit: 'piece', category: 'base', stockQuantity: 3 },
      { name: 'Noix', pricePerUnit: 30.0, unit: 'kg', category: 'flavoring', stockQuantity: 0.1 },
      {
        name: 'Sucre glace',
        pricePerUnit: 2.0,
        unit: 'kg',
        category: 'sweetener',
        stockQuantity: 0.2,
      },
      { name: 'Fraises', pricePerUnit: 6.0, unit: 'kg', category: 'flavoring', stockQuantity: 0 },
    ]);
    logger.info(`${ings.length} ingredients crees`);

    // Map par nom
    const i = (name: string) => ings.find((x) => x.name === name)!._id;

    // Machines
    const apps = await Appliance.insertMany([
      { name: 'Four electrique', powerConsumption: 2000, unit: 'W', category: 'cooking' },
      { name: 'Batteur electrique', powerConsumption: 300, unit: 'W', category: 'mixing' },
      { name: 'Robot patissier', powerConsumption: 500, unit: 'W', category: 'mixing' },
      { name: 'Micro-ondes', powerConsumption: 1200, unit: 'W', category: 'cooking' },
      { name: 'Refrigerateur', powerConsumption: 150, unit: 'W', category: 'cooling' },
    ]);
    logger.info(`${apps.length} machines creees`);

    const a = (name: string) => apps.find((x) => x.name === name)!._id;

    // Recettes
    await Recipe.insertMany([
      {
        name: 'Gateau au chocolat',
        description:
          'Un gateau moelleux et fondant au chocolat noir, parfait pour les amateurs de cacao. Recette traditionnelle de Mariem.',
        images: ['/images/recipes/gateau-chocolat.svg'],
        categories: ['gateau', 'chocolat'],
        variants: [
          {
            sizeName: 'Petit',
            portions: 6,
            ingredients: [
              { ingredientId: i('Farine'), quantity: 0.2, unit: 'kg' },
              { ingredientId: i('Sucre blanc'), quantity: 0.2, unit: 'kg' },
              { ingredientId: i('Oeufs'), quantity: 4, unit: 'piece' },
              { ingredientId: i('Beurre'), quantity: 0.1, unit: 'kg' },
              { ingredientId: i('Cacao en poudre'), quantity: 0.05, unit: 'kg' },
              { ingredientId: i('Chocolat noir'), quantity: 0.1, unit: 'kg' },
              { ingredientId: i('Levure chimique'), quantity: 0.01, unit: 'kg' },
              { ingredientId: i('Vanille'), quantity: 1, unit: 'cuillere' },
            ],
            appliances: [
              { applianceId: a('Four electrique'), duration: 45 },
              { applianceId: a('Batteur electrique'), duration: 10 },
            ],
          },
          {
            sizeName: 'Grand',
            portions: 12,
            ingredients: [
              { ingredientId: i('Farine'), quantity: 0.4, unit: 'kg' },
              { ingredientId: i('Sucre blanc'), quantity: 0.4, unit: 'kg' },
              { ingredientId: i('Oeufs'), quantity: 8, unit: 'piece' },
              { ingredientId: i('Beurre'), quantity: 0.2, unit: 'kg' },
              { ingredientId: i('Cacao en poudre'), quantity: 0.1, unit: 'kg' },
              { ingredientId: i('Chocolat noir'), quantity: 0.2, unit: 'kg' },
              { ingredientId: i('Levure chimique'), quantity: 0.02, unit: 'kg' },
              { ingredientId: i('Vanille'), quantity: 2, unit: 'cuillere' },
            ],
            appliances: [
              { applianceId: a('Four electrique'), duration: 60 },
              { applianceId: a('Batteur electrique'), duration: 15 },
            ],
          },
        ],
      },
      {
        name: 'Tarte aux pommes',
        description:
          'Une tarte croustillante avec une garniture fondante aux pommes caramelisees et une touche de cannelle.',
        images: ['/images/recipes/tarte-pommes.svg'],
        categories: ['tarte'],
        variants: [
          {
            sizeName: 'Moyen',
            portions: 8,
            ingredients: [
              { ingredientId: i('Farine'), quantity: 0.25, unit: 'kg' },
              { ingredientId: i('Beurre'), quantity: 0.125, unit: 'kg' },
              { ingredientId: i('Sucre blanc'), quantity: 0.15, unit: 'kg' },
              { ingredientId: i('Oeufs'), quantity: 3, unit: 'piece' },
              { ingredientId: i('Lait'), quantity: 0.1, unit: 'l' },
              { ingredientId: i('Vanille'), quantity: 1, unit: 'cuillere' },
              { ingredientId: i('Sel'), quantity: 0.005, unit: 'kg' },
            ],
            appliances: [
              { applianceId: a('Four electrique'), duration: 50 },
              { applianceId: a('Robot patissier'), duration: 10 },
            ],
          },
        ],
      },
      {
        name: 'Cookies pepites de chocolat',
        description:
          "Des cookies croustillants a l'exterieur, moelleux a l'interieur, avec de genereux morceaux de chocolat.",
        images: ['/images/recipes/cookies.svg'],
        categories: ['biscuit'],
        variants: [
          {
            sizeName: '12 pieces',
            portions: 12,
            ingredients: [
              { ingredientId: i('Farine'), quantity: 0.2, unit: 'kg' },
              { ingredientId: i('Sucre blanc'), quantity: 0.15, unit: 'kg' },
              { ingredientId: i('Oeufs'), quantity: 2, unit: 'piece' },
              { ingredientId: i('Beurre'), quantity: 0.1, unit: 'kg' },
              { ingredientId: i('Chocolat noir'), quantity: 0.15, unit: 'kg' },
              { ingredientId: i('Levure chimique'), quantity: 0.005, unit: 'kg' },
              { ingredientId: i('Vanille'), quantity: 1, unit: 'cuillere' },
            ],
            appliances: [
              { applianceId: a('Four electrique'), duration: 15 },
              { applianceId: a('Batteur electrique'), duration: 5 },
            ],
          },
          {
            sizeName: '24 pieces',
            portions: 24,
            ingredients: [
              { ingredientId: i('Farine'), quantity: 0.4, unit: 'kg' },
              { ingredientId: i('Sucre blanc'), quantity: 0.3, unit: 'kg' },
              { ingredientId: i('Oeufs'), quantity: 4, unit: 'piece' },
              { ingredientId: i('Beurre'), quantity: 0.2, unit: 'kg' },
              { ingredientId: i('Chocolat noir'), quantity: 0.3, unit: 'kg' },
              { ingredientId: i('Levure chimique'), quantity: 0.01, unit: 'kg' },
              { ingredientId: i('Vanille'), quantity: 2, unit: 'cuillere' },
            ],
            appliances: [
              { applianceId: a('Four electrique'), duration: 25 },
              { applianceId: a('Batteur electrique'), duration: 10 },
            ],
          },
        ],
      },
      {
        name: 'Muffins vanille',
        description:
          'Des muffins legers et parfumes a la vanille, parfaits pour le gouter ou le petit dejeuner.',
        images: ['/images/recipes/muffins.svg'],
        categories: ['muffin'],
        variants: [
          {
            sizeName: '6 pieces',
            portions: 6,
            ingredients: [
              { ingredientId: i('Farine'), quantity: 0.15, unit: 'kg' },
              { ingredientId: i('Sucre blanc'), quantity: 0.1, unit: 'kg' },
              { ingredientId: i('Oeufs'), quantity: 2, unit: 'piece' },
              { ingredientId: i('Beurre'), quantity: 0.06, unit: 'kg' },
              { ingredientId: i('Lait'), quantity: 0.08, unit: 'l' },
              { ingredientId: i('Vanille'), quantity: 2, unit: 'cuillere' },
              { ingredientId: i('Levure chimique'), quantity: 0.008, unit: 'kg' },
            ],
            appliances: [{ applianceId: a('Four electrique'), duration: 25 }],
          },
          {
            sizeName: '12 pieces',
            portions: 12,
            ingredients: [
              { ingredientId: i('Farine'), quantity: 0.3, unit: 'kg' },
              { ingredientId: i('Sucre blanc'), quantity: 0.2, unit: 'kg' },
              { ingredientId: i('Oeufs'), quantity: 4, unit: 'piece' },
              { ingredientId: i('Beurre'), quantity: 0.12, unit: 'kg' },
              { ingredientId: i('Lait'), quantity: 0.15, unit: 'l' },
              { ingredientId: i('Vanille'), quantity: 3, unit: 'cuillere' },
              { ingredientId: i('Levure chimique'), quantity: 0.015, unit: 'kg' },
            ],
            appliances: [{ applianceId: a('Four electrique'), duration: 30 }],
          },
        ],
      },
      {
        name: 'Baklawa tunisienne',
        description:
          "La baklawa traditionnelle tunisienne aux amandes et pistaches, imbibee de sirop de miel et d'eau de fleur d'oranger.",
        images: ['/images/recipes/baklawa.svg'],
        categories: ['patisserie', 'traditionnel'],
        variants: [
          {
            sizeName: 'Plateau (20 pieces)',
            portions: 20,
            ingredients: [
              { ingredientId: i('Pate filo'), quantity: 2, unit: 'piece' },
              { ingredientId: i('Amandes'), quantity: 0.3, unit: 'kg' },
              { ingredientId: i('Pistache'), quantity: 0.1, unit: 'kg' },
              { ingredientId: i('Sucre blanc'), quantity: 0.3, unit: 'kg' },
              { ingredientId: i('Beurre'), quantity: 0.2, unit: 'kg' },
              { ingredientId: i('Miel'), quantity: 0.15, unit: 'kg' },
              { ingredientId: i("Eau de fleur d'oranger"), quantity: 0.05, unit: 'l' },
            ],
            appliances: [{ applianceId: a('Four electrique'), duration: 40 }],
          },
        ],
      },
      {
        name: 'Gateau aux fraises',
        description:
          'Un gateau leger garni de fraises fraiches et de creme, ideal pour les fetes et les anniversaires.',
        images: ['/images/recipes/gateau-fraise.svg'],
        categories: ['gateau', 'fruits', 'anniversaire'],
        variants: [
          {
            sizeName: 'Moyen',
            portions: 8,
            ingredients: [
              { ingredientId: i('Farine'), quantity: 0.25, unit: 'kg' },
              { ingredientId: i('Sucre blanc'), quantity: 0.15, unit: 'kg' },
              { ingredientId: i('Oeufs'), quantity: 4, unit: 'piece' },
              { ingredientId: i('Beurre'), quantity: 0.1, unit: 'kg' },
              { ingredientId: i('Creme fraiche'), quantity: 0.3, unit: 'l' },
              { ingredientId: i('Fraises'), quantity: 0.4, unit: 'kg' },
              { ingredientId: i('Sucre glace'), quantity: 0.05, unit: 'kg' },
              { ingredientId: i('Vanille'), quantity: 1, unit: 'cuillere' },
              { ingredientId: i('Levure chimique'), quantity: 0.01, unit: 'kg' },
            ],
            appliances: [
              { applianceId: a('Four electrique'), duration: 35 },
              { applianceId: a('Batteur electrique'), duration: 15 },
              { applianceId: a('Refrigerateur'), duration: 60 },
            ],
          },
        ],
      },
      {
        name: 'Brownies chocolat',
        description:
          'Des brownies denses et fondants au chocolat noir intense, avec une croute croustillante.',
        images: ['/images/recipes/brownie.svg'],
        categories: ['biscuit', 'chocolat'],
        variants: [
          {
            sizeName: '9 pieces',
            portions: 9,
            ingredients: [
              { ingredientId: i('Chocolat noir'), quantity: 0.2, unit: 'kg' },
              { ingredientId: i('Beurre'), quantity: 0.15, unit: 'kg' },
              { ingredientId: i('Sucre blanc'), quantity: 0.2, unit: 'kg' },
              { ingredientId: i('Oeufs'), quantity: 3, unit: 'piece' },
              { ingredientId: i('Farine'), quantity: 0.08, unit: 'kg' },
              { ingredientId: i('Cacao en poudre'), quantity: 0.03, unit: 'kg' },
              { ingredientId: i('Vanille'), quantity: 1, unit: 'cuillere' },
              { ingredientId: i('Noix'), quantity: 0.05, unit: 'kg' },
            ],
            appliances: [
              { applianceId: a('Four electrique'), duration: 25 },
              { applianceId: a('Micro-ondes'), duration: 3 },
            ],
          },
        ],
      },
      {
        name: 'Madeleines au miel',
        description:
          "Les classiques madeleines bien bombees, parfumees au miel et a la fleur d'oranger.",
        images: ['/images/recipes/madeleines.svg'],
        categories: ['patisserie', 'traditionnel'],
        variants: [
          {
            sizeName: '12 pieces',
            portions: 12,
            ingredients: [
              { ingredientId: i('Farine'), quantity: 0.15, unit: 'kg' },
              { ingredientId: i('Sucre blanc'), quantity: 0.1, unit: 'kg' },
              { ingredientId: i('Oeufs'), quantity: 3, unit: 'piece' },
              { ingredientId: i('Beurre'), quantity: 0.1, unit: 'kg' },
              { ingredientId: i('Miel'), quantity: 0.03, unit: 'kg' },
              { ingredientId: i('Levure chimique'), quantity: 0.005, unit: 'kg' },
              { ingredientId: i("Eau de fleur d'oranger"), quantity: 0.01, unit: 'l' },
            ],
            appliances: [{ applianceId: a('Four electrique'), duration: 12 }],
          },
          {
            sizeName: '24 pieces',
            portions: 24,
            ingredients: [
              { ingredientId: i('Farine'), quantity: 0.3, unit: 'kg' },
              { ingredientId: i('Sucre blanc'), quantity: 0.2, unit: 'kg' },
              { ingredientId: i('Oeufs'), quantity: 6, unit: 'piece' },
              { ingredientId: i('Beurre'), quantity: 0.2, unit: 'kg' },
              { ingredientId: i('Miel'), quantity: 0.06, unit: 'kg' },
              { ingredientId: i('Levure chimique'), quantity: 0.01, unit: 'kg' },
              { ingredientId: i("Eau de fleur d'oranger"), quantity: 0.02, unit: 'l' },
            ],
            appliances: [{ applianceId: a('Four electrique'), duration: 15 }],
          },
        ],
      },
    ]);
    logger.info('8 recettes creees');

    logger.info('Seed termine avec succes');
    logger.info(`Admin: ${ADMIN_EMAIL} (mot de passe defini via ADMIN_PASSWORD)`);
  } catch (error) {
    logger.error('Erreur seed:', error);
    throw error;
  }
};

if (require.main === module) {
  seedData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { seedData };
