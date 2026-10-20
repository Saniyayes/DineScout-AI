# DineScout-AI-Powered-Restaurant-Recommendation-Business-Analysis-System
DineScout is a full-stack web application that helps users find nearby restaurants and assists owners with AI-based market analysis. It features secure authentication with OTP, role-based dashboards, location-based search, and data-driven business insights using Node.js, MongoDB, and Python.
# 🍽️ DineScout – AI Powered Restaurant Recommendation & Business Analysis System

DineScout is a full-stack web application integrated with data analytics and machine learning to help users discover nearby restaurants and assist restaurant owners in making smart business decisions.

## 🎥 Project Demo

A complete walkthrough of the DineScout system, including registration, login, restaurant recommendation, and dashboard features.

▶️ Demo Video Link: 
[https://drive.google.com/file/d/1WFPiPuBNSPM01edQviuxBE8CSfXe3aab/view?usp=sharing](https://drive.google.com/file/d/1vEe-M2t3ln3KLBCqpF7N-azHyJ8MTk_V/view?usp=sharing)

---

## 📌 Features

### 👥 User Module
- **User Registration & Login with OTP Verification** & JWT Auth
- **Mood / Occasion-Based AI Search (NEW)**: Natural language vibe search (e.g., *"quiet place for a first date"*, *"budget bites with friends"*, *"candlelight dinner"*) with keyword & sentiment scoring.
- **AI Review Summarization (NEW)**: Synthesizes diner sentiment into structured Pros & Cons, sentiment ratios, and AI verdicts.
- **Value-for-Money Scoring System (NEW)**: Computes cost-to-rating efficiency scores (1.0 to 10.0) with dynamic badges (*Exceptional Value 💎*, *Great Value ⭐*, *Good Value 👍*).
- **Menu & Signature Dish Recommendations (NEW)**: Dish-level explorer recommending top-rated signature dishes across restaurants.
- **Location-Based Search & Filter**: Real-time proximity calculation and Google Maps navigation.

### 🏪 Owner Module & Business Consultant
- **Market Demand & Feasibility Analysis**: Aggregated city and cuisine analytics powered by Flask and Zomato intelligence.
- **Competitor Benchmarking (NEW)**: Compares owner pricing, ratings, and market positioning against direct local competitors with visual benchmark meters and gap analysis.
- **Review-to-Action Insights (NEW)**: Performs keyword frequency analysis over recurring customer feedback friction points to generate prioritized, high-impact business action items.
- **AI Business Advisor (NEW)**: Provides real-time dynamic competitor radars, review sentiment charts, revenue forecasting tools, and a unified Business Health Score to optimize strategy.
- **Data Visualization & Business Consultant Dashboard**: Role-based analytics in `owner-dashboard.html` and Streamlit analytics.

### 📊 Zomato Data Analysis & Machine Learning
- Cuisine Trend Analysis & Demand Prediction
- Price Prediction & Rating Analysis
- City Clustering & Market Segmentation Engine

---

## 🚀 API Endpoints Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/restaurants/mood-search` | Natural language mood & occasion search |
| `GET` | `/api/restaurants/:id/review-summary` | AI Pros/Cons review synthesis |
| `GET` | `/api/restaurants/dishes/recommendations` | Dish-level recommendation engine |
| `GET` | `/api/restaurants/search` | Location & cuisine search with value badges |
| `POST` | `/api/owner/competitor-benchmarking` | Owner vs local competitor benchmark analysis |
| `POST` | `/api/owner/review-action-insights` | Review keyword frequency & action recommendations |
| `POST` | `/api/owner/market-analysis` | Core market demand analysis |
| `GET` | `/api/advisor/competitors` | Fetches top competitors and provides AI actionable tips |
| `GET` | `/api/advisor/sentiment` | Generates a market-level sentiment analysis and review feedback |
| `POST` | `/api/advisor/predict` | Predicts monthly customers, revenue and break-even points |

---

## 🛠️ Technologies Used

### Frontend
- HTML5, CSS3 (Modern Glassmorphism & Responsive Grids), Vanilla JavaScript

### Backend
- Node.js, Express.js, MongoDB (Mongoose), JWT, Nodemailer

### Data Analytics & AI Engine
- Python, Flask (Port 7000), Streamlit (Port 8501), Pandas, NumPy, Scikit-learn, Matplotlib


