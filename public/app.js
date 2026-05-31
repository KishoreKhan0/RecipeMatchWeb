const state = {
  recipes: [],
  visibleRecipes: [],
  source: 'loading',
};

const elements = {
  recipes: document.querySelector('#recipes'),
  loader: document.querySelector('#loader'),
  statusText: document.querySelector('#statusText'),
  recipeCount: document.querySelector('#recipeCount'),
  searchInput: document.querySelector('#searchInput'),
  tagFilter: document.querySelector('#tagFilter'),
  ingredientInput: document.querySelector('#ingredientInput'),
  calorieRange: document.querySelector('#calorieRange'),
  calorieLabel: document.querySelector('#calorieLabel'),
  clearFilters: document.querySelector('#clearFilters'),
  toggleTheme: document.querySelector('#toggleTheme'),
  modal: document.querySelector('#modal'),
  modalContent: document.querySelector('#modalContent'),
  closeModal: document.querySelector('#closeModal'),
};

function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);
  if (options.className) element.className = options.className;
  if (options.text !== undefined) element.textContent = options.text;
  if (options.type) element.type = options.type;
  if (options.ariaLabel) element.setAttribute('aria-label', options.ariaLabel);
  return element;
}

function setLoading(isLoading) {
  elements.loader.classList.toggle('active', isLoading);
  elements.loader.setAttribute('aria-hidden', String(!isLoading));
}

function buildQueryString() {
  const params = new URLSearchParams();
  const search = elements.searchInput.value.trim();
  const tag = elements.tagFilter.value;
  const ingredients = elements.ingredientInput.value.trim();
  const maxCalories = elements.calorieRange.value;

  if (search) params.set('search', search);
  if (tag) params.set('tag', tag);
  if (ingredients) params.set('ingredients', ingredients);
  if (maxCalories && Number(maxCalories) < 1000) params.set('maxCalories', maxCalories);

  return params.toString();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

async function loadTags() {
  const tags = await fetchJson('/api/tags');
  tags.forEach((tag) => {
    const option = createElement('option', { text: tag });
    option.value = tag;
    elements.tagFilter.appendChild(option);
  });
}

async function loadRecipes() {
  setLoading(true);
  elements.statusText.textContent = 'Loading recipes…';
  elements.recipes.replaceChildren();

  try {
    const query = buildQueryString();
    const hasIngredients = elements.ingredientInput.value.trim().length > 0;
    const endpoint = hasIngredients ? '/api/match' : '/api/recipes';
    const payload = await fetchJson(`${endpoint}${query ? `?${query}` : ''}`);

    state.recipes = payload.recipes || [];
    state.visibleRecipes = state.recipes;
    state.source = payload.source || 'api';

    renderRecipes(state.visibleRecipes);
    updateStatus();
  } catch (error) {
    renderError('Recipes could not be loaded. Start the Express server and check the API health endpoint.');
  } finally {
    setLoading(false);
  }
}

function updateStatus() {
  const count = state.visibleRecipes.length;
  elements.recipeCount.textContent = String(count || state.recipes.length || 0);
  const sourceLabel = state.source === 'mongodb' ? 'MongoDB' : 'local seed data';
  elements.statusText.textContent = `${count} recipe${count === 1 ? '' : 's'} shown · data source: ${sourceLabel}`;
}

function renderError(message) {
  const box = createElement('div', { className: 'error-state', text: message });
  elements.recipes.replaceChildren(box);
  elements.statusText.textContent = 'Unable to load recipes.';
}

function renderEmptyState() {
  const box = createElement('div', {
    className: 'empty-state',
    text: 'No recipes match the current filters. Try fewer ingredients or a higher calorie limit.',
  });
  elements.recipes.replaceChildren(box);
}

function renderRecipes(recipes) {
  if (!recipes.length) {
    renderEmptyState();
    return;
  }

  const fragment = document.createDocumentFragment();
  recipes.forEach((recipe) => fragment.appendChild(createRecipeCard(recipe)));
  elements.recipes.replaceChildren(fragment);
}

function createRecipeCard(recipe) {
  const card = createElement('button', {
    className: 'recipe-card',
    type: 'button',
    ariaLabel: `Open details for ${recipe.title}`,
  });

  const title = createElement('h3', { text: recipe.title });
  const metrics = createElement('div', { className: 'metric-row' });
  metrics.append(
    createElement('span', { className: 'metric', text: `${recipe.calories} kcal` }),
    createElement('span', { className: 'metric', text: `${recipe.prepTime + recipe.cookTime} min` }),
    createElement('span', { className: 'metric', text: `${recipe.servings} serving${recipe.servings === 1 ? '' : 's'}` }),
  );

  const tags = createElement('div', { className: 'tag-list' });
  recipe.tags.slice(0, 4).forEach((tag) => tags.appendChild(createElement('span', { className: 'tag', text: tag })));

  card.append(title, metrics, tags);

  if (typeof recipe.matchScore === 'number' && elements.ingredientInput.value.trim()) {
    const matchText = createElement('p', { text: `${recipe.matchScore}% ingredient match` });
    const meter = createElement('div', { className: 'match-meter' });
    const fill = createElement('span');
    fill.style.setProperty('--match-score', `${recipe.matchScore}%`);
    meter.appendChild(fill);
    card.append(matchText, meter);
  }

  card.addEventListener('click', () => openModal(recipe));
  return card;
}

function createList(items, formatter) {
  const list = createElement('ul');
  items.forEach((item) => {
    const entry = createElement('li', { text: formatter(item) });
    list.appendChild(entry);
  });
  return list;
}

function openModal(recipe) {
  const wrapper = createElement('div', { className: 'modal-content-grid' });
  const title = createElement('h2', { text: recipe.title });
  title.id = 'modalTitle';

  const metrics = createElement('div', { className: 'metric-row' });
  metrics.append(
    createElement('span', { className: 'metric', text: `${recipe.calories} kcal` }),
    createElement('span', { className: 'metric', text: `${recipe.prepTime} min prep` }),
    createElement('span', { className: 'metric', text: `${recipe.cookTime} min cook` }),
    createElement('span', { className: 'metric', text: `${recipe.servings} serving${recipe.servings === 1 ? '' : 's'}` }),
  );

  const tags = createElement('div', { className: 'tag-list' });
  recipe.tags.forEach((tag) => tags.appendChild(createElement('span', { className: 'tag', text: tag })));

  const ingredientsSection = createElement('section', { className: 'modal-section' });
  ingredientsSection.append(
    createElement('h3', { text: 'Ingredients' }),
    createList(recipe.ingredients, (ingredient) => `${ingredient.quantity} ${ingredient.unit} ${ingredient.name}`),
  );

  const stepsSection = createElement('section', { className: 'modal-section' });
  stepsSection.append(
    createElement('h3', { text: 'Preparation steps' }),
    createList(recipe.preparationSteps, (step) => `${step.number}. ${step.description}`),
  );

  wrapper.append(title, metrics, tags, ingredientsSection, stepsSection);

  if (typeof recipe.matchScore === 'number' && elements.ingredientInput.value.trim()) {
    const matchSection = createElement('section', { className: 'modal-section' });
    matchSection.appendChild(createElement('h3', { text: `Ingredient match: ${recipe.matchScore}%` }));
    const matched = recipe.matchedIngredients?.length ? recipe.matchedIngredients.join(', ') : 'None yet';
    const missing = recipe.missingIngredients?.length ? recipe.missingIngredients.join(', ') : 'None';
    matchSection.append(
      createElement('p', { text: `Matched: ${matched}` }),
      createElement('p', { text: `Missing: ${missing}` }),
    );
    wrapper.appendChild(matchSection);
  }

  elements.modalContent.replaceChildren(wrapper);
  elements.modal.classList.add('active');
}

function closeModal() {
  elements.modal.classList.remove('active');
}

function clearFilters() {
  elements.searchInput.value = '';
  elements.tagFilter.value = '';
  elements.ingredientInput.value = '';
  elements.calorieRange.value = '1000';
  elements.calorieLabel.textContent = '1000';
  loadRecipes();
}

function applyThemeFromStorage() {
  const savedTheme = localStorage.getItem('recipeMatchTheme');
  const isDark = savedTheme === 'dark';
  document.body.classList.toggle('dark', isDark);
  elements.toggleTheme.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('recipeMatchTheme', isDark ? 'dark' : 'light');
  elements.toggleTheme.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
}

function debounce(callback, delay = 250) {
  let timeoutId;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), delay);
  };
}

const debouncedLoadRecipes = debounce(loadRecipes, 250);

elements.searchInput.addEventListener('input', debouncedLoadRecipes);
elements.ingredientInput.addEventListener('input', debouncedLoadRecipes);
elements.tagFilter.addEventListener('change', loadRecipes);
elements.calorieRange.addEventListener('input', () => {
  elements.calorieLabel.textContent = elements.calorieRange.value;
  debouncedLoadRecipes();
});
elements.clearFilters.addEventListener('click', clearFilters);
elements.toggleTheme.addEventListener('click', toggleTheme);
elements.closeModal.addEventListener('click', closeModal);
elements.modal.addEventListener('click', (event) => {
  if (event.target === elements.modal) closeModal();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeModal();
});

applyThemeFromStorage();
loadTags().catch(() => {
  elements.statusText.textContent = 'Tags could not be loaded, but recipes may still work.';
});
loadRecipes();
