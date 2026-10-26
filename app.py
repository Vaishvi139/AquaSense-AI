
from pathlib import Path
import json
import sqlite3
import csv
import io
import math
from datetime import datetime

import joblib
import pandas as pd
from flask import (
    Flask,
    Response,
    render_template,
    request,
    redirect,
    url_for,
)

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"
DATABASE_PATH = BASE_DIR / "prediction_history.db"

app = Flask(__name__)

# Trained model filenames
MODEL_FILES = {
    "Linear Regression": "linear_regression.joblib",
    "Random Forest": "random_forest_regression.joblib",
    "Gradient Boosting": "histgradientboostingregressor.joblib",
}

FEATURES = [
    "temperature",
    "turbidity",
    "tds",
    "conductivity",
    "dissolved_oxygen",
]

# Load trained models
models = {}

for display_name, filename in MODEL_FILES.items():
    model_path = MODEL_DIR / filename

    if model_path.exists():
        models[display_name] = joblib.load(model_path)

# Load model performance metrics

metrics_path = MODEL_DIR / "metrics.json"
metrics = []

if metrics_path.exists():
    with open(metrics_path, "r", encoding="utf-8") as file:
        loaded_metrics = json.load(file)

    if isinstance(loaded_metrics, list):
        metrics = loaded_metrics

    elif isinstance(loaded_metrics, dict):
        for model_name, values in loaded_metrics.items():
            if isinstance(values, dict):
                metrics.append({
                    "model": model_name,
                    "mae": values.get("mae"),
                    "rmse": values.get("rmse"),
                    "r2": values.get("r2"),
                    "feature_importance": values.get(
                        "feature_importance", {}
                    ),
                })

# Standardize model names for chart labels
model_aliases = {
    "Linear Regression": "Linear Regression",
    "linear_regression": "Linear Regression",
    "Random Forest": "Random Forest",
    "random_forest": "Random Forest",
    "Gradient Boosting": "HistGradientBoosting",
    "HistGradientBoosting": "HistGradientBoosting",
    "HistGradientBoostingRegressor": "HistGradientBoosting",
    "hist_gradient_boosting": "HistGradientBoosting",
}

for item in metrics:
    if isinstance(item, dict):
        name = item.get("model", item.get("name", ""))
        item["model"] = model_aliases.get(name, name)
                
# Load Random Forest feature importance
importance_path = MODEL_DIR / "feature_importance.json"
feature_importance = {}

if importance_path.exists():
    with open(importance_path, "r", encoding="utf-8") as file:
        feature_importance = json.load(file)


# Create the SQLite database and table
def initialize_database():
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS prediction_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                measurements TEXT NOT NULL,
                predictions TEXT NOT NULL
            )
            """
        )


# Save a successful prediction
def save_prediction(values, predictions):
    measurements = {
        feature: float(values[feature])
        for feature in FEATURES
    }

    timestamp = datetime.now().astimezone().strftime(
        "%d %b %Y, %I:%M %p"
    )

    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.execute(
            """
            INSERT INTO prediction_history
            (created_at, measurements, predictions)
            VALUES (?, ?, ?)
            """,
            (
                timestamp,
                json.dumps(measurements),
                json.dumps(predictions),
            ),
        )


# Get the latest 10 predictions
def get_prediction_history():
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.row_factory = sqlite3.Row

        rows = connection.execute(
            """
            SELECT id, created_at, measurements, predictions
            FROM prediction_history
            ORDER BY id DESC
            LIMIT 50
            """
        ).fetchall()

    history = []

    for row in rows:
        try:
            measurements = json.loads(row["measurements"])
            predictions = json.loads(row["predictions"])

            # Keep older or unexpected records from crashing the page.
            if not isinstance(measurements, dict):
                measurements = {}

            if isinstance(predictions, list):
                predictions = {
                    str(item.get("model", f"Model {index + 1}")):
                    item.get("ph", item.get("prediction", "N/A"))
                    for index, item in enumerate(predictions)
                    if isinstance(item, dict)
                }

            if not isinstance(predictions, dict):
                predictions = {}

            history.append(
                {
                    "id": row["id"],
                    "created_at": row["created_at"],
                    "measurements": measurements,
                    "predictions": predictions,
                }
            )
        except (ValueError, TypeError, json.JSONDecodeError):
            continue

    return history


# Initialize database
initialize_database()


@app.route("/", methods=["GET", "POST"])
def home():
    predictions = None
    error = None
    linear_model_details = None

    values = {
        "temperature": "25",
        "turbidity": "2.0",
        "tds": "250",
        "conductivity": "380",
        "dissolved_oxygen": "7.5",
    }

    if request.method == "POST":
        try:
            # Read and validate input values
            for feature in FEATURES:
                values[feature] = request.form.get(
                    feature, ""
                ).strip()

                if not values[feature]:
                    raise ValueError(
                        f"Please enter a value for "
                        f"{feature.replace('_', ' ')}."
                    )

            # Convert input values to numbers
            try:
                numbers = [
                    float(values[feature])
                    for feature in FEATURES
                ]
            except ValueError:
                raise ValueError(
                    "Please enter valid numbers in all fields."
                )

            if not all(math.isfinite(number) for number in numbers):
                raise ValueError(
                    "Please enter valid finite numbers."
                )

            if not models:
                raise RuntimeError(
                    "No trained models found. "
                    "Run python train_model.py first."
                )

            input_data = pd.DataFrame(
                [numbers],
                columns=FEATURES,
            )

            # Generate pH predictions
            predictions = {
                name: round(float(model.predict(input_data)[0]), 2)
                for name, model in models.items()
            }

            # Get Linear Regression equation details
            for model_name, model in models.items():
                if model_name == "Linear Regression":
                    if (
                        hasattr(model, "coef_")
                        and hasattr(model, "intercept_")
                    ):
                        linear_model_details = {
                            "intercept": float(model.intercept_),
                            "coefficients": [
                                {
                                    "feature": feature,
                                    "coefficient": float(coefficient),
                                }
                                for feature, coefficient in zip(
                                    FEATURES, model.coef_
                                )
                            ],
                        }
                    break

            # Save successful predictions
            save_prediction(values, predictions)

        except ValueError as exc:
            predictions = None
            error = str(exc)

        except Exception as exc:
            predictions = None
            error = f"Could not make prediction: {exc}"

    history = get_prediction_history()

    if request.args.get("history_hidden") == "1":
        history = []

    return render_template(
        "index.html",
        predictions=predictions,
        error=error,
        values=values,
        history=history,
        metrics=metrics,
        feature_importance=feature_importance,
        linear_model_details=linear_model_details,
    )
# Individual AquaSense AI pages

@app.route("/analyzer", methods=["GET", "POST"])
def analyzer():
    values = {
        "temperature": "25",
        "turbidity": "2.0",
        "tds": "250",
        "conductivity": "380",
        "dissolved_oxygen": "7.5",
    }

    predictions = None
    error = None

    if request.method == "POST":
        try:
            numbers = {}

            for feature in FEATURES:
                raw_value = request.form.get(feature, "").strip()

                if not raw_value:
                    raise ValueError(
                        f"Please enter a value for {feature.replace('_', ' ')}."
                    )

                number = float(raw_value)

                if not math.isfinite(number):
                    raise ValueError(
                        f"Please enter a valid number for {feature.replace('_', ' ')}."
                    )

                numbers[feature] = number
                values[feature] = raw_value

            if not models:
                raise RuntimeError(
                    "No trained models found. Run python train_model.py first."
                )

            input_data = pd.DataFrame([numbers], columns=FEATURES)

            predictions = {
                name: round(float(model.predict(input_data)[0]), 2)
                for name, model in models.items()
            }

            save_prediction(values, predictions)

        except ValueError as exc:
            error = str(exc)
        except Exception as exc:
            error = f"Could not make prediction: {exc}"

    return render_template(
        "analyzer.html",
        predictions=predictions,
        error=error,
        values=values,
        history=get_prediction_history(),
        metrics=metrics,
        feature_importance=feature_importance,
    )

@app.route("/insights")
def insights():
    history = get_prediction_history()
    latest = history[0] if history else None

    return render_template(
        "insights.html",
        latest=latest,
        history=history,
    )


@app.route("/predictions")
def prediction_results():
    history = get_prediction_history()
    latest = history[0] if history else None

    return render_template(
        "predictions.html",
        latest=latest,
        predictions=latest["predictions"] if latest else None,
        history=history,
    )


@app.route("/performance")
def model_performance():
    return render_template(
        "performance.html",
        metrics=metrics,
    )


@app.route("/feature-importance")
def feature_importance_page():
    return render_template(
        "feature_importance.html",
        feature_importance=feature_importance,
    )


@app.route("/history")
def prediction_history_page():
    return render_template(
        "history.html",
        history=get_prediction_history(),
    )


@app.route("/applications")
def applications():
    return render_template("applications.html")


# Clear saved prediction history
@app.route("/clear-history", methods=["POST"])
def clear_history():
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.execute("DELETE FROM prediction_history")
        connection.execute(
            "DELETE FROM sqlite_sequence WHERE name = 'prediction_history'"
        )

    return redirect(url_for("home"))


# Download the latest prediction as a CSV report
@app.route("/download-report", methods=["POST"])
def download_report():
    with sqlite3.connect(DATABASE_PATH) as connection:
        connection.row_factory = sqlite3.Row

        row = connection.execute(
            """
            SELECT created_at, measurements, predictions
            FROM prediction_history
            ORDER BY id DESC
            LIMIT 1
            """
        ).fetchone()

    if row is None:
        return redirect(url_for("home"))

    measurements = json.loads(row["measurements"])
    predictions = json.loads(row["predictions"])

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["AquaSense AI - Water Prediction Report"])
    writer.writerow(["Report date", row["created_at"]])
    writer.writerow([])
    writer.writerow(["Water Measurement", "Value"])

    for feature, value in measurements.items():
        writer.writerow([feature.replace("_", " ").title(), value])

    writer.writerow([])
    writer.writerow(["ML Model", "Predicted pH"])

    for model_name, ph in predictions.items():
        writer.writerow([model_name, ph])

    csv_content = "\ufeff" + output.getvalue()

    return Response(
        csv_content,
        mimetype="text/csv",
        headers={
            "Content-Disposition":
                "attachment; filename=aquasense_prediction_report.csv"
        },
    )


if __name__ == "__main__":
    app.run(debug=True)
