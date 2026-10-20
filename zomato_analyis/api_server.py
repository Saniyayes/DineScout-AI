from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd

app = Flask(__name__)
CORS(app)


# ================= LOAD DATA =================

df = pd.read_csv("zomato.csv", encoding="latin1")


# Prepare cuisine list column once
df["Cuisine_List"] = df["Cuisines"].str.split(",")
df = df.explode("Cuisine_List")
df["Cuisine_List"] = df["Cuisine_List"].str.strip()


# ================= META API =================

@app.route("/meta", methods=["GET"])
def meta():
    city_group = df.groupby("City")["Aggregate rating"].mean().round(1)
    cities = [{"name": str(city), "rating": float(rating)} for city, rating in city_group.items()]
    cities = sorted(cities, key=lambda x: x["name"])

    cuisine_group = df.groupby("Cuisine_List")["Aggregate rating"].mean().round(1)
    cuisines = [{"name": str(cuisine), "rating": float(rating)} for cuisine, rating in cuisine_group.items()]
    cuisines = sorted(cuisines, key=lambda x: x["name"])

    return jsonify({
        "cities": cities,
        "cuisines": cuisines
    })


# ================= MARKET ANALYSIS =================

@app.route("/market-analysis", methods=["POST"])
def analyze():

    data = request.json

    city = data.get("city")
    cuisine = data.get("cuisine")


    # Filter data
    city_data = df[df["City"] == city]
    cuisine_data = df[df["Cuisine_List"] == cuisine]

    both = city_data[city_data["Cuisine_List"] == cuisine]


    # No data case
    if len(both) == 0:
        city_avg_rating = round(city_data["Aggregate rating"].mean(), 2) if not city_data["Aggregate rating"].empty else 0
        cuisine_avg_rating = round(cuisine_data["Aggregate rating"].mean(), 2) if not cuisine_data["Aggregate rating"].empty else 0
        
        # Predictive baseline (average of city and cuisine)
        predicted_rating = round((city_avg_rating + cuisine_avg_rating) / 2, 1) if city_avg_rating and cuisine_avg_rating else 3.5
        
        city_cost = int(city_data["Average Cost for two"].mean()) if not city_data.empty else 0
        cuisine_cost = int(cuisine_data["Average Cost for two"].mean()) if not cuisine_data.empty else 0
        predicted_cost = int((city_cost + cuisine_cost) / 2) if city_cost and cuisine_cost else 500

        return jsonify({

            "avg_rating": predicted_rating,
            "city_avg_rating": city_avg_rating,
            "cuisine_avg_rating": cuisine_avg_rating,
            "avg_cost": predicted_cost,
            "avg_votes": 20, # Baseline votes
            "total_restaurants": 0,

            "demand": "Untapped",
            "recommendation": "First-Mover Advantage! No direct competitors found.",

            "top_city_cuisines": {},
            "top_cuisine_cities": {},

            "best_options": [
                f"Be the first to open {cuisine} in {city}!"
            ]

        })


    # ================= BASIC METRICS =================

    avg_rating = round(both["Aggregate rating"].mean(), 2) if not both["Aggregate rating"].empty else 0
    city_avg_rating = round(city_data["Aggregate rating"].mean(), 2) if not city_data["Aggregate rating"].empty else 0
    cuisine_avg_rating = round(cuisine_data["Aggregate rating"].mean(), 2) if not cuisine_data["Aggregate rating"].empty else 0

    avg_cost = int(both["Average Cost for two"].mean()) if not both.empty else 0

    avg_votes = int(both["Votes"].mean()) if not both.empty else 0

    total = len(both)


    # ================= DEMAND =================

    if total > 150:
        demand = "High"
    elif total > 70:
        demand = "Medium"
    else:
        demand = "Low"


    # ================= RECOMMENDATION =================

    if demand == "High" and avg_rating >= 3.8:
        recommendation = "High profit potential. Strong market."
    elif demand == "Medium":
        recommendation = "Competitive market. Focus on quality."
    else:
        recommendation = "High risk. Try another area."


    # ================= TOP CUISINES IN CITY =================

    top_city_cuisines_series = city_data["Cuisine_List"].value_counts().head(10)
    top_city_cuisines = {}
    for c, count in top_city_cuisines_series.items():
        avg_rtg = city_data[city_data["Cuisine_List"] == c]["Aggregate rating"].mean()
        top_city_cuisines[c] = {"count": int(count), "rating": round(float(avg_rtg), 1)}


    # ================= TOP CITIES FOR CUISINE =================

    top_cuisine_cities_series = cuisine_data["City"].value_counts().head(10)
    top_cuisine_cities = {}
    for c, count in top_cuisine_cities_series.items():
        avg_rtg = cuisine_data[cuisine_data["City"] == c]["Aggregate rating"].mean()
        top_cuisine_cities[c] = {"count": int(count), "rating": round(float(avg_rtg), 1)}


    # ================= BEST BUSINESS OPTIONS =================

    best_option_1 = f"Start {cuisine} restaurant in {city}"

    if len(top_cuisine_cities) > 0:
        best_city = list(top_cuisine_cities.keys())[0]
        best_option_2 = f"Try {cuisine} in {best_city}"
    else:
        best_option_2 = "Explore new cities"


    # ================= RESPONSE =================

    return jsonify({

        "avg_rating": avg_rating,
        "city_avg_rating": city_avg_rating,
        "cuisine_avg_rating": cuisine_avg_rating,
        "avg_cost": avg_cost,
        "avg_votes": avg_votes,
        "total_restaurants": total,

        "demand": demand,
        "recommendation": recommendation,

        "top_city_cuisines": top_city_cuisines,
        "top_cuisine_cities": top_cuisine_cities,

        "best_options": [
            best_option_1,
            best_option_2
        ]

    })



# ================= RUN SERVER =================

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=7000,
        debug=True
    )
