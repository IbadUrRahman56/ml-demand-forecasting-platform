# Sprint Plan — ML Demand Forecasting Platform
**Assigned:** June 29 | **Sprint window:** 9 working days (1.5 weeks) | **Strategy:** MVP-first, prioritized by grading weight

Full spec = 3–4 week project for a team. To hit 1.5 weeks solo, build a **thin-but-complete vertical slice**: real EDA, real trained models, real evaluation, a *minimal* API, and a *minimal* dashboard. Skip almost all "Bonus Features" unless days 8–9 are free.

---

## Day 1 — Setup + Dataset
- Init GitHub repo, folder structure (`/data`, `/notebooks`, `/api`, `/frontend`, `/models`)
- Find/generate a retail sales dataset (Kaggle: "Store Sales", "Retail Demand Forecasting", or similar) — CSV is enough, skip Excel/Mongo
- Basic FastAPI skeleton + Docker file (empty routes for now)
- Write initial README with problem statement

## Day 2–3 — Data Preprocessing & EDA (20%)
- Missing value handling, duplicate detection, outlier detection
- Feature encoding, scaling, normalization
- EDA notebook: correlation matrix, distributions, trend/seasonal patterns
- Save cleaned dataset + a few key plots (Matplotlib/Plotly) — this becomes your report's evidence

## Day 4–5 — Model Development (25%)
- Train 3–4 models: Linear Regression, Random Forest, XGBoost, (LightGBM if time)
- Skip exotic ones (Prophet/LSTM — these are listed as bonus)
- Simple train/test split + basic hyperparameter tuning (skip full Grid/Random Search — do a light version)

## Day 6 — Evaluation & Optimization (20%)
- Compute MAE, MSE, RMSE, R² for each model
- Feature importance chart
- Pick best model, justify with metrics
- One comparison table/chart across models

## Day 7 — Backend APIs (10%) — minimal viable
- Endpoints: `/upload`, `/train`, `/predict`, `/evaluate`
- Basic error handling + Swagger docs (FastAPI gives you this free)
- Skip JWT/roles unless you have spare time — note it as "future work" if cut

## Day 8 — Frontend Dashboard (10%) — minimal viable
- One-page React dashboard: upload button, forecast chart, metrics table
- No auth screens, no multi-page nav — just enough to demo it working end-to-end

## Day 9 — Docs, Polish, Report (10% + submission)
- README, API docs, sample dataset, trained model files, Postman collection
- Final report covering: problem statement → EDA → model selection → evaluation → forecasting results → challenges → future improvements
- Record a short demo / deploy link if possible (Render/Railway free tier)

---

## What to explicitly cut (call these "Future Work" in your report)
- Prophet/LSTM time-series, AutoML, SHAP dashboard, email reports, scheduled retraining, multi-dataset comparison, PDF/CSV export, CI/CD
- JWT auth + role-based access (mention as designed-but-not-implemented if pressed for time)
- MongoDB option — just use CSV/local storage or SQLite, don't set up Postgres/Mongo infra

## Daily discipline
- End each day with a commit + short README update — "Code Quality & Documentation" (10%) is graded continuously, not just at the end.
