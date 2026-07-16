"""
Generates a synthetic but realistic retail sales dataset for the
demand forecasting project. Includes trend, weekly + yearly seasonality,
promo effects, and injected anomalies (for the anomaly detection task).
"""
import numpy as np
import pandas as pd

np.random.seed(42)

START_DATE = "2023-01-01"
END_DATE = "2025-06-30"
STORES = [f"Store_{i}" for i in range(1, 6)]
PRODUCTS = [f"Product_{chr(65+i)}" for i in range(8)]  # Product_A ... Product_H

dates = pd.date_range(START_DATE, END_DATE, freq="D")
rows = []

for store in STORES:
    store_base = np.random.uniform(80, 150)  # base demand level per store
    for product in PRODUCTS:
        product_base = np.random.uniform(0.5, 2.0)  # product popularity multiplier
        price = round(np.random.uniform(5, 50), 2)

        for i, date in enumerate(dates):
            trend = i * 0.01  # slow upward trend over time
            weekly_season = 15 * np.sin(2 * np.pi * date.dayofweek / 7)
            yearly_season = 25 * np.sin(2 * np.pi * date.dayofyear / 365)
            promo = 1 if np.random.rand() < 0.08 else 0
            promo_effect = promo * np.random.uniform(20, 50)
            noise = np.random.normal(0, 8)

            sales = (store_base * product_base) + trend + weekly_season + yearly_season + promo_effect + noise
            sales = max(sales, 0)

            # Inject anomalies ~0.5% of the time (spikes or drops)
            if np.random.rand() < 0.005:
                sales *= np.random.choice([0.1, 3.5])  # sudden drop or spike

            rows.append({
                "date": date.strftime("%Y-%m-%d"),
                "store": store,
                "product": product,
                "price": price,
                "promo": promo,
                "units_sold": round(sales),
                "revenue": round(sales * price, 2),
            })

df = pd.DataFrame(rows)

# Inject some missing values and duplicates on purpose (mirrors real messy data,
# useful for the "Missing Value Detection" / "Duplicate Record Detection" features)
missing_idx = df.sample(frac=0.01, random_state=1).index
df.loc[missing_idx, "units_sold"] = np.nan

dupes = df.sample(frac=0.005, random_state=2)
df = pd.concat([df, dupes], ignore_index=True)

df.to_csv("data/sales_dataset.csv", index=False)
print(f"Generated {len(df):,} rows -> data/sales_dataset.csv")
print(df.head())
