import re
import pandas as pd


class ZomatoAdvisor:

    def __init__(self, df):
        self.df = df.copy()

        self.df["City"] = self.df["City"].str.title()
        self.df["Cuisines"] = self.df["Cuisines"].str.title()


    # ---------------- INTENT PARSER ----------------
    def parse_query(self, query):

        q = query.lower()

        intent = {
            "city": None,
            "cuisine": None,
            "budget": None,
            "mode": None
        }

        # City
        for c in self.df["City"].unique():
            if c.lower() in q:
                intent["city"] = c
                break

        # Cuisine
        for cu in self.df["Cuisines"].unique():
            if cu.lower() in q:
                intent["cuisine"] = cu
                break

        # Budget
        num = re.findall(r"\d+", q)
        if num:
            intent["budget"] = int(num[0])

        elif "low budget" in q:
            intent["budget"] = 500

        elif "medium budget" in q:
            intent["budget"] = 1000

        elif "high budget" in q:
            intent["budget"] = 2000


        # Mode
        if intent["city"] and intent["cuisine"]:
            intent["mode"] = "both"

        elif intent["city"]:
            intent["mode"] = "city"

        elif intent["cuisine"]:
            intent["mode"] = "cuisine"

        elif intent["budget"]:
            intent["mode"] = "budget"

        else:
            intent["mode"] = "general"


        return intent


    # ---------------- RECOMMENDER ----------------
    def recommend(self, intent):

        df = self.df.copy()


        # Apply filters
        if intent["city"]:
            df = df[df["City"] == intent["city"]]

        if intent["cuisine"]:
            df = df[df["Cuisines"].str.contains(intent["cuisine"])]

        if intent["budget"]:
            df = df[
                df["Average Cost for two"] <= intent["budget"] * 1.3
            ]


        if len(df) == 0:
            return None, "No matching market found."


        # Business Score
        df["Score"] = (
            df["Votes"] * 0.4 +
            df["Aggregate rating"] * 120 -
            df["Average Cost for two"] * 0.25
        )


        df = df.sort_values("Score", ascending=False)


        return df.head(10), None


    # ---------------- EXPLANATION ----------------
    def explain(self, df, intent):

        top = df.iloc[0]

        msg = f"""
Recommended Plan:

City: {top['City']}
Cuisine: {top['Cuisines']}
Cost: ₹{int(top['Average Cost for two'])}
Rating: {round(top['Aggregate rating'],2)}
Votes: {top['Votes']}

Reason:
High popularity and good customer ratings
with manageable pricing in this area.
"""

        return msg
