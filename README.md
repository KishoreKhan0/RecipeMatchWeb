# RecipeMatch Web

RecipeMatch is a full-stack recipe discovery application built around a validated XML data pipeline. It combines a Python XML/RelaxNG import workflow, MongoDB persistence, an Express API, and a responsive vanilla JavaScript frontend with recipe search, dietary filters, calorie filtering, and ingredient-based matching.

## Highlights

- Validated recipe data pipeline using XML, RelaxNG schema validation, Python, and MongoDB upserts.
- Express API with health checks, tag discovery, recipe filtering, and ingredient-match ranking.
- Responsive frontend with search, tag filters, calorie range filtering, dark mode, recipe details modal, loading/error states, and safe DOM rendering.
- Local JSON fallback so the demo still works even when MongoDB is not running.
- Clean portfolio-ready repository structure with setup scripts, `.gitignore`, `.env.example`, and documented commands.

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

## Portfolio / CV Angle

This project is useful as a resume item because it is not only a static frontend. It demonstrates:

- full-stack API design with Express and MongoDB,
- structured data engineering using XML and RelaxNG validation,
- Python-based ETL/import workflow,
- frontend state management and responsive UI implementation,
- practical fallback/error handling for a smoother demo experience.

Suggested CV bullets:

```latex
\item{
\textbf{RecipeMatch Web -- Full-Stack Recipe Discovery \& XML Data Pipeline} \hfill \textit{2026} \\
- Built a full-stack recipe discovery app with an Express API, MongoDB persistence, responsive JavaScript frontend, search/filter controls, calorie filtering, dark mode, and ingredient-based recipe matching.

- Designed a validated XML data pipeline using RelaxNG schemas and Python import scripts to normalize recipe data, enforce schema consistency, create MongoDB indexes, and upsert structured recipe documents.

- Improved production readiness with API health checks, local JSON fallback data, clean repository structure, environment-based configuration, documented setup commands, and safe frontend DOM rendering.
}
```
