#!/usr/bin/env python3
import glob
import subprocess
import xmltodict
from lxml import etree
from pymongo import MongoClient

# ─── CONFIGURATION ─────────────────────────────────────────────────────────────
# Schema conversion settings
RNC_SCHEMA = r'C:\Users\KISHORE KHAN\Downloads\RecipeMatchWeb_StarterKit\recipe.rnc'
RNG_SCHEMA = r'C:\Users\KISHORE KHAN\Downloads\RecipeMatchWeb_StarterKit\recipe.rng'
JAR_PATH   = r'C:\Users\KISHORE KHAN\Downloads\RecipeMatchWeb_StarterKit\trang.jar'  # Update with your jar file's full path

# XML and MongoDB settings
XML_FILES  = r'C:\Users\KISHORE KHAN\Downloads\RecipeMatchWeb_StarterKit/recipes.xml'
MONGO_URI  = r'mongodb://127.0.0.1:27017'
DB_NAME    = 'RecipeMatch'
COL_NAME   = 'recipes'

# ─── FUNCTIONS ─────────────────────────────────────────────────────────────────
def convert_rnc_to_rng(rnc_file, rng_file, jar_path):
    """
    Converts a RelaxNG Compact (.rnc) file to an XML-based (.rng) file using Jing-Trang.
    """
    print("[INFO] Converting .rnc schema to .rng schema...")
    try:
        result = subprocess.run(
            ["java", "-jar", jar_path, rnc_file, rng_file],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        print("Conversion successful:")
        print("STDOUT:", result.stdout)
        print("STDERR:", result.stderr)
    except subprocess.CalledProcessError as e:
        print("Error during conversion:")
        print("Return code:", e.returncode)
        print("STDOUT:", e.stdout)
        print("STDERR:", e.stderr)
        raise

def load_rng(schema_path):
    print(f"[DEBUG] Loading RNG schema from: {schema_path}")
    try:
        doc = etree.parse(schema_path)
    except Exception as e:
        print(f"[ERROR] Failed to parse RNG schema: {schema_path}")
        raise e
    print("[DEBUG] RNG schema loaded successfully.")
    return etree.RelaxNG(doc)

def connect_mongo(uri, db, coll):
    print(f"[DEBUG] Connecting to MongoDB at: {uri}, database: {db}, collection: {coll}")
    try:
        client = MongoClient(uri)
    except Exception as e:
        print("[ERROR] MongoDB connection failed.")
        raise e
    print("[DEBUG] MongoDB connection established.")
    return client[db][coll]

def normalize_list(maybe_list):
    """Ensure the value is always returned as a Python list."""
    if maybe_list is None:
        return []
    return maybe_list if isinstance(maybe_list, list) else [maybe_list]

def validate_recipe_element(recipe_elem, rng):
    # Wrap the recipe element in a temporary root element for validation.
    wrapper = etree.Element("recipes")
    wrapper.append(recipe_elem)
    temp_doc = etree.ElementTree(wrapper)
    return rng.validate(temp_doc)

def process_recipe(recipe_elem, rng, collection):
    # Validate this individual recipe element.
    if not validate_recipe_element(recipe_elem, rng):
        print("[WARN] Skipping a recipe due to validation errors:")
        for err in rng.error_log:
            print("   ", err)
        return False

    # Convert the validated recipe element to a dict.
    rec_xml_str = etree.tostring(recipe_elem)
    try:
        rec_dict = xmltodict.parse(rec_xml_str)['recipe']
    except Exception as e:
        print("[ERROR] Failed to convert recipe XML to dict.")
        print("Exception:", e)
        return False

    # Transform the dict into the desired JSON structure for MongoDB.
    try:
        title = rec_dict.get('title')
        rec_json = {
            "title":        title,
            "calories":     int(rec_dict.get('calories') or 0),
            "prepTime":     int(rec_dict.get('prepTime') or 0),
            "cookTime":     int(rec_dict.get('cookTime') or 0),
            "servings":     int(rec_dict.get('servings') or 0),
            "ingredients":  [],
            "preparationSteps": [],
            "tags":         []
        }

        # Process ingredients.
        ingr_list = normalize_list(rec_dict.get('ingredients', {}).get('ingredient'))
        for i in ingr_list:
            rec_json['ingredients'].append({
                "name":     i.get('name'),
                "quantity": float(i.get('quantity') or 0.0),
                "unit":     i.get('unit')
            })

        # Process preparation steps.
        steps = normalize_list(rec_dict.get('preparationSteps', {}).get('step'))
        for s in steps:
            number = s.get('@number') or s.get('number')
            rec_json['preparationSteps'].append({
                "number":     int(number),
                "description": s.get('#text') or s.get(None)
            })

        # Process tags.
        tag_list = normalize_list(rec_dict.get('tags', {}).get('tag'))
        rec_json['tags'] = tag_list

    except Exception as e:
        print(f"[ERROR] Error transforming recipe '{title}'.")
        print("Exception:", e)
        return False

    # Upsert into MongoDB.
    try:
        collection.update_one(
            {"title": rec_json['title']},
            {"$set": rec_json},
            upsert=True
        )
        print(f"[SUCCESS] → Imported: {rec_json['title']}")
    except Exception as e:
        print(f"[ERROR] Error upserting recipe '{rec_json['title']}'.")
        print("Exception:", e)
        return False
    return True

def main():
    # 1. Convert the .rnc file to .rng schema file.
    convert_rnc_to_rng(RNC_SCHEMA, RNG_SCHEMA, JAR_PATH)

    # 2. Load the newly created RNG schema.
    rng = load_rng(RNG_SCHEMA)

    # 3. Connect to MongoDB.
    collection = connect_mongo(MONGO_URI, DB_NAME, COL_NAME)

    # 4. Find and process the XML file with recipes.
    files = glob.glob(XML_FILES)
    print(f"[DEBUG] Files found: {files}")

    for xml_path in files:
        print(f"[INFO] Processing file: {xml_path}")
        try:
            dom = etree.parse(xml_path)
        except Exception as e:
            print(f"[ERROR] Failed to parse XML file: {xml_path}")
            continue

        # Extract all <recipe> elements in the file.
        recipe_elements = dom.xpath("//recipe")
        print(f"[DEBUG] Found {len(recipe_elements)} recipe elements in {xml_path}")

        valid_count = 0
        for recipe_elem in recipe_elements:
            if process_recipe(recipe_elem, rng, collection):
                valid_count += 1

        print(f"[INFO] Processed {valid_count} valid recipes from {xml_path}")

    print("[INFO] All done.")

if __name__ == '__main__':
    main()
