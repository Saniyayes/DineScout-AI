import pandas as pd
import time
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix


def run():

    print("Running Demand Prediction Module")

    df = pd.read_csv("zomato.csv", encoding="latin1")

    def demand_label(v):
        if v < 50:
            return "Low"
        elif v < 200:
            return "Medium"
        else:
            return "High"

    df["Demand"] = df["Votes"].apply(demand_label)

    X = df[["Average Cost for two", "City", "Cuisines",
            "Has Online delivery", "Has Table booking"]]

    y = df["Demand"]

    X = X.fillna("Unknown")
    X = pd.get_dummies(X, drop_first=True)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.3, random_state=42
    )

    # Decision Tree
    start = time.time()
    dt = DecisionTreeClassifier(random_state=42)
    dt.fit(X_train, y_train)

    dt_pred = dt.predict(X_test)
    dt_acc = accuracy_score(y_test, dt_pred)

    # Naive Bayes
    nb = GaussianNB()
    nb.fit(X_train, y_train)

    nb_pred = nb.predict(X_test)
    nb_acc = accuracy_score(y_test, nb_pred)

    print("Decision Tree Accuracy:", dt_acc)
    print("Naive Bayes Accuracy:", nb_acc)

    # Pie Chart
    df["Demand"].value_counts().plot.pie(autopct="%1.1f%%")
    plt.title("Demand Distribution")
    plt.show()

    # Confusion Matrix
    sns.heatmap(confusion_matrix(y_test, dt_pred), annot=True, fmt="d")
    plt.title("Decision Tree CM")
    plt.show()

    print("Demand Module Completed")


if __name__ == "__main__":
    run()
