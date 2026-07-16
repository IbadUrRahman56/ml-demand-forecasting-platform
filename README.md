<div align="center">

# 📈 ML Demand Forecasting Platform

**An end-to-end machine learning platform that predicts retail product demand, surfaces sales insights, and serves forecasts through a REST API and interactive dashboard.**

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev/)
[![XGBoost](https://img.shields.io/badge/Model-XGBoost-brightgreen.svg)](https://xgboost.readthedocs.io/)
[![License](https://img.shields.io/badge/License-MIT-lightgrey.svg)](#license)

</div>

---

## Overview

Retail and e-commerce businesses lose money in both directions of a bad forecast — stockouts starve sales, overstocking ties up cash. This project builds a complete pipeline to address that: it ingests historical sales data, cleans and explores it, trains and compares multiple forecasting models, and exposes the best-performing model through both a REST API and a live dashboard.

**Final model performance:** XGBoost, **R² = 0.799**, MAE = 9.99 units — explaining ~80% of the variance in daily demand across 5 stores and 8 products.

---

## Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Results](#results)
- [Getting Started](#getting-started)
  - [Windows Setup](#windows-setup)
  - [macOS / Linux Setup](#macos--linux-setup)
- [Running the Notebooks](#running-the-notebooks)
- [API Reference](#api-reference)
- [Dashboard](#dashboard)
- [Testing](#testing)
- [Known Limitations](#known-limitations)
- [Future Work](#future-work)
- [License](#license)

---

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌───────────────────┐
│   Data Layer     │      │   ML Pipeline     │      │   Serving Layer    │
│                  │      │                   │      │                    │
│  sales_dataset   │ ───▶ │  Preprocessing    │ ───▶ │  FastAPI backend   │
│  .csv (36k rows) │      │  EDA              │      │  /predict          │
│                  │      │  Model training    │      │  /train            │
│                  │      │  (LR, RF, XGBoost)│      │  /evaluate         │
│                  │      │  Evaluation        │      │  /upload           │
└─────────────────┘      └──────────────────┘      └─────────┬──────────┘
                                                                │
                                                                ▼
                                                     ┌────────────────────┐
                                                     │  React Dashboard    │
                                                     │  (Vite + Recharts)  │
                                                     │  localhost:5173     │
                                                     └────────────────────┘
```

The notebooks are the **build-time** pipeline (run once to produce trained models). The API + dashboard are the **runtime** layer (used to actually get predictions day-to-day).

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python, FastAPI, Uvicorn |
| **Machine Learning** | scikit-learn, XGBoost, Pandas, NumPy |
| **Visualization** | Matplotlib, Seaborn, Recharts |
| **Frontend** | React 18, Vite |
| **Notebooks** | Jupyter |
| **Deployment** | Docker |
| **API Testing** | Postman |

---

## Project Structure

```
ml-demand-platform/
├── api/
│   ├── app/main.py              # FastAPI app — /upload, /train, /predict, /evaluate
│   └── requirements.txt
├── data/
│   ├── sales_dataset.csv        # raw synthetic dataset (36k+ rows)
│   ├── cleaned_sales_dataset.csv# cleaned + feature-engineered
│   └── generate_dataset.py      # dataset generator script
├── models/                      # trained model artifacts (.joblib)
├── notebooks/
│   ├── 01_data_preprocessing_eda.ipynb
│   ├── 02_model_development.ipynb
│   └── 03_evaluation_optimization.ipynb
├── frontend/
│   ├── src/App.jsx               # dashboard UI
│   └── src/index.css
├── docs/
│   ├── final_report.docx        # full written report
│   ├── postman_collection.json
│   └── *.png                    # EDA & evaluation charts
├── tests/
│   └── test_main.py
├── Dockerfile
└── requirements / package files
```

---

## Results

| Model | MAE | RMSE | R² |
|---|---|---|---|
| Linear Regression | 43.999 | 59.384 | 0.058 |
| Random Forest | 11.236 | 28.467 | 0.784 |
| **XGBoost (tuned)** | **9.999** | **27.449** | **0.799** |

XGBoost was selected as the final model — see `docs/final_report.docx` for the full evaluation, including residual analysis, feature importance, and per-segment error breakdown.

---

## Getting Started

### Prerequisites
- **Python 3.11+** — install from [python.org](https://www.python.org/downloads/) (not the Microsoft Store version on Windows — it causes PATH issues)
- **Node.js 18+** — install from [nodejs.org](https://nodejs.org/) (LTS version)
- **Git**

### Windows Setup

Open PowerShell in the project folder:

```powershell
# 1. Backend — create and activate a virtual environment
py -m venv venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1

# 2. Install backend dependencies
pip install --upgrade pip
pip install -r api/requirements.txt

# 3. Start the API
cd api
uvicorn app.main:app --reload
```

Leave that terminal running. Open **http://localhost:8000/docs** to confirm the API is live.

In a **second terminal**:
```powershell
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173** for the dashboard.

> **Note:** If your Python version is very new (3.13+), some pinned package versions in `requirements.txt` may not have prebuilt wheels yet. If `pip install` tries to compile a package from source and fails, relax the version pins (remove the `==x.x.x` and just use the package name) and reinstall.

### macOS / Linux Setup

```bash
# Backend
python3 -m venv venv
source venv/bin/activate
pip install -r api/requirements.txt
cd api && uvicorn app.main:app --reload

# Frontend (in a second terminal)
cd frontend
npm install
npm run dev
```

---

## Running the Notebooks

Install the **Jupyter extension** in VS Code, then open any notebook in `notebooks/` and click "Run All":

1. `01_data_preprocessing_eda.ipynb` — cleaning, missing values, outliers, EDA charts
2. `02_model_development.ipynb` — trains Linear Regression, Random Forest, XGBoost
3. `03_evaluation_optimization.ipynb` — cross-validation, residuals, tuning impact, final model selection

Each notebook saves its outputs (cleaned data, trained models, charts) to `data/`, `models/`, and `docs/` respectively, so later notebooks and the API depend on earlier ones having been run at least once. Pre-trained models are already included in `models/`, so this step is optional unless you want to retrain from scratch.

---

## API Reference

Base URL: `http://localhost:8000`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check — confirms API is running and whether a model is loaded |
| `POST` | `/upload` | Upload a new CSV dataset |
| `POST` | `/train` | Retrain the model on a given dataset, returns metrics |
| `POST` | `/predict` | Predict units sold for a store/product/date |
| `GET` | `/evaluate` | Returns the latest model's evaluation metrics |

**Example — predict:**
```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"store": "Store_1", "product": "Product_A", "date": "2025-08-01", "promo": 0}'
```
```json
{"store": "Store_1", "product": "Product_A", "date": "2025-08-01", "predicted_units_sold": 181.9}
```

Interactive Swagger docs (try-it-yourself UI) are available at `/docs` once the server is running. A ready-to-import Postman collection is at `docs/postman_collection.json`.

---

## Dashboard

The React dashboard (`frontend/`) is the runtime interface for using the trained model:

- **Query panel** — select store, product, target date, and promo status
- **Live prediction** — calls `/predict` and displays the forecasted units sold
- **10-day forecast chart** — visualizes the trend around the target date
- **Metrics cards** — live MAE / RMSE / R² pulled from `/evaluate`
- **CSV upload** — feed new datasets directly to the API
- **Connection status indicator** — shows whether the dashboard can reach the API

---

## Testing

```bash
cd api
pytest tests/
```

---

## Known Limitations

- Promo-day predictions carry more error than non-promo days — the model tends to under-predict promotional spikes
- No external features (holidays, weather, competitor pricing) are included
- A single global model is used across all stores/products; error varies by segment
- No authentication layer — not production-hardened

See `docs/final_report.docx` for the full discussion.

---

## Future Work

- Time-series-specific models (Prophet, LSTM)
- AutoML pipeline for broader hyperparameter search
- SHAP-based explainability dashboard
- Scheduled retraining and drift monitoring
- JWT authentication and role-based access control
- CI/CD pipeline and full containerized deployment
- Segment-specific models to close the per-store/product error gap



<div align="center">

**Built by Ibad Ur Rahman**

</div>
