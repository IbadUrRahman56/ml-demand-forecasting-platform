"""
FastAPI backend for the ML Demand Forecasting Platform.
"""
import os
import joblib
import pandas as pd
import numpy as np
import datetime
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from xgboost import XGBRegressor

app = FastAPI(
    title="ML Demand Forecasting Platform",
    description="Predicts product demand, detects trends/anomalies, and serves insights via REST API.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten before real deployment
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "data")
MODELS_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

FEATURES = ["store_encoded", "product_encoded", "price", "promo", "day_of_week", "month", "is_weekend"]
TARGET = "units_sold"

# ---------------------------------------------------------------------------
# Load model artifacts at startup (if they exist). Falls back gracefully if
# the models haven't been trained yet — /train can create them.
# ---------------------------------------------------------------------------
_state = {"model": None, "store_encoder": None, "product_encoder": None,
          "price_lookup": None, "metrics": None}


def _load_artifacts():
    try:
        _state["model"] = joblib.load(os.path.join(MODELS_DIR, "xgboost.joblib"))
        _state["store_encoder"] = joblib.load(os.path.join(MODELS_DIR, "store_encoder.joblib"))
        _state["product_encoder"] = joblib.load(os.path.join(MODELS_DIR, "product_encoder.joblib"))
        _state["price_lookup"] = joblib.load(os.path.join(MODELS_DIR, "price_lookup.joblib"))
    except Exception:
        pass  # not trained yet — /train will populate these


_load_artifacts()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class PredictRequest(BaseModel):
    store: str = Field(..., example="Store_1")
    product: str = Field(..., example="Product_A")
    date: datetime.date = Field(..., example="2025-08-01")
    promo: int = Field(0, ge=0, le=1, description="1 if a promotion is running that day")
    price: Optional[float] = Field(None, description="Defaults to the store/product's historical average price if omitted")


class PredictResponse(BaseModel):
    store: str
    product: str
    date: datetime.date
    predicted_units_sold: float


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "ML Demand Forecasting Platform API",
        "model_loaded": _state["model"] is not None,
    }


@app.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    """Accepts a CSV and saves it to the data directory."""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    dest = os.path.join(DATA_DIR, file.filename)
    with open(dest, "wb") as f:
        f.write(await file.read())

    df = pd.read_csv(dest)
    return {"filename": file.filename, "rows": len(df), "columns": list(df.columns)}


@app.post("/train")
def train_model(dataset_filename: str = "cleaned_sales_dataset.csv"):
    """
    Retrains XGBoost on the given dataset (must already be cleaned/feature-engineered,
    i.e. have gone through the Day 2-3 preprocessing pipeline) and overwrites the
    saved model + encoders.
    """
    dataset_path = os.path.join(DATA_DIR, dataset_filename)
    if not os.path.exists(dataset_path):
        raise HTTPException(status_code=404, detail=f"Dataset not found: {dataset_filename}")

    df = pd.read_csv(dataset_path, parse_dates=["date"])
    required_cols = {"store", "product", "price", "promo", "units_sold", "date"}
    missing = required_cols - set(df.columns)
    if missing:
        raise HTTPException(status_code=400, detail=f"Dataset missing required columns: {missing}")

    from sklearn.preprocessing import LabelEncoder
    le_store = LabelEncoder().fit(df["store"])
    le_product = LabelEncoder().fit(df["product"])
    df["store_encoded"] = le_store.transform(df["store"])
    df["product_encoded"] = le_product.transform(df["product"])
    df["day_of_week"] = df["date"].dt.dayofweek
    df["month"] = df["date"].dt.month
    df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)

    df = df.sort_values("date")
    cutoff = df["date"].quantile(0.85, interpolation="nearest")
    train_df, test_df = df[df["date"] <= cutoff], df[df["date"] > cutoff]

    X_train, y_train = train_df[FEATURES], train_df[TARGET]
    X_test, y_test = test_df[FEATURES], test_df[TARGET]

    model = XGBRegressor(
        n_estimators=200, max_depth=5, learning_rate=0.05, subsample=0.8,
        random_state=42, objective="reg:squarederror",
    )
    model.fit(X_train, y_train)
    preds = model.predict(X_test)

    metrics = {
        "MAE": round(float(mean_absolute_error(y_test, preds)), 3),
        "RMSE": round(float(np.sqrt(mean_squared_error(y_test, preds))), 3),
        "R2": round(float(r2_score(y_test, preds)), 3),
        "train_rows": len(train_df),
        "test_rows": len(test_df),
    }

    price_lookup = df.groupby(["store", "product"])["price"].mean().round(2).to_dict()

    joblib.dump(model, os.path.join(MODELS_DIR, "xgboost.joblib"))
    joblib.dump(le_store, os.path.join(MODELS_DIR, "store_encoder.joblib"))
    joblib.dump(le_product, os.path.join(MODELS_DIR, "product_encoder.joblib"))
    joblib.dump(price_lookup, os.path.join(MODELS_DIR, "price_lookup.joblib"))

    _state.update({
        "model": model, "store_encoder": le_store, "product_encoder": le_product,
        "price_lookup": price_lookup, "metrics": metrics,
    })

    return {"status": "trained", "metrics": metrics}


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    if _state["model"] is None:
        raise HTTPException(status_code=400, detail="No trained model available. Call /train first.")

    store_enc, product_enc = _state["store_encoder"], _state["product_encoder"]

    if req.store not in store_enc.classes_:
        raise HTTPException(status_code=400, detail=f"Unknown store '{req.store}'. Known: {list(store_enc.classes_)}")
    if req.product not in product_enc.classes_:
        raise HTTPException(status_code=400, detail=f"Unknown product '{req.product}'. Known: {list(product_enc.classes_)}")

    price = req.price
    if price is None:
        price = _state["price_lookup"].get((req.store, req.product))
        if price is None:
            raise HTTPException(status_code=400, detail="No historical price on file for this store/product; please supply `price`.")

    row = pd.DataFrame([{
        "store_encoded": store_enc.transform([req.store])[0],
        "product_encoded": product_enc.transform([req.product])[0],
        "price": price,
        "promo": req.promo,
        "day_of_week": req.date.weekday(),
        "month": req.date.month,
        "is_weekend": int(req.date.weekday() in (5, 6)),
    }])[FEATURES]

    pred = float(_state["model"].predict(row)[0])
    return PredictResponse(store=req.store, product=req.product, date=req.date,
                            predicted_units_sold=round(max(pred, 0), 1))


@app.get("/evaluate")
def evaluate():
    """Returns the metrics from the most recent /train call, or the metrics
    saved during the Day 6 evaluation notebook if the API hasn't retrained yet."""
    if _state["metrics"] is not None:
        return {"source": "latest /train call", "metrics": _state["metrics"]}

    fallback_path = os.path.join(BASE_DIR, "docs", "final_model_comparison.csv")
    if os.path.exists(fallback_path):
        df = pd.read_csv(fallback_path)
        return {"source": "docs/final_model_comparison.csv (Day 6 notebook)", "metrics": df.to_dict(orient="records")}

    raise HTTPException(status_code=404, detail="No evaluation metrics available yet. Call /train first.")
