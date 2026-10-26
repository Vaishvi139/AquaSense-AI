
document.addEventListener("DOMContentLoaded", function () {

    // 1. WATER QUALITY ANALYZER FORM
    const form = document.getElementById("waterAnalyzerForm");
    const predictButton = form
        ? form.querySelector(".btn-predict")
        : null;

    const inputs = document.querySelectorAll(
        '#waterAnalyzerForm input[name="temperature"], ' +
        '#waterAnalyzerForm input[name="turbidity"], ' +
        '#waterAnalyzerForm input[name="tds"], ' +
        '#waterAnalyzerForm input[name="conductivity"], ' +
        '#waterAnalyzerForm input[name="dissolved_oxygen"]'
    );

    // Loading feedback during analysis
    if (form && predictButton) {
        form.addEventListener("submit", function (event) {

            if (!form.checkValidity()) {
                event.preventDefault();
                form.reportValidity();
                return;
            }

            predictButton.disabled = true;
            predictButton.innerHTML =
                '<span class="loading-spinner"></span> Analyzing Water...';

            predictButton.classList.add("is-loading");
            predictButton.setAttribute("aria-busy", "true");
        });
    }

    // 2. INPUT HIGHLIGHTING AND VALIDATION
    inputs.forEach(function (input) {

        function updateInputStyle() {
            input.classList.toggle(
                "input-edited",
                input.value.trim() !== ""
            );

            if (input.value.trim() === "") {
                input.classList.remove("is-valid");
                input.classList.remove("is-invalid");
                return;
            }

            const isValid = input.checkValidity() &&
                Number.isFinite(Number(input.value));

            input.classList.toggle("is-valid", isValid);
            input.classList.toggle("is-invalid", !isValid);
        }

        input.addEventListener("input", updateInputStyle);

        input.addEventListener("blur", function () {
            if (input.value.trim() === "") {
                input.classList.remove("input-edited");
                input.classList.remove("is-valid");
                input.classList.remove("is-invalid");
            }
        });

        updateInputStyle();
    });

    // 3. ANIMATE PREDICTION CARDS
    const resultCards = document.querySelectorAll(".result-card");

    resultCards.forEach(function (card, index) {
        card.style.animationDelay = `${index * 120}ms`;
        card.classList.add("result-card-animated");
    });

    // 4. ANIMATE PERFORMANCE CARDS
    const metricCards = document.querySelectorAll(".metric-card");

    metricCards.forEach(function (card, index) {
        card.style.animationDelay = `${index * 100}ms`;
        card.classList.add("metric-card-animated");
    });

    // 5. SMOOTH SCROLLING
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {

        link.addEventListener("click", function (event) {
            const targetId = link.getAttribute("href");

            if (!targetId || targetId === "#") {
                return;
            }

            const target = document.querySelector(targetId);

            if (target) {
                event.preventDefault();

                target.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
        });
    });

    // 6. ACCESSIBILITY: REDUCED MOTION
    if (
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
        document.documentElement.classList.add("reduce-motion");
    }

    // 7. DASHBOARD INITIALIZATION
    console.log(
        "AquaSense AI dashboard JavaScript loaded successfully."
    );
});


/* ===== AQUASENSE AI: DARK / LIGHT MODE ===== */

(() => {
    const toggle = document.getElementById("themeToggle");

    if (!toggle) return;

    const root = document.documentElement;

    function applyTheme(theme) {
        const isDark = theme === "dark";

        root.setAttribute("data-theme", theme);
        toggle.textContent = isDark ? "☀️" : "🌙 ";
        toggle.setAttribute("aria-pressed", String(isDark));
        toggle.setAttribute(
            "aria-label",
            isDark ? "Switch to light mode" : "Switch to dark mode"
        );
    }

    let savedTheme = "light";

    try {
        savedTheme = localStorage.getItem("aquasense-theme") || "light";
    } catch (error) {
        // Continue using light mode if browser storage is unavailable.
    }

    applyTheme(savedTheme === "dark" ? "dark" : "light");

    toggle.addEventListener("click", () => {
        const currentTheme = root.getAttribute("data-theme") || "light";
        const nextTheme = currentTheme === "dark" ? "light" : "dark";

        applyTheme(nextTheme);

        try {
            localStorage.setItem("aquasense-theme", nextTheme);
        } catch (error) {
            // Theme still works for the current page if storage is unavailable.
        }

        // Update existing Chart.js charts if they expose their instances.
        if (window.Chart && Chart.instances) {
            Object.values(Chart.instances).forEach((chart) => {
                const color = nextTheme === "dark" ? "#d5e2f0" : "#52677e";
                const grid = nextTheme === "dark" ? "#34445a" : "#dce6f0";

                if (chart.options.plugins?.legend?.labels) {
                    chart.options.plugins.legend.labels.color = color;
                }

                ["x", "y"].forEach((axis) => {
                    if (chart.options.scales?.[axis]) {
                        chart.options.scales[axis].ticks = {
                            ...chart.options.scales[axis].ticks,
                            color
                        };

                        if (chart.options.scales[axis].grid) {
                            chart.options.scales[axis].grid.color = grid;
                        }

                        if (chart.options.scales[axis].title) {
                            chart.options.scales[axis].title.color = color;
                        }
                    }
                });

                chart.update("none");
            });
        }
    });
})();


/* =================================
   FEATURE 2: INTERACTIVE MODEL COMPARISON
================================= */

document.addEventListener("DOMContentLoaded", () => {
    const dataElement = document.getElementById("feature3-metrics-data");
    const metricSelect = document.getElementById("feature2MetricSelect");
    const canvas = document.getElementById("feature2ComparisonChart");
    const bestModelElement = document.getElementById("feature2BestModel");

    if (!dataElement || !metricSelect || !canvas || !bestModelElement) {
        return;
    }

    if (typeof Chart === "undefined") {
        bestModelElement.textContent =
            "Chart.js could not load. Check your internet connection.";
        return;
    }

    let metrics;

    try {
        metrics = JSON.parse(dataElement.textContent);
    } catch (error) {
        bestModelElement.textContent =
            "Could not read the model evaluation metrics.";
        console.error("Feature 2 metrics parsing error:", error);
        return;
    }

    if (!Array.isArray(metrics) || metrics.length === 0) {
        bestModelElement.textContent = "No model metrics are available.";
        return;
    }

    const metricDetails = {
        mae: {
            label: "Mean Absolute Error (MAE)",
            better: "lower",
            format: value => value.toFixed(4)
        },
        rmse: {
            label: "Root Mean Squared Error (RMSE)",
            better: "lower",
            format: value => value.toFixed(4)
        },
        r2: {
            label: "R² Score",
            better: "higher",
            format: value => value.toFixed(4)
        }
    };

    const labels = metrics.map(item => item.model);

    const chart = new Chart(canvas, {
        type: "bar",
        data: {
            labels,
           
datasets: [{
    label: "Model score",
    data: [],
    backgroundColor: [],
    borderColor: [],
    borderWidth: 1,
    borderRadius: 8,
    borderSkipped: false,
    categoryPercentage: 1.0,
    barPercentage: 1.0,
    maxBarThickness: Infinity
}]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 350
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: context => {
                            const value = Number(context.raw);
                            return Number.isFinite(value)
                                ? `Score: ${value.toFixed(4)}`
                                : "Score unavailable";
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Metric score"
                    }
                },      
x: {
    offset: true,
    grid: {
        display: false
    },
    ticks: {
        autoSkip: false,
        maxRotation: 25,
        minRotation: 0
    }
}
            }
        }
    });

    function updateComparison() {
        const key = metricSelect.value;
        const details = metricDetails[key];

        if (!details) return;

        const validMetrics = metrics.filter(item =>
            Number.isFinite(Number(item[key]))
        );

        if (validMetrics.length === 0) {
            bestModelElement.textContent =
                "No valid values are available for this metric.";
            return;
        }

        const best = validMetrics.reduce((currentBest, item) => {
            const currentValue = Number(item[key]);
            const bestValue = Number(currentBest[key]);

            return details.better === "lower"
                ? (currentValue < bestValue ? item : currentBest)
                : (currentValue > bestValue ? item : currentBest);
        });

        const bestValue = Number(best[key]);

        chart.data.labels = metrics.map(item => item.model);
        chart.data.datasets[0].label = details.label;
        chart.data.datasets[0].data = metrics.map(item => {
            const value = Number(item[key]);
            return Number.isFinite(value) ? value : null;
        });

        
chart.data.datasets[0].backgroundColor = metrics.map(item => {
    const name = item.model.toLowerCase();

    if (name.includes("linear")) return "#14b8a6";
    if (name.includes("random forest")) return "#3b82f6";
    if (name.includes("histgradient") || name.includes("hist gradient"))
        return "#a855f7";

    return "#93c5fd";
});

chart.data.datasets[0].borderColor = chart.data.datasets[0].backgroundColor;

        chart.options.scales.y.beginAtZero = key !== "r2";
        chart.options.scales.y.title.text = details.label;
        chart.update();

        bestModelElement.textContent =
            `Best for ${details.label}: ${best.model} ` +
            `(${details.format(bestValue)}). ` +
            (key === "r2"
                ? "Higher R² is generally better."
                : "Lower error is better.");
    }

    metricSelect.addEventListener("change", updateComparison);
    updateComparison();
});


/* ==========================================
   FEATURE 3: PREDICTION HISTORY ANALYTICS
========================================== */

document.addEventListener("DOMContentLoaded", function () {
    const entries = Array.from(
        document.querySelectorAll("#history .history-entry")
    );

    const startInput = document.getElementById("historyStartDate");
    const endInput = document.getElementById("historyEndDate");
    const resetButton = document.getElementById("historyResetDates");
    const totalElement = document.getElementById("historyTotal");
    const averageElement = document.getElementById("historyAverage");
    const minimumElement = document.getElementById("historyMinimum");
    const maximumElement = document.getElementById("historyMaximum");
    const messageElement = document.getElementById("historyAnalyticsMessage");
    const canvas = document.getElementById("historyAnalyticsChart");

    if (
        !startInput || !endInput || !resetButton ||
        !totalElement || !averageElement || !minimumElement ||
        !maximumElement || !canvas
    ) {
        return;
    }

    // Convert saved dates into YYYY-MM-DD format.
    function getDate(entry) {
        const raw = (entry.dataset.created || "").trim();

        let match = raw.match(/\b\d{4}-\d{2}-\d{2}\b/);
        if (match) return match[0];

        match = raw.match(/\b(\d{2})[/-](\d{2})[/-](\d{4})\b/);
        if (match) {
            return `${match[3]}-${match[2]}-${match[1]}`;
        }

        const parsed = new Date(raw);

        if (!Number.isNaN(parsed.getTime())) {
            const year = parsed.getFullYear();
            const month = String(parsed.getMonth() + 1).padStart(2, "0");
            const day = String(parsed.getDate()).padStart(2, "0");

            return `${year}-${month}-${day}`;
        }

        return "";
    }

    // Read all model predictions from each saved history entry.
    function getPredictions(entry) {
        try {
            return JSON.parse(entry.dataset.predictions || "{}");
        } catch (error) {
            console.error("Could not read history predictions:", error);
            return {};
        }
    }

    const modelNames = [
        ...new Set(
            entries.flatMap(entry => Object.keys(getPredictions(entry)))
        )
    ];

    const colors = [
        "#14b8a6",
        "#3b82f6",
        "#a855f7"
    ];

    const datasets = modelNames.map((name, index) => ({
        label: name,
        data: [],
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length] + "22",
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        spanGaps: false
    }));

    let historyChart = null;

    if (typeof Chart !== "undefined") {
        historyChart = new Chart(canvas, {
            type: "line",
            data: {
                labels: [],
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: "index"
                },
                plugins: {
                    legend: {
                        display: true
                    }
                },
                scales: {
                    y: {
                        title: {
                            display: true,
                            text: "Predicted pH"
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: "Prediction date"
                        }
                    }
                }
            }
        });
    } else if (messageElement) {
        messageElement.textContent = "Chart.js could not load.";
    }

    function updateAnalytics() {
        const start = startInput.value;
        const end = endInput.value;

        if (start && end && start > end) {
            if (messageElement) {
                messageElement.textContent =
                    "The start date must be on or before the end date.";
            }
            return;
        }

        const filtered = entries.filter(entry => {
            const date = getDate(entry);

            if (!date) return false;
            if (start && date < start) return false;
            if (end && date > end) return false;

            return true;
        });

        totalElement.textContent = filtered.length;

        const records = filtered.map(entry => ({
            date: getDate(entry),
            predictions: getPredictions(entry)
        })).sort((a, b) => a.date.localeCompare(b.date));

        // Use Linear Regression for summary cards to avoid counting
        // the same record three times.
        const summaryModel =
            modelNames.find(name => name.toLowerCase().includes("linear")) ||
            modelNames[0];

        const values = records
            .map(record => Number(record.predictions[summaryModel]))
            .filter(value => Number.isFinite(value));

        if (values.length) {
            const average = values.reduce((sum, value) => sum + value, 0)
                / values.length;

            averageElement.textContent = average.toFixed(2);
            minimumElement.textContent = Math.min(...values).toFixed(2);
            maximumElement.textContent = Math.max(...values).toFixed(2);
        } else {
            averageElement.textContent = "—";
            minimumElement.textContent = "—";
            maximumElement.textContent = "—";
        }

        if (historyChart) {
            historyChart.data.labels = records.map(record => record.date);

            historyChart.data.datasets.forEach(dataset => {
                dataset.data = records.map(record => {
                    const value = Number(record.predictions[dataset.label]);

                    return Number.isFinite(value) ? value : null;
                });
            });

            historyChart.update();
        }

        // Keep the dashboard clean by clearing the status message.
        if (messageElement) {
            messageElement.textContent = "";
        }
    }

    startInput.addEventListener("change", updateAnalytics);
    endInput.addEventListener("change", updateAnalytics);

    resetButton.addEventListener("click", function () {
        startInput.value = "";
        endInput.value = "";
        updateAnalytics();
    });

    updateAnalytics();
});


/* FEATURE 5: Feature Importance for all models */
(() => {
    const canvas = document.getElementById("featureImportanceChart");
    const selector = document.getElementById("importanceModelSelect");

    if (!canvas || !selector) return;

    if (typeof Chart === "undefined") {
        console.error("Chart.js is not loaded.");
        return;
    }

    let allImportance;

    try {
        allImportance = JSON.parse(canvas.dataset.importance || "{}");
    } catch (error) {
        console.error("Unable to read feature importance data:", error);
        return;
    }

    const modelNames = {
        linear_regression: "Linear Regression",
        random_forest_regression: "Random Forest",
        histgradientboostingregressor: "HistGradientBoosting"
    };

    const availableModels = Object.keys(allImportance)
        .filter(name => allImportance[name] &&
            Object.keys(allImportance[name]).length > 0);

    selector.querySelectorAll("option").forEach(option => {
        option.disabled = !availableModels.includes(option.value);
    });

    if (availableModels.length === 0) {
        console.warn("No feature importance scores were provided.");
        return;
    }

    if (!availableModels.includes(selector.value)) {
        selector.value = availableModels[0];
    }

    const chart = new Chart(canvas, {
        type: "bar",
        data: {
            labels: [],
            datasets: [{
                label: "Relative importance",
                data: [],
                borderWidth: 1,
                borderRadius: 5
            }]
        },
        options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: context =>
                            `Relative importance: ${(context.raw * 100).toFixed(2)}%`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: 1,
                    ticks: {
                        callback: value => `${(value * 100).toFixed(0)}%`
                    },
                    title: {
                        display: true,
                        text: "Relative importance"
                    }
                }
            }
        }
    });

    function updateChart() {
        const selectedModel = selector.value;
        const scores = allImportance[selectedModel] || {};

        chart.data.labels = Object.keys(scores).map(feature =>
            feature.replace(/_/g, " ")
                .replace(/\b\w/g, letter => letter.toUpperCase())
        );

        chart.data.datasets[0].data = Object.values(scores).map(Number);
        chart.data.datasets[0].label =
            `${modelNames[selectedModel] || selectedModel} importance`;

        chart.update();
    }

    selector.addEventListener("change", updateChart);
    updateChart();
})();
