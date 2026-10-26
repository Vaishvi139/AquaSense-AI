
from pathlib import Path
import json

import joblib
import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.inspection import permutation_importance
from sklearn.pipeline import make_pipeline
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import (
    RandomForestRegressor,
    HistGradientBoostingRegressor,
)
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "dataset" / "water_quality.csv"
MODEL_DIR = BASE_DIR / "models"

FEATURES = [
    "temperature",
    "turbidity",
    "tds",
    "conductivity",
    "dissolved_oxygen",
]

TARGET = "pH"


def main():
    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATA_PATH}"
        )

    data = pd.read_csv(DATA_PATH)

    required = FEATURES + [TARGET]
    missing = [
        column for column in required
        if column not in data.columns
    ]

    if missing:
        raise ValueError(
            f"Missing columns in CSV: {missing}"
        )

    # Convert required columns to numeric values
    for column in required:
        data[column] = pd.to_numeric(
            data[column],
            errors="coerce",
        )

    # Replace infinite values and remove rows without target pH
    data = data.replace([np.inf, -np.inf], np.nan)
    data = data.dropna(subset=[TARGET])

    if len(data) < 10:
        raise ValueError(
            "Please provide at least 10 valid data rows."
        )

    X = data[FEATURES]
    y = data[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.25,
        random_state=42,
    )

    # Define the three machine learning models
    models = {
        "linear_regression": make_pipeline(
            SimpleImputer(strategy="median"),
            LinearRegression(),
        ),

        "random_forest_regression": make_pipeline(
            SimpleImputer(strategy="median"),
            RandomForestRegressor(
                n_estimators=100,
                random_state=42,
            ),
        ),

        "histgradientboostingregressor": make_pipeline(
            SimpleImputer(strategy="median"),
            HistGradientBoostingRegressor(
                max_iter=100,
                random_state=42,
            ),
        ),
    }

    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    results = []

    # Train, evaluate, and save each model
    all_feature_importance = {}
    for name, model in models.items():
        model.fit(X_train, y_train)
              
        # FEATURE 5: Importance for all three models
        if name == "linear_regression":
            estimator = model.named_steps["linearregression"]
            raw_scores = abs(estimator.coef_)

        elif name == "random_forest_regression":
            estimator = model.named_steps["randomforestregressor"]
            raw_scores = estimator.feature_importances_

        elif name == "histgradientboostingregressor":
            result = permutation_importance(
                model,
                X_test,
                y_test,
                n_repeats=10,
                random_state=42,
                scoring="neg_mean_absolute_error",
            )
            raw_scores = result.importances_mean
            raw_scores = raw_scores.clip(min=0)

        else:
            raw_scores = None

        if raw_scores is not None:
            total = float(sum(raw_scores))

            if total > 0:
                normalized_scores = raw_scores / total
            else:
                normalized_scores = raw_scores

            all_feature_importance[name] = {
                feature: round(float(score), 4)
                for feature, score in zip(
                    FEATURES, normalized_scores
                )
            }

        predictions = model.predict(X_test)

        mae = mean_absolute_error(y_test, predictions)
        rmse = np.sqrt(
            mean_squared_error(y_test, predictions)
        )
        r2 = r2_score(y_test, predictions)

        model_path = MODEL_DIR / f"{name}.joblib"
        joblib.dump(model, model_path)

        results.append({
            "model": name,
            "mae": round(float(mae), 4),
            "rmse": round(float(rmse), 4),
            "r2": round(float(r2), 4),
        })

        print(f"\nModel: {name}")
        print(f"MAE:  {mae:.4f}")
        print(f"RMSE: {rmse:.4f}")
        print(f"R2:   {r2:.4f}")

    # Save model evaluation metrics
    metrics_path = MODEL_DIR / "metrics.json"

    with open(
        metrics_path,
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(results, file, indent=2)

        
    importance_path = MODEL_DIR / "feature_importance.json"

    with open(importance_path, "w", encoding="utf-8") as file:
        json.dump(all_feature_importance, file, indent=2)

    print("\nFeature importance saved for:")
    for model_name in all_feature_importance:
        print(f"- {model_name}")
        
    print("\nTraining completed successfully!")
    print(f"Saved models to: {MODEL_DIR}")
    print(f"Saved metrics to: {metrics_path}")


if __name__ == "__main__":
    main()
