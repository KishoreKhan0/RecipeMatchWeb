const express = require('express');
const { MongoClient } = require('mongodb');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.DB_NAME || 'RecipeMatch';
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'recipes';
const MONGO_DISABLED = process.env.MONGO_DISABLED === 'true';

const publicDir = path.join(__dirname, 'public');
const seedDataPath = path.join(__dirname, 'data', 'recipes.json');

let mongoClient;
let mongoAvailable = false;
let lastMongoFailure = 0;
const MONGO_RETRY_INTERVAL_MS = 15_000;

app.use(express.json());
app.use(express.static(publicDir));

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function parseIngredientQuery(value) {
  return String(value || '')
    .split(',')
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function sanitizeRecipe(recipe) {
  const { _id, ...rest } = recipe;
  return {
    title: String(rest.title || 'Untitled Recipe'),
    calories: Number(rest.calories || 0),
    prepTime: Number(rest.prepTime || 0),
    cookTime: Number(rest.cookTime || 0),
    servings: Number(rest.servings || 1),
    ingredients: Array.isArray(rest.ingredients) ? rest.ingredients : [],
    preparationSteps: Array.isArray(rest.preparationSteps) ? rest.preparationSteps : [],
    tags: Array.isArray(rest.tags) ? rest.tags : [],
  };
}

async function readSeedRecipes() {
  const data = await fs.readFile(seedDataPath, 'utf8');
  return JSON.parse(data).map(sanitizeRecipe);
}

async function getMongoCollection() {
  if (MONGO_DISABLED) return null;

  const now = Date.now();
  if (!mongoAvailable && now - lastMongoFailure < MONGO_RETRY_INTERVAL_MS) {
    return null;
  }

  try {
    if (!mongoClient) {
      mongoClient = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 1200 });
    }
    await mongoClient.connect();
    await mongoClient.db(DB_NAME).command({ ping: 1 });
    mongoAvailable = true;
    return mongoClient.db(DB_NAME).collection(COLLECTION_NAME);
  } catch (error) {
    mongoAvailable = false;
    lastMongoFailure = Date.now();
    return null;
  }
}

async function getRecipes() {
  const collection = await getMongoCollection();
  if (!collection) {
    return { source: 'seed-json', recipes: await readSeedRecipes() };
  }

  const recipes = await collection.find({}, { projection: { _id: 0 } }).sort({ title: 1 }).toArray();
  if (!recipes.length) {
    return { source: 'seed-json', recipes: await readSeedRecipes() };
  }

  return { source: 'mongodb', recipes: recipes.map(sanitizeRecipe) };
}

function recipeMatchesFilters(recipe, query) {
  const search = normalizeText(query.search);
  const selectedTag = normalizeText(query.tag);
  const maxCalories = Number(query.maxCalories || query.calories || 0);
  const ingredients = parseIngredientQuery(query.ingredients);

  const title = normalizeText(recipe.title);
  const tags = recipe.tags.map(normalizeText);
  const ingredientNames = recipe.ingredients.map((item) => normalizeText(item.name));
  const searchable = [title, ...tags, ...ingredientNames].join(' ');

  const searchMatch = !search || searchable.includes(search);
  const tagMatch = !selectedTag || tags.includes(selectedTag);
  const calorieMatch = !maxCalories || recipe.calories <= maxCalories;
  const ingredientMatch =
    !ingredients.length ||
    ingredients.every((requested) =>
      ingredientNames.some((available) => available.includes(requested) || requested.includes(available)),
    );

  return searchMatch && tagMatch && calorieMatch && ingredientMatch;
}

function scoreRecipe(recipe, requestedIngredients) {
  const ingredientNames = recipe.ingredients.map((item) => normalizeText(item.name));
  const matchedIngredients = requestedIngredients.filter((requested) =>
    ingredientNames.some((available) => available.includes(requested) || requested.includes(available)),
  );

  const matchScore = requestedIngredients.length
    ? Math.round((matchedIngredients.length / requestedIngredients.length) * 100)
    : 0;

  return {
    ...recipe,
    matchScore,
    matchedIngredients,
    missingIngredients: requestedIngredients.filter((item) => !matchedIngredients.includes(item)),
  };
}

app.get('/api/health', async (_req, res) => {
  try {
    const { source, recipes } = await getRecipes();
    res.json({ status: 'ok', source, recipeCount: recipes.length });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Health check failed.' });
  }
});

app.get('/api/tags', async (_req, res) => {
  try {
    const { recipes } = await getRecipes();
    const tags = [...new Set(recipes.flatMap((recipe) => recipe.tags))].sort((a, b) => a.localeCompare(b));
    res.json(tags);
  } catch (error) {
    res.status(500).json({ message: 'Unable to load tags.' });
  }
});

app.get('/api/recipes', async (req, res) => {
  try {
    const { source, recipes } = await getRecipes();
    const filteredRecipes = recipes.filter((recipe) => recipeMatchesFilters(recipe, req.query));
    res.json({ source, count: filteredRecipes.length, recipes: filteredRecipes });
  } catch (error) {
    res.status(500).json({ message: 'Unable to load recipes.' });
  }
});

app.get('/api/match', async (req, res) => {
  try {
    const requestedIngredients = parseIngredientQuery(req.query.ingredients);
    const { source, recipes } = await getRecipes();
    const filtersWithoutIngredientRequirement = { ...req.query, ingredients: "" };
    const filteredRecipes = recipes.filter((recipe) => recipeMatchesFilters(recipe, filtersWithoutIngredientRequirement));
    const rankedRecipes = filteredRecipes
      .map((recipe) => scoreRecipe(recipe, requestedIngredients))
      .sort((a, b) => b.matchScore - a.matchScore || a.title.localeCompare(b.title));

    res.json({ source, count: rankedRecipes.length, recipes: rankedRecipes });
  } catch (error) {
    res.status(500).json({ message: 'Unable to match recipes.' });
  }
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API route not found.' });
  }
  return res.sendFile(path.join(publicDir, 'index.html'));
});

process.on('SIGINT', async () => {
  if (mongoClient) await mongoClient.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`RecipeMatch server running at http://localhost:${PORT}`);
});
