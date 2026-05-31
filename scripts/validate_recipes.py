#!/usr/bin/env python3
"""Validate RecipeMatch XML data against the RelaxNG schema."""

from __future__ import annotations

import argparse
from pathlib import Path
from lxml import etree


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate RecipeMatch XML data.")
    parser.add_argument("--xml", default="data/recipes.xml", help="Path to the recipes XML file")
    parser.add_argument("--schema", default="schemas/recipe.rng", help="Path to the RelaxNG schema")
    args = parser.parse_args()

    xml_path = Path(args.xml)
    schema_path = Path(args.schema)

    schema_doc = etree.parse(str(schema_path))
    relaxng = etree.RelaxNG(schema_doc)
    xml_doc = etree.parse(str(xml_path))

    if not relaxng.validate(xml_doc):
        print("Recipe XML is invalid.")
        for error in relaxng.error_log:
            print(f"Line {error.line}: {error.message}")
        raise SystemExit(1)

    recipe_count = len(xml_doc.xpath("//recipe"))
    print(f"Recipe XML is valid. Checked {recipe_count} recipes.")


if __name__ == "__main__":
    main()
