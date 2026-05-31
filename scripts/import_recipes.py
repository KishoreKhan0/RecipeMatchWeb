#!/usr/bin/env python3
"""Validate XML recipe data and import it into MongoDB.

Usage examples:
  python scripts/import_recipes.py --dry-run
  python scripts/import_recipes.py --mongo-uri mongodb://127.0.0.1:27017
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
from lxml import etree


def number(text: str | None, cast, default):
    try:
        return cast(text)
    except (TypeError, ValueError):
        return default


def parse_recipe(recipe_element: etree._Element) -> dict:
    ingredients = []
    for ingredient in recipe_element.xpath("./ingredients/ingredient"):
        ingredients.append(
            {
                "name": ingredient.findtext("name", default="Ingredient"),
                "quantity": number(ingredient.findtext("quantity"), float, 1.0),
                "unit": ingredient.findtext("unit", default="piece"),
            }
        )

    preparation_steps = []
    for step in recipe_element.xpath("./preparationSteps/step"):
        preparation_steps.append(
            {
                "number": number(step.get("number"), int, len(preparation_steps) + 1),
                "description": " ".join("".join(step.itertext()).split()),
            }
        )

    return {
        "title": recipe_element.findtext("title", default="Untitled Recipe"),
        "calories": number(recipe_element.findtext("calories"), int, 0),
        "prepTime": number(recipe_element.findtext("prepTime"), int, 0),
        "cookTime": number(recipe_element.findtext("cookTime"), int, 0),
        "servings": number(recipe_element.findtext("servings"), int, 1),
        "ingredients": ingredients,
        "preparationSteps": preparation_steps,
        "tags": [tag.text for tag in recipe_element.xpath("./tags/tag") if tag.text],
    }


def validate(xml_path: Path, schema_path: Path) -> etree._ElementTree:
    schema = etree.RelaxNG(etree.parse(str(schema_path)))
    document = etree.parse(str(xml_path))
    if not schema.validate(document):
        print("XML validation failed. Fix the data before importing.")
        for error in schema.error_log:
            print(f"Line {error.line}: {error.message}")
        raise SystemExit(1)
    return document


def main() -> None:
    parser = argparse.ArgumentParser(description="Import RecipeMatch XML data into MongoDB.")
    parser.add_argument("--xml", default="data/recipes.xml", help="Path to recipe XML")
    parser.add_argument("--schema", default="schemas/recipe.rng", help="Path to RelaxNG schema")
    parser.add_argument("--mongo-uri", default=os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017"))
    parser.add_argument("--db", default=os.getenv("DB_NAME", "RecipeMatch"))
    parser.add_argument("--collection", default=os.getenv("COLLECTION_NAME", "recipes"))
    parser.add_argument("--dry-run", action="store_true", help="Validate and parse without writing to MongoDB")
    args = parser.parse_args()

    document = validate(Path(args.xml), Path(args.schema))
    recipes = [parse_recipe(recipe) for recipe in document.xpath("//recipe")]

    if args.dry_run:
        print(f"Dry run successful. Parsed {len(recipes)} valid recipes.")
        return

    try:
        from pymongo import MongoClient, ASCENDING
    except ModuleNotFoundError as exc:
        raise SystemExit(
            "pymongo is not installed. Run `pip install -r requirements.txt` before importing to MongoDB."
        ) from exc

    client = MongoClient(args.mongo_uri, serverSelectionTimeoutMS=3000)
    client.admin.command("ping")
    collection = client[args.db][args.collection]

    collection.create_index([("title", ASCENDING)], unique=True)
    collection.create_index([("tags", ASCENDING)])
    collection.create_index([("calories", ASCENDING)])
    collection.create_index([("ingredients.name", ASCENDING)])

    for recipe in recipes:
        collection.update_one({"title": recipe["title"]}, {"$set": recipe}, upsert=True)

    print(f"Imported {len(recipes)} recipes into {args.db}.{args.collection}.")


if __name__ == "__main__":
    main()
