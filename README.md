# RecipeMatch Web

RecipeMatch is a full-stack recipe discovery application built around a validated XML data pipeline. It combines a Python XML/RelaxNG import workflow, MongoDB persistence, an Express API, and a responsive vanilla JavaScript frontend with recipe search, dietary filters, calorie filtering, and ingredient-based matching.


## Tech Stack

| Layer | Tools |
| --- | --- |
| Frontend | HTML, CSS, vanilla JavaScript |
| Backend | Node.js, Express |
| Database | MongoDB |
| Data pipeline | Python, lxml, pymongo |
| Data format/schema | XML, RelaxNG Compact, RelaxNG XML |

## Project Structure

```text
RecipeMatchWeb/
├── data/
│   ├── recipes.json          # JSON fallback/seed data used by the API
│   └── recipes.xml           # Schema-valid XML recipe dataset
├── public/
│   ├── app.js                # Frontend behavior
│   ├── index.html            # App shell
│   ├── styles.css            # Responsive styling
│   └── images/               # Project images/logo assets
├── schemas/
│   ├── recipe.rnc            # RelaxNG Compact schema
│   └── recipe.rng            # RelaxNG XML schema
├── scripts/
│   ├── import_recipes.py     # Validate XML and import into MongoDB
│   └── validate_recipes.py   # XML schema validation check
├── server.js                 # Express API and static server
├── package.json
├── requirements.txt
├── .env.example
└── .gitignore
```

## Setup

### 1. Install Node dependencies

```bash
npm install
```

### 2. Optional: create a Python virtual environment

Windows CMD:

```cmd
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

macOS/Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Validate the XML dataset

```bash
npm run validate:data
```

Expected output:

```text
Recipe XML is valid. Checked 161 recipes.
```

### 4. Run the web app

```bash
npm start
```

Open:

```text
http://localhost:3000
```

The app works immediately using `data/recipes.json`. If MongoDB is running and populated, the API automatically uses MongoDB instead.

## MongoDB Import

Start MongoDB locally, then run:

```bash
npm run import:recipes
```

The import script validates `data/recipes.xml`, creates useful indexes, and upserts recipes by title into the `RecipeMatch.recipes` collection.

To check the pipeline without writing to MongoDB:

```bash
python scripts/import_recipes.py --dry-run
```

Environment variables can be configured from `.env.example`:

```text
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017
DB_NAME=RecipeMatch
COLLECTION_NAME=recipes
MONGO_DISABLED=false
```

## API Endpoints

| Endpoint | Description |
| --- | --- |
| `GET /api/health` | Returns API status, data source, and recipe count. |
| `GET /api/tags` | Returns all available recipe tags. |
| `GET /api/recipes` | Returns recipes with optional filters. |
| `GET /api/match` | Returns recipes ranked by ingredient-match score. |

### Query Parameters

`/api/recipes` and `/api/match` support:

| Parameter | Example | Purpose |
| --- | --- | --- |
| `search` | `search=curry` | Search by title, tags, or ingredients. |
| `tag` | `tag=vegan` | Filter by exact tag. |
| `maxCalories` | `maxCalories=500` | Filter recipes below a calorie limit. |
| `ingredients` | `ingredients=rice,tofu,tomato` | Require or rank recipes by available ingredients. |

Example:

```text
/api/match?ingredients=rice,tofu,tomato&maxCalories=600
```

## Data Quality Notes

The XML dataset has been normalized so that every recipe includes:

- title
- calories
- prep time
- cook time
- servings
- at least one ingredient with name, quantity, and unit
- at least one numbered preparation step
- at least one tag

Dietary tags are also normalized to avoid obvious contradictions such as a recipe being marked vegan while containing meat, fish, egg, or dairy ingredients. The demo data has also been curated so recipe titles, ingredients, and preparation steps are more realistic for portfolio review.
