const express = require("express");
const router = express.Router();
const fs = require("fs");
const csv = require("csv-parser");

let data = [];

/* ================= LOAD CSV ================= */

fs.createReadStream("zomato.csv")
  .pipe(csv())
  .on("data", (row) => {
    data.push(row);
  })
  .on("end", () => {
    console.log("Zomato CSV Loaded ✅");
  });


/* ================= META API ================= */

router.get("/meta", (req, res) => {

  const cities = [
    ...new Set(data.map(d => d.City).filter(Boolean))
  ];

  const cuisinesSet = new Set();

  data.forEach(d => {
    if(d.Cuisines){
      d.Cuisines.split(",").forEach(c=>{
        cuisinesSet.add(c.trim());
      });
    }
  });

  res.json({
    cities: cities.sort(),
    cuisines: [...cuisinesSet].sort()
  });

});


/* ================= ANALYSIS API ================= */

router.post("/market-analysis", (req, res) => {

  try{

    const { city, cuisine } = req.body;

    const filtered = data.filter(d =>
      d.City === city &&
      d.Cuisines &&
      d.Cuisines.includes(cuisine)
    );


    if(filtered.length === 0){

      return res.json({
        avg_rating:0,
        avg_cost:0,
        avg_votes:0,
        total_restaurants:0,
        demand:"Low",
        recommendation:"No data available",
        top_city_cuisines:{},
        top_cuisine_cities:{},
        best_options:[],
        competition:"Low",
        profit:"Low",
        risk:"High",
        summary:"No sufficient market data found."
      });

    }


    /* ============ BASIC METRICS ============ */

    const total = filtered.length;

    const avg_rating = (
      filtered.reduce((a,b)=>a+Number(b["Aggregate rating"]||0),0)/total
    ).toFixed(2);

    const avg_cost = Math.round(
      filtered.reduce((a,b)=>a+Number(b["Average Cost for two"]||0),0)/total
    );

    const avg_votes = Math.round(
      filtered.reduce((a,b)=>a+Number(b["Votes"]||0),0)/total
    );


    /* ============ DEMAND ============ */

    let demand="Low";

    if(total>150) demand="High";
    else if(total>70) demand="Medium";


    /* ============ COMPETITION ============ */

    let competition="Low";

    if(total>1000) competition="Very High";
    else if(total>400) competition="High";
    else if(total>100) competition="Medium";


    /* ============ PROFIT ============ */

    let profit="Low";

    if(avg_rating>=4 && avg_votes>300) profit="High";
    else if(avg_rating>=3.5) profit="Medium";


    /* ============ RISK ============ */

    let risk="Medium";

    if(demand==="Low" || avg_rating<3) risk="High";
    else if(demand==="High" && avg_rating>4) risk="Low";


    /* ============ RECOMMENDATION ============ */

    let recommendation="";

    if(demand==="High" && avg_rating>=3.8)
      recommendation="Strong market. High profit opportunity.";

    else if(demand==="Medium")
      recommendation="Moderate competition. Focus on branding.";

    else
      recommendation="High risk. Consider alternate markets.";


    /* ============ TOP CUISINES IN CITY ============ */

    const cityData = data.filter(d=>d.City===city);

    const cuisineCount = {};

    cityData.forEach(d=>{
      if(d.Cuisines){
        d.Cuisines.split(",").forEach(c=>{
          c=c.trim();
          cuisineCount[c]=(cuisineCount[c]||0)+1;
        });
      }
    });

    const top_city_cuisines = Object.fromEntries(
      Object.entries(cuisineCount)
      .sort((a,b)=>b[1]-a[1])
      .slice(0,10)
    );


    /* ============ TOP CITIES FOR CUISINE ============ */

    const cuisineData = data.filter(
      d=>d.Cuisines && d.Cuisines.includes(cuisine)
    );

    const cityCount = {};

    cuisineData.forEach(d=>{
      cityCount[d.City]=(cityCount[d.City]||0)+1;
    });

    const top_cuisine_cities = Object.fromEntries(
      Object.entries(cityCount)
      .sort((a,b)=>b[1]-a[1])
      .slice(0,10)
    );


    /* ============ BUSINESS OPTIONS ============ */

    const best_options = [

      `Start ${cuisine} restaurant in ${city}`,

      `Open cloud kitchen for ${cuisine} in ${city}`

    ];


    /* ============ SUMMARY ============ */

    const summary = `
Market Intelligence Report

Location: ${city}
Cuisine: ${cuisine}

Demand Level: ${demand}
Competition: ${competition}
Profit Potential: ${profit}
Risk Level: ${risk}

Performance Metrics:
• Average Rating: ${avg_rating}
• Average Cost: ₹${avg_cost}
• Average Votes: ${avg_votes}
• Active Restaurants: ${total}

Business Insight:
The ${cuisine} market in ${city} shows ${demand.toLowerCase()} demand with
${competition.toLowerCase()} competition. Customer engagement and ratings
indicate ${profit.toLowerCase()} profitability.

Strategic Recommendation:
${recommendation}

Focus on quality service, digital marketing, and brand differentiation.
`;


    /* ============ RESPONSE ============ */

    res.json({

      avg_rating,
      avg_cost,
      avg_votes,
      total_restaurants: total,

      demand,
      competition,
      profit,
      risk,

      recommendation,

      top_city_cuisines,
      top_cuisine_cities,

      best_options,

      summary

    });


  }catch(err){

    console.log(err);

    res.status(500).json({
      msg:"Server error"
    });

  }

});

module.exports = router;
