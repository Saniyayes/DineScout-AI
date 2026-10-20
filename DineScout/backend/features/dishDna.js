/**
 * Dish DNA & Flavor Profile Matching Module
 */

const FLAVOR_DICTIONARY = {
  spicy: ["spicy", "chili", "chilli", "hot", "fiery", "peppery", "jalapeno", "schezwan", "masala", "pungent", "peri-peri", "tikka", "biryani", "curry", "arrabbiata"],
  creamy: ["creamy", "cheese", "cheesy", "butter", "milky", "makhani", "smooth", "rich", "alfredo", "paneer", "soup", "truffle"],
  tangy: ["tangy", "lemon", "sour", "citrus", "tamarind", "pickled", "zesty", "vinegar", "tomato"],
  smoky: ["smoky", "tandoori", "barbecue", "bbq", "grilled", "charred", "roasted", "smoked", "wood-fired"],
  sweet: ["sweet", "honey", "caramel", "chocolate", "sugary", "glazed", "dessert", "ice cream", "cake", "tiramisu", "matcha"],
  crispy: ["crispy", "crunchy", "fried", "golden", "crusted", "tempura", "wings", "fries"],
  savory: ["savory", "ramen", "nigiri", "sushi", "platter", "mains", "tasting", "roll"]
};

function extractFlavorTags(text = "") {
  const textLower = text.toLowerCase();
  const tags = new Set();

  for (const [flavor, keywords] of Object.entries(FLAVOR_DICTIONARY)) {
    if (keywords.some(kw => textLower.includes(kw))) {
      tags.add(flavor);
    }
  }

  if (tags.size === 0) tags.add("savory");
  return Array.from(tags);
}

function calculateFlavorOverlap(tags1 = [], tags2 = []) {
  if (!tags1 || !tags2 || tags1.length === 0 || tags2.length === 0) return 0;
  const set1 = new Set(tags1.map(t => t.toLowerCase()));
  const set2 = new Set(tags2.map(t => t.toLowerCase()));

  const intersection = [...set1].filter(x => set2.has(x)).length;
  const union = new Set([...set1, ...set2]).size;

  return Number((intersection / union).toFixed(2));
}

function generateDefaultDishes(cuisinesStr = "") {
  const c = (cuisinesStr || "").toLowerCase();
  const dishes = [];

  if (c.includes("italian") || c.includes("pizza") || c.includes("pasta")) {
    dishes.push(
      { name: "Wood-Fired Spicy Pepperoni Pizza", category: "Pizza", price: 550, rating: 4.6, flavorTags: ["spicy", "smoky", "crispy"], isSignature: true },
      { name: "Creamy Truffle Mushroom Alfredo", category: "Pasta", price: 480, rating: 4.5, flavorTags: ["creamy", "mild"], isSignature: true },
      { name: "Tangy Tomato Arrabbiata Pasta", category: "Pasta", price: 420, rating: 4.3, flavorTags: ["tangy", "spicy"] }
    );
  } else if (c.includes("indian") || c.includes("biryani") || c.includes("curry") || c.includes("mughlai")) {
    dishes.push(
      { name: "Fiery Special Chicken Biryani", category: "Biryani", price: 450, rating: 4.7, flavorTags: ["spicy", "smoky"], isSignature: true },
      { name: "Rich & Creamy Butter Chicken", category: "Curry", price: 520, rating: 4.8, flavorTags: ["creamy", "mild", "sweet"], isSignature: true },
      { name: "Smoky Tandoori Chicken Tikka", category: "Tandoor", price: 380, rating: 4.6, flavorTags: ["smoky", "spicy", "tangy"], isSignature: true }
    );
  } else if (c.includes("chinese") || c.includes("asian")) {
    dishes.push(
      { name: "Spicy Schezwan Dim Sum", category: "Dim Sum", price: 340, rating: 4.5, flavorTags: ["spicy", "tangy"], isSignature: true },
      { name: "Crispy Honey Chili Potatoes", category: "Starters", price: 290, rating: 4.4, flavorTags: ["crispy", "sweet", "spicy"], isSignature: true }
    );
  } else {
    dishes.push(
      { name: "Spicy Peri-Peri House Burger", category: "Burgers", price: 350, rating: 4.4, flavorTags: ["spicy", "crispy"], isSignature: true },
      { name: "Creamy Wild Mushroom Soup", category: "Soups", price: 280, rating: 4.3, flavorTags: ["creamy", "mild"] },
      { name: "Tangy Lemon Garlic Wings", category: "Starters", price: 320, rating: 4.5, flavorTags: ["tangy", "crispy"] }
    );
  }

  return dishes;
}

module.exports = {
  extractFlavorTags,
  calculateFlavorOverlap,
  generateDefaultDishes,
  FLAVOR_DICTIONARY
};
